import  { drizzleRepository } from 'drizzle-service/sqlite'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { sqliteTable, uniqueIndex } from 'drizzle-orm/sqlite-core'

const tenants = sqliteTable('tenants', (t) => ({
	tenantId: t.integer('id').primaryKey(),
	name: t.text('name').notNull().unique(),
	createdAt: t
		.integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: t
		.integer('updated_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date())
		.notNull(),
}))

const users = sqliteTable('users', (t) => ({
	id: t.integer('id').primaryKey(),
	email: t.text('email').notNull().unique(),
	name: t.text('name').notNull(),
	tenant: t
		.integer('tenant_id')
		.notNull()
		.references(() => tenants.tenantId),
	createdAt: t
		.integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: t
		.integer('updated_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull(),
}))

const todos = sqliteTable(
	'todos',
	(t) => ({
		id: t
			.text('id')
			.primaryKey()
			.$defaultFn(() => `TASK-${performance.now()}}`),
		title: t.text('title').notNull(),
		description: t.text('description'),
		tenant: t
			.integer('tenant_id')
			.notNull()
			.references(() => tenants.tenantId),
		createdAt: t
			.integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: t
			.integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
			.$onUpdateFn(() => new Date()),
		userId: t
			.integer('user_id', { mode: 'number' })
			.notNull()
			.references(() => users.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			}),
		status: t
			.text('status', {
				enum: ['todo', 'backlog', 'in-progress', 'done', 'canceled'],
			})
			.default('todo')
			.notNull(),
		priority: t
			.text('priority', {
				enum: ['low', 'medium', 'high'],
			})
			.default('medium')
			.notNull(),
		label: t
			.text('label', {
				enum: ['bug', 'feature', 'documentation'],
			})
			.default('feature')
			.notNull(),
	}),
	(t) => [uniqueIndex('todo_user_id_title_idx').on(t.userId, t.title)],
)

export const client = createClient({ url: 'file:./test/sqlite/db.sqlite' })
const db = drizzle({
	schema: {
		users,
		todos,
	},
	client,
})

const repository = drizzleRepository(db)

export { db, repository, todos, users, tenants }
