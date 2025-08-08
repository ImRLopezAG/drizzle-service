import { PGlite } from '@electric-sql/pglite'
import { relations, type SQL, sql } from 'drizzle-orm'
import { index, pgEnum, pgTable, primaryKey } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/pglite'
import { drizzleService } from 'drizzle-service/pg'

export const genId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
export const itemType = pgEnum('item_type', ['ITEM', 'SERVICE', 'BUNDLE', ' '])

export const itemEntryType = pgEnum('item_entry_type', [
	'POSITIVE_ADJ',
	'NEGATIVE_ADJ',
	' ',
])
export const userType = pgEnum('user_type', [
	'ADMIN',
	'USER',
	'GUEST',
	'STAFF',
	' ',
])

export const userStatus = pgEnum('user_status', [
	'ACTIVE',
	'INACTIVE',
	'SUSPENDED',
	' ',
])
export const itemStatus = pgEnum('item_status', [
	'ACTIVE',
	'INACTIVE',
	'ARCHIVED',
	'DISCONTINUED',
	' ',
])
export const itemCategory = pgEnum('item_category', [
	'ELECTRONICS',
	'FURNITURE',
	'CLOTHING',
	'FOOD',
	'SPORTS',
	' ',
])
export const sales = pgEnum('item_type', ['ITEM', 'SERVICE', 'BUNDLE', ' '])

export const documentType = pgEnum('document_type', [
	'INVOICE',
	'ORDER',
	'QUOTE',
	'CREDIT_MEMO',
	'RETURN',
	'POS_TRANSACTION',
	' ',
])

export const documentStatus = pgEnum('document_status', [
	'DRAFT',
	'PENDING_APPROVAL',
	'APPROVED',
	'REJECTED',
	'CANCELED',
	'COMPLETED',
	' ',
])

export const stores = pgTable('stores', (t) => ({
	id: t.serial().primaryKey(),
	name: t.text().notNull(),
	location: t.text().notNull(),
	createdAt: t.timestamp('created_at').defaultNow(),
	updatedAt: t
		.timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date()),
	deletedAt: t.timestamp('deleted_at'),
}))

export const users = pgTable('users', (t) => ({
	id: t.serial().primaryKey(),
	email: t.text().notNull().unique(),
	name: t.text().notNull(),
	type: userType().default('USER').notNull(),
	status: userStatus().default('ACTIVE').notNull(),
	createdAt: t.timestamp('created_at').defaultNow(),
	updatedAt: t
		.timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date()),
}))

export const items = pgTable(
	'items',
	(t) => ({
		id: t
			.text()
			.primaryKey()
			.$defaultFn(() => genId('ITM')),
		name: t.text().notNull(),
		sku: t.text().notNull().unique(),
		description: t.text().notNull(),
		type: itemType().default('ITEM').notNull(),
		status: itemStatus().default('ACTIVE').notNull(),
		category: itemCategory().default(' ').notNull(),
		barcode: t.text(),
		price: t
			.numeric('price', { mode: 'number', precision: 10, scale: 2 })
			.notNull(),
		createdAt: t.timestamp('created_at').defaultNow(),
		updatedAt: t
			.timestamp('updated_at')
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	}),
	(t) => [
		index('items_name_idx').on(t.name),
		index('items_description_idx').on(t.description),
		index('items_sku_idx').on(t.sku),
		index('items_barcode_idx').on(t.barcode),
		index('items_created_at_idx').on(t.createdAt),
		index('items_updated_at_idx').on(t.updatedAt),
	],
)

