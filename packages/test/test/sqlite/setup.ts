import { faker } from '@faker-js/faker'
import { beforeAll } from 'vitest'
import {
	itemEntryService,
	itemService,
	mockItem,
	mockSaleHeader,
	mockSaleLine,
	mockStore,
	mockUser,
	salesLinesService,
	salesService,
	storeService,
	userService,
} from './repository'

let alreadySetup = false
export const setup: {
	itemsId: string[]
	usersId: number[]
	storesId: number[]
} = {
	itemsId: [],
	usersId: [],
	storesId: [],
}
export const setupCreations = {
	items: async () => {
		const [error, data] = await itemService.create(mockItem())
		if (error) throw new Error(`Failed to create item: ${error}`)
		setup.itemsId.push(data.id)
		return data
	},
	users: async () => {
		const [error, data] = await userService.create(mockUser())
		if (error) throw new Error(`Failed to create user: ${error}`)
		setup.usersId.push(data.id)
		return data
	},
	stores: async () => {
		const [error, data] = await storeService.create(mockStore())
		if (error) throw new Error(`Failed to create store: ${error}`)
		setup.storesId.push(data.id)
		return data
	},
}
export function setupBeforeAll() {
	beforeAll(async () => {
		if (alreadySetup) return
		const itemsMock = Array.from({ length: 20 }, () => mockItem())
		const usersMock = Array.from({ length: 5 }, () => mockUser())
		const storesMock = Array.from({ length: 5 }, () => mockStore())
		await itemService.bulkCreate(itemsMock, {
			afterAction: async (items) => {
				items.forEach((element) => {
					setup.itemsId.push(element.id)
				})
			},
		})
		await userService.bulkCreate(usersMock, {
			afterAction: async (users) => {
				users.forEach((element) => {
					setup.usersId.push(element.id)
				})
			},
		})
		await storeService.bulkCreate(storesMock, {
			afterAction: async (stores) => {
				stores.forEach((element) => {
					setup.storesId.push(element.id)
				})
			},
		})
		alreadySetup = true
	})
}

export async function populate(length: number) {
	const storesMock = Array.from({ length }, () => mockStore())

	await storeService.bulkCreate(storesMock, {
		afterAction: async (stores) => {
			stores.forEach((element) => {
				setup.storesId.push(element.id)
			})
			for (const store of stores) {
				const headerMock = mockSaleHeader(store.id)
				await salesService.create(headerMock, {
					afterAction: async (sale) => {
						const itemsMock = Array.from(
							{ length: faker.number.int({ min: 10, max: 25 }) },
							() => mockItem(),
						)
						await itemService.bulkCreate(itemsMock, {
							afterAction: async (items) => {
								items.forEach((element) => {
									setup.itemsId.push(element.id)
								})
								const saleLines = items.map((item) => ({
									...mockSaleLine(
										{ no: sale.id, type: sale.documentType },
										{ no: item.id, type: item.type, unitPrice: item.price },
									),
								}))
								await salesLinesService.bulkCreate(saleLines, {
									afterAction: async (lines) => {
										const amount = lines.reduce(
											(acc, line) => acc + parseFloat(line.amount.toString()),
											0,
										)
										const tax = lines.reduce(
											(acc, line) => acc + parseFloat(line.tax.toString()),
											0,
										)
										await salesService.update(
											sale.id,
											{ amount, tax },
											{
												afterAction: async () => {
													await itemEntryService.addInventory(
														items.map((item) => item.id),
														faker.number.int({ min: 1000, max: 5000 }),
														store.id,
													)
												},
											},
										)
									},
								})
							},
						})
					},
				})
			}
		},
	})
}
