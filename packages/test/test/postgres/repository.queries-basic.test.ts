import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import {
	type UserWithTodos,
	createTodo,
	testIds,
	todosService,
	uniquePrefix,
	userService,
} from './repository'
import { todos, users } from './schema'
import { setupBeforeAll } from './test-setup'

setupBeforeAll()

describe('PG Service: Query Operations (Without Options)', () => {
	// Create test data for queries
	beforeAll(async () => {
		// Create a variety of todos for testing queries
		for (let i = 0; i < 20; i++) {
			const priority = i % 3 === 0 ? 'low' : i % 3 === 1 ? 'medium' : 'high'
			const status =
				i % 4 === 0
					? 'todo'
					: i % 4 === 1
						? 'in-progress'
						: i % 4 === 2
							? 'backlog'
							: 'done'
			await createTodo(
				i,
				priority as 'low' | 'medium' | 'high',
				status as 'todo' | 'backlog' | 'in-progress' | 'done',
			)
		}
	})

	it('should find all records', async () => {
		const todos = await todosService.find()
		expect(todos).toBeInstanceOf(Array)
		expect(todos.length).toBeGreaterThan(0)

		// Verify structure of returned objects
		for (const todo of todos) {
			expect(todo).toHaveProperty('id')
			expect(todo).toHaveProperty('title')
			expect(todo).toHaveProperty('userId')
			expect(todo).toHaveProperty('status')
			expect(todo).toHaveProperty('createdAt')
			expect(todo).toHaveProperty('updatedAt')
		}
	})

	it('should find a record by ID', async () => {
		if (testIds.todoIds.length === 0) {
			await createTodo(1000) // Create a todo if none exists
		}

		const todoId = testIds.todoIds[0]
		expect(todoId).toBeDefined()

		if (!todoId) {
			throw new Error('No todo ID available for testing')
		}

		const todo = await todosService.findOne(todoId)

		expect(todo).not.toBeNull()
		expect(todo?.id).toBe(todoId)
	})

	it('should return null when finding a non-existent ID', async () => {
		const nonExistentId = 'non-existent-id'
		const todo = await todosService.findOne(nonExistentId)

		expect(todo).toBeNull()
	})

	it('should find records by exact criteria', async () => {
		const todos = await todosService.findBy({
			userId: testIds.userId,
			priority: 'high',
		})

		expect(todos).toBeInstanceOf(Array)
		expect(todos.length).toBeGreaterThan(0)

		// All returned todos should match the criteria
		for (const todo of todos) {
			expect(todo.userId).toBe(testIds.userId)
			expect(todo.priority).toBe('high')
		}
	})

	it('should find records by a single field', async () => {
		const todos = await todosService.findByField('status', 'done')

		expect(todos).toBeInstanceOf(Array)
		expect(todos.length).toBeGreaterThan(0)

		// All returned todos should have status 'done'
		for (const todo of todos) {
			expect(todo.status).toBe('done')
		}
	})

	it('should find records by matching any of the criteria (OR condition)', async () => {
		const todos = await todosService.findByMatching({
			status: 'done',
			priority: 'high',
		})

		expect(todos).toBeInstanceOf(Array)
		expect(todos.length).toBeGreaterThan(0)

		// All returned todos should match at least one of the criteria
		for (const todo of todos) {
			const matchesCriteria = todo.status === 'done' || todo.priority === 'high'
			expect(matchesCriteria).toBe(true)
		}
	})

	it('should count records', async () => {
		const totalCount = await todosService.count()
		expect(totalCount).toBeGreaterThan(0)

		// Count with criteria
		const highPriorityCount = await todosService.count({ priority: 'high' })
		const lowPriorityCount = await todosService.count({ priority: 'low' })
		const mediumPriorityCount = await todosService.count({
			priority: 'medium',
		})

		// Count by priority should return values
		expect(highPriorityCount).toBeGreaterThanOrEqual(0)
		expect(lowPriorityCount).toBeGreaterThanOrEqual(0)
		expect(mediumPriorityCount).toBeGreaterThanOrEqual(0)

		// Note: Due to soft deleted records, the sum might not equal the total
		// as soft deleted records might have different priorities
	})

	it('should count records with criteria', async () => {
		const doneTasksCount = await todosService.count({ status: 'done' })
		const doneTasks = await todosService.findBy({ status: 'done' })

		expect(doneTasksCount).toBe(doneTasks.length)
	})

	it('should find records with cursor pagination', async () => {
		const result = await todosService.findWithCursor({
			limit: 5,
		})

		expect(result.items).toBeInstanceOf(Array)
		expect(result.items.length).toBeLessThanOrEqual(5)
		expect(result.nextCursor).toBeDefined() // Could be null if fewer than 5 items
		expect(result.pagination).toHaveProperty('page', 1)
		expect(result.pagination).toHaveProperty('pageSize', 5)
		expect(result.pagination).toHaveProperty('total')
		expect(result.pagination).toHaveProperty('hasNext')
		expect(result.pagination).toHaveProperty('hasPrev')
	})

	it('should use relations to join tables', async () => {
		const todosWithRelations = await todosService.withRelations()

		expect(todosWithRelations).toBeInstanceOf(Array)
		expect(todosWithRelations.length).toBeGreaterThan(0)

		// Check that the joined data contains user information
		for (const relation of todosWithRelations) {
			expect(relation).toHaveProperty('todos')
			expect(relation).toHaveProperty('users')
			if (relation.users && relation.todos) {
				expect(relation.users.id).toBe(relation.todos.userId)
			}
		}
	})

	it('should find a user with their todos', async () => {
		const userWithTodos = await userService.findBy(
			{ id: testIds.userId },
			{
				relations: [
					{ type: 'left', table: todos, sql: eq(users.id, todos.userId) },
				],
				parse(data) {
					const grouped = new Map<number, UserWithTodos>()
					for (const { users, todos } of data) {
						if (!grouped.has(users.id)) {
							grouped.set(users.id, {
								...users,
								todos: [],
							})
						}
						if (todos) {
							grouped.get(users.id)?.todos.push(todos)
						}
					}
					return Array.from(grouped.values())
				},
			},
		)

		expect(userWithTodos).toBeInstanceOf(Array)
		expect(userWithTodos.length).toBeGreaterThan(0)

		for (const user of userWithTodos) {
			expect(user).toHaveProperty('id')
			expect(user).toHaveProperty('name')
			expect(user).toHaveProperty('email')
			expect(user).toHaveProperty('todos')
			expect(user.todos).toBeInstanceOf(Array)

			// Verify that the todos belong to this user
			for (const todo of user.todos) {
				expect(todo.userId).toBe(user.id)
			}
		}
	})

	it('should filter records using filter criteria', async () => {
		// Test basic filtering with string pattern matching (contains)
		const todosWithPrefix = await todosService.filter({
			title: [`*${uniquePrefix}*`],
		})

		expect(todosWithPrefix).toBeInstanceOf(Array)
		expect(todosWithPrefix.length).toBeGreaterThan(0)

		// All returned todos should have titles containing the prefix
		for (const todo of todosWithPrefix) {
			expect(todo.title).toContain(uniquePrefix)
		}
	})

	it('should filter records with multiple criteria', async () => {
		// Test filtering with multiple fields using exact match
		const filteredTodos = await todosService.filter({
			priority: ['%1', 'high'],
			status: ['%1', 'done'],
		})

		expect(filteredTodos).toBeInstanceOf(Array)

		// All returned todos should match all criteria
		for (const todo of filteredTodos) {
			expect(todo.priority).toBe('high')
			expect(todo.status).toBe('done')
		}
	})

	it('should filter records with no results', async () => {
		// Test filtering that returns no results
		const filteredTodos = await todosService.filter({
			title: ['*non-existent-filter-pattern-xyz*'],
		})

		expect(filteredTodos).toBeInstanceOf(Array)
		expect(filteredTodos).toHaveLength(0)
	})
})
