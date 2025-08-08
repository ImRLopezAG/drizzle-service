import { randomUUID } from 'node:crypto'
import { faker } from '@faker-js/faker'
import { z } from 'zod/v4'
import { db, schema, service } from './schema'

export {schema}
export type SchemaKeys = keyof typeof schema

export interface EntityTypes<T extends SchemaKeys> {
	readonly query: (typeof schema)[T] extends { $inferSelect: infer S }
		? S
		: never
	readonly mutation: (typeof schema)[T] extends { $inferInsert: infer I }
		? I
		: never
}

export const itemService = service(schema.items, {
	soft: {
		field: 'status',
		deletedValue: 'DISCONTINUED',
		notDeletedValue: 'ACTIVE',
	},
})

export const salesService = service(schema.salesHeaders, {
	soft: {
		field: 'status',
		deletedValue: 'CANCELED',
		notDeletedValue: 'DRAFT',
	},
	query: db.query.salesHeaders,
	getSalesWithLines: async () => {
		return await salesService.db.query.salesHeaders.findMany({
			with: {
				salesLines: true,
			},
		})
	},
})

export const salesLinesService = service(schema.salesLines, {
	id: 'lineNo',
})

export const userService = service(schema.users, {
	id: 'id',
	soft: {
		field: 'status',
		deletedValue: 'INACTIVE',
		notDeletedValue: 'ACTIVE',
	},
})
export const itemEntryService = service(schema.itemEntry, {
	id: 'entryNo',
	addInventory: async (item: string | string[], quantity: number, store: number) => {
		const isArray = Array.isArray(item)
		return isArray ? await itemEntryService.bulkCreate(item.map((itemId) => ({
			itemId,
			type: 'POSITIVE_ADJ',
			storeId: store,
			quantity,
			description: `Added ${quantity} of item ${itemId} to store ${store}`,
		}))) : await itemEntryService.create({
			itemId: item,
			type: 'POSITIVE_ADJ',
			storeId: store,
			quantity,
			description: `Added ${quantity} of item ${item} to store ${store}`,
		})
	},
	removeInventory: async (item: string | string[], quantity: number, store: number) => {
		const isArray = Array.isArray(item)
		return isArray ? await itemEntryService.bulkCreate(item.map((itemId) => ({
			itemId,
			type: 'NEGATIVE_ADJ',
			storeId: store,
			quantity,
		}))) : await itemEntryService.create({
			itemId: item,
			type: 'NEGATIVE_ADJ',
			storeId: store,
			quantity,
			description: `Removed ${quantity} of item ${item} from store ${store}`,
		})
	},
	getInventory: async (item: string, store?: number) => {
		return await itemEntryService.findBy(
			{
				itemId: item,
				storeId: store ?? undefined,
			},
			{
				parse(data) {
					return data.reduce((total, entry) => {
						return entry.type.startsWith('POSITIVE')
							? total + entry.quantity
							: total - entry.quantity
					}, 0)
				},
			},
		)
	},
})

export type Item = EntityTypes<'items'>
export type SaleHeader = EntityTypes<'salesHeaders'>
export type SaleLine = EntityTypes<'salesLines'>
export type User = EntityTypes<'users'>
export type ItemEntry = EntityTypes<'itemEntry'>
export type Store = EntityTypes<'stores'>
export const mockItem = (): Item['mutation'] => ({
	name: faker.commerce.productName(),
	sku: randomUUID(),
	description: faker.commerce.productDescription(),
	price: Number(faker.commerce.price({ min: 400, max: 5000, dec: 2 })),
	type: faker.helpers.arrayElement(['ITEM', 'SERVICE', 'BUNDLE']),
	status: faker.helpers.arrayElement([
		'ACTIVE',
		'INACTIVE',
		'ARCHIVED',
		'DISCONTINUED',
	]),
	category: faker.helpers.arrayElement([
		'ELECTRONICS',
		'FURNITURE',
		'CLOTHING',
		'FOOD',
		'SPORTS',
	]),
	barcode: faker.finance.iban(),
	createdAt: new Date(),
})

export const mockUser = (): User['mutation'] => {
	const firstName = faker.person.firstName()
	const lastName = faker.person.lastName()
	return {
		name: `${firstName} ${lastName}`,
		email: faker.internet.email({
			firstName,
			lastName,
			provider: `${faker.string.uuid().slice(0, 4)}${faker.internet.domainName()}`,
			allowSpecialCharacters: true,
		}),
		type: faker.helpers.arrayElement(['ADMIN', 'USER', 'GUEST', 'STAFF']),
		status: faker.helpers.arrayElement(['ACTIVE', 'SUSPENDED']),
		createdAt: new Date(),
	}
}

