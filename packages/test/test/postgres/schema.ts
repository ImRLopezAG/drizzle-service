import { drizzleService } from 'drizzle-service/pg'
import { pgEnum, pgTableCreator, uniqueIndex } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const pgTable = pgTableCreator((name) => `ps_${name}`)

export const statusEnum = pgEnum('status', [
	'todo',
	'backlog',
	'in-progress',
	'done',
	'canceled',
])
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high'])
export const labelEnum = pgEnum('label', ['bug', 'feature', 'documentation'])

const tenants = pgTable('tenants', (t) => ({
	tenantId: t.serial('tenant_id').primaryKey(),
	name: t.text('name').notNull(),
	createdAt: t
		.timestamp('created_at')
		.notNull()		.$defaultFn(() => new Date()),
	updatedAt: t
		.timestamp('updated_at')
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date())
}))

const users = pgTable('users', (t) => ({
	id: t.serial('id').primaryKey(),
	email: t.text('email').notNull().unique(),
	name: t.text('name').notNull(),
	tenant: t
		.integer('tenant_id')
		.notNull()
		.references(() => tenants.tenantId),
	createdAt: t
		.timestamp('created_at')
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: t
		.timestamp('updated_at')
		.notNull()
		.$defaultFn(() => new Date()),
}))

const todos = pgTable(
	'todos',
	(t) => ({
		id: t
			.text('id')
			.primaryKey()
			.$defaultFn(() => `TASK-${performance.now()}`),
		title: t.text('title').notNull(),
		description: t.text('description'),
		tenant: t
			.integer('tenant_id')
			.notNull()
			.references(() => tenants.tenantId),
		createdAt: t
			.timestamp('created_at')
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: t
			.timestamp('updated_at')
			.notNull()
			.$defaultFn(() => new Date())
			.$onUpdateFn(() => new Date()),
		userId: t
			.integer('user_id')
			.notNull()
			.references(() => users.id),
		status: statusEnum('status').default('todo').notNull(),
		priority: priorityEnum('priority').default('medium').notNull(),
		label: labelEnum('label').default('feature').notNull(),
	}),
	(t) => [uniqueIndex('todo_user_id_title_idx').on(t.userId, t.title)],
)

// process.loadEnvFile('.env.test')

const client = postgres(process.env.DATABASE_URL ?? '')
const db = drizzle({
	schema: {
		statusEnum,
		priorityEnum,
		labelEnum,
		todos,
		users,
	},
	client,
})

const service = drizzleService(db)

export { db, service, todos, users, tenants }
