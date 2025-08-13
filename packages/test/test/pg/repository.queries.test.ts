import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import {
	itemService,
	mockSaleHeader,
	mockSaleLine,
	salesLinesService,
	salesService,
	userService,
} from './repository'
import { items, salesHeaders, salesLines, stores } from './schema'
import { populate, setup, setupBeforeAll, setupCreations } from './setup'

setupBeforeAll()

describe('SQLITE Service: Query Operations (Basic)', () => {
	// Create test data for queries
	beforeAll(async () => {
		await populate(10)
	})

	it('should find all item records', async () => {
		const items = await itemService.find()
		expect(items).toBeInstanceOf(Array)
		expect(items.length).toBeGreaterThan(0)

		// Verify structure of returned objects
		for (const item of items) {
			expect(item).toHaveProperty('id')
			expect(item).toHaveProperty('name')
			expect(item).toHaveProperty('sku')
			expect(item).toHaveProperty('price')
			expect(item).toHaveProperty('status')
			expect(item).toHaveProperty('type')
			expect(item).toHaveProperty('createdAt')
			expect(item).toHaveProperty('updatedAt')
		}
	})

	it('should find all user records', async () => {
		const users = await userService.find()
		expect(users).toBeInstanceOf(Array)
		expect(users.length).toBeGreaterThan(0)

		// Verify structure of returned objects
		for (const user of users) {
			expect(user).toHaveProperty('id')
			expect(user).toHaveProperty('name')
			expect(user).toHaveProperty('email')
			expect(user).toHaveProperty('type')
			expect(user).toHaveProperty('status')
			expect(user).toHaveProperty('createdAt')
			expect(user).toHaveProperty('updatedAt')
		}
	})

	it('should find a record by ID', async () => {
		if (setup.itemsId.length === 0) {
			await setupCreations.items()
		}

		const itemId = setup.itemsId[0]
		expect(itemId).toBeDefined()

		if (!itemId) {
			throw new Error('No item ID available for testing')
		}

		const item = await itemService.findOne(itemId)

		expect(item).not.toBeNull()
		expect(item?.id).toBe(itemId)
	})

	it('should return null when finding a non-existent ID', async () => {
		const nonExistentId = 'ITM-non-existent-id'
		const item = await itemService.findOne(nonExistentId)

		expect(item).toBeNull()
	})

	it('should find records by exact criteria', async () => {
		// Create an item with specific criteria for testing
		const testItem = await setupCreations.items()

		const items = await itemService.findBy({
			status: testItem.status,
			type: testItem.type,
		})

		expect(items).toBeInstanceOf(Array)
		expect(items.length).toBeGreaterThan(0)

		// All returned items should match the criteria
		for (const item of items) {
			expect(item.status).toBe(testItem.status)
			expect(item.type).toBe(testItem.type)
		}
	})

	it('should find records by matching any of the criteria (OR condition)', async () => {
		const items = await itemService.findByMatching({
			status: 'ACTIVE',
			type: 'ITEM',
		})

		expect(items).toBeInstanceOf(Array)
		expect(items.length).toBeGreaterThan(0)

		expect(
			items.every((item) => item.status === 'ACTIVE' || item.type === 'ITEM'),
		).toBe(true)
	})

	it('should find records by partial criteria with custom criteria (BETWEEN)', async () => {
		const items = await itemService.findBy({
			price: {
				$between: [500, 5000],
			},
		})

		expect(items).toBeInstanceOf(Array)
		expect(items.length).toBeGreaterThan(0)
		expect(items.every((item) => item.price >= 500 && item.price <= 5000)).toBe(
			true,
		)
	})

	it('should find records by partial criteria with custom criteria (NOT EQUAL)', async () => {
		const items = await itemService.findBy({
			category: {
				$neq: 'ELECTRONICS',
			},
		})

		expect(items).toBeInstanceOf(Array)
		expect(items.length).toBeGreaterThan(0)
		expect(items.every((item) => item.category !== 'ELECTRONICS')).toBe(true)
	})

	it('should find records by partial criteria with custom sql function', async () => {
		const items = await itemService.findBy({
			category: eq(itemService.entity.category, 'ELECTRONICS'),
		})

		expect(items).toBeInstanceOf(Array)
		expect(items.length).toBeGreaterThan(0)
		expect(items.every((item) => item.category === 'ELECTRONICS')).toBe(true)
	})

	it('should count records', async () => {
		const totalCount = await itemService.count()
		expect(totalCount).toBeGreaterThan(0)

		// Count with criteria
		const activeCount = await itemService.count({ status: 'ACTIVE' })
		const itemTypeCount = await itemService.count({ type: 'ITEM' })

		// Count by status should return values
		expect(activeCount).toBeGreaterThanOrEqual(0)
		expect(itemTypeCount).toBeGreaterThanOrEqual(0)
	})

	it('should count records with criteria', async () => {
		const activeItemsCount = await itemService.count({ status: 'ACTIVE' })
		const activeItems = await itemService.findBy({ status: 'ACTIVE' })

		expect(activeItemsCount).toBe(activeItems.length)
	})

	it('should find records with cursor pagination', async () => {
		const result = await itemService.findWithCursor({
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

	it('should use cursor pagination with correct ordering', async () => {
		const firstPage = await itemService.findWithCursor({
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
			const secondPage = await itemService.findWithCursor({
				limit: 3,
				cursor: firstPage.nextCursor,
				orderBy: { createdAt: 'desc' },
			})

			// Pagination object should exist
			expect(secondPage.pagination).toBeDefined()
		}
	})

	it('should filter records using search criteria', async () => {
		// Create an item with a specific name pattern for testing
		const testItem = await setupCreations.items()
		const searchPattern = testItem.name.substring(0, 5)

		// Test basic filtering with string pattern matching (contains)
		const itemsWithPattern = await itemService.search({
			name: [`*${searchPattern}*`],
		})

		expect(itemsWithPattern).toBeInstanceOf(Array)
		expect(itemsWithPattern.length).toBeGreaterThan(0)

		// All returned items should have names containing the pattern
		for (const item of itemsWithPattern) {
			expect(item.name).toContain(searchPattern)
		}
	})

	it('should filter records with multiple criteria', async () => {
		// Test filtering with multiple fields using exact match
		const filteredItems = await itemService.search({
			status: ['%1', 'ACTIVE'],
			type: ['%1', 'ITEM'],
		})

		expect(filteredItems).toBeInstanceOf(Array)

		// All returned items should match all criteria
		for (const item of filteredItems) {
			expect(item.status).toBe('ACTIVE')
			expect(item.type).toBe('ITEM')
		}
	})

	it('should search records with no results', async () => {
		// Test searching that returns no results
		const filteredItems = await itemService.search({
			name: ['*non-existent-filter-pattern-xyz*'],
		})

		expect(filteredItems).toBeInstanceOf(Array)
		expect(filteredItems).toHaveLength(0)
	})

	it('should find the first record', async () => {
		const firstItem = await itemService.findFirst()

		expect(firstItem).not.toBeNull()
		expect(firstItem).toHaveProperty('id')
		expect(firstItem).toHaveProperty('name')
		expect(firstItem).toHaveProperty('sku')
		expect(firstItem).toHaveProperty('price')
		expect(firstItem).toHaveProperty('status')
		expect(firstItem).toHaveProperty('type')
		expect(firstItem).toHaveProperty('createdAt')
		expect(firstItem).toHaveProperty('updatedAt')

		// Verify that the first item matches what find() returns as first element
		const allItems = await itemService.find()
		expect(allItems).toBeInstanceOf(Array)
		expect(allItems.length).toBeGreaterThan(0)
		const firstFromFind = allItems[0]
		if (!firstFromFind || !firstItem) {
			throw new Error('No items found to verify first record')
		}
		expect(firstItem.id).toBe(firstFromFind.id)
	})

	it('should find records with pagination', async () => {
		const page1 = await itemService.find({ page: 1, limit: 3 })
		const page2 = await itemService.find({ page: 2, limit: 3 })

		expect(page1).toHaveLength(3)
		expect(page2.length).toBeGreaterThanOrEqual(0)

		// Page 1 and page 2 should contain different records
		const page1Ids = page1.map((item) => item.id)
		const page2Ids = page2.map((item) => item.id)

		// No overlapping IDs between pages
		const overlapping = page1Ids.filter((id) => page2Ids.includes(id))
		expect(overlapping).toHaveLength(0)
	})

	it('should order results by a single field ascending', async () => {
		const items = await itemService.find({
			orderBy: { name: 'asc' },
			limit: 10,
		})

		expect(items.length).toBeGreaterThan(0)

		// Check if names are sorted in ascending order
		for (let i = 1; i < items.length; i++) {
			const currentItem = items[i]
			const previousItem = items[i - 1]
			if (currentItem && previousItem) {
				expect(
					currentItem.name.localeCompare(previousItem.name),
				).toBeGreaterThanOrEqual(0)
			}
		}
	})

	it('should order results by a single field descending', async () => {
		const users = await userService.find({
			orderBy: { name: 'desc' },
			limit: 10,
		})

		expect(users.length).toBeGreaterThan(0)

		// Check if names are sorted in descending order
		for (let i = 1; i < users.length; i++) {
			const currentUser = users[i]
			const previousUser = users[i - 1]
			if (currentUser && previousUser) {
				expect(
					currentUser.name.localeCompare(previousUser.name),
				).toBeLessThanOrEqual(0)
			}
		}
	})

	it('should use relations to join tables', async () => {
		// Ensure we have sales data with relationships
		if (setup.storesId.length === 0) {
			await setupCreations.stores()
		}

		const salesHeaderData = mockSaleHeader(setup.storesId[0] ?? 1)
		const [error, sale] = await salesService.create(salesHeaderData)

		if (error || !sale) {
			throw new Error('Failed to create sales header for testing')
		}

		// Query sales headers with store relations
		const salesWithRelations = await salesService.find({
			relations: [
				{
					type: 'left',
					table: stores,
					on: eq(salesHeaders.storeId, stores.id),
				},
			],
		})

		expect(salesWithRelations).toBeInstanceOf(Array)
		expect(salesWithRelations.length).toBeGreaterThan(0)

		// Check that the joined data contains store information
		for (const relation of salesWithRelations) {
			expect(relation).toHaveProperty('sales_headers')
			expect(relation).toHaveProperty('stores')
			if (relation.stores && relation.sales_headers) {
				expect(relation.stores.id).toBe(relation.sales_headers.storeId)
			}
		}
	})

	it('should handle complex relations with multiple joins', async () => {
		// Create test data with relationships
		if (setup.itemsId.length === 0 || setup.storesId.length === 0) {
			await setupCreations.items()
			await setupCreations.stores()
		}

		const salesHeaderData = mockSaleHeader(setup.storesId[0] ?? 1)
		const [error, sale] = await salesService.create(salesHeaderData)

		if (error || !sale) {
			throw new Error('Failed to create sales header for testing')
		}

		const saleLineData = mockSaleLine(
			{ no: sale.id, type: sale.documentType },
			{ no: setup.itemsId[0] ?? '', type: 'ITEM', unitPrice: 100 },
		)
		const [lineError, saleLine] = await salesLinesService.create(saleLineData)

		if (lineError || !saleLine) {
			throw new Error('Failed to create sales line for testing')
		}

		// Query sales lines with both item and sales header relations
		const salesLinesWithRelations = await salesLinesService.find({
			relations: [
				{ type: 'left', table: items, on: eq(salesLines.itemNo, items.id) },
				{
					type: 'left',
					table: salesHeaders,
					on: eq(salesLines.documentNo, salesHeaders.id),
				},
			],
		})

		expect(salesLinesWithRelations).toBeInstanceOf(Array)
		expect(salesLinesWithRelations.length).toBeGreaterThan(0)

		// Check that the joined data contains both item and sales header information
		for (const relation of salesLinesWithRelations) {
			expect(relation).toHaveProperty('sales_lines')
			expect(relation).toHaveProperty('items')
			expect(relation).toHaveProperty('sales_headers')
		}
	})

	it('should handle custom parse functions', async () => {
		const result = await itemService.find({
			limit: 5,
			parse: (data) => {
				return data.map((item) => ({
					id: item.id,
					displayName: item.name.toUpperCase(),
					isExpensive: item.price > 1000,
					category: item.category,
				}))
			},
		})

		expect(result.length).toBeGreaterThan(0)

		// Check that the custom parse function was applied
		for (const item of result) {
			expect(item).toHaveProperty('id')
			expect(item).toHaveProperty('displayName')
			expect(item).toHaveProperty('isExpensive')
			expect(item).toHaveProperty('category')
			expect(typeof item.isExpensive).toBe('boolean')
			expect(item.displayName).toBe(item.displayName.toUpperCase())
		}
	})

	it('should handle workspace filtering', async () => {
		// Test workspace filtering using store ID
		if (setup.storesId.length === 0) {
			await setupCreations.stores()
		}

		const storeId = setup.storesId[0] ?? 1
		const salesHeaderData = mockSaleHeader(storeId)
		await salesService.create(salesHeaderData)

		const workspaceSales = await salesService.find({
			workspace: {
				field: 'storeId',
				value: storeId,
			},
		})

		expect(workspaceSales).toBeInstanceOf(Array)

		// All sales should be for the specified store
		for (const sale of workspaceSales) {
			expect(sale.storeId).toBe(storeId)
		}
	})

	it('should find a single record with custom parse', async () => {
		if (setup.itemsId.length === 0) {
			await setupCreations.items()
		}

		const itemId = setup.itemsId[0] ?? ''
		const item = await itemService.findOne(itemId, {
			parse(data) {
				if (!data) return null
				return {
					id: data.id,
					displayName: data.name.toUpperCase(),
					priceFormatted: `$${data.price.toFixed(2)}`,
				}
			},
		})

		expect(item).toBeDefined()
		expect(item?.id).toBe(itemId)
		expect(typeof item?.displayName).toBe('string')
		expect(item?.displayName).toBe(item?.displayName.toUpperCase())
		expect(item?.priceFormatted).toMatch(/^\$\d+\.\d{2}$/)
	})

	it('should return null for non-existent id in findOne', async () => {
		const item = await itemService.findOne('ITM-999999', {})
		expect(item).toBeNull()
	})

	it('should support custom parse returning null', async () => {
		if (setup.itemsId.length === 0) {
			await setupCreations.items()
		}

		const itemId = setup.itemsId[0] ?? ''
		const item = await itemService.findOne(itemId, {
			parse() {
				return null
			},
		})
		expect(item).toBeNull()
	})
})
