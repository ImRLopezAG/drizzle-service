import {
  createParserFunction,
  errorHandler,
  getTableName,
  initializeService,
  tryHandler,
} from '@/builder'
import type {
  BaseEntity,
  BulkOperationResult,
  FilterCriteria,
  Handler,
  IdType,
  MutationOperations,
  MutationsBulkOperations,
  PaginationResult,
  PostgresDb,
  PostgresQb,
  QueryOperations,
  QueryOpts,
  RelationType,
  Service,
  ServiceHooks,
  ServiceMethods,
  ServiceOptions,
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
  ilike,
  inArray,
  ne,
  or,
} from 'drizzle-orm'

export const createPostgresService = initializeService<PostgresDb>(
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

    const parseFilterExpression = createParserFunction<
      T,
      keyof T['$inferSelect']
    >(table, (column, value) => {
      return ilike(column, value)
    })
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
    async function handleQueries<TResult, TRels extends WithRelations[] = []>(
      query: PostgresQb,
      queryOpts: QueryOpts<T, TResult, TRels>,
      hooks?: {
        beforeParse?: (q: PostgresQb) => PostgresQb
        afterParse?: (data: TResult) => TResult
      },
    ) {
      const { parse, ...opts } = queryOpts
      const { beforeParse, afterParse } = hooks || {}
      let q = withOpts(query, opts)

      if (beforeParse) {
        // @ts-ignore
        q = beforeParse(q)
      }

      const data = await q

      // Apply custom parse function if provided
      if (parse) {
        return parse(
          opts.relations && opts.relations.length > 0
            ? (data as RelationType<T, TRels>[])
            : (data as T['$inferSelect'][]),
        ) as TResult
      }

      if (afterParse) {
        return afterParse(data as TResult)
      }

      return data as TResult
    }

    // ===============================
    // 🚀 REPOSITORY IMPLEMENTATION
    // ===============================

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
        return await handleQueries<TResult, TRels>(createBaseQuery(), opts)
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
        let data = await withOpts(createBaseQuery(), queryOpts)
        // Create a new object without relations for count query
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

        return await handleQueries<TResult, TRels>(createBaseQuery(), opts, {
          beforeParse(q) {
            return q.where(and(...conditions))
          },
        })
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

        return await handleQueries<TResult, TRels>(createBaseQuery(), opts, {
          beforeParse(q) {
            return q.where(or(...conditions))
          },
        })
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
        opts: QueryOpts<T, TResult, TRels> = {} as QueryOpts<T, TResult, TRels>,
      ) => {
        return await handleQueries<TResult, TRels>(createBaseQuery(), opts, {
          beforeParse(q) {
            return q.where(eq(table[field] as SQLWrapper, value))
          },
        })
      },
      filter: async <
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

        return await handleQueries<TResult, TRels>(createBaseQuery(), opts, {
          beforeParse(q) {
            if (filterConditions.length === 0) return q
            return q.where(and(...filterConditions))
          },
        })
      },
    }

    // ===============================
    // 🚀 MUTATION OPERATIONS
    // ===============================

    const _mutationOperations: MutationOperations<T, O> = {
      create: async (
        data: T['$inferInsert'],
        hooks?: ServiceHooks<T>,
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
        hooks?: ServiceHooks<T>,
      ): Handler<T['$inferSelect']> => {
        return await tryHandler(
          async () => {
            const prev = await baseMethods.findById(id)
            if (!prev) throw new Error(`Entity with id ${id} not found`)

            if (hooks?.beforeAction)
              await hooks.beforeAction({
                ...prev,
                ...data,
              })

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

      delete: async (id: IdType<T, O>, hooks?: ServiceHooks<T>) => {
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

      hardDelete: async (id: IdType<T, O>, hooks?: ServiceHooks<T>) => {
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

      restore: async (id: IdType<T, O>, hooks?: ServiceHooks<T>) => {
        if (!soft) {
          return {
            success: false,
            message: 'Soft delete is not configured for this entity',
          }
        }

        const [error] = await tryHandler(async () => {
          // Find the entity including soft deleted ones
          const idField = getIdField()
          const query = createBaseQuery().where(
            eq(table[idField] as SQLWrapper, id),
          )
          // Skip soft delete filtering to find deleted entities
          const results = await query
          const data = results[0] as T['$inferSelect'] | undefined

          if (!data) throw new Error(`Entity with id ${id} not found`)

          if (hooks?.beforeAction) await hooks.beforeAction(data)

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
              throw new Error(
                'notDeletedValue is required for non-boolean, non-timestamp soft delete fields',
              )
            }
            restoreValue = notDeletedValue
          }

          // Update the entity to restore it
          await db
            .update(table)
            .set({
              [field]: restoreValue,
              updatedAt: new Date(),
            } as Record<string, unknown>)
            .where(eq(table[idField] as SQLWrapper, id))

          const restoredData = {
            ...data,
            [field]: restoreValue,
          } as T['$inferSelect']
          if (hooks?.afterAction) await hooks.afterAction(restoredData)

          return true
        })

        return {
          success: !error,
          message: error
            ? error.message
            : `Entity with id ${id} successfully restored`,
        }
      },
    }

    // ===============================
    // 🚀 BULK OPERATIONS
    // ===============================

    // Helper function to split array into batches
    function createBatches<T>(array: T[], batchSize: number): T[][] {
      const batches: T[][] = []
      for (let i = 0; i < array.length; i += batchSize) {
        batches.push(array.slice(i, i + batchSize))
      }
      return batches
    }

    const _bulkOperations: MutationsBulkOperations<T, O> = {
      bulkCreate: async (
        data: T['$inferInsert'][],
        hooks?: ServiceHooks<T> | undefined,
      ): Promise<BulkOperationResult<T['$inferSelect'][], T>> => {
        const result: BulkOperationResult<T['$inferSelect'][], T> = {
          batch: {
            size: batchSize,
            processed: 0,
            failed: 0,
            errors: [],
          },
          data: [],
        }

        if (data.length === 0) {
          return result
        }

        if (hooks?.beforeAction) await hooks.beforeAction(data)

        const batches = createBatches(data, batchSize)

        for (const batch of batches) {
          try {
            // Process batch without transaction
            const batchResult = await db
              .insert(table)
              .values(
                batch.map((item) => ({
                  ...item,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })),
              )
              .returning()

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
                error: error instanceof Error ? error.message : 'Unknown error',
              })
            }
          }
        }

        if (hooks?.afterAction) await hooks.afterAction(result.data)

        return result
      },
      bulkUpdate: async (
        data: {
          id: IdType<T, O>
          changes: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>
        }[],
        hooks?: ServiceHooks<T> | undefined,
      ): Promise<BulkOperationResult<T['$inferSelect'][], T>> => {
        const result: BulkOperationResult<T['$inferSelect'][], T> = {
          batch: {
            size: batchSize,
            processed: 0,
            failed: 0,
            errors: [],
          },
          data: [],
        }

        if (data.length === 0) {
          return result
        }

        if (hooks?.beforeAction) await hooks.beforeAction(data)

        const batches = createBatches(data, batchSize)
        const idField = getIdField()

        for (const batch of batches) {
          try {
            // Process batch without transaction - individual updates
            const updates = []
            for (const item of batch) {
              try {
                const [updated] = await db
                  .update(table)
                  .set({
                    ...item.changes,
                    updatedAt: new Date(),
                  })
                  .where(eq(table[idField] as SQLWrapper, item.id))
                  .returning()

                if (updated) {
                  updates.push(updated)
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
            result.data.push(...updates)
          } catch (error) {
            result.batch.failed += batch.length
            for (const item of batch) {
              result.batch.errors?.push({
                id: item.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              })
            }
          }
        }

        if (hooks?.afterAction) await hooks.afterAction(result.data)

        return result
      },
      bulkDelete: async (
        ids: IdType<T, O>[],
        hooks?: ServiceHooks<T> | undefined,
      ): Promise<
        BulkOperationResult<
          { readonly success: boolean; readonly message?: string },
          T
        >
      > => {
        const result: BulkOperationResult<
          { readonly success: boolean; readonly message?: string },
          T
        > = {
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
          return result
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
          return result
        }

        if (hooks?.beforeAction) await hooks.beforeAction(ids)

        const batches = createBatches(ids, batchSize)
        const idField = getIdField()

        for (const batch of batches) {
          try {
            // Process batch without transaction
            // First, check which entities exist and are not already deleted
            const existingData = await createBaseQuery().where(
              inArray(table[idField] as SQLWrapper, batch),
            )

            const validIds = existingData
              .filter(
                (item) =>
                  item[soft.field as keyof typeof item] !== soft.deletedValue,
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
            const updated = await db
              .update(table)
              .set({
                [soft.field]: soft.deletedValue,
                updatedAt: new Date(),
              } as Partial<T['$inferInsert']>)
              .where(inArray(table[idField] as SQLWrapper, validIds))
              .returning()

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
                error: error instanceof Error ? error.message : 'Unknown error',
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

        if (hooks?.afterAction) await hooks.afterAction(ids)

        return result
      },
      bulkHardDelete: async (
        ids: IdType<T, O>[],
        hooks?: ServiceHooks<T> | undefined,
      ): Promise<
        BulkOperationResult<
          { readonly success: boolean; readonly message?: string },
          T
        >
      > => {
        const result: BulkOperationResult<
          { readonly success: boolean; readonly message?: string },
          T
        > = {
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
          return result
        }

        if (hooks?.beforeAction) await hooks.beforeAction(ids)

        const batches = createBatches(ids, batchSize)
        const idField = getIdField()

        for (const batch of batches) {
          try {
            // Process batch without transaction
            // First, get the entities that will be deleted for hooks
            const existingData = await createBaseQuery().where(
              inArray(table[idField] as SQLWrapper, batch),
            )

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
            await db
              .delete(table)
              .where(inArray(table[idField] as SQLWrapper, batch))

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
                error: error instanceof Error ? error.message : 'Unknown error',
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

        if (hooks?.afterAction) await hooks.afterAction(ids)

        return result
      },
      bulkRestore: async (
        ids: IdType<T, O>[],
        hooks?: ServiceHooks<T> | undefined,
      ): Promise<
        BulkOperationResult<
          { readonly success: boolean; readonly message?: string },
          T
        >
      > => {
        const result: BulkOperationResult<
          { readonly success: boolean; readonly message?: string },
          T
        > = {
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
          return result
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
          return result
        }

        if (hooks?.beforeAction) await hooks.beforeAction(ids)

        const batches = createBatches(ids, batchSize)
        const idField = getIdField()

        for (const batch of batches) {
          try {
            // Process batch without transaction
            // First, check which entities exist and are currently deleted
            const existingData = await createBaseQuery().where(
              and(
                inArray(table[idField] as SQLWrapper, batch),
                eq(
                  table[soft.field as keyof T] as SQLWrapper,
                  soft.deletedValue,
                ),
              ),
            )

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

            const updated = await db
              .update(table)
              .set({
                [soft.field]: restoreValue,
                updatedAt: new Date(),
              } as Partial<T['$inferInsert']>)
              .where(inArray(table[idField] as SQLWrapper, validIds))
              .returning()

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
                error: error instanceof Error ? error.message : 'Unknown error',
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

        if (hooks?.afterAction) await hooks.afterAction(ids)

        return result
      },
    }

    const baseMethods: ServiceMethods<T, O> = {
      ..._queryOperations,
      ..._mutationOperations,
      ..._bulkOperations,
    }

    const baseService = {
      ...baseMethods,
      ...(override ? override(baseMethods) : {}),
    }

    const service: Service<T, D> = {
      ...baseService,
      _: baseMethods,
      entityName: entityName,
      db,
      entity: table,
    }

    return {
      ...service,
      ...rest,
    } as Service<T, D> & O
  },
)

export function drizzleService<D extends PostgresDb>(
  db: D,
): <
  T extends BaseEntity,
  TExtensions extends Record<string, unknown> = Record<string, unknown>,
>(
  table: T,
  opts?: ServiceOptions<T, TExtensions>,
) => Service<T, D> & TExtensions {
  return <
    T extends BaseEntity,
    TExtensions extends Record<string, unknown> = Record<string, unknown>,
  >(
    table: T,
    opts?: ServiceOptions<T, TExtensions>,
  ) => createPostgresService(db, table, opts) as Service<T, D> & TExtensions
}

// Helper function to parse Business Central filter expressions
