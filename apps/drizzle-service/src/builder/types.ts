/** biome-ignore-all lint/suspicious/noExplicitAny: Any for flexibility */
import type { Column, SQL, Table } from 'drizzle-orm'
import type { PgDatabase, PgSelect } from 'drizzle-orm/pg-core'
import type { BaseSQLiteDatabase, SQLiteSelect } from 'drizzle-orm/sqlite-core'
// Base entity interface that all tables must implement
export interface BaseEntity extends Table {
	id?: Column<any>
	createdAt: Column<any>
	updatedAt: Column<any>
}

// Database-specific types
export type SQLiteDb = BaseSQLiteDatabase<any, any, any, any>
export type PostgresDb = PgDatabase<any, any, any>
// Query builder types for each database
export type SQLiteQb = SQLiteSelect
export type PostgresQb = PgSelect
export type QBuilders = SQLiteQb | PostgresQb

export type BaseDatabase = SQLiteDb | PostgresDb

export type Handler<T> = Promise<[ServiceError, null] | [null, T]>

// Effect-specific error types
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

export type ServiceOptions<
	T extends BaseEntity,
	TExtensions = Record<string, unknown>,
> = {
	readonly defaultLimit?: number
	readonly maxLimit?: number
	readonly soft?: SoftDeleteOption<T>
	readonly batchSize?: number
	override?: (baseMethods: ServiceMethods<T>) => Partial<ServiceMethods<T>>
} & (T['$inferSelect'] extends { id: infer IdType } // If the entity has an id field of type string, id is optional and must be a string key
	? IdType extends string
		? { id?: Extract<keyof T['$inferSelect'], string> }
		: { id: Extract<keyof T['$inferSelect'], string> }
	: { id: Extract<keyof T['$inferSelect'], string> }) &
	TExtensions

// Query options that work with any entity
export type QueryOpts<
	T extends BaseEntity,
	TResult = T['$inferSelect'][],
	TRels extends WithRelations[] = [],
> = {
	page?: number
	limit?: number
	orderBy?: {
		[P in keyof T['$inferSelect']]?: 'asc' | 'desc'
	}
	withDeleted?: boolean
	cursor?: Date | null
	relations?: TRels
	workspace?: {
		field: keyof T['$inferSelect']
		value: T['$inferSelect'][keyof T['$inferSelect']]
	}
	custom?: SQL
	parse?: TRels['length'] extends 0
		? (data: T['$inferSelect'][]) => TResult
		: (data: RelationType<T, TRels>[]) => TResult
}
type CriteriaFilters = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in' | 'nin'

