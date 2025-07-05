import type { Column, SQL, Table } from 'drizzle-orm'
import type { MySqlDatabase, MySqlSelect } from 'drizzle-orm/mysql-core'
import type { PgDatabase, PgSelect } from 'drizzle-orm/pg-core'
import type { BaseSQLiteDatabase, SQLiteSelect } from 'drizzle-orm/sqlite-core'

// Base entity interface that all tables must implement
export interface BaseEntity extends Table {
	// Optional ID field - repositories must specify the ID field if not present
	// biome-ignore lint/suspicious/noExplicitAny: Drizzle requires any for column types
	id?: Column<any>
	// biome-ignore lint/suspicious/noExplicitAny: Drizzle requires any for column types
	createdAt: Column<any>
	// biome-ignore lint/suspicious/noExplicitAny: Drizzle requires any for column types
	updatedAt: Column<any>
}

// Database-specific types
// biome-ignore lint/suspicious/noExplicitAny: Drizzle database types require any for schema generics
export type SQLiteDb = BaseSQLiteDatabase<any, any, any, any>
// biome-ignore lint/suspicious/noExplicitAny: Drizzle database types require any for schema generics
export type PostgresDb = PgDatabase<any, any, any>
// biome-ignore lint/suspicious/noExplicitAny: Drizzle database types require any for schema generics
export type MySqlDb = MySqlDatabase<any, any>

// Query builder types for each database
export type SQLiteQb = SQLiteSelect
export type PostgresQb = PgSelect
export type MySqlQb = MySqlSelect

// Special marker type for timestamp-based soft deletes
export type SoftDeleteTimestampMarker = 'NOT_NULL'

// Soft delete configuration with type-safe constraints
type SoftDeleteConfig<
	T extends BaseEntity,
	K extends keyof T['$inferSelect'],
