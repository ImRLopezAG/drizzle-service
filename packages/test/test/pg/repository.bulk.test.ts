import { beforeAll, describe, expect, it } from 'vitest'
import {
	itemService,
	mockItem,
	mockSaleHeader,
	mockUser,
	salesService,
	storeService,
	userService,
} from './repository'
import { setup, setupBeforeAll, setupCreations, populate } from './setup'

setupBeforeAll()

describe('PG Service: Bulk Mutation Operations', () => {
  beforeAll(async () => {
   await populate(2)
  })
	it('should bulk create multiple item records', async () => {
		const itemsToCreate = Array.from({ length: 5 }, () => mockItem())

		const [batch, data] = await itemService.bulkCreate(itemsToCreate)

		expect(batch.failed).toBe(0)
		expect(data).toBeDefined()
		expect(data).toHaveLength(5)
		expect(batch.processed).toBe(5)

		for (const item of data) {
			expect(item.id).toBeDefined()
			expect(item.name).toBeDefined()
			expect(item.sku).toBeDefined()
			expect(item.price).toBeGreaterThan(0)
		}
	})

	it('should bulk create multiple user records', async () => {
		const usersToCreate = Array.from({ length: 3 }, () => mockUser())

		const [batch, data] = await userService.bulkCreate(usersToCreate)

		expect(batch.failed).toBe(0)
		expect(data).toBeDefined()
		expect(data).toHaveLength(3)
		expect(batch.processed).toBe(3)

		for (const user of data) {
			expect(user.id).toBeDefined()
			expect(user.email).toBeDefined()
			expect(user.name).toBeDefined()
			expect(user.type).toBeDefined()
			expect(user.status).toBeDefined()
		}
	})

	it('should bulk update multiple item records', async () => {
		// Create some items to update
		const createdItems = []
		for (let i = 0; i < 3; i++) {
			createdItems.push(await setupCreations.items())
		}

		const updates = createdItems.map((item, i) => ({
			id: item.id,
			changes: {
				name: `Updated Item ${i}`,
				status: 'INACTIVE' as const,
			},
		}))

		const [batch, data] = await itemService.bulkUpdate(updates)

		expect(batch.failed).toBe(0)
		expect(data).toBeDefined()
		expect(data).toHaveLength(3)
		expect(batch.processed).toBe(3)

		// Verify updates were applied
		for (let i = 0; i < data.length; i++) {
			const updatedItem = data[i]
			if (!updatedItem) continue
			expect(updatedItem.name).toBe(`Updated Item ${i}`)
			expect(updatedItem.status).toBe('INACTIVE')
		}
	})

	it('should bulk soft delete multiple item records', async () => {
		// Create some items to delete
    const mockItems = Array.from({ length: 4 }, () => mockItem())
		const createdItems: typeof itemService.entity.$inferSelect[] = []
		await itemService.bulkCreate(mockItems, {
			afterAction: async (data) => {
				createdItems.push(...data)
			},
		})

		const idsToDelete = createdItems.map((item) => item.id)

		const [, data] = await itemService.bulkDelete(idsToDelete)
		expect(data.success).toBe(true)

		for (const id of idsToDelete) {
			const deleted = await itemService.findOne(id)
			expect(deleted).not.toBeNull()
			expect(deleted?.status).toBe('DISCONTINUED')
		}
	})

	it('should bulk hard delete multiple store records', async () => {
		// Create some stores to hard delete
		const createdStores = []
		for (let i = 0; i < 3; i++) {
			createdStores.push(await setupCreations.stores())
		}

		const idsToHardDelete = createdStores.map((store) => store.id)

		const [, data] = await storeService.bulkHardDelete(idsToHardDelete)

		expect(data.success).toBe(true)
		expect(data.message).toContain('Successfully hard deleted')

		// Verify all are completely removed
		for (const id of idsToHardDelete) {
			const deleted = await storeService.findOne(id)
			expect(deleted).toBeNull()
		}
	})

	it('should handle lifecycle hooks during bulk create', async () => {
		let hookCalled = false

		const usersToCreate = Array.from({ length: 2 }, () => mockUser())

		const [batch, data] = await userService.bulkCreate(usersToCreate, {
			afterAction: async (data) => {
				hookCalled = true
				expect(data).toBeDefined()
				expect(Array.isArray(data)).toBe(true)
				expect(data.length).toBe(2)
				return Promise.resolve()
			},
		})

		expect(batch.failed).toBe(0)
		expect(data).toBeDefined()
		expect(hookCalled).toBe(true)
	})

	it('should bulk restore soft deleted records', async () => {
		// Create and soft delete some items
		const createdItems = []
		for (let i = 0; i < 3; i++) {
			createdItems.push(await setupCreations.items())
		}

		const idsToDelete = createdItems.map((item) => item.id)

		// Soft delete them
		await itemService.bulkDelete(idsToDelete)

		// Verify they are soft deleted
		for (const id of idsToDelete) {
			const deleted = await itemService.findOne(id)
			expect(deleted?.status).toBe('DISCONTINUED')
		}

		// Now restore them
		const [, restoredata] = await itemService.bulkRestore(idsToDelete)

		expect(restoredata.success).toBe(true)
		expect(restoredata.message).toContain('Successfully restored')

		// Verify they are restored
		for (const id of idsToDelete) {
			const restored = await itemService.findOne(id)
			expect(restored).not.toBeNull()
			expect(restored?.status).not.toBe('DISCONTINUED')
		}
	})

	it('should handle bulk operations with error scenarios', async () => {
		// Test with empty array
		const [emptyBatch, emptyData] = await itemService.bulkCreate([])
		expect(emptyBatch.processed).toBe(0)
		expect(emptyData).toHaveLength(0)

		// Test bulk update with non-existent IDs
		const nonExistentUpdates = [
			{
				id: 'ITM-non-existent-id',
				changes: { name: 'Should not work' },
			},
		]

		const [updateBatch] = await itemService.bulkUpdate(nonExistentUpdates)
		expect(updateBatch.failed).toBeGreaterThan(0)
	})

	it('should handle bulk create with sales headers', async () => {
		// Ensure we have stores available
		if (setup.storesId.length === 0) {
			await setupCreations.stores()
		}

		const salesHeadersToCreate = Array.from({ length: 3 }, () =>
			mockSaleHeader(setup.storesId[0] ?? 1),
		)

		const [batch, data] = await salesService.bulkCreate(salesHeadersToCreate)

		expect(batch.failed).toBe(0)
		expect(data).toBeDefined()
		expect(data).toHaveLength(3)
		expect(batch.processed).toBe(3)

		for (const sale of data) {
			expect(sale.id).toBeDefined()
			expect(sale.documentNo).toBeDefined()
			expect(sale.documentType).toBeDefined()
			expect(sale.status).toBeDefined()
			expect(sale.storeId).toBe(setup.storesId[0])
		}
	})
})
