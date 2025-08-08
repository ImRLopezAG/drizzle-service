import { createFilters } from '@builder/filters'
import type {
	BulkOperationResult,
	CriteriaFilter,
	FilterCriteria,
	FindByQueryOpts,
	FindOneOpts,
	IdType,
	MutationOperations,
	MutationsBulkOperations,
	PaginationResult,
	PostgresDb,
	QueryOperations,
	QueryOpts,
	RelationType,
	Service,
	ServiceMethods,
	WithRelations,
} from '@builder/types'
import {
	and,
	count,
	eq,
	getTableName,
	ilike,
	inArray,
	or,
	type SQLWrapper,
} from 'drizzle-orm'
import type { IndexColumn } from 'drizzle-orm/pg-core'
import { Effect } from 'effect'
import { createService } from '@/builder'
import {
	createDatabaseError,
	createNotFoundError,
	executeHooks,
	handleError,
	handleOptionalErrorHook,
	tryEffect,
	tryHandleError,
} from '@/helpers'

export const createPostgresService = createService<PostgresDb>(
	(db, table, opts) => {
		type D = typeof db
		type T = typeof table
		type O = typeof opts

		const {
			defaultLimit = 100,
			maxLimit = 1000,
			batchSize = 100,
			override,
			soft,
			id,
			...rest
		} = opts || {}
		const entityName = getTableName(table)

		function getIdField(): keyof typeof table {
			return (id as keyof typeof table) || ('id' as keyof typeof table)
		}

		const {
			withOpts,
			parseFilterExpression,
			handleQueries,
			handleOneQuery,
			conditionsFromCriteria,
		} = createFilters<T, D>({
			table,
			db,
			handleILike: (column, value) => ilike(column, value),
			soft,
			defaultLimit,
			maxLimit,
		})

		// Helper function to convert Promise-based hooks to Effect-based hooks

		// Helper function to split array into batches
		function createBatches<T>(array: T[], batchSize: number): T[][] {
			const batches: T[][] = []
			for (let i = 0; i < array.length; i += batchSize) {
				batches.push(array.slice(i, i + batchSize))
			}
			return batches
		}

		// ===============================
		// 🚀 REPOSITORY IMPLEMENTATION
		// ===============================

		// @ts-ignore
		const createBaseQuery = () => db.select().from(table).$dynamic()

		// ===============================
		// 🚀 QUERY OPERATIONS
		// ===============================

		const _queryOperations: QueryOperations<T, D, O> = {
			find: <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				opts: QueryOpts<T, TResult, TRels> = {} as QueryOpts<T, TResult, TRels>,
			) => {
				return handleError(handleQueries(createBaseQuery(), opts))
			},
			findFirst: <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect']
					: RelationType<T, TRels>,
			>(
				opts = {},
			): Promise<TResult | null> => {
				return handleError(
					handleOneQuery(createBaseQuery(), opts, {
						beforeParse(q) {
							return q.limit(1)
						},
						afterParse(data) {
							const isArray = Array.isArray(data)
							if (isArray && data.length === 0) return null
							if (isArray) return (data as TResult[])[0] as TResult
							return data as TResult
						},
					}),
				)
			},
			findOne: <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect']
					: RelationType<T, TRels>,
			>(
				id: IdType<T, O>,
				opts: FindOneOpts<T, TResult, TRels> = {},
			) => {
				const hasRelations = opts.relations && opts.relations.length > 0
				return handleError(
					handleOneQuery(createBaseQuery(), opts, {
						beforeParse(q) {
							const query = q.where(eq(table[getIdField()] as SQLWrapper, id))
							if (hasRelations) return query
							return query.limit(1)
						},
						afterParse(data) {
							const isArray = Array.isArray(data)
							if (isArray && data.length === 0) return null
							if (hasRelations) return data as TResult
							if (isArray) return data[0] as TResult
							return data as TResult
						},
					}),
				)
			},

			findWithCursor: <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? PaginationResult<T['$inferSelect']>
					: RelationType<T, TRels>[],
			>(
				opts: QueryOpts<T, TResult, TRels>,
			) => {
				return handleError(
					Effect.gen(function* () {
						const { parse, ...queryOpts } = opts
						let data = yield* tryEffect(
							async () => await withOpts(createBaseQuery(), queryOpts),
						)
						// Create a new object without relations for count query
						const { relations: _, ...countOpts } = queryOpts
						const totalCount = yield* tryEffect(async () =>
							baseMethods.count(
								undefined,
								countOpts as QueryOpts<T, number, []>,
							),
						)

						// Apply custom parse function if provided
						if (parse) {
							data = parse(data) as unknown as typeof data
						}

						const pageSize = Math.min(opts.limit || defaultLimit, maxLimit)
						const page = Math.max(0, (opts.page || 1) - 1)

						return {
							items: data,
							nextCursor:
								data.length > 0
									? (data[data.length - 1]?.createdAt ?? null)
									: null,
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
				criteria: CriteriaFilter<T>,
				opts: FindByQueryOpts<T, TResult, TRels> = {} as FindByQueryOpts<
					T,
					TResult,
					TRels
				>,
			) => {
				const conditions = conditionsFromCriteria(
					criteria,
					opts.match || 'exact',
					opts.caseSensitive ?? false,
				)
				const { custom, ...restOpts } = opts
				if (custom) conditions.push(custom)
				return handleError(
					handleQueries<TResult, TRels>(createBaseQuery(), restOpts, {
						beforeParse(q) {
							return q.where(and(...conditions))
						},
					}),
				)
			},

			findByMatching: <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				criteria: CriteriaFilter<T>,
				opts: FindByQueryOpts<T, TResult, TRels> = {} as FindByQueryOpts<
					T,
					TResult,
					TRels
				>,
			) => {
				const conditions = conditionsFromCriteria(
					criteria,
					opts.match || 'contains',
					opts.caseSensitive ?? false,
				)

				const { custom, ...restOpts } = opts

				return handleError(
					handleQueries<TResult, TRels>(createBaseQuery(), restOpts, {
						beforeParse(q) {
							if (custom) return q.where(and(or(...conditions), custom))
							return q.where(or(...conditions))
						},
					}),
				)
			},
			search: <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				criteria: FilterCriteria<T>,
				opts: QueryOpts<T, TResult, TRels> = {} as QueryOpts<T, TResult, TRels>,
			) => {
				const filterConditions = Object.entries(criteria)
					.map(([field, filterExpr]) => {
						if (!filterExpr) return null
						return parseFilterExpression(
							field as keyof T['$inferSelect'],
							filterExpr,
						)
					})
					.filter(Boolean) as SQLWrapper[]

				return handleError(
					handleQueries<TResult, TRels>(createBaseQuery(), opts, {
						beforeParse(q) {
							if (filterConditions.length === 0) return q
							return q.where(and(...filterConditions))
						},
					}),
				)
			},
		}

		// ===============================
		// 🚀 MUTATION OPERATIONS
		// ===============================

		const _mutationOperations: MutationOperations<T, O> = {
			create: (data: T['$inferInsert'], hooks?) => {
				return tryHandleError(
					Effect.gen(function* () {
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
							return yield* createDatabaseError(
								`Failed to create ${entityName}`,
								{
									code: 'SQL_FAILURE',
									query: db.insert(table).values(insertData).toSQL(),
								},
							)
						}
						yield* executeHooks(hooks, result, 'after')

						return result
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},

			update: (
				id: IdType<T, O>,
				data: Partial<Omit<T['$inferInsert'], 'id' | 'createdAt'>>,
				hooks?,
			) => {
				return tryHandleError(
					Effect.gen(function* () {
						const idField = getIdField()
						const entity = yield* tryEffect(
							async () => await _queryOperations.findOne(id),
						)

						if (!entity) {
							return {
								success: false,
								message: `Entity with id ${id} not found`,
							}
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
								.where(hooks?.custom || eq(table[idField] as SQLWrapper, id))
								.returning()
								.execute()

							return result
						})

						if (!result) {
							return yield* createDatabaseError(
								`Failed to update ${entityName}`,
								{
									code: 'SQL_FAILURE',
									query: db
										.update(table)
										.set(updateData)
										.where(
											hooks?.custom || eq(table[idField] as SQLWrapper, id),
										)
										.toSQL(),
								},
							)
						}
						yield* executeHooks(hooks, result, 'after')
						return result
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},
			upsert(data, hooks) {
				return tryHandleError(
					Effect.gen(function* () {
						yield* executeHooks(hooks, data, 'before')

						const result = yield* tryEffect(async () => {
							const [result] = await db
								.insert(table)
								.values(data)
								.onConflictDoUpdate({
									target: table[getIdField()] as IndexColumn,
									set: data,
									setWhere: eq(
										table[getIdField()] as SQLWrapper,
										data[getIdField() as keyof T['$inferInsert']],
									),
								})
								.returning()
								.execute()

							return result
						})

						if (!result) {
							return yield* createDatabaseError(
								`Failed to upsert ${entityName}`,
								{
									code: 'SQL_FAILURE',
									query: db
										.insert(table)
										.values(data)
										.onConflictDoUpdate({
											target: table[getIdField()] as IndexColumn,
											set: data,
											setWhere:
												hooks?.custom ||
												eq(
													table[getIdField()] as SQLWrapper,
													data[getIdField() as keyof T['$inferInsert']],
												),
										})
										.toSQL(),
								},
							)
						}
						yield* executeHooks(hooks, result, 'after')
						return result
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},
			findOrCreate(data, hooks) {
				return tryHandleError(
					Effect.gen(function* () {
						yield* executeHooks(hooks, data, 'before')
						const existing = yield* tryEffect(
							async () =>
								await _queryOperations.findOne(
									data[getIdField() as keyof T['$inferInsert']],
								),
						)
						if (existing) {
							yield* executeHooks(hooks, existing, 'after')
							return existing
						}

						const result = yield* tryEffect(async () => {
							const [result] = await db
								.insert(table)
								.values(data)
								.returning()
								.execute()

							return result
						})

						if (!result) {
							return yield* createDatabaseError(
								`Failed to find or create ${entityName}`,
								{
									code: 'SQL_FAILURE',
									query: db.insert(table).values(data).toSQL(),
								},
							)
						}
						yield* executeHooks(hooks, result, 'after')
						return result
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},
			delete: (id: IdType<T, O>, hooks?) => {
				return handleError(
					Effect.gen(function* () {
						const idField = getIdField()

						if (!soft)
							return yield* createDatabaseError(
								`Soft delete is not enabled for ${entityName}`,
							)

						const { field, deletedValue } = soft
						const entity = yield* tryEffect(
							async () => await _queryOperations.findOne(id),
						)
						if (!entity) {
							return yield* createNotFoundError(entityName, id)
						}

						yield* executeHooks(hooks, entity, 'before')
						const result = yield* tryEffect(async () => {
							const updated = await db
								.update(table)
								.set({ [field]: deletedValue, updatedAt: new Date() } as Record<
									string,
									unknown
								>)
								.where(hooks?.custom || eq(table[idField] as SQLWrapper, id))
								.returning()
								.execute()

							if (updated.length === 0) {
								return new Error(
									`Failed to soft delete ${entityName} with id ${id}`,
								)
							}

							return updated[0] as T['$inferSelect']
						})

						yield* executeHooks(hooks, result, 'after')

						return {
							success: true,
							message: 'successfully soft deleted',
						}
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},

			hardDelete: (id: IdType<T, O>, hooks?) => {
				return handleError(
					Effect.gen(function* () {
						const idField = getIdField()
						const entity = yield* tryEffect(
							async () => await _queryOperations.findOne(id),
						)
						if (!entity) {
							return yield* createNotFoundError(entityName, id)
						}

						yield* executeHooks(hooks, entity, 'before')
						const result = yield* tryEffect(async () => {
							const [deleted] = await db
								.delete(table)
								.where(hooks?.custom || eq(table[idField] as SQLWrapper, id))
								.returning()
								.execute()

							return deleted
						})

						if (!result) {
							return yield* createNotFoundError(entityName, id)
						}
						yield* executeHooks(hooks, entity, 'after')

						return {
							success: true,
							message: `${entityName} permanently deleted`,
						}
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},

			restore: (id: IdType<T, O>, hooks?) => {
				return handleError(
					Effect.gen(function* () {
						if (!soft)
							return yield* createDatabaseError(
								'notDeletedValue is required for non-boolean, non-timestamp soft delete fields',
							)

						const data = yield* tryEffect(
							async () => await _queryOperations.findOne(id),
						)

						if (!data) {
							return {
								success: false,
								message: `Entity with id ${id} not found`,
							}
						}

						yield* executeHooks(hooks, data, 'before')

						const { field, deletedValue, notDeletedValue } = soft

						// Determine the restore value based on field type
						let restoreValue: unknown
						if (typeof deletedValue === 'boolean') {
							// For boolean fields, use opposite of deletedValue if notDeletedValue not specified
							restoreValue =
								notDeletedValue !== undefined ? notDeletedValue : !deletedValue
						} else if (deletedValue === 'NOT_NULL') {
							// For timestamp fields with special marker, use null or specified notDeletedValue
							restoreValue =
								notDeletedValue !== undefined ? notDeletedValue : null
						} else {
							// For other types, notDeletedValue is required
							if (notDeletedValue === undefined) {
								return yield* createDatabaseError(
									'notDeletedValue is required for non-boolean, non-timestamp soft delete fields',
								)
							}
							restoreValue = notDeletedValue
						}

						const idField = getIdField()
						yield* tryEffect(async () => {
							await db
								.update(table)
								.set({
									[field]: restoreValue,
									updatedAt: new Date(),
								} as Record<string, unknown>)
								.where(hooks?.custom || eq(table[idField] as SQLWrapper, id))
						})

						const restoredData = {
							...data,
							[field]: restoreValue,
						} as T['$inferSelect']

						yield* executeHooks(hooks, restoredData, 'after')

						return {
							success: true,
							message: `Entity with id ${id} successfully restored`,
						}
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},
		}

		// ===============================
		// 🚀 BULK OPERATIONS
		// ===============================

		const _bulkOperations: MutationsBulkOperations<T, O> = {
			bulkCreate: (data: T['$inferInsert'][], hooks?) => {
				return handleError(
					Effect.gen(function* () {
						const result: {
							batch: BulkOperationResult<T['$inferSelect'][], T>[0]
							data: BulkOperationResult<T['$inferSelect'][], T>[1]
						} = {
							batch: {
								size: batchSize,
								processed: 0,
								failed: 0,
								errors: [],
							},
							data: [],
						}

						if (data.length === 0) {
							return [result.batch, result.data] as BulkOperationResult<
								T['$inferSelect'][],
								T
							>
						}

						const insertData = data.map((item) => ({
							...item,
							createdAt: new Date(),
							updatedAt: new Date(),
						}))

						yield* executeHooks(hooks, insertData, 'before')

						const batches = createBatches(insertData, batchSize)

						for (const batch of batches) {
							try {
								const batchResult = yield* tryEffect(async () => {
									return await db
										.insert(table)
										.values(batch)
										.returning()
										.execute()
								})

								result.data.push(...batchResult)
								result.batch.processed += batch.length
							} catch (error) {
								result.batch.failed += batch.length
								// For create operations, we can't easily identify individual failed records
								// so we mark the entire batch as failed
								for (let index = 0; index < batch.length; index++) {
									result.batch.errors?.push({
										id: `batch_${batches.indexOf(batch)}_item_${index}` as IdType<
											T,
											O
										>,
										error:
											error instanceof Error ? error.message : 'Unknown error',
									})
								}
							}
						}

						yield* executeHooks(hooks, result.data, 'after')
						return [result.batch, result.data] as BulkOperationResult<
							T['$inferSelect'][],
							T
						>
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},

			bulkUpdate: (
				data: Array<{
					id: IdType<T, O>
					changes: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>
				}>,
				hooks?,
			) => {
				return handleError(
					Effect.gen(function* () {
						const result: {
							batch: BulkOperationResult<T['$inferSelect'][], T>[0]
							data: BulkOperationResult<T['$inferSelect'][], T>[1]
						} = {
							batch: {
								size: batchSize,
								processed: 0,
								failed: 0,
								errors: [],
							},
							data: [],
						}

						if (data.length === 0) {
							return [result.batch, result.data] as BulkOperationResult<
								T['$inferSelect'][],
								T
							>
						}

						yield* executeHooks(hooks, data, 'before')

						const batches = createBatches(data, batchSize)
						const idField = getIdField()

						for (const batch of batches) {
							for (const item of batch) {
								try {
									const updated = yield* tryEffect(async () => {
										const [updated] = await db
											.update(table)
											.set({
												...item.changes,
												updatedAt: new Date(),
											})
											.where(eq(table[idField] as SQLWrapper, item.id))
											.returning()

										return updated
									})

									if (updated) {
										result.data.push(updated)
										result.batch.processed += 1
									} else {
										result.batch.failed += 1
										result.batch.errors?.push({
											id: item.id,
											error: 'Record not found or not updated',
										})
									}
								} catch (itemError) {
									result.batch.failed += 1
									result.batch.errors?.push({
										id: item.id,
										error:
											itemError instanceof Error
												? itemError.message
												: 'Unknown error',
									})
								}
							}
						}

						yield* executeHooks(hooks, result.data, 'after')

						return [result.batch, result.data] as BulkOperationResult<
							T['$inferSelect'][],
							T
						>
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},

			bulkDelete: (ids: IdType<T, O>[], hooks?) => {
				return handleError(
					Effect.gen(function* () {
						const result: {
							batch: BulkOperationResult<
								{ readonly success: boolean; readonly message?: string },
								T
							>[0]
							data: BulkOperationResult<
								{ readonly success: boolean; readonly message?: string },
								T
							>[1]
						} = {
							batch: {
								size: batchSize,
								processed: 0,
								failed: 0,
								errors: [],
							},
							data: { success: false },
						}

						if (ids.length === 0) {
							result.data = { success: true, message: 'No records to delete' }
							return [result.batch, result.data] as BulkOperationResult<
								{ readonly success: boolean; readonly message?: string },
								T
							>
						}

						if (!soft) {
							// If no soft delete configured, add all as errors
							result.batch.failed = ids.length
							result.data = {
								success: false,
								message: `Soft delete is not enabled for the entity: ${entityName}`,
							}
							for (const id of ids) {
								result.batch.errors?.push({
									id,
									error: `Soft delete is not enabled for the entity: ${entityName}`,
								})
							}
							return [result.batch, result.data] as BulkOperationResult<
								{ readonly success: boolean; readonly message?: string },
								T
							>
						}

						if (hooks?.beforeAction) {
							yield* executeHooks(hooks, ids, 'before')
						}

						const batches = createBatches(ids, batchSize)
						const idField = getIdField()

						for (const batch of batches) {
							try {
								// First, check which entities exist and are not already deleted
								const existingData = yield* tryEffect(async () => {
									return await createBaseQuery().where(
										inArray(table[idField] as SQLWrapper, batch),
									)
								})

								const validIds = existingData
									.filter(
										(item) =>
											item[soft.field as keyof typeof item] !==
											soft.deletedValue,
									)
									.map((item) => item[idField as keyof typeof item])

								if (validIds.length === 0) {
									// All records in this batch are invalid
									result.batch.failed += batch.length
									for (const id of batch) {
										result.batch.errors?.push({
											id,
											error: 'Record not found or already deleted',
										})
									}
									continue
								}

								// Perform the soft delete
								const updated = yield* tryEffect(async () => {
									return await db
										.update(table)
										.set({
											[soft.field]: soft.deletedValue,
											updatedAt: new Date(),
										} as Partial<T['$inferInsert']>)
										.where(inArray(table[idField] as SQLWrapper, validIds))
										.returning()
								})

								result.batch.processed += updated.length

								// Track failed deletes within the batch
								if (updated.length < batch.length) {
									const failedCount = batch.length - updated.length
									result.batch.failed += failedCount
								}
							} catch (error) {
								result.batch.failed += batch.length
								for (const id of batch) {
									result.batch.errors?.push({
										id,
										error:
											error instanceof Error ? error.message : 'Unknown error',
									})
								}
							}
						}

						// Set final result data
						const totalRequested = ids.length
						const successful = result.batch.processed
						const failed = result.batch.failed

						if (failed === 0) {
							result.data = {
								success: true,
								message: `Successfully deleted ${successful} records`,
							}
						} else if (successful === 0) {
							result.data = {
								success: false,
								message: `Failed to delete all ${totalRequested} records`,
							}
						} else {
							result.data = {
								success: true,
								message: `Partially successful: ${successful} deleted, ${failed} failed`,
							}
						}

						if (hooks?.afterAction) {
							yield* executeHooks(hooks, ids, 'after')
						}

						return [result.batch, result.data] as BulkOperationResult<
							{ readonly success: boolean; readonly message?: string },
							T
						>
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},

			bulkHardDelete: (ids: IdType<T, O>[], hooks?) => {
				return handleError(
					Effect.gen(function* () {
						const result: {
							batch: BulkOperationResult<
								{ readonly success: boolean; readonly message?: string },
								T
							>[0]
							data: BulkOperationResult<
								{ readonly success: boolean; readonly message?: string },
								T
							>[1]
						} = {
							batch: {
								size: batchSize,
								processed: 0,
								failed: 0,
								errors: [],
							},
							data: { success: false },
						}

						if (ids.length === 0) {
							result.data = { success: true, message: 'No records to delete' }
							return [result.batch, result.data] as BulkOperationResult<
								{ readonly success: boolean; readonly message?: string },
								T
							>
						}

						if (hooks?.beforeAction) {
							yield* executeHooks(hooks, ids, 'before')
						}

						const batches = createBatches(ids, batchSize)
						const idField = getIdField()

						for (const batch of batches) {
							try {
								// First, get the entities that will be deleted for hooks
								const existingData = yield* tryEffect(async () => {
									return await createBaseQuery().where(
										inArray(table[idField] as SQLWrapper, batch),
									)
								})

								if (existingData.length === 0) {
									// All records in this batch are missing
									result.batch.failed += batch.length
									for (const id of batch) {
										result.batch.errors?.push({
											id,
											error: 'Record not found',
										})
									}
									continue
								}

								// Perform the hard delete
								yield* tryEffect(async () => {
									await db
										.delete(table)
										.where(inArray(table[idField] as SQLWrapper, batch))
								})

								result.batch.processed += existingData.length

								// Track failed deletes within the batch
								if (existingData.length < batch.length) {
									const failedCount = batch.length - existingData.length
									result.batch.failed += failedCount
								}
							} catch (error) {
								result.batch.failed += batch.length
								for (const id of batch) {
									result.batch.errors?.push({
										id,
										error:
											error instanceof Error ? error.message : 'Unknown error',
									})
								}
							}
						}

						// Set final result data
						const totalRequested = ids.length
						const successful = result.batch.processed
						const failed = result.batch.failed

						if (failed === 0) {
							result.data = {
								success: true,
								message: `Successfully hard deleted ${successful} records`,
							}
						} else if (successful === 0) {
							result.data = {
								success: false,
								message: `Failed to hard delete all ${totalRequested} records`,
							}
						} else {
							result.data = {
								success: true,
								message: `Partially successful: ${successful} hard deleted, ${failed} failed`,
							}
						}

						if (hooks?.afterAction) {
							yield* executeHooks(hooks, ids, 'after')
						}

						return [result.batch, result.data] as BulkOperationResult<
								{ readonly success: boolean; readonly message?: string },
								T
							>
					}).pipe(
						Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					),
				)
			},

			bulkRestore: (ids: IdType<T, O>[], hooks?) => {
				return Effect.gen(function* () {
					const result: {
						batch: BulkOperationResult<
							{ readonly success: boolean; readonly message?: string },
							T
						>[0]
						data: BulkOperationResult<
							{ readonly success: boolean; readonly message?: string },
							T
						>[1]
					} = {
						batch: {
							size: batchSize,
							processed: 0,
							failed: 0,
							errors: [],
						},
						data: { success: false },
					}

					if (ids.length === 0) {
						result.data = { success: true, message: 'No records to restore' }
						return [result.batch, result.data] as BulkOperationResult<
							{ readonly success: boolean; readonly message?: string },
							T
						>
					}

					if (!soft) {
						// If no soft delete configured, add all as errors
						result.batch.failed = ids.length
						result.data = {
							success: false,
							message: `Soft delete is not enabled for the entity: ${entityName}`,
						}
						for (const id of ids) {
							result.batch.errors?.push({
								id,
								error: `Soft delete is not enabled for the entity: ${entityName}`,
							})
						}
						return [result.batch, result.data] as BulkOperationResult<
							{ readonly success: boolean; readonly message?: string },
							T
						>
					}

					if (hooks?.beforeAction) {
						yield* executeHooks(hooks, ids, 'before')
					}

					const batches = createBatches(ids, batchSize)
					const idField = getIdField()

					for (const batch of batches) {
						try {
							// First, check which entities exist and are currently deleted
							const existingData = yield* tryEffect(async () => {
								return await createBaseQuery().where(
									and(
										inArray(table[idField] as SQLWrapper, batch),
										eq(
											table[soft.field as keyof T] as SQLWrapper,
											soft.deletedValue,
										),
									),
								)
							})

							const validIds = existingData.map(
								(item) => item[idField as keyof typeof item],
							)

							if (validIds.length === 0) {
								// All records in this batch are invalid (not found or not deleted)
								result.batch.failed += batch.length
								for (const id of batch) {
									result.batch.errors?.push({
										id,
										error: 'Record not found or not deleted',
									})
								}
								continue
							}

							// Perform the restore (set soft delete field to notDeletedValue)
							const restoreValue =
								soft.notDeletedValue !== undefined
									? soft.notDeletedValue
									: typeof soft.deletedValue === 'boolean'
										? !soft.deletedValue
										: null

							const updated = yield* tryEffect(async () => {
								return await db
									.update(table)
									.set({
										[soft.field]: restoreValue,
										updatedAt: new Date(),
									} as Partial<T['$inferInsert']>)
									.where(inArray(table[idField] as SQLWrapper, validIds))
									.returning()
							})

							result.batch.processed += updated.length

							// Track failed restores within the batch
							if (updated.length < batch.length) {
								const failedCount = batch.length - updated.length
								result.batch.failed += failedCount
							}
						} catch (error) {
							result.batch.failed += batch.length
							for (const id of batch) {
								result.batch.errors?.push({
									id,
									error:
										error instanceof Error ? error.message : 'Unknown error',
								})
							}
						}
					}

					// Set final result data
					const totalRequested = ids.length
					const successful = result.batch.processed
					const failed = result.batch.failed

					if (failed === 0) {
						result.data = {
							success: true,
							message: `Successfully restored ${successful} records`,
						}
					} else if (successful === 0) {
						result.data = {
							success: false,
							message: `Failed to restore all ${totalRequested} records`,
						}
					} else {
						result.data = {
							success: true,
							message: `Partially successful: ${successful} restored, ${failed} failed`,
						}
					}

					if (hooks?.afterAction) {
						yield* executeHooks(hooks, ids, 'after')
					}

					return [result.batch, result.data] as BulkOperationResult<
								{ readonly success: boolean; readonly message?: string },
								T
							>
				}).pipe(
					Effect.catchAll((error) => handleOptionalErrorHook(error, hooks)),
					Effect.runPromise,
				)
			},
		}

		const baseMethods: ServiceMethods<T, D, O> = {
			..._queryOperations,
			..._mutationOperations,
			..._bulkOperations,
		}
		const _ = {
			...baseMethods,
			searchTyped: <
				TRels extends WithRelations[] = [],
				TResult = TRels['length'] extends 0
					? T['$inferSelect'][]
					: RelationType<T, TRels>[],
			>(
				criteria: CriteriaFilter<T>,
				opts: FindByQueryOpts<T, TResult, TRels> = {} as FindByQueryOpts<
					T,
					TResult,
					TRels
				>,
			) => {
				const conditions = conditionsFromCriteria(
					criteria,
					opts.match || 'exact',
					opts.caseSensitive ?? false,
				)

				const { custom, ...restOpts } = opts
				return handleError(
					handleQueries(createBaseQuery(), restOpts, {
						beforeParse(query) {
							if (!conditions.length) return query
							if (custom) return query.where(or(custom, and(...conditions)))
							return query.where(and(...conditions))
						},
					}),
				)
			},
		}

		const baseService = {
			...baseMethods,
			...(override ? override(baseMethods) : {}),
		}

		const repository: Service<T, D> = {
			...baseService,
			_,
			entityName: entityName,
			db,
			entity: table,
		}

		return {
			...repository,
			...rest,
		} as Service<T, D, O> & O
	},
)
