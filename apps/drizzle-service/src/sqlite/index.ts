import type {
	BaseEntity,
	Service,
	ServiceOptions,
	SQLiteDb,
} from '@builder/types'
import { createSqliteService } from './service'

// Simple Effect-based drizzleService - returns Effect that needs to be run
export function drizzleService<D extends SQLiteDb>(
	db: D,
): {
	<
		T extends BaseEntity & { $inferSelect: { id: string } },
		TExtensions extends Record<string, unknown> = Record<string, unknown>,
	>(
		table: T,
		opts?: ServiceOptions<T, TExtensions>,
	): Service<T, D> & TExtensions
	<
		T extends BaseEntity,
		TExtensions extends Record<string, unknown> = Record<string, unknown>,
	>(
		table: T,
		opts: ServiceOptions<T, TExtensions>,
	): Service<T, D> & TExtensions
}
export function drizzleService<D extends SQLiteDb>(db: D) {
	return <
		T extends BaseEntity,
		TExtensions extends Record<string, unknown> = Record<string, unknown>,
	>(
		table: T,
		opts?: ServiceOptions<T, TExtensions>,
	) => createSqliteService(db, table, opts) as Service<T, D> & TExtensions
}