> = {
	readonly field: K
} & // For boolean fields: deletedValue is required, notDeletedValue is optional (defaults to opposite)
(T['$inferSelect'][K] extends boolean
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
type SoftDeleteOption<T extends BaseEntity> = {
	[K in keyof T['$inferSelect']]: SoftDeleteConfig<T, K>
}[keyof T['$inferSelect']]

export type ServiceOptions<
	T extends BaseEntity,
	TExtensions = Record<string, unknown>,
> = {
	readonly defaultLimit?: number
	readonly maxLimit?: number
	readonly soft?: SoftDeleteOption<T>
	caching?: {
		get?: <K, V>(key: K) => V | null
		set?: <K, V>(key: K, value: V, ttl?: number) => void
		clear?: () => void
		delete?: <K>(key: K) => void
	}
	override?: (baseMethods: ServiceMethods<T>) => Partial<ServiceMethods<T>>
} & (T['$inferSelect'] extends { id: string }
	? {
			id?: keyof T['$inferSelect'] // Optional if entity has an ID field
		}
	: {
			id: keyof T['$inferSelect'] // Required if entity doesn't have an ID field
		}) &
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

export interface WithRelations {
	type: 'left' | 'inner' | 'right'
	table: BaseEntity
	sql: SQL
}

// Handler type for error handling
export type Handler<T> = Promise<[Error, null] | [null, T]>

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

// Service hooks for lifecycle events
export interface ServiceHooks<T extends BaseEntity> {
	beforeAction?: (data: T['$inferSelect']) => Promise<void>
	afterAction?: (data: T['$inferSelect']) => Promise<void>
	onError?: (error: Error) => Promise<void>
}

/**
 * Interface defining mutation operations for service entities.
 *
 * @template T - The base entity type that extends BaseEntity
 * @template TOpts - Optional service options that extend ServiceOptions<T>
 */
export interface MutationOperations<
	T extends BaseEntity,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> {
	/**
	 * Creates a new entity in the service.
	 *
	 * @param data - The data to insert, conforming to the entity's insert schema
	 * @param hooks - Optional service hooks to execute during creation
	 * @param validate - Optional validation function to run on the data before creation
	 * @returns A handler that resolves to the created entity's select schema
	 */
	create: (
		data: T['$inferInsert'],
		hooks?: ServiceHooks<T>,
	) => Handler<T['$inferSelect']>

	/**
	 * Updates an existing entity in the service.
	 *
	 * @param id - The identifier of the entity to update
	 * @param data - Partial data to update, excluding createdAt and id fields
	 * @param hooks - Optional service hooks to execute during update
	 * @param validate - Optional validation function to run on the partial data before update
	 * @returns A handler that resolves to the updated entity's select schema
	 */
	update: (
		id: IdType<T, TOpts>,
		data: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>,
		hooks?: ServiceHooks<T>,
	) => Handler<T['$inferSelect']>
	/**
	 * Performs a soft delete on an entity (typically marks as deleted without removing from database).
	 *
	 * @param id - The identifier of the entity to soft delete
	 * @param hooks - Optional service hooks to execute during deletion
	 * @returns A promise that resolves to an object indicating success status and optional message
	 */
	delete: (
		id: IdType<T, TOpts>,
		hooks?: ServiceHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>

	/**
	 * Performs a hard delete on an entity (permanently removes from database).
	 *
	 * @param id - The identifier of the entity to permanently delete
	 * @param hooks - Optional service hooks to execute during hard deletion
	 * @returns A promise that resolves to an object indicating success status and optional message
	 */
	hardDelete: (
		id: IdType<T, TOpts>,
		hooks?: ServiceHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>

	/**
	 * Performs a restore operation on a soft-deleted entity (typically marks as not deleted).
	 * @param id - The identifier of the entity to restore
	 * @param hooks - Optional service hooks to execute during restoration
	 * @returns A promise that resolves to an object indicating success status and optional message
	 */
	restore: (
		id: IdType<T, TOpts>,
		hooks?: ServiceHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
}

/**
 * Interface defining query operations for a service pattern.
 * Provides a comprehensive set of methods for retrieving data from a data source.
 *
 * @template T - The base entity type that extends BaseEntity
 * @template TOpts - Service options type, defaults to undefined
 */
export interface QueryOperations<
	T extends BaseEntity,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> {
	/**
	 * Retrieves all entities from the data source.
	 *
	 * @template TRels - Array of relation types to include
	 * @template TResult - The resulting type based on whether relations are included
	 * @param opts - Optional query options for filtering, sorting, and including relations
	 * @returns Promise resolving to an array of entities
	 */
	findAll: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		opts?: QueryOpts<T, TResult, TRels>,
	) => Promise<TResult>

	/**
	 * Finds a single entity by its unique identifier.
	 *
	 * @template TResult - The resulting entity type
	 * @param id - The unique identifier of the entity
	 * @returns Promise resolving to the entity or null if not found
	 */
	findById: <TResult = T['$inferSelect']>(
		id: IdType<T, TOpts>,
	) => Promise<TResult | null>

	/**
	 * Finds entities that match the specified criteria using partial matching.
	 *
	 * @template TRels - Array of relation types to include
	 * @template TResult - The resulting type based on whether relations are included
	 * @param criteria - Partial entity object containing the search criteria
	 * @param opts - Optional query options for filtering, sorting, and including relations
	 * @returns Promise resolving to an array of matching entities
	 */
	findBy: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		criteria: Partial<T['$inferSelect']>,
		opts?: QueryOpts<T, TResult, TRels>,
	) => Promise<TResult>

	/**
	 * Finds entities that exactly match the specified criteria.
	 *
	 * @template TRels - Array of relation types to include
	 * @template TResult - The resulting type based on whether relations are included
	 * @param criteria - Partial entity object containing the exact match criteria
	 * @param opts - Optional query options for filtering, sorting, and including relations
	 * @returns Promise resolving to an array of exactly matching entities
	 */
	findByMatching: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		criteria: Partial<T['$inferSelect']>,
		opts?: QueryOpts<T, TResult, TRels>,
	) => Promise<TResult>

	/**
	 * Finds entities by a specific field and its value.
	 *
	 * @template K - The key of the entity field to search by
	 * @template TRels - Array of relation types to include
	 * @template TResult - The resulting type based on whether relations are included
	 * @param field - The field name to search by
	 * @param value - The value to match against the specified field
	 * @param opts - Optional query options for filtering, sorting, and including relations
	 * @returns Promise resolving to an array of entities matching the field criteria
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

	/**
	 * Counts the number of entities that match the specified criteria.
	 *
	 * @param criteria - Optional partial entity object containing the search criteria
	 * @param opts - Optional query options for additional filtering
	 * @returns Promise resolving to the count of matching entities
	 */
	count: (
		criteria?: Partial<T['$inferSelect']>,
		opts?: QueryOpts<T, number>,
	) => Promise<number>

	/**
	 * Performs cursor-based pagination to retrieve entities.
	 * Useful for efficient pagination through large datasets.
	 *
	 * @template TRels - Array of relation types to include
	 * @template TResult - The resulting type based on whether relations are included
	 * @param opts - Query options including cursor information for pagination
	 * @returns Promise resolving to a paginated result containing entities and pagination metadata
	 */
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
}

export interface MutationsBulkOperations<
	T extends BaseEntity,
	TOpts extends ServiceOptions<T> | undefined = undefined,
> {
	bulkCreate: (
		data: T['$inferInsert'][],
		hooks?: ServiceHooks<T>,
	) => Handler<T['$inferSelect'][]>
	bulkUpdate: (
		data: Array<{
			id: IdType<T, TOpts>
			changes: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>
		}>,
		hooks?: ServiceHooks<T>,
	) => Handler<T['$inferSelect'][]>
	bulkDelete: (
		ids: IdType<T, TOpts>[],
		hooks?: ServiceHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
	bulkHardDelete: (
		ids: IdType<T, TOpts>[],
		hooks?: ServiceHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
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
	readonly db: DB
	readonly entity: T
	readonly entityName: string
	_: ServiceMethods<T, TOpts>
}

// Service builder function that each database adapter implements
export type ServiceBuilderFn<DB> = <
	T extends BaseEntity,
	TExtensions = Record<string, unknown>,
>(
	db: DB,
	entity: T,
	opts?: ServiceOptions<T, TExtensions>,
) => Service<T, DB> & TExtensions

// Main builder function signature - creates the service factory
export type CreateServiceBuilder = <DB>(
	builderFn: ServiceBuilderFn<DB>,
) => ServiceBuilderFn<DB>

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
		? T['$inferSelect'][IdField] // Use the type from the specified ID field in options
		: never // Error case: the specified ID field doesn't exist
	: T['$inferSelect'] extends { id: infer IdType }
		? IdType // Use the entity's native ID field type
		: string // Default to string if no ID field exists
