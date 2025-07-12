import type {
	BaseEntity,
	PostgresDb,
	Service,
	ServiceOptions,
} from '@/builder/types'
import { createPostgresService } from './service'

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