export type CriteriaFilter<T extends BaseEntity> = {
	[K in keyof T['$inferSelect']]?: T['$inferSelect'][K]  | {
		[P in CriteriaFilters]?: T['$inferSelect'][K] | T['$inferSelect'][K][]
	} & {
		custom?: SQL
	}
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
	parse?: TRelations['length'] extends 0
		? (data: T['$inferSelect'] | null) => TResult | null
		: (data: RelationType<T, TRelations>[] | null) => TResult | null
}
export interface WithRelations {
	type: 'left' | 'inner' | 'right'
	table: BaseEntity
	sql: SQL
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

// Service hooks for lifecycle events - using Effect
export interface ServiceHooks<T extends BaseEntity> {
	beforeAction?: (data: T['$inferSelect']) => Promise<void>
	afterAction?: (data: T['$inferSelect']) => Promise<void>
	onError?: (error: ServiceError) => Promise<void>
}

export interface ExtendedServiceHooks<T extends BaseEntity> extends ServiceHooks<T> {
	custom?: SQL
}
export interface MutationOperations<
	T extends BaseEntity,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> {
	create: (
		data: T['$inferInsert'],
		hooks?: ServiceHooks<T>,
	) => Handler<T['$inferSelect']>
	update: (
		id: IdType<T, TOpts>,
		data: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>,
		hooks?: ExtendedServiceHooks<T>,
	) => Handler<T['$inferSelect']>
	findOrCreate: (
		data: T['$inferInsert'],
		hooks?: ServiceHooks<T>,
	) => Handler<T['$inferSelect']>
	upsert: (
		data: T['$inferInsert'],
		hooks?: ExtendedServiceHooks<T>,
	) => Handler<T['$inferSelect']>
	delete: (
		id: IdType<T, TOpts>,
		hooks?: ExtendedServiceHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
	hardDelete: (
		id: IdType<T, TOpts>,
		hooks?: ExtendedServiceHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
	restore: (
		id: IdType<T, TOpts>,
		hooks?: ExtendedServiceHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
}

export interface QueryOperations<
	T extends BaseEntity,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> {
	find: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		opts?: QueryOpts<T, TResult, TRels>,
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
	/**
	 * @deprecated This method is similar to `findBy` and may be changed or removed in the future.
	 */
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
	) => Promise<TResult>
	findBy: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		criteria: Partial<T['$inferSelect']>,
		opts?: FindByQueryOpts<T, TResult, TRels>,
	) => Promise<TResult>
	findByMatching: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		criteria: Partial<T['$inferSelect']>,
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
		hooks?: ServiceHooks<T>,
	) => Promise<BulkOperationResult<T['$inferSelect'][], T>>
	bulkUpdate: (
		data: Array<{
			id: IdType<T, TOpts>
			changes: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>
		}>,
		hooks?: ServiceHooks<T>,
	) => Promise<BulkOperationResult<T['$inferSelect'][], T>>
	bulkDelete: (
		ids: IdType<T, TOpts>[],
		hooks?: ServiceHooks<T>,
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
		hooks?: ServiceHooks<T>,
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
		hooks?: ServiceHooks<T>,
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
	TOpts extends ServiceOptions<T> | undefined = undefined,
> extends MutationOperations<T, TOpts>,
		QueryOperations<T>,
		MutationsBulkOperations<T, TOpts> {}

export interface Service<
	T extends BaseEntity,
	DB,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> extends ServiceMethods<T, TOpts> {
	readonly _: ServiceMethods<T, TOpts>
	readonly entityName: string
	readonly db: DB
	readonly entity: T
}

// Special marker type for timestamp-based soft deletes
export type SoftDeleteTimestampMarker = 'NOT_NULL'

// Soft delete configuration with type-safe constraints
type SoftDeleteConfig<
	T extends BaseEntity,
	K extends keyof T['$inferSelect'],
> = {
	readonly field: K
} & (T['$inferSelect'][K] extends boolean // For boolean fields: deletedValue is required, notDeletedValue is optional (defaults to opposite)
	? {
			readonly deletedValue: boolean
			readonly notDeletedValue?: boolean
		}
	: // For timestamp fields - match exact Date type but exclude Date | null from this branch
		[T['$inferSelect'][K]] extends [Date]
		? {
				readonly deletedValue: Date | SoftDeleteTimestampMarker
				readonly notDeletedValue?: Date | null
			}
		: // For nullable timestamp fields (Date | null)
			T['$inferSelect'][K] extends Date | null
			? {
					readonly deletedValue: Date | SoftDeleteTimestampMarker | null
					readonly notDeletedValue?: Date | null
				}
			: // For all other types (enums, strings, etc): both values are required
				{
					readonly deletedValue: T['$inferSelect'][K]
					readonly notDeletedValue: T['$inferSelect'][K]
				})

// Helper type to properly distribute the union for soft delete config
export type SoftDeleteOption<T extends BaseEntity> = {
	[K in keyof T['$inferSelect']]: SoftDeleteConfig<T, K>
}[keyof T['$inferSelect']]

export type FilterExpression<T> = [string, ...T[]]

export type FilterCriteria<T extends BaseEntity> = {
	[K in keyof T['$inferSelect']]?: FilterExpression<T['$inferSelect'][K]>
}

export interface BulkOperationResult<T, E extends BaseEntity> {
	batch: {
		size: number
		processed: number
		failed: number
		errors?: Array<{
			id: IdType<E>
			error: string
		}>
	}
	data: T
}

// Service builder function that each database adapter implements
export type ServiceBuilderFn<DB extends BaseDatabase> = <
	T extends BaseEntity,
	TExtensions = Record<string, unknown>,
>(
	db: DB,
	entity: T,
	opts?: ServiceOptions<T, TExtensions>,
) => Service<T, DB> & TExtensions

// Helper type to extract the table name from a BaseEntity
type TableName<T extends BaseEntity> = T extends { _: { name: infer N } }
	? N
	: never

// Helper type to extract the result structure when relations are used
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

export type IdType<
	T extends BaseEntity,
	TOpts extends { id?: keyof T['$inferSelect'] } | undefined = undefined,
> = TOpts extends { id: infer IdField }
	? IdField extends keyof T['$inferSelect']
		? T['$inferSelect'][IdField]
		: never
	: T['$inferSelect'] extends { id: infer IdType }
		? IdType
		: string


