import {
	createRepository,
	errorHandler,
	getTableName,
	tryHandler,
} from '@/builder'
import type {
	BaseEntity,
	Handler,
	IdType,
	MutationOperations,
	MutationsBulkOperations,
	PaginationResult,
	QueryOperations,
	QueryOpts,
	RelationType,
	Repository,
	RepositoryHooks,
	RepositoryMethods,
	RepositoryOptions,
	SQLiteDb,
	SQLiteQb,
	WithRelations,
} from '@builder/types'
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

export const createSqliteRepository = createRepository<SQLiteDb>(
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

		function withPagination<Q extends SQLiteQb, TResult>(
			q: Q,
			options?: QueryOpts<T, TResult>,
		) {
			const pageSize = Math.min(options?.limit || defaultLimit, maxLimit)
			const page = Math.max(0, (options?.page || 1) - 1)
			return q.limit(pageSize).offset(page * pageSize)
		}

		function withOrderBy<Q extends SQLiteQb, TResult>(
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

		function withCursor<Q extends SQLiteQb, TResult>(
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

		function withRelations<Q extends SQLiteQb>(
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

		function withCustom<Q extends SQLiteQb, TResult>(
			q: Q,
			custom?: QueryOpts<T, TResult>['custom'],
		) {
			if (!custom) return q

			return q.where(custom)
		}

		function withSoftDeleted<Q extends SQLiteQb>(q: Q, skip = false) {
			if (skip) {
				return q
			}
			if (soft) {
				return q.where(ne(table[soft.field] as SQLWrapper, soft.deletedValue))
			}
			return q
		}
		function withWorkspace<Q extends SQLiteQb, TResult>(
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
			Q extends SQLiteQb,
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
			findAll: async <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				opts: QueryOpts<T, TResult, TRels> = {} as QueryOpts<T, TResult, TRels>,
			) => {
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
			},

			findById: async <TResult = T['$inferSelect']>(id: IdType<T, O>) => {
				const query = withSoftDeleted(createBaseQuery())
				const idField = getIdField()
				const result = await query
					.where(eq(table[idField] as SQLWrapper, id))
					.limit(1)
				return (result[0] || null) as TResult | null
			},

			findWithCursor: async <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				opts: QueryOpts<T, TResult, TRels> = {} as QueryOpts<T, TResult, TRels>,
			) => {
				const { parse, ...queryOpts } = opts
				let query = createBaseQuery()
				query = withOpts(query, queryOpts)
				// Create a new object without relations for count query
				let data = await query
				const { relations: _, ...countOpts } = queryOpts
				const totalCount = await baseMethods.count(
					undefined,
					countOpts as QueryOpts<T, number, []>,
				)

				// Apply custom parse function if provided
				if (parse) {
					data = parse(
						opts.relations && opts.relations.length > 0
							? (data as RelationType<T, TRels>[])
							: (data as T['$inferSelect'][]),
					) as unknown as typeof data
				}

				const pageSize = Math.min(opts.limit || defaultLimit, maxLimit)
				const page = Math.max(0, (opts.page || 1) - 1)

				return {
					items: data,
					nextCursor:
						data.length > 0 ? (data[data.length - 1]?.createdAt ?? null) : null,
					pagination: {
						page: page + 1,
						pageSize,
						total: totalCount,
						hasNext: (page + 1) * pageSize < totalCount,
						hasPrev: page > 0,
					},
				} as unknown as PaginationResult<
					TResult extends T['$inferSelect'][] ? T['$inferSelect'] : TResult
				>
			},

			count: async <TRels extends WithRelations[] = []>(
				criteria?: Partial<T['$inferSelect']>,
				opts: QueryOpts<T, number, TRels> = {} as QueryOpts<T, number, TRels>,
			) => {
				// @ts-ignore
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
			},

			findBy: async <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				criteria: Partial<T['$inferSelect']>,
				opts: QueryOpts<T, TResult, TRels> = {} as QueryOpts<T, TResult, TRels>,
			) => {
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
			},

			findByMatching: async <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				criteria: Partial<T['$inferSelect']>,
				opts: QueryOpts<T, TResult, TRels> = {} as QueryOpts<T, TResult, TRels>,
			) => {
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
			},

			findByField: async <
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
				let query = createBaseQuery()
				query = withSoftDeleted(query)

				// Apply relations and other options if provided
				if (opts && Object.keys(opts).length > 0) {
					query = withOpts(query, opts)
				}

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
			},
		}

		// ===============================
		// 🚀 MUTATION OPERATIONS
		// ===============================

		const _mutationOperations: MutationOperations<T, O> = {
			create: async (
				data: T['$inferInsert'],
				hooks?: RepositoryHooks<T>,
			): Handler<T['$inferSelect']> => {
				return await tryHandler(
					async () => {
						if (hooks?.beforeAction) await hooks.beforeAction(data)

						const [result] = await db
							.insert(table)
							.values({
								...data,
								createdAt: new Date(),
								updatedAt: new Date(),
							})
							.returning()

						const created = result as T['$inferSelect'] | null
						if (!created) throw new Error('Failed to create entity')

						if (hooks?.afterAction) await hooks.afterAction(created)

						return created
					},
					(error) => errorHandler(error),
				)
			},

			update: async (
				id: IdType<T, O>,
				data: Partial<Omit<T['$inferInsert'], 'id' | 'createdAt'>>,
				hooks?: RepositoryHooks<T>,
			): Handler<T['$inferSelect']> => {
				return await tryHandler(
					async () => {
						if (hooks?.beforeAction) await hooks.beforeAction(data)
						const prev = await baseMethods.findById(id)
						if (!prev) throw new Error(`Entity with id ${id} not found`)

						const idField = getIdField()
						const [result] = await db
							.update(table)
							.set({
								...data,
								updatedAt: new Date(),
							})
							.where(eq(table[idField] as SQLWrapper, id))
							.returning()

						const updated = result as T['$inferSelect'] | null
						if (!updated) throw new Error(`Entity with id ${id} not found`)

						if (hooks?.afterAction) await hooks.afterAction(updated)

						return updated
					},
					(error) => errorHandler(error),
				)
			},

			delete: async (id: IdType<T, O>, hooks?: RepositoryHooks<T>) => {
				const [error] = await tryHandler(async () => {
					const data = await baseMethods.findById(id)
					if (!data) throw new Error(`Entity with id ${id} not found`)

					if (!soft) {
						throw new Error(
							`Soft delete is not enabled for the entity: ${entityName}`,
						)
					}

					// Check if already soft deleted
					if (data[soft.field] === soft.deletedValue) {
						throw new Error(`Entity with id ${id} is already deleted`)
					}

					if (hooks?.beforeAction) await hooks.beforeAction(data)

					const idField = getIdField()
					const [result] = await db
						.update(table)
						.set({
							[soft.field]: soft.deletedValue,
							updatedAt: new Date(),
						} as Partial<T['$inferInsert']>)
						.where(eq(table[idField] as SQLWrapper, id))
						.returning()

					if (!result)
						throw new Error(`Failed to soft delete entity with id ${id}`)

					if (hooks?.afterAction) await hooks.afterAction(data)

					return true
				})

				return {
					success: !error,
					message: error
						? error.message
						: `Entity with id ${id} successfully soft deleted`,
				}
			},

			hardDelete: async (id: IdType<T, O>, hooks?: RepositoryHooks<T>) => {
				const [error] = await tryHandler(async () => {
					const data = await baseMethods.findById(id)
					if (!data) throw new Error(`Entity with id ${id} not found`)

					if (hooks?.beforeAction) await hooks.beforeAction(data)
					const idField = getIdField()
					await db.delete(table).where(eq(table[idField] as SQLWrapper, id))
					if (hooks?.afterAction) await hooks.afterAction(data)

					return true
				})

				return {
					success: !error,
					message: error
						? error.message
						: `Entity with id ${id} successfully hard deleted`,
				}
			},
		}

		// ===============================
		// 🚀 BULK OPERATIONS
		// ===============================

		const _bulkOperations: MutationsBulkOperations<T, O> = {
			bulkCreate: async (
				data: T['$inferInsert'][],
				hooks?: RepositoryHooks<T> | undefined,
			): Handler<T['$inferSelect'][]> => {
				return await tryHandler(
					async () => {
						if (hooks?.beforeAction) await hooks.beforeAction(data)

						const result = await db.insert(table).values(data).returning()

						if (hooks?.afterAction) await hooks.afterAction(result)

						return result
					},
					(error) => errorHandler(error),
				)
			},
			bulkUpdate: async (
				data: {
					id: IdType<T, O>
					changes: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>
				}[],
				hooks?: RepositoryHooks<T> | undefined,
			): Handler<T['$inferSelect'][]> => {
				return await tryHandler(
					async () => {
						if (hooks?.beforeAction) await hooks.beforeAction(data)

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

						if (hooks?.afterAction) await hooks.afterAction(result)

						return result
					},
					(error) => errorHandler(error),
				)
			},
			bulkDelete: async (
				ids: IdType<T, O>[],
				hooks?: RepositoryHooks<T> | undefined,
			): Promise<{ readonly success: boolean; readonly message?: string }> => {
				const [error] = await tryHandler(async () => {
					const idField = getIdField()
					const data = await createBaseQuery().where(
						inArray(table[idField] as SQLWrapper, ids),
					)
					if (data.length === 0) {
						throw new Error(`Entities with ids ${ids.join(', ')} not found`)
					}

					if (!soft) {
						throw new Error(
							`Soft delete is not enabled for the entity: ${entityName}`,
						)
					}

					// Check if already soft deleted
					if (data.some((item) => item[soft.field] === soft.deletedValue)) {
						throw new Error(
							`Some entities with ids ${ids.join(', ')} are already deleted`,
						)
					}

					if (hooks?.beforeAction) await hooks.beforeAction(ids)

					const [result] = await db
						.update(table)
						.set({
							[soft.field]: soft.deletedValue,
							updatedAt: new Date(),
						} as Partial<T['$inferInsert']>)
						.where(inArray(table[idField] as SQLWrapper, ids))
						.returning()

					if (!result)
						throw new Error(
							`Failed to soft delete entities with ids ${ids.join(', ')}`,
						)

					if (hooks?.afterAction) await hooks.afterAction(ids)

					return true
				})

				return {
					success: !error,
					message: error
						? error.message
						: `Entities with ids ${ids.join(', ')} successfully soft deleted`,
				}
			},
			bulkHardDelete: async (
				ids: IdType<T, O>[],
				hooks?: RepositoryHooks<T> | undefined,
			): Promise<{ readonly success: boolean; readonly message?: string }> => {
				const [error] = await tryHandler(async () => {
					const idField = getIdField()
					const data = await createBaseQuery().where(
						inArray(table[idField] as SQLWrapper, ids),
					)
					if (data.length === 0) {
						throw new Error(`Entities with ids ${ids.join(', ')} not found`)
					}

					if (hooks?.beforeAction) await hooks.beforeAction(ids)

					await db
						.delete(table)
						.where(inArray(table[idField] as SQLWrapper, ids))

					if (hooks?.afterAction) await hooks.afterAction(ids)
					return true
				})
				return {
					success: !error,
					message: error
						? error.message
						: `Entities with ids ${ids.join(', ')} successfully hard deleted`,
				}
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
			entityName,
			db,
			entity: table,
		}

		return {
			...repository,
			...rest,
		} as Repository<T, D> & O
	},
)

export function drizzleRepository<D extends SQLiteDb>(
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
	) => createSqliteRepository(db, table, opts) as Repository<T, D> & TExtensions
}
