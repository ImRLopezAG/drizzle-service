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

export type RepositoryOptions<
	T extends BaseEntity,
	TExtensions = Record<string, unknown>,
> = {
	readonly defaultLimit?: number
	readonly maxLimit?: number
	readonly soft?: {
		readonly field: keyof T['$inferSelect']
		readonly deletedValue: T['$inferSelect'][keyof T['$inferSelect']]
		readonly notDeletedValue?: T['$inferSelect'][keyof T['$inferSelect']]
	}
	caching?: {
		get?: <K, V>(key: K) => V | null
		set?: <K, V>(key: K, value: V, ttl?: number) => void
		clear?: () => void
		delete?: <K>(key: K) => void
	}
	override?: (
		baseMethods: RepositoryMethods<T>,
	) => Partial<RepositoryMethods<T>>
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

// Repository hooks for lifecycle events
export interface RepositoryHooks<T extends BaseEntity> {
	beforeAction?: (data: T['$inferSelect']) => Promise<void>
	afterAction?: (data: T['$inferSelect']) => Promise<void>
	onError?: (error: Error) => Promise<void>
}

/**
 * Interface defining mutation operations for repository entities.
 * 
 * @template T - The base entity type that extends BaseEntity
 * @template TOpts - Optional repository options that extend RepositoryOptions<T>
 */
export interface MutationOperations<
	T extends BaseEntity,
	TOpts extends RepositoryOptions<T> | undefined = undefined,
> {
	/**
	 * Creates a new entity in the repository.
	 * 
	 * @param data - The data to insert, conforming to the entity's insert schema
	 * @param hooks - Optional repository hooks to execute during creation
	 * @param validate - Optional validation function to run on the data before creation
	 * @returns A handler that resolves to the created entity's select schema
	 */
	create: (
		data: T['$inferInsert'],
		hooks?: RepositoryHooks<T>,
		validate?: (data: T['$inferInsert']) => void,
	) => Handler<T['$inferSelect']>
	
	/**
	 * Updates an existing entity in the repository.
	 * 
	 * @param id - The identifier of the entity to update
	 * @param data - Partial data to update, excluding createdAt and id fields
	 * @param hooks - Optional repository hooks to execute during update
	 * @param validate - Optional validation function to run on the partial data before update
	 * @returns A handler that resolves to the updated entity's select schema
	 */
	update: (
		id: IdType<T, TOpts>,
		data: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>,
		hooks?: RepositoryHooks<T>,
		validate?: (data: Partial<T['$inferInsert']>) => void,
	) => Handler<T['$inferSelect']>
	
	/**
	 * Performs a soft delete on an entity (typically marks as deleted without removing from database).
	 * 
	 * @param id - The identifier of the entity to soft delete
	 * @param hooks - Optional repository hooks to execute during deletion
	 * @returns A promise that resolves to an object indicating success status and optional message
	 */
	delete: (
		id: IdType<T, TOpts>,
		hooks?: RepositoryHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
	
	/**
	 * Performs a hard delete on an entity (permanently removes from database).
	 * 
	 * @param id - The identifier of the entity to permanently delete
	 * @param hooks - Optional repository hooks to execute during hard deletion
	 * @returns A promise that resolves to an object indicating success status and optional message
	 */
	hardDelete: (
		id: IdType<T, TOpts>,
		hooks?: RepositoryHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
}

/**
 * Interface defining query operations for a repository pattern.
 * Provides a comprehensive set of methods for retrieving data from a data source.
 * 
 * @template T - The base entity type that extends BaseEntity
 * @template TOpts - Repository options type, defaults to undefined
 */
export interface QueryOperations<
	T extends BaseEntity,
	TOpts extends RepositoryOptions<T> | undefined = undefined,
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
	TOpts extends RepositoryOptions<T> | undefined = undefined,
> {
	bulkCreate: (
		data: T['$inferInsert'][],
		hooks?: RepositoryHooks<T>,
	) => Handler<T['$inferSelect'][]>
	bulkUpdate: (
		data: Array<{
			id: IdType<T, TOpts>
			changes: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>
		}>,
		hooks?: RepositoryHooks<T>,
	) => Handler<T['$inferSelect'][]>
	bulkDelete: (
		ids: IdType<T, TOpts>[],
		hooks?: RepositoryHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
	bulkHardDelete: (
		ids: IdType<T, TOpts>[],
		hooks?: RepositoryHooks<T>,
	) => Promise<{ readonly success: boolean; readonly message?: string }>
}

export interface RepositoryMethods<
	T extends BaseEntity,
	TOpts extends RepositoryOptions<T> | undefined = undefined,
> extends MutationOperations<T, TOpts>,
		QueryOperations<T>,
		MutationsBulkOperations<T, TOpts> {}

export interface Repository<
	T extends BaseEntity,
	DB,
	TOpts extends RepositoryOptions<T> | undefined = undefined,
> extends RepositoryMethods<T, TOpts> {
	readonly db: DB
	readonly entity: T
	readonly entityName: string
	_: RepositoryMethods<T, TOpts>
}

// Repository builder function that each database adapter implements
export type RepositoryBuilderFn<DB> = <
	T extends BaseEntity,
	TExtensions = Record<string, unknown>,
>(
	db: DB,
	entity: T,
	opts?: RepositoryOptions<T, TExtensions>,
) => Repository<T, DB> & TExtensions

// Main builder function signature - creates the repository factory
export type CreateRepositoryBuilder = <DB>(
	builderFn: RepositoryBuilderFn<DB>,
) => RepositoryBuilderFn<DB>

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