export const mockSaleHeader = (store: number): SaleHeader['mutation'] => ({
	documentNo: faker.string.uuid(),
	documentType: faker.helpers.arrayElement([
		'INVOICE',
		'ORDER',
		'QUOTE',
		'CREDIT_MEMO',
		'RETURN',
		'POS_TRANSACTION',
	]),
	storeId: store,
	status: faker.helpers.arrayElement([
		'DRAFT',
		'PENDING_APPROVAL',
		'APPROVED',
		'REJECTED',
		'COMPLETED',
	]),
	postingDate: new Date(),
	createdAt: new Date(),
	amount: 0,
})

export const mockSaleLine = (
	header: {
		no: string
		type: SaleHeader['mutation']['documentType']
	},
	item: {
		no: string
		type: Item['mutation']['type']
		unitPrice: number
	},
): SaleLine['mutation'] => {
	const quantity = faker.number.int({ min: 1, max: 100 })
	const tax = faker.number.float({ min: 0.22, max: 0.4, fractionDigits: 2 }) // fixed min/max order

	return {
		documentType: header.type,
		documentNo: header.no,
		itemNo: item.no,
		itemType: item.type,
		description: faker.commerce.productDescription(),
		quantity: quantity,
		unitPrice: item.unitPrice,
		tax: tax,
		createdAt: new Date(),
	}
}

export const mockStore = (): Store['mutation'] => ({
	name: faker.company.name(),
	location: faker.location.streetAddress(),
	createdAt: new Date(),
	updatedAt: new Date(),
})

export const storeService = service(schema.stores, {
	id: 'id',
	soft: {
		field: 'deletedAt',
		deletedValue: 'NOT_NULL'
	},
})

export const itemSchema = z.object({
	id: z.string().optional(),
	name: z.string(),
	sku: z.string(),
	description: z.string(),
	type: z.enum(['ITEM', 'SERVICE', 'BUNDLE']),
	status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'DISCONTINUED']),
	category: z.enum([
		'ELECTRONICS',
		'FURNITURE',
		'CLOTHING',
		'FOOD',
		'BEAUTY',
		'SPORTS',
		'HEALTH',
		'BOOKS',
		'MUSIC',
	]),
	barCode: z.string().optional(),
	sellPrice: z.number().min(0),
	costPrice: z.number().min(0),
	createdAt: z.date().optional(),
	updatedAt: z.date().optional(),
})

export const userSchema = z.object({
	id: z.string().optional(),
	email: z.email(),
	name: z.string().min(2).max(100),
	type: z.enum(['ADMIN', 'USER', 'GUEST', 'STAFF']).default('USER'),
	status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
	createdAt: z.date().optional(),
	updatedAt: z.date().optional(),
})

export const saleHeaderSchema = z.object({
	id: z.string().optional(),
	documentNo: z.string().min(1),
	documentType: z
		.enum([
			'INVOICE',
			'ORDER',
			'QUOTE',
			'CREDIT_MEMO',
			'RETURN',
			'POS_TRANSACTION',
		])
		.default('INVOICE'),
	status: z
		.enum([
			'DRAFT',
			'PENDING_APPROVAL',
			'APPROVED',
			'REJECTED',
			'CANCELED',
			'COMPLETED',
		])
		.default('DRAFT'),
	postingDate: z.date().optional(),
	totalAmount: z.number().min(0).optional(),
	tax: z.number().min(0).optional(),
	createdAt: z.date().optional(),
	updatedAt: z.date().optional(),
})

export const saleLineSchema = z.object({
	lineNo: z.number().int().min(1).optional(),
	documentType: z
		.enum([
			'INVOICE',
			'ORDER',
			'QUOTE',
			'CREDIT_MEMO',
			'RETURN',
			'POS_TRANSACTION',
		])
		.default('INVOICE'),
	documentNo: z.string().min(1),
	itemNo: z.string().min(1),
	itemType: z.enum(['ITEM', 'SERVICE', 'BUNDLE']).default('ITEM'),
	description: z.string().min(1),
	quantity: z.number().min(0),
	unitPrice: z.number().min(0),
	amount: z.number().min(0),
	tax: z.number().min(0).default(0),
	createdAt: z.date().optional(),
	updatedAt: z.date().optional(),
})

export const itemEntrySchema = z.object({
	entryNo: z.string().optional(),
	itemId: z.string().min(1),
	type: z.enum(['POSITIVE_ADJ', 'NEGATIVE_ADJ']).default('POSITIVE_ADJ'),
	storeId: z.number().int().min(1),
	quantity: z.number().min(0),
	description: z.string().optional(),
	createdAt: z.date().optional(),
	updatedAt: z.date().optional(),
})
export const storeSchema = z.object({
	id: z.number().int().optional(),
	name: z.string().min(1),
	location: z.string().min(1),
	createdAt: z.date().optional(),
	updatedAt: z.date().optional(),
})
