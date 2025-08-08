import type {
	BaseEntity,
	PostgresDb,
	Service,
	ServiceOptions,
} from '@builder/types'
import { createPostgresService } from './service'

// Helper to check if table has an 'id' field of any type
type HasIdField<T extends BaseEntity> = T['$inferSelect'] extends { id: any }
	? true
	: false

// Helper to get the type of the 'id' field if it exists
type GetIdType<T extends BaseEntity> = T['$inferSelect'] extends {
	id: infer IdType
}
	? IdType
	: never

export function drizzleService<D extends PostgresDb>(
	db: D,
): {
	// Overload 1: Tables with string 'id' field - opts are optional
	<
		T extends BaseEntity & { $inferSelect: { id: string } },
		TExtensions extends Record<string, unknown> = Record<string, unknown>,
	>(
		table: T,
		opts?: ServiceOptions<T, D, TExtensions>,
	): Service<T, D, ServiceOptions<T, D, TExtensions> | undefined> & TExtensions

	// Overload 2: Tables with non-string 'id' field OR no 'id' field - must provide id option
	<
		T extends BaseEntity,
		TIdField extends keyof T['$inferSelect'],
		TExtensions extends Record<string, unknown> = Record<string, unknown>,
	>(
		table: T,
		opts: ServiceOptions<T, D, TExtensions> & { id: TIdField },
	): HasIdField<T> extends true
		? GetIdType<T> extends string
			? never // This case is handled by overload 1
			: Service<T, D, ServiceOptions<T, D, TExtensions> & { id: TIdField }> &
					TExtensions
		: Service<T, D, ServiceOptions<T, D, TExtensions> & { id: TIdField }> &
				TExtensions
}

export function drizzleService<D extends PostgresDb>(db: D) {
	return <
		T extends BaseEntity,
		TExtensions extends Record<string, unknown> = Record<string, unknown>,
	>(
		table: T,
		opts?: ServiceOptions<T, D, TExtensions>,
	) => createPostgresService(db, table, opts)
}
