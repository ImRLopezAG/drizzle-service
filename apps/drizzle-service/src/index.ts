import { drizzleService as pg } from './pg'
import { drizzleService as sqlite } from './sqlite'

export const drizzleService = {
	pg,
	sqlite,
}

// Export types for type-safe configurations
export type {
	BaseEntity,
	Handler,
	IdType,
	MutationOperations,
	MutationsBulkOperations,
	MySqlDb,
	PaginationResult,
	PostgresDb,
	QueryOperations,
	QueryOpts,
	RelationType,
	Service,
	ServiceHooks,
	ServiceMethods,
	ServiceOptions,
	SoftDeleteTimestampMarker,
	SQLiteDb,
	WithRelations,
} from './builder/types'

export default drizzleService
