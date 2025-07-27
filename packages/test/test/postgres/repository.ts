import { eq } from 'drizzle-orm'
import { expect } from 'vitest'
import { z } from 'zod/v4'
import { service, tenants, todos, users } from './schema'

const timestamp = Date.now()
const uniquePrefix = `Test-${timestamp}`

const userService = service(users, {
	id: 'id',
})

const tenantsService = service(tenants, {
	id: 'tenantId',
})

const todosService = service(todos, {
	soft: {
		field: 'status',
		deletedValue: 'canceled',
		notDeletedValue: 'todo',
	},
	getSoftDeleted: async () => {
		return await todosService.findBy(
			{ status: 'canceled' },
			{ withDeleted: true },
		)
	},
	withRelations: async () => {
		return await todosService.db
			.select()
			.from(todos)
			.leftJoin(users, eq(todos.userId, users.id))
			.orderBy(todos.id)
	},
})

// Type definitions for clarity
type UserWithTodos = typeof users.$inferSelect & {
	todos: Array<typeof todos.$inferSelect>
}

// Test data - tenant will be set after tenant creation
const userData = {
	email: `${uniquePrefix}@example.com`,
	name: `User ${uniquePrefix}`,
	tenant: 0, // Will be updated after tenant creation
}

// Store test IDs and data for use across tests
const testIds = {
	userId: 0,
	tenantId: 0,
	todoIds: [] as string[],
	bulkTodoIds: [] as string[],
}

// Helper function to create a todo
const createTodo = async (
	index = 0,
	priority: 'low' | 'medium' | 'high' = 'medium',
	status: 'todo' | 'backlog' | 'in-progress' | 'done' = 'todo'
) => {
	const [error, todo] = await todosService.create({
		title: `${uniquePrefix}-Todo-${index}`,
		description: `Description for test todo ${index}`,
		userId: testIds.userId,
		priority,
		status,
		tenant: testIds.tenantId,
		label:
			index % 3 === 0 ? 'bug' : index % 3 === 1 ? 'feature' : 'documentation',
	})

	expect(error).toBeNull()
	expect(todo).toBeDefined()

	if (todo) {
		testIds.todoIds.push(todo.id)
		return todo
	}
	throw new Error('Failed to create todo')
}

export const createTodoWithMatching = async (
	prefix: string,	
	index = 0,
	priority: 'low' | 'medium' | 'high' = 'medium',
	status: 'todo' | 'backlog' | 'in-progress' | 'done' = 'todo',
	matching: 'startWith' | 'endWith' | 'contains' | 'exact' = 'exact'
) => {
	const title = {
		startWith: `${prefix}-Todo-${index}-${uniquePrefix}`,
		endWith: `${uniquePrefix}-Todo-${index}-${prefix}`,
		contains: `${uniquePrefix}-${prefix}-Todo-${index}`,
		exact: `Todo-${prefix}-${index}-${uniquePrefix}`,
	}
	const [error, todo] = await todosService.create({
		title: title[matching],
		description: `Description for test todo ${index}`,
		userId: testIds.userId,
		priority,
		status,
		tenant: testIds.tenantId,
		label:
			index % 3 === 0 ? 'bug' : index % 3 === 1 ? 'feature' : 'documentation',
	})
	expect(error).toBeNull()
	expect(todo).toBeDefined()
	if (error) {
		throw new Error(`Failed to create todo with error: ${error.message}`)
	}
	testIds.todoIds.push(todo.id)
	return todo
}

const userSchema = z.object({
	email: z.email(),
	name: z.string().min(1, 'Name is required'),
	tenant: z.number().min(1, 'Tenant ID is required'),
})

export {
	createTodo,
	tenants,
	tenantsService,
	testIds,
	todos,
	todosService,
	uniquePrefix,
	userData,
	users,
	userSchema,
	userService,
}
export type { UserWithTodos }
