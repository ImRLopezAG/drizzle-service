import type {
	BaseEntity,
	SQLiteDb,
	Service,
	ServiceOptions,
} from '@/builder/types'
import { createSqliteService } from './service'

export function drizzleService<D extends SQLiteDb>(
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
	) => createSqliteService(db, table, opts) as Service<T, D> & TExtensions
}
