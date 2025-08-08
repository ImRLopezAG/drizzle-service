/** biome-ignore-all lint/suspicious/noExplicitAny: Any for flexibility */
import type {
	Column,
	ExtractTableRelationsFromSchema,
	SQL,
	Table
} from 'drizzle-orm'
import type { PgDatabase, PgSelect } from 'drizzle-orm/pg-core'
import type { BaseSQLiteDatabase, SQLiteSelect } from 'drizzle-orm/sqlite-core'

export interface BaseEntity extends Table {
	id?: Column<any>
	createdAt: Column<any>
	updatedAt: Column<any>
}

// Database-specific types
export type SQLiteDb = BaseSQLiteDatabase<any, any, any, any>
export type PostgresDb = PgDatabase<any, any, any>
export type QBuilders = SQLiteSelect | PgSelect
export type BaseDatabase = SQLiteDb | PostgresDb

export type Handler<T> = Promise<[ServiceError, null] | [null, T]>// Error types remain the same...
export class DatabaseError extends Error {
	readonly _tag = 'DatabaseError'
	constructor(
		message: string,
		public override readonly cause?: unknown,
	) {
		super(message)
	}
}

export class ValidationError extends Error {
	readonly _tag = 'ValidationError'
	constructor(
		message: string,
		readonly field?: string,
	) {
		super(message)
	}
}

export class NotFoundError extends Error {
	readonly _tag = 'NotFoundError'
	constructor(
		message: string,
		readonly entityType?: string,
		readonly id?: unknown,
	) {
		super(message)
	}
}

export type ServiceError = DatabaseError | ValidationError | NotFoundError

// Fixed ServiceOptions - make id field more flexible
export type ServiceOptions<
	T extends BaseEntity,
	DB extends BaseDatabase = BaseDatabase,
	TExtensions = Record<string, unknown>,
> = {
	/**
	 * Default limit for query results
	 * @default 100
	 */
	readonly defaultLimit?: number
	/**
	 * Maximum limit for query results
	 * @default 1000
	 */
	readonly maxLimit?: number
	/**
	 * Soft delete configuration
	 * @example { field: 'deletedAt', deletedValue: 'NOT_NULL' }
	 */
	readonly soft?: SoftDeleteOption<T>
	/**
	 * Size of the batch for bulk operations
	 * @default 100
	 */
	readonly batchSize?: number
	/**
	 * ID field for the service
	 * If not provided, the service will use the natural 'id' field from the entity this should be a string
	 * This field is optional and can be any key from the entity's $inferSelect type.
	 * @example 'id' | 'customIdField'
	 * @default 'id'
	 * @see BaseEntity for more details on the entity structure
	 * @see ServiceOptions for more details on the service options
	 */
	readonly id?: keyof T['$inferSelect'] // Make id optional and allow any key
	/**
	 * Extensions for the service
	 * This allows you to add custom methods or properties to the service
	 *
	 * @example
	 * ```typescript
	 * {
	 *  override: (baseMethods) => ({
	 *   count: async () => {
	 *     return await service.db.$count()
	 *   },
	 *  }),
	 * }
	 */
	override?: (
		baseMethods: ServiceMethods<T, DB>,
	) => Partial<ServiceMethods<T, DB>>
} & TExtensions

export type WithRelationsRecursive<
	TTable extends Table,
	Db extends BaseDatabase,
> = {
	[P in keyof ExtractTableRelationsFromSchema<
		Db['_']['fullSchema'],
		TTable['_']['name']
	>]?:
		| true
		| WithRelationsRecursive<
				// The related table type for P
				ExtractTableRelationsFromSchema<
					Db['_']['fullSchema'],
					TTable['_']['name']
				>[P]['referencedTable'],
				Db
		  >
}

// Query options remain mostly the same...
export interface QueryOpts<
	T extends BaseEntity,
	TResult = T['$inferSelect'][],
	TRels extends WithRelations[] = [],
	Db extends BaseDatabase = BaseDatabase,
