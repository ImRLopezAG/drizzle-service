import { beforeAll, describe, expect, it } from 'vitest'
import {
	itemSchema,
	itemService,
	mockItem,
	mockSaleHeader,
	mockUser,
	salesLinesService,
	salesService,
	storeService,
	userSchema,
	userService,
} from './repository'
import { populate, setup, setupBeforeAll, setupCreations } from './setup'
import { eq } from 'drizzle-orm'

setupBeforeAll()

describe('PG Service: Mutation Operations', () => {
	beforeAll(async () => {
		await populate(2)
	})
	it('should create an item record with required fields', async () => {
		const itemData = mockItem()
		const [error, item] = await itemService.create(itemData)

		expect(error).toBeNull()
		expect(item).toBeDefined()
		expect(item?.id).toBeDefined()
		expect(item?.name).toBe(itemData.name)
		expect(item?.sku).toBe(itemData.sku)
		expect(item?.price).toBe(itemData.price)
		expect(item?.status).toBe(itemData.status)
		expect(item?.type).toBe(itemData.type)
	})

	it('should create a user record with all fields specified', async () => {
		const userData = mockUser()
		const [error, user] = await userService.create(userData)

		expect(error).toBeNull()
		expect(user).toBeDefined()
		expect(user?.id).toBeDefined()
		expect(user?.name).toBe(userData.name)
		expect(user?.email).toBe(userData.email)
		expect(user?.type).toBe(userData.type)
		expect(user?.status).toBe(userData.status)
	})

	it('should update an item record with partial data', async () => {
		const item = await setupCreations.items()

		const [error, updated] = await itemService.update(item.id, {
			name: 'Updated Item Name',
			status: 'INACTIVE',
		})

		expect(error).toBeNull()
		expect(updated).toBeDefined()
		expect(updated?.id).toBe(item.id)
		expect(updated?.name).toBe('Updated Item Name')
		expect(updated?.status).toBe('INACTIVE')
		// Fields not specified in the update should remain unchanged
		expect(updated?.sku).toBe(item.sku)
		expect(updated?.price).toBe(item.price)
	})

	it('should update a user record with all fields', async () => {
		const user = await setupCreations.users()

		const [error, updated] = await userService.update(user.id, {
			name: 'Fully Updated User',
			type: 'ADMIN',
			status: 'SUSPENDED',
		})

		expect(error).toBeNull()
		expect(updated).toBeDefined()
		expect(updated?.id).toBe(user.id)
		expect(updated?.name).toBe('Fully Updated User')
		expect(updated?.type).toBe('ADMIN')
		expect(updated?.status).toBe('SUSPENDED')
		// Email should remain unchanged
		expect(updated?.email).toBe(user.email)
	})

	it('should soft delete an item record', async () => {
		const item = await setupCreations.items()

		const { success, message } = await itemService.delete(item.id)

		expect(success).toBe(true)
		expect(message).toContain('successfully soft deleted')

		// Verify the record is soft deleted (status changed to DISCONTINUED)
		const deleted = await itemService.findOne(item.id)
		expect(deleted).not.toBeNull()
		expect(deleted?.status).toBe('DISCONTINUED')
	})

	it('should soft delete a user record', async () => {
		const user = await setupCreations.users()

		const { success, message } = await userService.delete(user.id)

		expect(success).toBe(true)
		expect(message).toContain('successfully soft deleted')

		// Verify the record is soft deleted (status changed to INACTIVE)
		const deleted = await userService.findOne(user.id)
		expect(deleted).not.toBeNull()
		expect(deleted?.status).toBe('INACTIVE')
	})

	it('should not find soft deleted records by default', async () => {
		const item = await setupCreations.items()

		await itemService.delete(item.id)

		// Soft deleted records should not be returned in normal queries
		const items = await itemService.find()
		const found = items.find((i) => i.id === item.id)
		expect(found).toBeUndefined()
	})

	it('should find soft deleted records when withDeleted option is used', async () => {
		const item = await setupCreations.items()

		await itemService.delete(item.id)

		// Soft deleted records should be returned when withDeleted is true
		const items = await itemService.find({ withDeleted: true })
		const found = items.find((i) => i.id === item.id)
		expect(found).toBeDefined()
		expect(found?.status).toBe('DISCONTINUED')
	})

	it('should restore a soft deleted item record', async () => {
		const item = await setupCreations.items()

		// First soft delete the record
		const deleteResult = await itemService.delete(item.id)
		expect(deleteResult.success).toBe(true)

		// Verify it's soft deleted
		const deleted = await itemService.findOne(item.id)
		expect(deleted?.status).toBe('DISCONTINUED')

		// Now restore it
		const restoreResult = await itemService.restore(item.id)
		expect(restoreResult.success).toBe(true)
		expect(restoreResult.message).toContain('successfully restored')

		// Verify it's restored (status changed back to ACTIVE)
		const restored = await itemService.findOne(item.id)
		expect(restored).not.toBeNull()
		expect(restored?.status).toBe('ACTIVE')
		expect(restored?.id).toBe(item.id)
	})

	it('should restore a soft deleted user record', async () => {
		const user = await setupCreations.users()

		// First soft delete the record
		await userService.delete(user.id)

		// Verify it's soft deleted
		const deleted = await userService.findOne(user.id)
		expect(deleted?.status).toBe('INACTIVE')

		// Now restore it
		const restoreResult = await userService.restore(user.id)
		expect(restoreResult.success).toBe(true)

		// Verify it's restored
		const restored = await userService.findOne(user.id)
		expect(restored).not.toBeNull()
		expect(restored?.status).toBe('ACTIVE')
		expect(restored?.id).toBe(user.id)
	})

	it('should handle restore with lifecycle hooks', async () => {
		const item = await setupCreations.items()
		let hookCalled = false

		// First soft delete the record
		await itemService.delete(item.id)

		// Restore with hooks
		const restoreResult = await itemService.restore(item.id, {
			afterAction: async (data) => {
				hookCalled = true
				expect(data.id).toBe(item.id)
				expect(data.status).toBe('ACTIVE')
				return Promise.resolve()
			},
		})

		expect(restoreResult.success).toBe(true)
		expect(hookCalled).toBe(true)
	})

	it('should handle restore of non-existent record', async () => {
		const nonExistentId = 'ITM-non-existent-id'
		const restoreResult = await itemService.restore(nonExistentId)

		expect(restoreResult.success).toBe(false)
		expect(restoreResult.message).toContain('not found')
	})

	it('should handle lifecycle hooks during create', async () => {
		let hookCalled = false
		const itemData = mockItem()

		const [error, item] = await itemService.create(itemData, {
			afterAction: async (data) => {
				hookCalled = true
				expect(data.id).toBeDefined()
				expect(data.name).toBe(itemData.name)
				return Promise.resolve()
			},
		})

		expect(error).toBeNull()
		expect(item).toBeDefined()
		expect(hookCalled).toBe(true)
	})

	it('should handle lifecycle hooks during update', async () => {
		const item = await setupCreations.items()
		let hookCalled = false

		const [error, updated] = await itemService.update(
			item.id,
			{
				name: 'Updated With Hooks',
			},
			{
				afterAction: async (data) => {
					hookCalled = true
					expect(data.id).toBe(item.id)
					expect(data.name).toBe('Updated With Hooks')
					return Promise.resolve()
				},
			},
		)

		expect(error).toBeNull()
		expect(updated).toBeDefined()
		expect(hookCalled).toBe(true)
	})

	it('should throw a validation error for invalid data', async () => {
		const invalidData = {
			name: '',
			sku: '',
			description: '',
			price: -1,
		} as const

		const [error, item] = await itemService.create(invalidData as never, {
			async beforeAction(data) {
				itemSchema.parse(data)
			},
		})

		expect(error).toBeDefined()
		expect(item).toBeNull()
	})

	it('should handle custom error messages for validation errors', async () => {
		const invalidData = {
			email: 'invalid-email',
			name: '',
		} as const

		const [error, user] = await userService.create(invalidData as never, {
			async beforeAction(data) {
				try {
					userSchema.parse(data)
				} catch {
					throw new Error('Custom validation error message')
				}
			},
		})

		expect(error).toBeDefined()
		if (!error) throw new Error('Expected error to be defined')
		expect(error.message).toBe('Custom validation error message')
		expect(user).toBeNull()
	})

	it('should create a record after not finding it (findOrCreate)', async () => {
		const itemData = mockItem()
		const customId = `ITM-${crypto.randomUUID()}`

		const [error, item] = await itemService.findOrCreate({
			...itemData,
			id: customId,
		})

		expect(error).toBeNull()
		expect(item).toBeDefined()
		expect(item?.id).toBe(customId)
		expect(item?.name).toBe(itemData.name)
		expect(item?.sku).toBe(itemData.sku)
		expect(item?.type).toBe(itemData.type)
		expect(item?.status).toBe(itemData.status)
	})

	it('should not create a record if it already exists (findOrCreate)', async () => {
		const existingItem = await setupCreations.items()

		const [error, item] = await itemService.findOrCreate({
			...mockItem(),
			id: existingItem.id,
		})

		expect(error).toBeNull()
		expect(item).toBeDefined()
		expect(item?.id).toBe(existingItem.id)
		expect(item?.name).toBe(existingItem.name) // Should not change the name
		expect(item?.sku).toBe(existingItem.sku) // Should not change the sku
	})

	it('should handle findOrCreate with lifecycle hooks', async () => {
		let hookCalled = false
		const itemData = mockItem()
		const customId = `ITM-findorcreate-${crypto.randomUUID()}`

		const [error, item] = await itemService.findOrCreate(
			{
				...itemData,
				id: customId,
			},
			{
				async afterAction(data) {
					hookCalled = true
					expect(data.id).toBe(customId)
					return Promise.resolve()
				},
			},
		)

		expect(error).toBeNull()
		expect(item).toBeDefined()
		expect(hookCalled).toBe(true)
	})

	it('should upsert a record (create new)', async () => {
		const itemData = mockItem()
		const customId = `ITM-upsert-${crypto.randomUUID()}`

		const [error, item] = await itemService.upsert({
			...itemData,
			id: customId,
		})

		expect(error).toBeNull()
		expect(item).toBeDefined()
		expect(item?.id).toBe(customId)
		expect(item?.name).toBe(itemData.name)
		expect(item?.sku).toBe(itemData.sku)
		expect(item?.type).toBe(itemData.type)
		expect(item?.status).toBe(itemData.status)
	})

	it('should upsert a record (update existing)', async () => {
		const existingItem = await setupCreations.items()
		const updatedName = `Updated ${existingItem.name}`

		const [error, item] = await itemService.upsert({
			...existingItem,
			name: updatedName,
		})

		expect(error).toBeNull()
		expect(item).toBeDefined()
		expect(item?.id).toBe(existingItem.id)
		expect(item?.name).toBe(updatedName)
		expect(item?.sku).toBe(existingItem.sku)
		expect(item?.type).toBe(existingItem.type)
	})

	it('should handle upsert with lifecycle hooks', async () => {
		let hookCalled = false
		const itemData = mockItem()
		const customId = `ITM-upsert-hooks-${crypto.randomUUID()}`

		const [error, item] = await itemService.upsert(
			{
				...itemData,
				id: customId,
			},
			{
				async afterAction(data) {
					hookCalled = true
					expect(data.id).toBe(customId)
					return Promise.resolve()
				},
			},
		)

		expect(error).toBeNull()
		expect(item).toBeDefined()
		expect(hookCalled).toBe(true)

		if (!item) throw new Error('Expected item to be defined')

		// Test update through upsert
		hookCalled = false
		const updatedName = `${item.name} - Updated`

		const [updateError, updatedItem] = await itemService.upsert(
			{
				...item,
				name: updatedName,
			},
			{
				async afterAction(data) {
					hookCalled = true
					expect(data.id).toBe(item.id)
					expect(data.name).toBe(updatedName)
					return Promise.resolve()
				},
			},
		)

		expect(updateError).toBeNull()
		expect(updatedItem).toBeDefined()
		expect(hookCalled).toBe(true)
		expect(updatedItem?.name).toBe(updatedName)
	})

	it('should handle hard delete of store records', async () => {
		const store = await setupCreations.stores()

		const { success, message } = await storeService.hardDelete(store.id)

		expect(success).toBe(true)
		expect(message).toContain('stores permanently deleted')

		// Verify the record is completely removed
		const deleted = await storeService.findOne(store.id)
		expect(deleted).toBeNull()
	})

	it('should create sales header with store relationship', async () => {
		// Ensure we have a store
		if (setup.storesId.length === 0) {
			await setupCreations.stores()
		}

		const salesHeaderData = mockSaleHeader(setup.storesId[0] ?? 1)
		const [error, sale] = await salesService.create(salesHeaderData)

		expect(error).toBeNull()
		expect(sale).toBeDefined()
		expect(sale?.id).toBeDefined()
		expect(sale?.documentNo).toBe(salesHeaderData.documentNo)
		expect(sale?.documentType).toBe(salesHeaderData.documentType)
		expect(sale?.storeId).toBe(salesHeaderData.storeId)
		expect(sale?.status).toBe(salesHeaderData.status)
		expect(sale?.amount).toBe(salesHeaderData.amount)
	})

	it('should update sales lines with custom statement', async () => {
		const store = await setupCreations.stores()
		const salesHeader = await salesService.mockHeader(store.id)

		const [error, updated] = await salesLinesService.update(1, {
			description: 'Updated description',
		}, {
			custom: eq(salesLinesService.entity.documentNo, salesHeader.id),
		})

		expect(error).toBeNull()

		const updatedLine = await salesLinesService.query.findMany({
			where({ documentNo }, { eq }) {
				return eq(documentNo, salesHeader.id)
			},
		})

		expect(updatedLine).toBeDefined()
		expect(updatedLine.every((line) => line.description === 'Updated description')).toBe(true)
	})
})
