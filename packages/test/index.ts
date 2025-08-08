import {
	itemService,
	mockItem,
	mockSaleHeader,
	mockSaleLine,
	mockStore,
	salesLinesService,
	salesService,
	storeService,
} from './test/sqlite/repository'

try {
	// const itemsMock = Array.from({ length: 20 }, () => mockItem())
	// const storeMock = mockStore()

	// const [errorStore, store] = await storeService.create(storeMock)
	// if (errorStore) throw new Error(`Failed to create store: ${errorStore}`)

	// const { batch, data: items } = await itemService.bulkCreate(itemsMock, {})
	// if (batch.failed > 0) {
	// 	throw new Error(`Failed to create some items: ${batch.failed} errors`)
	// }
	// const saleHeader = mockSaleHeader(store.id)
	// const [errorHeader] = await salesService.create(saleHeader, {
	// 	afterAction: async (created) => {
	// 		const saleLines = items.map((item) => ({
	// 			...mockSaleLine(
	// 				{ no: created.id, type: created.documentType },
	// 				{ no: item.id, type: item.type, unitPrice: item.price },
	// 			),
	// 		}))
	// 		const { batch } = await salesLinesService.bulkCreate(saleLines, {
	// 			afterAction: async (lines) => {
	// 				const amount = lines.reduce(
	// 					(acc, line) => acc + parseFloat(line.amount.toString()),
	// 					0)
	// 				const tax = lines.reduce(
	// 					(acc, line) => acc + parseFloat(line.tax.toString()),
	// 					0,
	// 				)
	// 				await salesService.update(created.id, { amount, tax })
	// 			}
	// 		})
	// 		if (batch.failed > 0) {
	// 			throw new Error(
	// 				`Failed to create some sale lines: ${batch.failed} errors`,
	// 			)
	// 		}
	// 	},
	// })

	// if (errorHeader) {
	// 	throw new Error(`Failed to create sale header: ${errorHeader}`)
	// }

  // const sales = await salesService.getSalesWithLines()
	// console.log('Sales with lines:', JSON.stringify(sales, null, 2))
	const items = await itemService.findBy({
				price: {
					$between: [500, 550],
				},
			})
	console.log('Items found:', items)
} catch (error) {
	console.error('Error during setup:', error)
	throw error
}
