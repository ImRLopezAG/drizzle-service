import type { Column, SQL, Table } from 'drizzle-orm'
import type { MySqlDatabase, MySqlSelect } from 'drizzle-orm/mysql-core'
import type { PgDatabase, PgSelect } from 'drizzle-orm/pg-core'
import type { BaseSQLiteDatabase, SQLiteSelect } from 'drizzle-orm/sqlite-core'
import type { Effect } from 'effect'
import { Context } from 'effect'

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

export type RepositoryError = DatabaseError | ValidationError | NotFoundError

export type RepositoryOptions<
	T extends BaseEntity,
	TExtensions = Record<string, unknown>,
> = {
	readonly defaultLimit?: number
	readonly maxLimit?: number
	readonly soft?: {
		readonly field: keyof T['$inferSelect']
		readonly deletedValue: T['$inferSelect'][keyof T['$inferSelect']]
	}
	caching?: {
		get?: <K, V>(key: K) => Effect.Effect<V | null, never, never>
		set?: <K, V>(
			key: K,
			value: V,
			ttl?: number,
		) => Effect.Effect<void, never, never>
		clear?: () => Effect.Effect<void, never, never>
		delete?: <K>(key: K) => Effect.Effect<void, never, never>
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

// Repository hooks for lifecycle events - using Effect
export interface RepositoryHooks<T extends BaseEntity> {
	beforeAction?: (
		data: T['$inferSelect'],
	) => Effect.Effect<void, RepositoryError, never>
	afterAction?: (
		data: T['$inferSelect'],
	) => Effect.Effect<void, RepositoryError, never>
	onError?: (error: RepositoryError) => Effect.Effect<void, never, never>
}

export interface MutationOperations<
	T extends BaseEntity,
	TOpts extends RepositoryOptions<T> | undefined = undefined,
> {
	create: (
		data: T['$inferInsert'],
		hooks?: RepositoryHooks<T>,
	) => Effect.Effect<T['$inferSelect'], RepositoryError, never>
	update: (
		id: IdType<T, TOpts>,
		data: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>,
		hooks?: RepositoryHooks<T>,
	) => Effect.Effect<T['$inferSelect'], RepositoryError, never>
	delete: (
		id: IdType<T, TOpts>,
		hooks?: RepositoryHooks<T>,
	) => Effect.Effect<
		{ readonly success: boolean; readonly message?: string },
		RepositoryError,
		never
	>
	hardDelete: (
		id: IdType<T, TOpts>,
		hooks?: RepositoryHooks<T>,
	) => Effect.Effect<
		{ readonly success: boolean; readonly message?: string },
		RepositoryError,
		never
	>
}

export interface QueryOperations<
	T extends BaseEntity,
	TOpts extends RepositoryOptions<T> | undefined = undefined,
> {
	findAll: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		opts?: QueryOpts<T, TResult, TRels>,
	) => Effect.Effect<TResult, RepositoryError, never>
	findById: <TResult = T['$inferSelect']>(
		id: IdType<T, TOpts>,
	) => Effect.Effect<TResult | null, RepositoryError, never>
	findBy: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		criteria: Partial<T['$inferSelect']>,
		opts?: QueryOpts<T, TResult, TRels>,
	) => Effect.Effect<TResult, RepositoryError, never>
	findByMatching: <
		TRels extends WithRelations[] = [],
		TResult = TRels['length'] extends 0
			? T['$inferSelect'][]
			: RelationType<T, TRels>[],
	>(
		criteria: Partial<T['$inferSelect']>,
		opts?: QueryOpts<T, TResult, TRels>,
	) => Effect.Effect<TResult, RepositoryError, never>
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
	) => Effect.Effect<TResult, RepositoryError, never>
	count: (
		criteria?: Partial<T['$inferSelect']>,
		opts?: QueryOpts<T, number>,
	) => Effect.Effect<number, RepositoryError, never>
}

export interface MutationsBulkOperations<
	T extends BaseEntity,
	TOpts extends RepositoryOptions<T> | undefined = undefined,
> {
	bulkCreate: (
		data: T['$inferInsert'][],
		hooks?: RepositoryHooks<T>,
	) => Effect.Effect<T['$inferSelect'][], RepositoryError, never>
	bulkUpdate: (
		data: {
			id: IdType<T, TOpts>
			changes: Partial<Omit<T['$inferInsert'], 'createdAt' | 'id'>>
		}[],
		hooks?: RepositoryHooks<T>,
	) => Effect.Effect<T['$inferSelect'][], RepositoryError, never>
	bulkDelete: (
		ids: IdType<T, TOpts>[],
		hooks?: RepositoryHooks<T>,
	) => Effect.Effect<
		{ readonly success: boolean; readonly message?: string },
		RepositoryError,
		never
	>
	bulkHardDelete: (
		ids: IdType<T, TOpts>[],
		hooks?: RepositoryHooks<T>,
	) => Effect.Effect<
		{ readonly success: boolean; readonly message?: string },
		RepositoryError,
		never
	>
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
	readonly _: RepositoryMethods<T, TOpts>
	readonly entityName: string
	readonly db: DB
	readonly entity: T
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
		? T['$inferSelect'][IdField]
		: never
	: T['$inferSelect'] extends { id: infer IdType }
		? IdType
		: string

// Context tags for dependency injection
export interface DatabaseService {
	readonly _: unique symbol
}

export const DatabaseService =
	Context.GenericTag<DatabaseService>('@services/Database')

// Repository service context
export interface RepositoryService<T extends BaseEntity, DB> {
	readonly _: unique symbol
	readonly repository: Repository<T, DB>
}

export const RepositoryService = <T extends BaseEntity, DB>(name: string) =>
	Context.GenericTag<RepositoryService<T, DB>>(`@services/Repository/${name}`)