> {
	/**
	 * Page number for pagination
	 * @default 1
	 */
	page?: number
	/**
	 * Number of items per page
	 * @default 100
	 * you can set a custom limit using `defaultLimit` in @type ServiceOptions
	 */
	limit?: number
	/**
	 * Order by fields
	 * @example
	 * ```typescript
	 * {
	 *   name: 'asc',
	 *   createdAt: 'desc'
	 * }
	 * ```
	 */
	orderBy?: {
		[P in keyof T['$inferSelect']]?: 'asc' | 'desc'
	}
	/**
	 * Include deleted items in the query result
	 * @default false
	 */
	withDeleted?: boolean
	/**
	 * Cursor for pagination
	 * @example ```typescript
	 *   cursor: new Date('2023-01-01T00:00:00Z')
	 * ```
	 */
	cursor?: Date | null
	/**
	 * SQL Relations to include in the query result
	 * @example [{ type: 'left', table: relatedTable, on: eq(relatedTable.id, mainTable.relatedId) }]
	 */
	relations?: TRels
	/**
	 * Workspace option to filter results by workspace / tenant / organization
	 * @example ```typescript
	 *   workspace: { field: 'organizationId', value: 'org123' }
	 * ```
	 */
	workspace?: WorkspaceOption<T>
	/**
	 * Custom SQL to execute in the query
	 * this will be executed after the main query and can be used to add custom logic or filters
	 * @example ```typescript
	 *   custom: or(
	 *     eq(relatedTable.id, mainTable.relatedId)
	 * 		like(relatedTable.name, '%search%'),
	 *   )
	 * ```
	 */
	custom?: SQL
	/**
	 * Include related entities in the query result
	 * This is a legacy field and will be removed in future versions.
	 * @deprecated Use `relations` instead for better type safety and flexibility.
	 * This field is for test purposes only and may be removed in future versions or could fully implement by the moment is just a placeholder and ts api for the query builder.
	 */
	include?: WithRelationsRecursive<T, Db>
	/**
	 * Function to parse the result of the query
	 * @example ```typescript
	 *   {
	 * 		parse: (data) => data.map(item => ({ ...item, createdAt: new Date(item.createdAt) }))
	 *   }
	 * ```
	 */
	parse?: TRels['length'] extends 0
		? (data: T['$inferSelect'][]) => TResult
		: (data: RelationType<T, TRels>[]) => TResult
}

export type CriteriaFilters =
	| '$gt'
	| '$gte'
	| '$lt'
	| '$lte'
	| '$eq'
	| '$neq'
	| '$in'
	| '$nin'
	| '$between'
export type FilterOperators<T> = {
	[K in CriteriaFilters]?: K extends '$in' | '$nin'
		? T[]
		: K extends '$between'
			? [T, T]
			: T
}

export type CriteriaFilter<T extends BaseEntity> = {
	[K in keyof T['$inferSelect']]?:
		| T['$inferSelect'][K]
		| FilterOperators<T['$inferSelect'][K]>
		| SQL
}

export interface FindByQueryOpts<
	T extends BaseEntity,
	TResult = T['$inferSelect'][],
	TRels extends WithRelations[] = [],
> extends QueryOpts<T, TResult, TRels> {
	match?: 'startWith' | 'contains' | 'exact' | 'endsWith'
	caseSensitive?: boolean
}

export interface FindOneOpts<
	T extends BaseEntity,
	TResult = T['$inferSelect'],
	TRelations extends WithRelations[] = [],
> extends Omit<
		QueryOpts<T, TResult, TRelations>,
		'page' | 'limit' | 'orderBy' | 'cursor' | 'parse'
	> {
	/**
	 * Function to parse the result of the query
	 * @example (data) => ({ ...data, createdAt: new Date(data.createdAt) })
	 */
	parse?: TRelations['length'] extends 0
		? (data: T['$inferSelect'] | null) => TResult | null
		: (data: RelationType<T, TRelations>[] | null) => TResult | null
}

export interface WithRelations {
	type: 'left' | 'inner' | 'right'
	table: BaseEntity
	on: SQL
}

// Pagination result
export interface PaginationResult<T> {
	readonly items: readonly T[]
	readonly nextCursor: Date | null
	readonly pagination: {
		readonly page: number
		readonly pageSize: number
		readonly total: number
		readonly hasNext: boolean
		readonly hasPrev: boolean
	}
}

// Service hooks remain the same...
export interface ServiceHooks<TBefore, TAfter = TBefore> {
	/**
	 * Function to run before the main action of the mutation
	 * @param data Data to be processed before the action
	 * @returns Promise that resolves when the action is ready to be executed
	 * @example
	 * ```typescript
	 * beforeAction: async (data) => {
	 *   // Perform some preprocessing on the data
	 *   data.createdAt = new Date(data.createdAt)
	 * }
	 * ```
	 */
	beforeAction?: (data: TBefore) => Promise<void>
	/**
	 * Function to run after the main action of the mutation
	 * @param data Data returned from the action
	 * @returns Promise that resolves when the after action is complete
	 * @example
	 * ```typescript
	 * afterAction: async (data) => {
	 *   // Perform some post-processing on the data
	 *   console.log('Data after action:', data)
	 * }
	 * ```
	 */
	afterAction?: (data: TAfter) => Promise<void>
	/**
	 * Function to run in case of an error during the action
	 * @param error Error that occurred during the action
	 * @returns Promise that resolves when the error handling is complete
	 * @example
	 * ```typescript
	 * onError: async (error) => {
	 *   // Log the error or perform some error handling
	 *   console.error('Error occurred:', error)
	 * }
	 * ```
	 */
	onError?: (error: ServiceError) => Promise<void>
}

