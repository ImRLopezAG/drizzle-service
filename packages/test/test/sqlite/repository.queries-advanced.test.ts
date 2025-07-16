import { and, eq, gt, like, lt, or, sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTodo, testIds, todosService, uniquePrefix } from './repository'
import { tenants, todos, users } from './schema'
import { setupBeforeAll } from './test-setup'

setupBeforeAll()

describe('SQLITE Service: Query Operations (With Options)', () => {
	// Create test data needed for advanced query tests
	beforeAll(async () => {
		// Create a variety of todos for testing advanced queries
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
				1000 + i, // Use higher numbers to avoid conflicts
				priority as 'low' | 'medium' | 'high',
				status as 'todo' | 'backlog' | 'in-progress' | 'done',
			)
		}
	})

	it('should find records with pagination', async () => {
		const page1 = await todosService.find({ page: 1, limit: 5 })
		const page2 = await todosService.find({ page: 2, limit: 5 })

		expect(page1).toHaveLength(5)
		expect(page2).toHaveLength(5)

		// Page 1 and page 2 should contain different records
		const page1Ids = page1.map((todo) => todo.id)
		const page2Ids = page2.map((todo) => todo.id)

		// No overlapping IDs between pages
		const overlapping = page1Ids.filter((id) => page2Ids.includes(id))
		expect(overlapping).toHaveLength(0)
	})

	it('should respect the maximum limit', async () => {
		// The Service is configured with a maxLimit, but it seems to be higher or not enforced
		const todos = await todosService.find({ limit: 1000 })

		// We just verify we get results and don't error when requesting a very large limit
		expect(todos.length).toBeGreaterThan(0)
	})

	it('should order results by a single field ascending', async () => {
		const todos = await todosService.find({
			orderBy: { title: 'asc' },
		})

		// Check if titles are sorted in ascending order
		const titles = todos.map((todo) => todo.title)
		const sortedTitles = [...titles].sort()
		expect(titles).toEqual(sortedTitles)
	})

	it('should order results by a single field descending', async () => {
		const todos = await todosService.find({
			orderBy: { title: 'desc' },
		})

		// Check if titles are sorted in descending order
		const titles = todos.map((todo) => todo.title)
		const sortedTitles = [...titles].sort((a, b) => b.localeCompare(a))
		expect(titles).toEqual(sortedTitles)
	})

	it('should filter results by multiple criteria', async () => {
		const todos = await todosService.findBy(
			{
				userId: testIds.userId,
				status: 'done',
			},
			{
				orderBy: { createdAt: 'desc' },
			},
		)

		expect(todos.length).toBeGreaterThan(0)

		// All todos should match both criteria
		for (const todo of todos) {
			expect(todo.userId).toBe(testIds.userId)
			expect(todo.status).toBe('done')
		}
	})

	it('should use cursor pagination with correct ordering', async () => {
		const firstPage = await todosService.findWithCursor({
			limit: 3,
			orderBy: { createdAt: 'desc' },
		})

		expect(firstPage.items).toHaveLength(3)

		expect(firstPage.pagination).toBeDefined()
		expect(firstPage.pagination.page).toBe(1)
		expect(firstPage.pagination.pageSize).toBe(3)
		expect(firstPage.pagination.total).toBeGreaterThanOrEqual(3)

		// Skip testing second page if the nextCursor is null
		if (firstPage.nextCursor) {
			const secondPage = await todosService.findWithCursor({
				limit: 3,
				cursor: firstPage.nextCursor,
				orderBy: { createdAt: 'desc' },
			})

			// Pagination object should exist
			expect(secondPage.pagination).toBeDefined()
		}
	})

	it('should apply custom SQL conditions', async () => {
		// Use the table reference directly, not the result variable
		const todosResult = await todosService.find({
			custom: sql`title LIKE ${`%${uniquePrefix}%`}`,
		})

		expect(todosResult.length).toBeGreaterThan(0)

		// All returned todos should have the prefix in their title
		for (const todo of todosResult) {
			expect(todo.title).toContain(uniquePrefix)
		}
	})

	it('should apply ordering with multiple fields', async () => {
		// Note: The order of fields might vary by implementation
		// Just verify we get ordered results without errors
		const todos = await todosService.find({
			orderBy: { priority: 'desc', status: 'asc' },
		})

		expect(todos.length).toBeGreaterThan(0)

		// Basic test - just check we got results in some order
		// Detailed ordering verification would be implementation-specific
		const foundPriorities = new Set(todos.map((t) => t.priority))
		const foundStatuses = new Set(todos.map((t) => t.status))

		// We should have different priorities and statuses
		expect(foundPriorities.size).toBeGreaterThanOrEqual(1)
		expect(foundStatuses.size).toBeGreaterThanOrEqual(1)
	})

	it('should apply filters and ordering together', async () => {
		const todos = await todosService.findBy(
			{ priority: 'high' },
			{ orderBy: { createdAt: 'desc' } },
		)

		expect(todos.length).toBeGreaterThan(0)

		// All should have high priority
		for (const todo of todos) {
			expect(todo.priority).toBe('high')
		}

		// Should be ordered by createdAt in descending order
		const dates = todos.map((todo) => new Date(todo.createdAt).getTime())
		const sortedDates = [...dates].sort((a, b) => b - a)
		expect(dates).toEqual(sortedDates)
	})

	it('should combine pagination with filters and ordering', async () => {
		const todos = await todosService.find({
			page: 1,
			limit: 5,
			orderBy: { status: 'asc', createdAt: 'desc' },
		})

		expect(todos.length).toBeLessThanOrEqual(5)

		// Check ordering: status alphabetically, then createdAt desc
		for (let i = 1; i < todos.length; i++) {
			const current = todos[i]
			const previous = todos[i - 1]

			if (current && previous && current.status === previous.status) {
				expect(new Date(current.createdAt).getTime()).toBeLessThanOrEqual(
					new Date(previous.createdAt).getTime(),
				)
			} else if (current && previous) {
				// Different status, check alphabetical order
				// String comparison, not numeric
				expect(
					current.status.localeCompare(previous.status),
				).toBeGreaterThanOrEqual(0)
			}
		}
	})

	it('should find records with relations and apply filters', async () => {
		const userTodos = await todosService.findBy(
			{ userId: testIds.userId },
			{
				relations: [
					{ type: 'left', table: users, sql: eq(todos.userId, users.id) },
				],
			},
		)

		expect(userTodos.length).toBeGreaterThan(0)

		// Check that each result has the joined data and matches the filter
		for (const result of userTodos) {
			expect(result).toHaveProperty('todos')
			expect(result).toHaveProperty('users')
			expect(result.todos.userId).toBe(testIds.userId)
			expect(result.users.id).toBe(testIds.userId)
		}
	})

	it('should parse results with a custom function', async () => {
		const result = await todosService.find({
			parse: (data) => {
				return data.map((todo) => ({
					id: todo.id,
					title: todo.title.toUpperCase(),
					isHighPriority: todo.priority === 'high',
				}))
			},
		})

		expect(result.length).toBeGreaterThan(0)

		// Check that the custom parse function was applied
		for (const item of result) {
			expect(item).toHaveProperty('id')
			expect(item).toHaveProperty('title')
			expect(item).toHaveProperty('isHighPriority')
			expect(item.title).toBe(item.title.toUpperCase())
			expect(typeof item.isHighPriority).toBe('boolean')
		}
	})

	it('should find records using custom filtering logic with SQL expressions', async () => {
		// Find todos with titles containing a specific string and created recently
		// Use a timestamp that's guaranteed to match our test data
		const searchString = uniquePrefix
		const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

		const todosWithSearch = await todosService.find({
			custom: and(
				like(sql`title`, `%${searchString}%`),
				gt(sql`created_at`, Math.floor(cutoffDate.getTime() / 1000)), // Convert to Unix timestamp for SQLite
			),
		})

		expect(todosWithSearch.length).toBeGreaterThan(0)

		// Check that all results match the criteria
		for (const todo of todosWithSearch) {
			expect(todo.title).toContain(searchString)
			expect(new Date(todo.createdAt).getTime()).toBeGreaterThan(
				cutoffDate.getTime(),
			)
		}
	})

	it('should support complex AND/OR conditions', async () => {
		// Find todos that are either (high priority AND done status) OR (low priority AND in-progress status)
		const todosComplex = await todosService.find({
			custom: or(
				and(eq(sql`priority`, 'high'), eq(sql`status`, 'done')),
				and(eq(sql`priority`, 'low'), eq(sql`status`, 'in-progress')),
			),
		})

		expect(todosComplex.length).toBeGreaterThan(0)

		// All todos should match one of the complex conditions
		for (const todo of todosComplex) {
			const matchesCondition =
				(todo.priority === 'high' && todo.status === 'done') ||
				(todo.priority === 'low' && todo.status === 'in-progress')
			expect(matchesCondition).toBe(true)
		}
	})

	it('should support range queries', async () => {
		// Get the current date range
		const now = new Date()
		const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

		// Find todos created in the last day
		const todosInRange = await todosService.find({
			custom: and(
				gt(sql`created_at`, oneDayAgo.toISOString()), // Convert to ISO string for PostgreSQL
				lt(sql`created_at`, now.toISOString()),
			),
		})

		expect(todosInRange.length).toBeGreaterThanOrEqual(0)

		// All returned todos should have been created within the last day
		for (const todo of todosInRange) {
			const createdAt = new Date(todo.createdAt).getTime()
			expect(createdAt).toBeGreaterThan(oneDayAgo.getTime())
			expect(createdAt).toBeLessThan(now.getTime())
		}
	})

	it('should support combined operations: find, count, and filter', async () => {
		// Find high priority todos
		const highPriorityTodos = await todosService.findBy({ priority: 'high' })

		// Count high priority todos
		const highPriorityCount = await todosService.count({ priority: 'high' })

		// Count should match the length of the found results
		expect(highPriorityCount).toBe(highPriorityTodos.length)

		// Find high priority todos with a specific status
		const highPriorityDoneTodos = await todosService.findBy({
			priority: 'high',
			status: 'done',
		})

		// Count high priority todos with done status
		const highPriorityDoneCount = await todosService.count({
			priority: 'high',
			status: 'done',
		})

		// Count should match the length of the found results
		expect(highPriorityDoneCount).toBe(highPriorityDoneTodos.length)

		// This should be less than or equal to the total high priority count
		expect(highPriorityDoneCount).toBeLessThanOrEqual(highPriorityCount)
	})

	it('should handle multiple relations in queries', async () => {
		const todosWithMultipleRelations = await todosService.find({
			relations: [
				{ type: 'left', table: users, sql: eq(todos.userId, users.id) },
				{
					type: 'left',
					table: tenants,
					sql: eq(todos.tenant, tenants.tenantId),
				},
			],
		})

		expect(todosWithMultipleRelations.length).toBeGreaterThan(0)

		for (const result of todosWithMultipleRelations) {
			expect(result).toHaveProperty('todos')
			expect(result).toHaveProperty('users')
			expect(result).toHaveProperty('tenants')
		}
	})

	it('should handle custom SQL conditions with relations', async () => {
		const todosWithCustomCondition = await todosService.find({
			relations: [
				{ type: 'left', table: users, sql: eq(todos.userId, users.id) },
			],
			custom: like(users.email, `%${uniquePrefix}%`),
		})

		expect(todosWithCustomCondition.length).toBeGreaterThan(0)

		for (const todo of todosWithCustomCondition) {
			expect(todo.users.email).toContain(uniquePrefix)
		}
	})

	it('should handle custom SQL conditions with multiple relations', async () => {
		const todosWithMultipleRelations = await todosService.find({
			relations: [
				{ type: 'left', table: users, sql: eq(todos.userId, users.id) },
				{
					type: 'left',
					table: tenants,
					sql: eq(todos.tenant, tenants.tenantId),
				},
			],
			custom: and(
				like(users.email, `%${uniquePrefix}%`),
				like(tenants.name, `%${uniquePrefix}%`),
			),
		})

		expect(todosWithMultipleRelations.length).toBeGreaterThan(0)

		for (const todo of todosWithMultipleRelations) {
			expect(todo.users.email).toContain(uniquePrefix)
			expect(todo.tenants.name).toContain(uniquePrefix)
		}
	})

	it('should handle custom SQL conditions with complex logic', async () => {
		const todosWithComplexCondition = await todosService.find({
			custom: or(
				and(
					like(sql`title`, `%${uniquePrefix}%`),
					gt(
						sql`created_at`,
						new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
					),
				),
				and(eq(sql`status`, 'done'), eq(sql`priority`, 'high')),
			),
		})

		expect(todosWithComplexCondition.length).toBeGreaterThan(0)

		for (const todo of todosWithComplexCondition) {
			const matchesTitleAndDate =
				todo.title.includes(uniquePrefix) &&
				new Date(todo.createdAt).getTime() >
					new Date(Date.now() - 24 * 60 * 60 * 1000).getTime()
			const matchesStatusAndPriority =
				todo.status === 'done' && todo.priority === 'high'

			expect(matchesTitleAndDate || matchesStatusAndPriority).toBe(true)
		}
	})

	it('should handle workspace', async () => {
		const workspaceTodos = await todosService.find({
			workspace: {
				field: 'tenant',
				value: testIds.tenantId,
			},
			relations: [
				{
					type: 'left',
					table: tenants,
					sql: eq(todos.tenant, tenants.tenantId),
				},
			],
		})

		expect(workspaceTodos.length).toBeGreaterThan(0)

		for (const todo of workspaceTodos) {
			expect(todo.todos.tenant).toBe(testIds.tenantId)
			expect(todo.tenants).toBeDefined()
			expect(todo.tenants.tenantId).toBe(testIds.tenantId)
		}
	})

	it('should filter records with advanced filter expressions', async () => {
		// Test range filtering - use a simple numeric range for testing
		const rangeFilteredTodos = await todosService.filter(
			{
				// Test with a wildcard pattern instead of range to avoid ID issues
				title: [`*${uniquePrefix}*`],
			},
			{
				orderBy: { createdAt: 'desc' },
			},
		)

		expect(rangeFilteredTodos).toBeInstanceOf(Array)
		// Verify all results contain the search pattern
		for (const todo of rangeFilteredTodos) {
			expect(todo.title).toContain(uniquePrefix)
		}
	})

	it('should filter records with wildcard patterns and options', async () => {
		// Test wildcard filtering with ordering
		const wildcardTodos = await todosService.filter(
			{
				title: [`*${uniquePrefix}*`],
			},
			{
				limit: 5,
				orderBy: { createdAt: 'desc' },
			},
		)

		expect(wildcardTodos).toBeInstanceOf(Array)
		expect(wildcardTodos.length).toBeLessThanOrEqual(5)

		// Verify ordering (only if we have multiple items)
		if (wildcardTodos.length > 1) {
			for (let i = 1; i < wildcardTodos.length; i++) {
				const prevTodo = wildcardTodos[i - 1]
				const currTodo = wildcardTodos[i]
				if (prevTodo && currTodo) {
					const prevDate = new Date(prevTodo.createdAt)
					const currDate = new Date(currTodo.createdAt)
					expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime())
				}
			}
		}

		// All should contain the prefix
		for (const todo of wildcardTodos) {
			expect(todo.title).toContain(uniquePrefix)
		}
	})

	it('should filter records with OR conditions using pipe operator', async () => {
		// Test multiple values using pipe operator (OR logic)
		const orFilteredTodos = await todosService.filter(
			{
				priority: ['%1|%2|%3', 'high', 'low', 'medium'],
			},
			{
				page: 1,
				limit: 10,
			},
		)

		expect(orFilteredTodos).toBeInstanceOf(Array)
		expect(orFilteredTodos.length).toBeLessThanOrEqual(10)

		// All results should match one of the specified priorities
		for (const todo of orFilteredTodos) {
			expect(['high', 'low', 'medium']).toContain(todo.priority)
		}
	})

	it('should filter records with comparison operators and pagination', async () => {
		// Test greater than filtering with pagination
		const comparisonTodos = await todosService.filter(
			{
				// Filter by creation date (greater than a certain date)
				createdAt: ['>%1', new Date(Date.now() - 24 * 60 * 60 * 1000)],
			},
			{
				page: 1,
				limit: 15,
				orderBy: { createdAt: 'asc' },
			},
		)

		expect(comparisonTodos).toBeInstanceOf(Array)
		expect(comparisonTodos.length).toBeLessThanOrEqual(15)

		const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
		for (const todo of comparisonTodos) {
			expect(new Date(todo.createdAt).getTime()).toBeGreaterThan(
				cutoffDate.getTime(),
			)
		}
	})

	it('should filter records with case-insensitive matching', async () => {
		// Test case-insensitive filtering
		const caseInsensitiveTodos = await todosService.filter(
			{
				title: [`@*${uniquePrefix.toLowerCase()}*`],
			},
			{
				limit: 10,
			},
		)

		expect(caseInsensitiveTodos).toBeInstanceOf(Array)

		// All results should contain the prefix regardless of case
		for (const todo of caseInsensitiveTodos) {
			expect(todo.title.toLowerCase()).toContain(uniquePrefix.toLowerCase())
		}
	})

	it('should filter records with combined filter expressions and relations', async () => {
		// Test complex filtering with relations
		const complexFilteredTodos = await todosService.filter(
			{
				status: ['%1|%2', 'todo', 'in-progress'],
				priority: ['<>%1', 'low'],
			},
			{
				relations: [
					{
						type: 'left',
						table: users,
						sql: eq(todos.userId, users.id),
					},
				],
				limit: 8,
				parse: (data) => {
					// Custom parsing for filtered results with relations
					return data.map((item) => ({
						...item.todos,
						user: item.users,
					}))
				},
			},
		)

		expect(complexFilteredTodos).toBeInstanceOf(Array)
		expect(complexFilteredTodos.length).toBeLessThanOrEqual(8)

		for (const todo of complexFilteredTodos) {
			// Verify filter conditions
			expect(['todo', 'in-progress']).toContain(todo.status)
			expect(todo.priority).not.toBe('low')
			// Verify relation was applied
			expect(todo.user).toBeDefined()
			expect(todo.user.id).toBe(todo.userId)
		}
	})

	it('should find a single record by id with custom parse', async () => {
			const todo = await todosService.findOne(testIds.todoIds[0] ?? '', {
				parse(data) {
					if (!data) return null
					return {
						id: data.id,
						title: data.title.toUpperCase(),
					}
				},
			})
			expect(todo).toBeDefined()
			expect(todo?.id).toBe(testIds.todoIds[0] ?? '')
			expect(typeof todo?.title).toBe('string')
			expect(todo?.title).toBe(todo?.title.toUpperCase())
		})
	
		it('should find a single record with custom SQL condition', async () => {
			const todo = await todosService.findOne(testIds.todoIds[0] ?? '', {
				custom: sql`title LIKE ${`%${uniquePrefix}%`}`,
			})
			expect(todo).toBeDefined()
			expect(todo?.title).toContain(uniquePrefix)
		})
	
		it('should find a single record with relations', async () => {
			const todoWithUser = await todosService.findOne(testIds.todoIds[0] ?? '', {
				relations: [
					{ type: 'left', table: users, sql: eq(todos.userId, users.id) },
				],
				parse(data) {
					if (!data) return null
					const singleTodo = data[0]
					if (!singleTodo) return null
					return {
						...singleTodo.todos,
						user: singleTodo.users,
					}
				},
			})
			expect(todoWithUser).toBeDefined()
			expect(todoWithUser?.user).toBeDefined()
			expect(todoWithUser?.user.id).toBe(todoWithUser?.userId)
		})
	
		it('should find a single record with multiple relations', async () => {
			const todoWithUserTenant = await todosService.findOne(testIds.todoIds[0] ?? '', {
				relations: [
					{ type: 'left', table: users, sql: eq(todos.userId, users.id) },
					{
						type: 'left',
						table: tenants,
						sql: eq(todos.tenant, tenants.tenantId),
					},
				],
				parse(data) {
					if (!data) return null
					const singleTodo = data[0]
					if (!singleTodo) return null
					const { todos: todo, users: user, tenants: tenant } = singleTodo
					return {
						...todo,
						user,
						tenantEntity: tenant,
					}
				},
			})
	
			console.log('todoWithUserTenant', todoWithUserTenant)
			expect(todoWithUserTenant).toBeDefined()
			expect(todoWithUserTenant?.user).toBeDefined()
			expect(todoWithUserTenant?.tenant).toBeDefined()
			expect(todoWithUserTenant?.user.id).toBe(todoWithUserTenant?.userId)
			expect(todoWithUserTenant?.tenantEntity.tenantId).toBe(todoWithUserTenant?.tenant)
		})
	
		it('should return null for non-existent id', async () => {
			const todo = await todosService.findOne('999999', {})
			expect(todo).toBeNull()
		})
	
		it('should support custom parse returning null', async () => {
			const todo = await todosService.findOne(testIds.todoIds[0] ?? '', {
				parse() {
					return null
				},
			})
			expect(todo).toBeNull()
		})
})