export const itemEntry = pgTable(
	'item_entry',
	(t) => ({
		entryNo: t.serial('entry_no').notNull(),
		itemId: t
			.text('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		type: itemEntryType('type').default(' ').notNull(),
		storeId: t
			.integer('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		quantity: t.numeric({ mode: 'number', precision: 10, scale: 2 }).notNull(),
		description: t.text('description'),
		createdAt: t.timestamp('created_at').defaultNow().notNull(),
		updatedAt: t
			.timestamp('updated_at')
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => new Date()),
	}),
	(t) => [
		index('item_entry_item_id_idx').on(t.itemId),
		primaryKey({
			columns: [t.entryNo, t.itemId],
			name: 'item_entry_pkey',
		}),
		index('item_entry_type_idx').on(t.type),
		index('item_entry_quantity_idx').on(t.quantity),
	],
)

export const salesHeaders = pgTable(
	'sales_headers',
	(t) => ({
		id: t
			.text()
			.primaryKey()
			.$defaultFn(() => genId('SH')),
		documentNo: t.text('document_no').notNull().unique(),
		documentType: documentType('document_type')
			.notNull()
			.$default(() => 'INVOICE'),
		status: documentStatus()
			.notNull()
			.$default(() => 'DRAFT'),
		postingDate: t.timestamp('posting_date').notNull().defaultNow(),
		storeId: t
			.integer('store_id')
			.notNull()
			.references(() => stores.id, { onDelete: 'cascade' }),
		amount: t.numeric({ mode: 'number', precision: 10, scale: 2 }).notNull(),
		tax: t
			.numeric({
				mode: 'number',
				precision: 10,
				scale: 2,
			})
			.notNull()
			.default(0),
		total: t
			.numeric({ mode: 'number', precision: 10, scale: 2 })
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`${salesHeaders.amount} + COALESCE(${salesHeaders.tax}, 0)`,
			),
		createdAt: t.timestamp('created_at').defaultNow().notNull(),
		updatedAt: t
			.timestamp('updated_at')
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => new Date()),
	}),
	(t) => [
		index('sales_document_status_idx').on(t.status),
		index('sales_document_created_at_idx').on(t.createdAt),
		index('sales_document_updated_at_idx').on(t.updatedAt),
	],
)

export const salesLines = pgTable(
	'sales_lines',
	(t) => ({
		lineNo: t.serial('line_no').notNull(),
		documentType: documentType('document_type')
			.notNull()
			.$default(() => 'INVOICE'),
		documentNo: t
			.text('document_no')
			.notNull()
			.references(() => salesHeaders.id, { onDelete: 'cascade' }),
		itemNo: t
			.text('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		itemType: itemType('item_type')
			.notNull()
			.$default(() => 'ITEM'),
		description: t.text('description').notNull(),
		quantity: t.numeric({ mode: 'number', precision: 10, scale: 2 }).notNull(),
		unitPrice: t
			.numeric('unit_price', { mode: 'number', precision: 10, scale: 2 })
			.notNull(),
		amount: t
			.numeric({ mode: 'number', precision: 10, scale: 2 })
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`(${salesLines.quantity} * ${salesLines.unitPrice}) + COALESCE((${salesLines.quantity} * ${salesLines.unitPrice}) * ${salesLines.tax}, 0)`,
			),
		tax: t
			.numeric({
				mode: 'number',
				precision: 10,
				scale: 2,
			})
			.notNull()
			.default(0),
		taxAmount: t
			.numeric('tax_amount', {
				mode: 'number',
				precision: 10,
				scale: 2,
			})
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`(${salesLines.quantity} * ${salesLines.unitPrice}) * ${salesLines.tax}`,
			),
		createdAt: t.timestamp('created_at').defaultNow().notNull(),
		updatedAt: t
			.timestamp('updated_at')
			.defaultNow()
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
		relationName: 'item_entry_store_fkey',
	}),
	item: one(items, {
		fields: [itemEntry.itemId],
		references: [items.id],
		relationName: 'item_entry_item_fkey',
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
	itemType,
	documentType,
	documentStatus,
	userType,
	userStatus,
	itemStatus,
	itemCategory,
	sales,
	itemEntryType,
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

const client = new PGlite('./test/pg/db.sql')
const db = drizzle({
	schema,
	client
})

const service = drizzleService(db)

export { db, service }
