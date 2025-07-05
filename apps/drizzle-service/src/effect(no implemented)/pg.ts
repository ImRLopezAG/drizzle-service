import {
	type SQLWrapper,
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	inArray,
	ne,
	or,
} from 'drizzle-orm'
import { Effect } from 'effect'
import {
	createDatabaseError,
	createNotFoundError,
	createRepository,
	executeHooks,
	getTableName,
	handleError,
	handleOptionalErrorHook,
	tryEffect,
} from './index'
import type {
	BaseEntity,
	IdType,
	MutationOperations,
	MutationsBulkOperations,
	QueryOperations,
	QueryOpts,
	RelationType,
	Repository,
	RepositoryHooks,
	RepositoryMethods,
	RepositoryOptions,
	PostgresDb,
	PostgresQb,
	WithRelations,
} from './types'

export const createPostgresRepository = createRepository<PostgresDb>(
	(db, table, opts) => {
		type D = typeof db
		type T = typeof table
		type O = typeof opts
		const {
			caching,
			defaultLimit = 100,
			maxLimit = 1000,
			override,
			soft,
			id,
			...rest
		} = opts || {}
		const entityName = getTableName(table)

		function getIdField(): keyof typeof table {
			return (opts?.id as keyof typeof table) || ('id' as keyof typeof table)
		}

		function withPagination<Q extends PostgresQb, TResult>(
			q: Q,
			options?: QueryOpts<T, TResult>,
		) {
			const pageSize = Math.min(options?.limit || defaultLimit, maxLimit)
			const page = Math.max(0, (options?.page || 1) - 1)
			return q.limit(pageSize).offset(page * pageSize)
		}

		function withOrderBy<Q extends PostgresQb, TResult>(
			q: Q,
			orderBy: QueryOpts<T, TResult>['orderBy'],
		) {
			if (!orderBy) return q

			// Collect all ordering expressions
			const orderExpressions = Object.entries(orderBy)
				.filter(([_, direction]) => direction)
				.map(([field, direction]) => {
					const column = table[field as keyof T] as SQLWrapper
					return direction === 'asc' ? asc(column) : desc(column)
				})

			if (orderExpressions.length === 0) return q

			// Apply all ordering expressions at once using spread operator
			return q.orderBy(...orderExpressions) as Q
		}

		function withCursor<Q extends PostgresQb, TResult>(
			q: Q,
			cursor?: QueryOpts<T, TResult>['cursor'],
		) {
			if (!cursor) return q

			let query = q
			// Assuming createdAt exists on the table for cursor pagination
			// You might need to make this more generic
			query = query.where(gt(table.createdAt, cursor))
			return query
		}

		function withRelations<Q extends PostgresQb>(
			q: Q,
			relations: WithRelations[] = [],
		) {
			if (relations.length === 0) return q

			// biome-ignore lint/suspicious/noExplicitAny: Join operations change query type
			let query: any = q
			for (const { sql, type, table } of relations) {
				switch (type) {
					case 'left':
						query = query.leftJoin(table, sql)
						break
					case 'inner':
						query = query.innerJoin(table, sql)
						break
					case 'right':
						query = query.rightJoin(table, sql)
						break
				}
			}

			return query
		}

		function withCustom<Q extends PostgresQb, TResult>(
			q: Q,
			custom?: QueryOpts<T, TResult>['custom'],
		) {
			if (!custom) return q

			return q.where(custom)
		}

		function withSoftDeleted<Q extends PostgresQb>(q: Q, skip = false) {
			if (skip) {
				return q
			}
			if (soft) {
				return q.where(ne(table[soft.field] as SQLWrapper, soft.deletedValue))
			}
			return q
		}

		function withWorkspace<Q extends PostgresQb, TResult>(
			q: Q,
			workspace?: QueryOpts<T, TResult>['workspace'],
		) {
			if (!workspace) return q
			const { field, value } = workspace
			return q.where(
				eq(table[field as keyof T['$inferSelect']] as SQLWrapper, value),
			)
		}
		function withOpts<
			Q extends PostgresQb,
			TResult,
			TRels extends WithRelations[] = [],
		>(q: Q, opts: Omit<QueryOpts<T, TResult, TRels>, 'parse'>): Q {
			let query = withSoftDeleted(q, opts.withDeleted)

			query = withWorkspace(query, opts.workspace)
			if (opts.relations && opts.relations.length > 0) {
				query = withRelations(query, opts.relations)
			}

			query = withOrderBy(query, opts.orderBy)

			// Only apply pagination when explicitly requested
			if (opts.page !== undefined || opts.limit !== undefined) {
				query = withPagination(query, {
					page: opts.page || 1,
					limit: opts.limit || defaultLimit,
				})
			}

			if (opts.cursor) {
				query = withCursor(query, opts.cursor)
			}

			if (opts.custom) {
				query = withCustom(query, opts.custom)
			}

			return query
		}

		// ===============================
		// 🚀 REPOSITORY IMPLEMENTATION
		// ===============================

		// @ts-ignore
		const createBaseQuery = () => db.select().from(table).$dynamic()

		// ===============================
		// 🚀 QUERY OPERATIONS
		// ===============================

		const _queryOperations: QueryOperations<T, O> = {
			findAll: <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				opts: QueryOpts<T, TResult, TRels> = {} as QueryOpts<T, TResult, TRels>,
			) => {
				return handleError(
					tryEffect(async () => {
						const { parse, ...queryOpts } = opts
						const data = await withOpts(createBaseQuery(), queryOpts)

						if (parse) {
							return parse(
								opts.relations && opts.relations.length > 0
									? (data as RelationType<T, TRels>[])
									: (data as T['$inferSelect'][]),
							) as TResult
						}
						return data as TResult
					}),
				)
			},
			findById: <TResult = T['$inferSelect']>(id: IdType<T, O>) => {
				return handleError(
					Effect.gen(function* () {
						const query = withSoftDeleted(createBaseQuery())
						const idField = getIdField()
						const result = yield* tryEffect(async () => {
							const result = await query
								.where(eq(table[idField] as SQLWrapper, id))
								.limit(1)
							return result[0] as TResult | undefined
						})

						if (!result) {
							yield* createNotFoundError(entityName, id)
						}

						return result as TResult
					}),
				)
			},

			count: <TRels extends WithRelations[] = []>(
				criteria?: Partial<T['$inferSelect']>,
				opts: QueryOpts<T, number, TRels> = {} as QueryOpts<T, number, TRels>,
			) => {
				return handleError(
					tryEffect(async () => {
						//@ts-ignore
						let query = db.select({ count: count() }).from(table).$dynamic()

						// Apply opts but exclude ordering for count queries
						const { orderBy: _, ...countOpts } = opts

						query = withOpts(query, countOpts)
						if (criteria && Object.keys(criteria).length > 0) {
							const conditions = Object.entries(criteria).map(([key, value]) =>
								eq(table[key as keyof T['$inferSelect']] as SQLWrapper, value),
							)
							query = query.where(and(...conditions))
						}
						const [result] = await query.limit(1)
						if (!result) return 0

						return result.count || 0
					}),
				)
			},

			findBy: <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				criteria: Partial<T['$inferSelect']>,
				opts: QueryOpts<T, TResult, TRels> = {} as QueryOpts<T, TResult, TRels>,
			) => {
				return handleError(
					tryEffect(async () => {
						const conditions = Object.entries(criteria).map(([key, value]) =>
							eq(table[key as keyof T['$inferSelect']] as SQLWrapper, value),
						)
						const { parse, ...queryOpts } = opts
						let query = withOpts(createBaseQuery(), queryOpts)
						query = query.where(and(...conditions))
						const data = await query

						if (parse) {
							return parse(
								opts.relations && opts.relations.length > 0
									? (data as RelationType<T, TRels>[])
									: (data as T['$inferSelect'][]),
							) as TResult
						}

						return data as TResult
					}),
				)
			},

			findByMatching: <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				criteria: Partial<T['$inferSelect']>,
				opts: QueryOpts<T, TResult, TRels> = {} as QueryOpts<T, TResult, TRels>,
			) => {
				return tryEffect(async () => {
					const conditions = Object.entries(criteria).map(([key, value]) =>
						eq(table[key as keyof T['$inferSelect']] as SQLWrapper, value),
					)
					const { parse, ...queryOpts } = opts
					let query = createBaseQuery()
					query = withSoftDeleted(query)

					// Apply relations and other options if provided
					if (Object.keys(queryOpts).length > 0) {
						query = withOpts(query, queryOpts)
					}

					query = query.where(or(...conditions))
					const data = await query

					// Apply custom parse function if provided
					if (parse) {
						return parse(
							opts.relations && opts.relations.length > 0
								? (data as RelationType<T, TRels>[])
								: (data as T['$inferSelect'][]),
						) as TResult
					}

					return data as TResult
				})
			},

			findByField: <
				K extends keyof T['$inferSelect'],
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				field: K,
				value: T['$inferSelect'][K],
				opts?: QueryOpts<T, TResult, TRels>,
			) => {
				return tryEffect(async () => {
					let query = withOpts(createBaseQuery(), opts || {})

					query = query.where(eq(table[field] as SQLWrapper, value))
					const data = await query

					// Apply custom parse function if provided
					if (opts?.parse) {
						return opts.parse(
							opts.relations && opts.relations.length > 0
								? (data as RelationType<T, TRels>[])
								: (data as T['$inferSelect'][]),
						) as TResult
					}

					return data as TResult
				})
			},
		}

		// ===============================
		// 🚀 MUTATION OPERATIONS
		// ===============================

		const _mutationOperations: MutationOperations<T, O> = {
			create: (data: T['$inferInsert'], hooks?: RepositoryHooks<T>) => {
				return Effect.gen(function* () {
					const insertData = {
						...data,
						createdAt: new Date(),
						updatedAt: new Date(),
					}
					yield* executeHooks(hooks, insertData, 'before')

					const result = yield* tryEffect(async () => {
						const [result] = await db
							.insert(table)
							.values(insertData)
							.returning()
							.execute()
						return result
					})

					if (!result) {
						throw createDatabaseError(`Failed to create ${entityName}`, {
							code: 'SQL_FAILURE',
							query: db.insert(table).values(insertData).toSQL(),
						})
					}
					yield* executeHooks(hooks, result, 'after')

					return result
				}).pipe(
					Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
				)
			},

			update: (
				id: IdType<T, O>,
				data: Partial<Omit<T['$inferInsert'], 'id' | 'createdAt'>>,
				hooks?: RepositoryHooks<T>,
			) => {
				return Effect.gen(function* () {
					const idField = getIdField()
					const entity = _queryOperations.findById(id)

					if (!entity) {
						throw createNotFoundError(entityName, id)
					}

					const updateData = {
						...data,
						updatedAt: new Date(),
					}
					yield* executeHooks(hooks, updateData, 'before')

					const result = yield* tryEffect(async () => {
						const [result] = await db
							.update(table)
							.set(updateData)
							.where(eq(table[idField] as SQLWrapper, id))
							.returning()
							.execute()

						return result
					})

					if (!result) {
						throw createDatabaseError(`Failed to update ${entityName}`, {
							code: 'SQL_FAILURE',
							query: db
								.update(table)
								.set(updateData)
								.where(eq(table[idField] as SQLWrapper, id))
								.toSQL(),
						})
					}
					yield* executeHooks(hooks, result, 'after')
					return result
				}).pipe(
					Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
				)
			},

			delete: (id: IdType<T, O>, hooks?: RepositoryHooks<T>) => {
				return Effect.gen(function* () {
					const idField = getIdField()

					if (!soft)
						throw createDatabaseError(
							`Soft delete is not enabled for ${entityName}`,
						)

					const { field, deletedValue } = soft
					const entity = yield* _queryOperations.findById(id)
					if (!entity) {
						throw createNotFoundError(entityName, id)
					}

					yield* executeHooks(hooks, entity, 'before')
					const result = yield* tryEffect(async () => {
						const updated = await db
							.update(table)
							.set({ [field]: deletedValue, updatedAt: new Date() } as Record<
								string,
								unknown
							>)
							.where(eq(table[idField] as SQLWrapper, id))
							.returning()
							.execute()

						if (updated.length === 0) {
							throw new Error(`${entityName} with id ${id} not found`)
						}

						return updated[0] as T['$inferSelect']
					})

					yield* executeHooks(hooks, result, 'after')

					return {
						success: true,
						message: `${entityName} soft deleted successfully`,
					}
				}).pipe(
					Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
				)
			},

			hardDelete: (id: IdType<T, O>, hooks?: RepositoryHooks<T>) => {
				return Effect.gen(function* () {
					const idField = getIdField()
					const entity = yield* _queryOperations.findById(id)
					if (!entity) {
						throw createNotFoundError(entityName, id)
					}

					yield* executeHooks(hooks, entity, 'before')
					const result = yield* tryEffect(async () => {
						const [deleted] = await db
							.delete(table)
							.where(eq(table[idField] as SQLWrapper, id))
							.returning()
							.execute()

						return deleted
					})

					if (!result) {
						throw createNotFoundError(entityName, id)
					}
					yield* executeHooks(hooks, entity, 'after')

					return { success: true, message: `${entityName} permanently deleted` }
				}).pipe(
					Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
				)
			},
		}

		// ===============================
		// 🚀 BULK OPERATIONS
		// ===============================

		const _bulkOperations: MutationsBulkOperations<T, O> = {
			bulkCreate: (data: T['$inferInsert'][], hooks?: RepositoryHooks<T>) => {
				return Effect.gen(function* () {
					const insertData = data.map((item) => ({
						...item,
						createdAt: new Date(),
						updatedAt: new Date(),
					}))

					yield* executeHooks(hooks, insertData, 'before')

					const results = yield* tryEffect(async () => {
						const result = await db
							.insert(table)
							.values(insertData)
							.returning()
							.execute()
						return result
					})

					yield* executeHooks(hooks, results, 'after')
					return results
				}).pipe(
					Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
				)
			},

			bulkUpdate: (
				data: {
					id: IdType<T, O>
					changes: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>
				}[],
				hooks?: RepositoryHooks<T>,
			) => {
				return Effect.gen(function* () {
					yield* executeHooks(hooks, data, 'before')
					const result = yield* tryEffect(async () => {
						const idField = getIdField()
						const result = await db
							.update(table)
							.set(
								data.map(({ changes }) => ({
									...changes,
									updatedAt: new Date(),
								})),
							)
							.where(
								inArray(
									table[idField] as SQLWrapper,
									data.map((item) => item.id),
								),
							)
							.returning()
						return result
					})
          if (!result || result.length === 0) {
            throw createDatabaseError(`Failed to update ${entityName}`, {
              code: 'SQL_FAILURE',
              query: db
                .update(table)
                .set(data.map(({ changes }) => ({ ...changes, updatedAt: new Date() })))
                .where(
                  inArray(
                    table[getIdField()] as SQLWrapper,
                    data.map((item) => item.id),
                  ),
                )
                .toSQL(),
            })
          }
					yield* executeHooks(hooks, result, 'after')

					return result
				}).pipe(
					Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
				)
			},

			bulkDelete: (ids: IdType<T, O>[], hooks?: RepositoryHooks<T>) => {
				return Effect.gen(function* () {
					const idField = getIdField()

					if (!soft) throw createDatabaseError(
            `Soft delete is not enabled for ${entityName}`,
          )

          const { field, deletedValue } = soft
						const results = yield* tryEffect(async () => {
							const updated = await db
								.update(table)
								.set({ [field]: deletedValue, updatedAt: new Date() })
								.where(inArray(table[idField] as SQLWrapper, ids))
								.returning()
								.execute()

							return updated as T['$inferSelect'][]
						})

						if (hooks?.beforeAction) {
							for (const result of results) {
								yield* hooks.beforeAction(result)
							}
						}

						if (hooks?.afterAction) {
							for (const result of results) {
								yield* hooks.afterAction(result)
							}
						}

						return {
							success: true,
							message: `${results.length} ${entityName}(s) soft deleted`,
						}

				}).pipe(
					Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
				)
			},

			bulkHardDelete: (ids: IdType<T, O>[], hooks?: RepositoryHooks<T>) => {
				return Effect.gen(function* () {
					const idField = getIdField()
          yield* executeHooks(hooks, ids, 'before')
					const results = yield* tryEffect(async () => {
						const deleted = await db
							.delete(table)
							.where(inArray(table[idField] as SQLWrapper, ids))
							.returning()
							.execute()

						return deleted as T['$inferSelect'][]
					})

          yield* executeHooks(hooks, results, 'after')
					return {
						success: true,
						message: `${results.length} ${entityName}(s) permanently deleted`,
					}
				}).pipe(
					Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
				)
			},
		}

		const baseMethods: RepositoryMethods<T, O> = {
			..._queryOperations,
			..._mutationOperations,
			..._bulkOperations,
		}

		const baseRepository = {
			...baseMethods,
			...(override ? override(baseMethods) : {}),
		}

		const repository: Repository<T, D> = {
			...baseRepository,
			_: baseMethods,
			entityName: entityName,
			db,
			entity: table,
		}

		return {
			...repository,
			...rest,
		} as Repository<T, D> & O
	},
)

export function drizzleRepository<D extends PostgresDb>(
	db: D,
): <
	T extends BaseEntity,
	TExtensions extends Record<string, unknown> = Record<string, unknown>,
>(
	table: T,
	opts?: RepositoryOptions<T, TExtensions>,
) => Repository<T, D> & TExtensions {
	return <
		T extends BaseEntity,
		TExtensions extends Record<string, unknown> = Record<string, unknown>,
	>(
		table: T,
		opts?: RepositoryOptions<T, TExtensions>,
	) => createPostgresRepository(db, table, opts) as Repository<T, D> & TExtensions
}