export interface ExtendedServiceHooks<TBefore, TAfter = TBefore>
	extends ServiceHooks<TBefore, TAfter> {
	custom?: SQL
}

// Fixed IdType to handle undefined options properly
export type IdType<
	T extends BaseEntity,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> = TOpts extends ServiceOptions<T>
	? TOpts extends { id: infer IdField }
		? IdField extends keyof T['$inferSelect']
			? T['$inferSelect'][IdField] // Use the type of the specified field
			: never
		: T['$inferSelect'] extends { id: infer IdType }
			? IdType // Use the natural 'id' field type
			: never
	: T['$inferSelect'] extends { id: infer IdType }
		? IdType // Use the natural 'id' field type
		: never

// Fixed interface signatures to handle undefined options properly
export interface MutationOperations<
	T extends BaseEntity,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> {
	create: (
		data: T['$inferInsert'],
		hooks?: ServiceHooks<T['$inferInsert'], T['$inferSelect']>,
	) => Handler<T['$inferSelect']>
	update: (
		id: IdType<T, TOpts>,
		data: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>,
		hooks?: ExtendedServiceHooks<T['$inferInsert'], T['$inferSelect']>,
	) => Handler<T['$inferSelect']>
	findOrCreate: (
		data: T['$inferInsert'],
		hooks?: ServiceHooks<T['$inferInsert'], T['$inferSelect']>,
	) => Handler<T['$inferSelect']>
	upsert: (
		data: T['$inferInsert'],
		hooks?: ExtendedServiceHooks<T['$inferInsert'], T['$inferSelect']>,
	) => Handler<T['$inferSelect']>
	delete: (
		id: IdType<T, TOpts>,
		hooks?: ExtendedServiceHooks<T['$inferInsert'], T['$inferSelect']>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
	hardDelete: (
		id: IdType<T, TOpts>,
		hooks?: ExtendedServiceHooks<T['$inferInsert'], T['$inferSelect']>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
	restore: (
		id: IdType<T, TOpts>,
		hooks?: ExtendedServiceHooks<T['$inferInsert'], T['$inferSelect']>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
}

export interface QueryOperations<
	T extends BaseEntity,
	Db extends BaseDatabase,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> {
	find: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		opts?: QueryOpts<T, TResult, TRels, Db>,
	) => Promise<TResult>
	findOne: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect']
			: RelationType<T, TRels>,
	>(
		id: IdType<T, TOpts>,
		opts?: FindOneOpts<T, TResult, TRels>,
	) => Promise<TResult | null>
	findFirst: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect']
			: RelationType<T, TRels>,
	>(
		opts?: FindOneOpts<T, TResult, TRels>,
	) => Promise<TResult | null>
	findBy: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		criteria: CriteriaFilter<T>,
		opts?: FindByQueryOpts<T, TResult, TRels>,
	) => Promise<TResult>
	findByMatching: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		criteria: CriteriaFilter<T>,
		opts?: FindByQueryOpts<T, TResult, TRels>,
	) => Promise<TResult>
	count: (
		criteria?: Partial<T['$inferSelect']>,
		opts?: QueryOpts<T, number>,
	) => Promise<number>
	findWithCursor: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		opts: QueryOpts<T, TResult, TRels>,
	) => Promise<
		PaginationResult<
			TResult extends T['$inferSelect'][] ? T['$inferSelect'] : TResult
		>
	>
	search: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		criteria: FilterCriteria<T>,
		opts?: QueryOpts<T, TResult, TRels>,
	) => Promise<TResult>
}

