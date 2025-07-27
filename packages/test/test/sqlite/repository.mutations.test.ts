import { describe, expect, it } from 'vitest'
import {
	createTodo,
	testIds,
	todosService,
	uniquePrefix,
	userSchema,
	userService,
} from './repository'
import { setupBeforeAll } from './test-setup'

setupBeforeAll()

describe('SQLITE Service: Mutation Operations', () => {
	it('should create a record with required fields', async () => {
		const [error, todo] = await todosService.create({
			title: `${uniquePrefix}-Simple`,
			userId: testIds.userId,
			tenant: testIds.tenantId,
		})

		expect(error).toBeNull()
		expect(todo).toBeDefined()
		expect(todo?.id).toBeDefined()
		expect(todo?.title).toBe(`${uniquePrefix}-Simple`)
		expect(todo?.userId).toBe(testIds.userId)
		expect(todo?.status).toBe('todo') // Default value
		expect(todo?.priority).toBe('medium') // Default value

		if (todo) testIds.todoIds.push(todo.id)
	})

	it('should create a record with all fields specified', async () => {
		const [error, todo] = await todosService.create({
			title: `${uniquePrefix}-Complete`,
			description: 'This is a complete todo',
			userId: testIds.userId,
			status: 'in-progress',
			tenant: testIds.tenantId,
			priority: 'high',
			label: 'bug',
		})

		expect(error).toBeNull()
		expect(todo).toBeDefined()
		expect(todo?.id).toBeDefined()
		expect(todo?.title).toBe(`${uniquePrefix}-Complete`)
		expect(todo?.description).toBe('This is a complete todo')
		expect(todo?.status).toBe('in-progress')
		expect(todo?.priority).toBe('high')
		expect(todo?.label).toBe('bug')

		if (todo) testIds.todoIds.push(todo.id)
	})

	it('should update a record with partial data', async () => {
		const todo = await createTodo(999)

		const [error, updated] = await todosService.update(todo.id, {
			title: `${uniquePrefix}-Updated`,
			status: 'in-progress',
		})

		expect(error).toBeNull()
		expect(updated).toBeDefined()
		expect(updated?.id).toBe(todo.id)
		expect(updated?.title).toBe(`${uniquePrefix}-Updated`)
		expect(updated?.status).toBe('in-progress')
		// Fields not specified in the update should remain unchanged
		expect(updated?.description).toBe(todo.description)
		expect(updated?.priority).toBe(todo.priority)
	})

	it('should update a record with all fields', async () => {
		const todo = await createTodo(998)

		const [error, updated] = await todosService.update(todo.id, {
			title: `${uniquePrefix}-Fully-Updated`,
			description: 'This is a fully updated description',
			status: 'done',
			priority: 'low',
			label: 'documentation',
		})

		expect(error).toBeNull()
		expect(updated).toBeDefined()
		expect(updated?.id).toBe(todo.id)
		expect(updated?.title).toBe(`${uniquePrefix}-Fully-Updated`)
		expect(updated?.description).toBe('This is a fully updated description')
		expect(updated?.status).toBe('done')
		expect(updated?.priority).toBe('low')
		expect(updated?.label).toBe('documentation')
	})

	it('should soft delete a record', async () => {
		const todo = await createTodo(997)

		const { success, message } = await todosService.delete(todo.id)

		expect(success).toBe(true)
		expect(message).toContain('successfully soft deleted')

		// Verify the record is soft deleted
		const deleted = await todosService.findOne(todo.id)
		expect(deleted).not.toBeNull()
		expect(deleted?.status).toBe('canceled')
	})

	it('should not find soft deleted records by default', async () => {
		const todo = await createTodo(996)

		await todosService.delete(todo.id)

		// Soft deleted records should not be returned in normal queries
		const todos = await todosService.find()
		const found = todos.find((t) => t.id === todo.id)
		expect(found).toBeUndefined()
	})

	it('should find soft deleted records when withDeleted option is used', async () => {
		const todo = await createTodo(995)

		await todosService.delete(todo.id)

		// Soft deleted records should be returned when withDeleted is true
		const todos = await todosService.find({ withDeleted: true })
		const found = todos.find((t) => t.id === todo.id)
		expect(found).toBeDefined()
		expect(found?.status).toBe('canceled')
	})

	it('should use custom soft delete implementation', async () => {
		const todo = await createTodo(994)

		await todosService.delete(todo.id)

		const deletedTodos = await todosService.getSoftDeleted()
		expect(deletedTodos.length).toBeGreaterThan(0)
		const found = deletedTodos.find((t) => t.id === todo.id)
		expect(found).toBeDefined()
		expect(found?.status).toBe('canceled')
	})

	it('should restore a soft deleted record', async () => {
		const todo = await createTodo(992)

		// First soft delete the record
		const deleteResult = await todosService.delete(todo.id)
		expect(deleteResult.success).toBe(true)
		expect(deleteResult.message).toContain('successfully soft deleted')

		// Verify it's soft deleted
		const deleted = await todosService.findOne(todo.id)
		expect(deleted).not.toBeNull()
		expect(deleted?.status).toBe('canceled')

		// Now restore it
		const restoreResult = await todosService.restore(todo.id)
		expect(restoreResult.success).toBe(true)
		expect(restoreResult.message).toContain('successfully restored')

		// Verify it's restored
		const restored = await todosService.findOne(todo.id)
		expect(restored).not.toBeNull()
		expect(restored?.status).not.toBe('canceled')
		expect(restored?.id).toBe(todo.id)
	})

	it('should handle restore with lifecycle hooks', async () => {
		const todo = await createTodo(991)
		let hookCalled = false

		// First soft delete the record
		await todosService.delete(todo.id)

		// Restore with hooks
		const restoreResult = await todosService.restore(todo.id, {
			afterAction: async (data) => {
				hookCalled = true
				expect(data.id).toBe(todo.id)
				expect(data.status).not.toBe('canceled')
				return Promise.resolve()
			},
		})

		expect(restoreResult.success).toBe(true)
		expect(hookCalled).toBe(true)
	})

	it('should handle restore of non-existent record', async () => {
		const nonExistentId = 'non-existent-id'
		const restoreResult = await todosService.restore(nonExistentId)

		expect(restoreResult.success).toBe(false)
		expect(restoreResult.message).toContain('not found')
	})

	it('should handle the lifecycle hooks during create', async () => {
		let hookCalled = false

		const [error, todo] = await todosService.create(
			{
				title: `${uniquePrefix}-Hooks`,
				userId: testIds.userId,
				tenant: testIds.tenantId,
			},
			{
				afterAction: async (data) => {
					hookCalled = true
					expect(data.id).toBeDefined()
					return Promise.resolve()
				},
			},
		)

		expect(error).toBeNull()
		expect(todo).toBeDefined()
		expect(hookCalled).toBe(true)

		if (todo) testIds.todoIds.push(todo.id)
	})

	it('should handle the lifecycle hooks during update', async () => {
		const todo = await createTodo(993)
		let hookCalled = false

		const [error, updated] = await todosService.update(
			todo.id,
			{
				title: `${uniquePrefix}-Updated-With-Hooks`,
			},
			{
				afterAction: async (data) => {
					hookCalled = true
					expect(data.id).toBe(todo.id)
					expect(data.title).toBe(`${uniquePrefix}-Updated-With-Hooks`)
					return Promise.resolve()
				},
			},
		)

		expect(error).toBeNull()
		expect(updated).toBeDefined()
		expect(hookCalled).toBe(true)
	})

	it('should throw an zod validation error for invalid data', async () => {
		const invalidData = {
			email: 'invalid-email',
			name: '',
			tenant: 0,
		}

		const [error, user] = await userService.create(invalidData, {
			async beforeAction(data) {
				userSchema.parse(data)
			},
		})
		expect(error).toBeDefined()
		expect(user).toBeNull()
	})

	it('should throw an zod validation error for invalid data', async () => {
		const invalidData = {
			email: 'invalid-email',
			name: '',
			tenant: 0,
		}

		const [error, user] = await userService.create(invalidData, {
			async beforeAction(data) {
				userSchema.parse(data)
			},
		})
		expect(error).toBeDefined()
		expect(user).toBeNull()
	})

	it('should handle custom error messages for validation errors', async () => {
		const invalidData = {
			email: 'invalid-email',
			name: '',
			tenant: 0,
		}

		const [error, user] = await userService.create(invalidData, {
			async beforeAction(data) {
				try {
					userSchema.parse(data)
				} catch (_e) {
					throw new Error('Custom validation error message')
				}
			},
		})
		expect(error).toBeDefined()
		if (!error) throw new Error('Expected error to be defined')
		expect(error.message).toBe('Custom validation error message')
		expect(user).toBeNull()
	})

	it('should create a record after not finding it', async () => {
		const nonExistentId = `${performance.now()}-non-existent`
		const [error, todo] = await todosService.findOrCreate({
			id: nonExistentId,
			title: `${uniquePrefix}-FindOrCreate`,
			userId: testIds.userId,
			tenant: testIds.tenantId,
		})
		expect(error).toBeNull()
		expect(todo).toBeDefined()
		expect(todo?.id).toBe(nonExistentId)
		expect(todo?.title).toBe(`${uniquePrefix}-FindOrCreate`)
		expect(todo?.userId).toBe(testIds.userId)
		expect(todo?.status).toBe('todo') // Default value
		expect(todo?.priority).toBe('medium') // Default value
		if (todo) testIds.todoIds.push(todo.id)
	})

	it('should not create a record if it already exists', async () => {
		const existingTodo = await createTodo(990)
		const [error, todo] = await todosService.findOrCreate({
			id: existingTodo.id,
			title: `${uniquePrefix}-FindOrCreate-Existing`,
			userId: testIds.userId,
			tenant: testIds.tenantId,
		})
		expect(error).toBeNull()
		expect(todo).toBeDefined()
		expect(todo?.id).toBe(existingTodo.id)
		expect(todo?.title).toBe(existingTodo.title) // Should not change the title
	})
	it('should handle findOrCreate with lifecycle hooks', async () => {
		let hookCalled = false

		const [error, todo] = await todosService.findOrCreate(
			{
				id: `${uniquePrefix}-FindOrCreate-Hooks`,
				title: `${uniquePrefix}-Hooks-${performance.now()}`,
				userId: testIds.userId,
				tenant: testIds.tenantId,
			},
			{
				async afterAction(data) {
					hookCalled = true
					expect(data.id).toBeDefined()
					return Promise.resolve()
				},
			},
		)

		expect(error).toBeNull()
		expect(todo).toBeDefined()
		expect(hookCalled).toBe(true)

		if (todo) testIds.todoIds.push(todo.id)
	})

	it('should handle findOrCreate with existing record', async () => {
		const existingTodo = await createTodo(989)
		let hookCalled = false

		const [error, todo] = await todosService.findOrCreate(
			{
				id: existingTodo.id,
				title: `${uniquePrefix}-FindOrCreate-Existing-Hooks`,
				userId: testIds.userId,
				tenant: testIds.tenantId,
			},
			{
				async afterAction(data) {
					hookCalled = true
					expect(data.id).toBe(existingTodo.id)
					expect(data.title).toBe(existingTodo.title) // Should not change the title
					return Promise.resolve()
				},
			},
		)

		expect(error).toBeNull()
		expect(todo).toBeDefined()
		expect(hookCalled).toBe(true)
	})

	it('should upsert a record', async () => {
		const nonExistentId = `${performance.now()}-upsert-non-existent`
		const nonExistentTitle = `${uniquePrefix}-Upsert-${performance.now()}`
		const [error, todo] = await todosService.upsert({
			id: nonExistentId,
			title: nonExistentTitle,
			userId: testIds.userId,
			tenant: testIds.tenantId,
		})
		expect(error).toBeNull()
		expect(todo).toBeDefined()
		expect(todo?.id).toBe(nonExistentId)
		expect(todo?.title).toBe(nonExistentTitle)
		expect(todo?.userId).toBe(testIds.userId)
		expect(todo?.status).toBe('todo') // Default value
		expect(todo?.priority).toBe('medium') // Default value
		if (todo) testIds.todoIds.push(todo.id)

		const updatedTitle = `${nonExistentTitle}-Updated`
		const [updateError, updatedTodo] = await todosService.upsert({
			id: nonExistentId,
			title: updatedTitle,
			userId: testIds.userId,
			tenant: testIds.tenantId,
		})
		expect(updateError).toBeNull()
		expect(updatedTodo).toBeDefined()
		expect(updatedTodo?.id).toBe(nonExistentId)
		expect(updatedTodo?.title).toBe(updatedTitle)
		expect(updatedTodo?.userId).toBe(testIds.userId)
		expect(updatedTodo?.status).toBe('todo') // Should remain the same
		expect(updatedTodo?.priority).toBe('medium') // Should remain the same
	})

	it('should handle upsert with lifecycle hooks', async () => {
		let hookCalled = false

		const [error, todo] = await todosService.upsert(
			{
				id: `${uniquePrefix}-Upsert-Hooks`,
				title: `${uniquePrefix}-Hooks-${performance.now()}`,
				userId: testIds.userId,
				tenant: testIds.tenantId,
			},
			{
				async afterAction(data) {
					hookCalled = true
					expect(data.id).toBeDefined()
					return Promise.resolve()
				},
			},
		)

		expect(error).toBeNull()
		expect(todo).toBeDefined()
		expect(hookCalled).toBe(true)

		if (todo) testIds.todoIds.push(todo.id)
		if (!todo) throw new Error('Expected todo to be defined')
		const updatedTitle = `${uniquePrefix}-Upsert-Hooks-Updated-${performance.now()}`
		const [updateError, updatedTodo] = await todosService.upsert(
			{
				id: todo.id,
				title: updatedTitle,
				userId: testIds.userId,
				tenant: testIds.tenantId,
			},
			{
				async afterAction(data) {
					hookCalled = true
					expect(data.id).toBe(todo.id)
					expect(data.title).toBe(updatedTitle)
					return Promise.resolve()
				},
			},
		)

		expect(updateError).toBeNull()
		expect(updatedTodo).toBeDefined()
		expect(hookCalled).toBe(true)

		if (updatedTodo) testIds.todoIds.push(updatedTodo.id)
	})
})
