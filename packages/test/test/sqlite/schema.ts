import { createClient } from '@libsql/client'
import { relations, type SQL, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { index, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core'
import { drizzleService } from 'drizzle-service/sqlite'

export const itemType = ['ITEM', 'SERVICE', 'BUNDLE', ' '] as const

export const itemEntryType = ['POSITIVE_ADJ', 'NEGATIVE_ADJ', ' '] as const
export const userType = ['ADMIN', 'USER', 'GUEST', 'STAFF', ' '] as const

export const userStatus = ['ACTIVE', 'INACTIVE', 'SUSPENDED', ' '] as const

export const itemStatus = [
	'ACTIVE',
	'INACTIVE',
	'ARCHIVED',
	'DISCONTINUED',
	' ',
] as const

export const itemCategory = [
	'ELECTRONICS',
	'FURNITURE',
	'CLOTHING',
	'FOOD',
	'SPORTS',
	' ',
] as const

export const sales = ['ITEM', 'SERVICE', 'BUNDLE', ' '] as const

export const documentType = [
	'INVOICE',
	'ORDER',
	'QUOTE',
	'CREDIT_MEMO',
	'RETURN',
	'POS_TRANSACTION',
	' ',
] as const

export const documentStatus = [
	'DRAFT',
	'PENDING_APPROVAL',
	'APPROVED',
	'REJECTED',
	'CANCELED',
	'COMPLETED',
	' ',
] as const

export const genId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

export const stores = sqliteTable('stores', (t) => ({
	id: t.integer().primaryKey({ autoIncrement: true }),
	name: t.text().notNull(),
	location: t.text().notNull(),
	createdAt: t
		.integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date()),
	updatedAt: t
		.integer('updated_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date()),
	deletedAt: t
		.integer('deleted_at', { mode: 'timestamp' }).default(sql`NULL`),
}), (t) => [
	index('stores_name_idx').on(t.name),
	index('stores_location_idx').on(t.location),
	index('stores_created_at_idx').on(t.createdAt),
	index('stores_updated_at_idx').on(t.updatedAt),
])

export const users = sqliteTable('users', (t) => ({
	id: t.integer().primaryKey({ autoIncrement: true }),
	email: t.text().notNull(),
	name: t.text().notNull(),
	type: t.text('type', { enum: userType }).default('USER').notNull(),
	status: t.text('status', { enum: userStatus }).default('ACTIVE').notNull(),
	createdAt: t
		.integer('updated_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date()),
	updatedAt: t
		.integer('updated_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date()),
}))

export const items = sqliteTable(
	'items',
	(t) => ({
		id: t
			.text()
			.primaryKey()
			.$defaultFn(() => genId('ITM')),
		name: t.text().notNull(),
		sku: t.text().notNull().unique('items_sku_idx'),
		description: t.text().notNull(),
		type: t.text('type', { enum: itemType }).default('ITEM').notNull(),
		status: t
			.text('status', {
				enum: itemStatus,
			})
			.default('ACTIVE')
			.notNull(),
		category: t
			.text('category', {
				enum: itemCategory,
			})
			.default(' ')
			.notNull(),
		barcode: t.text(),
		price: t.numeric('price', { mode: 'number' }).notNull(),
		createdAt: t
			.integer('updated_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date()),
		updatedAt: t
			.integer('updated_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date())
			.$onUpdateFn(() => new Date()),
	}),
	(t) => [
		index('items_name_idx').on(t.name),
		index('items_description_idx').on(t.description),
		index('items_barcode_idx').on(t.barcode),
		index('items_created_at_idx').on(t.createdAt),
		index('items_updated_at_idx').on(t.updatedAt),
	],
)

export const itemEntry = sqliteTable(
	'item_entry',
	(t) => ({
		entryNo: t.integer('entry_no').primaryKey({ autoIncrement: true }),
		itemId: t
			.text('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		type: t.text('type', { enum: itemEntryType }).default(' ').notNull(),
		storeId: t
			.integer('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		quantity: t.numeric({ mode: 'number' }).notNull(),
		description: t.text('description'),
		createdAt: t
			.integer('updated_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: t
			.integer('updated_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date())
			.notNull()
			.$onUpdateFn(() => new Date()),
	}),
	(t) => [
		index('item_entry_item_id_idx').on(t.itemId),
		index('item_entry_type_idx').on(t.type),
		index('item_entry_quantity_idx').on(t.quantity),
	],
)

export const salesHeaders = sqliteTable(
	'sales_headers',
	(t) => ({
		id: t
			.text()
			.primaryKey()
			.$defaultFn(() => genId('SH')),
		documentNo: t.text('document_no').notNull().unique('sales_headers_document_no_idx'),
		documentType: t
			.text('document_type', {
				enum: documentType,
			})
			.default('INVOICE')
			.notNull(),
		status: t
			.text('status', { enum: documentStatus })
			.default('DRAFT')
			.notNull(),
		postingDate: t
			.integer('posting_date', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		storeId: t
			.integer('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		amount: t.numeric({ mode: 'number' }).notNull(),
		// Use a subquery approach for the computed field to avoid circular reference
		tax: t
			.numeric({
				mode: 'number',
			})
			.notNull()
			.default(0),
		total: t
			.numeric({ mode: 'number' })
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`${salesHeaders.amount} + COALESCE(${salesHeaders.tax}, 0)`,
			),
		createdAt: t
			.integer('updated_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: t
			.integer('updated_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date())
			.notNull()
			.$onUpdateFn(() => new Date()),
	}),
	(t) => [
		index('sales_document_status_idx').on(t.status),
		index('sales_document_created_at_idx').on(t.createdAt),
		index('sales_document_updated_at_idx').on(t.updatedAt),
	],
)

export const salesLines = sqliteTable(
	'sales_lines',
	(t) => ({
		lineNo: t.integer('line_no', {mode: 'number'}),
		documentType: t
			.text('document_type', {
				enum: documentType,
			})
			.default('INVOICE')
			.notNull(),
		documentNo: t
			.text('document_no')
			.notNull()
			.references(() => salesHeaders.id, { onDelete: 'cascade' }),
		itemNo: t
			.text('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		itemType: t.text('item_type', { enum: itemType }).default('ITEM').notNull(),
		description: t.text('description').notNull(),
		quantity: t.numeric({ mode: 'number' }).notNull(),
		unitPrice: t.numeric('unit_price', { mode: 'number' }).notNull(),
		amount: t
			.numeric({ mode: 'number' })
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`(${salesLines.quantity} * ${salesLines.unitPrice}) + COALESCE(${salesLines.taxAmount}, 0)`,
			),
		tax: t
			.numeric({
				mode: 'number',
			})
			.notNull()
			.default(0),
			taxAmount: t
				.numeric('tax_amount', {
					mode: 'number',
				})
				.notNull()
				.generatedAlwaysAs(
					(): SQL =>
						sql`(${salesLines.quantity} * ${salesLines.unitPrice}) * ${salesLines.tax}`,
				),
		createdAt: t
			.integer('updated_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: t
			.integer('updated_at', { mode: 'timestamp' })
			.$defaultFn(() => new Date())
			.notNull()
			.$onUpdateFn(() => new Date()),
	}),
	(t) => [
		index('sales_lines_document_id_idx').on(t.documentNo),
		primaryKey({
			columns: [t.lineNo, t.documentType, t.documentNo],
			name: 'sales_lines_pkey',
		}),
		index('sales_lines_item_id_idx').on(t.itemNo),
		index('sales_lines_created_at_idx').on(t.createdAt),
		index('sales_lines_updated_at_idx').on(t.updatedAt),
	],
)

export const itemEntryRelations = relations(itemEntry, ({ one }) => ({
	store: one(stores, {
		fields: [itemEntry.storeId],
		references: [stores.id],
	}),
	item: one(items, {
		fields: [itemEntry.itemId],
		references: [items.id],
	}),
}))

export const itemsRelations = relations(items, ({ many }) => ({
	entries: many(itemEntry),
}))

export const salesLinesRelations = relations(salesLines, ({ one }) => ({
	saleHeader: one(salesHeaders, {
		fields: [salesLines.documentNo],
		references: [salesHeaders.id],
	}),
	item: one(items, {
		fields: [salesLines.itemNo],
		references: [items.id],
	}),
}))
export const salesHeadersRelations = relations(
	salesHeaders,
	({ many, one }) => ({
		salesLines: many(salesLines),
		store: one(stores, {
			fields: [salesHeaders.storeId],
			references: [stores.id],
		}),
	}),
)

export const schema = {
	stores,
	items,
	users,
	salesHeaders,
	salesLines,
	itemEntry,
	itemEntryRelations,
	salesLinesRelations,
	salesHeadersRelations,
	itemsRelations,
}

export const client = createClient({ url: 'file:./test/sqlite/db.sqlite' })
const db = drizzle({
	schema,
	client
})

const service = drizzleService(db)

export { db, service }