export interface MutationsBulkOperations<
	T extends BaseEntity,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> {
	bulkCreate: (
		data: T['$inferInsert'][],
		hooks?: ServiceHooks<T['$inferInsert'][], T['$inferSelect'][]>,
	) => Promise<BulkOperationResult<T['$inferSelect'][], T>>
	bulkUpdate: (
		data: Array<{
			id: IdType<T, TOpts>
			changes: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>
		}>,
		hooks?: ServiceHooks<
			Array<{
				id: IdType<T, TOpts>
				changes: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>
			}>,
			T['$inferSelect'][]
		>,
	) => Promise<BulkOperationResult<T['$inferSelect'][], T>>
	bulkDelete: (
		ids: IdType<T, TOpts>[],
		hooks?: ServiceHooks<IdType<T, TOpts>[], void>,
	) => Promise<
		BulkOperationResult<
			{
				readonly success: boolean
				readonly message?: string
			},
			T
		>
	>
	bulkHardDelete: (
		ids: IdType<T, TOpts>[],
		hooks?: ServiceHooks<IdType<T, TOpts>[], void>,
	) => Promise<
		BulkOperationResult<
			{
				readonly success: boolean
				readonly message?: string
			},
			T
		>
	>
	bulkRestore: (
		ids: IdType<T, TOpts>[],
		hooks?: ServiceHooks<IdType<T, TOpts>[], void>,
	) => Promise<
		BulkOperationResult<
			{
				readonly success: boolean
				readonly message?: string
			},
			T
		>
	>
}

export interface ServiceMethods<
	T extends BaseEntity,
	Db extends BaseDatabase,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> extends MutationOperations<T, TOpts>,
		QueryOperations<T, Db, TOpts>,
		MutationsBulkOperations<T, TOpts> {}

export interface Service<
	T extends BaseEntity,
	DB extends BaseDatabase,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> extends ServiceMethods<T, DB, TOpts> {
	readonly _: ServiceMethods<T, DB, TOpts> & {
		searchTyped: <
			TRels extends WithRelations[] = [],
			TResult = TRels['length'] extends 0
				? T['$inferSelect'][]
				: RelationType<T, TRels>[],
		>(
			criteria: CriteriaFilter<T>,
			opts?: FindByQueryOpts<T, TResult, TRels>,
		) => Promise<TResult>
	}
	readonly entityName: string
	readonly db: DB
	readonly entity: T
}

// Soft delete types remain the same...
export type SoftDeleteTimestampMarker = 'NOT_NULL'

type SoftDeleteConfig<
	T extends BaseEntity,
	K extends keyof T['$inferSelect'],
> = {
	readonly field: K
} & (T['$inferSelect'][K] extends boolean
	? {
			readonly deletedValue: boolean
			readonly notDeletedValue?: boolean
		}
	: [T['$inferSelect'][K]] extends [Date]
		? {
				readonly deletedValue: Date | SoftDeleteTimestampMarker
				readonly notDeletedValue?: Date | null
			}
		: T['$inferSelect'][K] extends Date | null
			? {
					readonly deletedValue: Date | SoftDeleteTimestampMarker | null
					readonly notDeletedValue?: Date | null
				}
			: {
					readonly deletedValue: T['$inferSelect'][K]
					readonly notDeletedValue: T['$inferSelect'][K]
				})

export type SoftDeleteOption<T extends BaseEntity> = {
	[K in keyof T['$inferSelect']]: SoftDeleteConfig<T, K>
}[keyof T['$inferSelect']]

export type WorkspaceOption<T extends BaseEntity> = {
	readonly field: keyof T['$inferSelect']
	readonly value: T['$inferSelect'][keyof T['$inferSelect']]
}

export type FilterExpression<T> = [string, ...T[]]

export type FilterCriteria<T extends BaseEntity> = {
	[K in keyof T['$inferSelect']]?: FilterExpression<T['$inferSelect'][K]>
}

export type BulkOperationResult<T, E extends BaseEntity> = [
	{
		size: number
		processed: number
		failed: number
		errors?: Array<{
			id: IdType<E>
			error: string
		}>
	},
	T,
]

// Service builder function - fixed to handle undefined options properly
export type ServiceBuilderFn<DB extends BaseDatabase> = <
	T extends BaseEntity,
	TExtensions = Record<string, unknown>,
>(
	db: DB,
	entity: T,
	opts?: ServiceOptions<T, DB, TExtensions>,
) => Service<T, DB, ServiceOptions<T, DB, TExtensions> | undefined> &
	TExtensions

// Helper types remain the same...
type TableName<T extends BaseEntity> = T extends { _: { name: infer N } }
	? N
	: never

export type RelationType<
	TMain extends BaseEntity,
	TRelations extends WithRelations[] = [],
> = TRelations['length'] extends 0
	? TMain['$inferSelect']
	: {
			[TKey in TableName<TMain>]: TMain['$inferSelect']
		} & {
			[TKey in TableName<TRelations[number]['table']>]: Extract<
				TRelations[number],
				{ table: { _: { name: TKey } } }
			>['table']['$inferSelect']
		}
