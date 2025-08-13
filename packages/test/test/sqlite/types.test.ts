import type {
	BulkOperationResult,
	CriteriaFilter,
	Handler,
	MutationOperations,
	MutationsBulkOperations,
	QueryOperations,
	Service,
	ServiceHooks,
	ServiceMethods,
	DeleteType
} from 'drizzle-service/builder/types.d.ts'
import { describe, expectTypeOf, it } from 'vitest'
import {
	itemEntryService,
	itemService,
	salesLinesService,
	salesService,
	storeService,
	userService,
} from './repository'
import type {
	db,
	itemEntry,
	items,
	salesHeaders,
	salesLines,
	stores,
	users,
} from './schema'

// Type aliases for clarity
type ItemEntity = typeof items
type UserEntity = typeof users
type StoreEntity = typeof stores
type SalesHeaderEntity = typeof salesHeaders
type SalesLineEntity = typeof salesLines

type SalesLineOption = {
	id: 'lineNo'
}
type ItemEntryEntity = typeof itemEntry

type ItemEntryOption = {
	id: 'entryNo'
}

type Db = typeof db

type ItemSelect = typeof items.$inferSelect
type ItemInsert = typeof items.$inferInsert
type UserSelect = typeof users.$inferSelect
type UserInsert = typeof users.$inferInsert
type StoreSelect = typeof stores.$inferSelect
type StoreInsert = typeof stores.$inferInsert
type SalesHeaderSelect = typeof salesHeaders.$inferSelect
type SalesHeaderInsert = typeof salesHeaders.$inferInsert
type SalesLineSelect = typeof salesLines.$inferSelect
type SalesLineInsert = typeof salesLines.$inferInsert
type ItemEntrySelect = typeof itemEntry.$inferSelect
type ItemEntryInsert = typeof itemEntry.$inferInsert

describe('SQLITE Service Types - Complex Schema', () => {
	describe('Base Service Structure', () => {
		it('should have correct Service interface structure for all entities', () => {
			expectTypeOf(itemService).toExtend<Service<ItemEntity, Db>>()
			expectTypeOf(userService).toExtend<Service<UserEntity, Db>>()
			expectTypeOf(storeService).toExtend<Service<StoreEntity, Db>>()
			expectTypeOf(salesService).toExtend<Service<SalesHeaderEntity, Db>>()
			expectTypeOf(salesLinesService).toExtend<
				Service<SalesLineEntity, Db, SalesLineOption>
			>()
			expectTypeOf(itemEntryService).toExtend<
				Service<ItemEntryEntity, Db, ItemEntryOption>
			>()
		})

		it('should expose database instance for all services', () => {
			expectTypeOf(itemService.db).toExtend<Db>()
			expectTypeOf(userService.db).toExtend<Db>()
			expectTypeOf(storeService.db).toExtend<Db>()
			expectTypeOf(salesService.db).toExtend<Db>()
			expectTypeOf(salesLinesService.db).toExtend<Db>()
			expectTypeOf(itemEntryService.db).toExtend<Db>()
		})

		it('should expose entity information for all services', () => {
			expectTypeOf(itemService.entity).toEqualTypeOf<ItemEntity>()
			expectTypeOf(userService.entity).toEqualTypeOf<UserEntity>()
			expectTypeOf(storeService.entity).toEqualTypeOf<StoreEntity>()
			expectTypeOf(salesService.entity).toEqualTypeOf<SalesHeaderEntity>()
			expectTypeOf(salesLinesService.entity).toEqualTypeOf<SalesLineEntity>()
			expectTypeOf(itemEntryService.entity).toEqualTypeOf<ItemEntryEntity>()

			expectTypeOf(itemService.entityName).toEqualTypeOf<string>()
			expectTypeOf(userService.entityName).toEqualTypeOf<string>()
			expectTypeOf(storeService.entityName).toEqualTypeOf<string>()
			expectTypeOf(salesService.entityName).toEqualTypeOf<string>()
			expectTypeOf(salesLinesService.entityName).toEqualTypeOf<string>()
			expectTypeOf(itemEntryService.entityName).toEqualTypeOf<string>()
		})
	})

	describe('Query Operations Types', () => {
		it('should implement QueryOperations interface for all services', () => {
			expectTypeOf(itemService).toExtend<QueryOperations<ItemEntity, Db>>()
			expectTypeOf(userService).toExtend<QueryOperations<UserEntity, Db>>()
			expectTypeOf(storeService).toExtend<QueryOperations<StoreEntity, Db>>()
			expectTypeOf(salesService).toExtend<
				QueryOperations<SalesHeaderEntity, Db>
			>()
			expectTypeOf(salesLinesService).toExtend<
				QueryOperations<SalesLineEntity, Db>
			>()
			expectTypeOf(itemEntryService).toExtend<
				QueryOperations<ItemEntryEntity, Db>
			>()
		})

		it('should have correct find method types', () => {
			expectTypeOf(itemService.find).toBeFunction()
			expectTypeOf(userService.find).toBeFunction()
			expectTypeOf(storeService.find).toBeFunction()
			expectTypeOf(salesService.find).toBeFunction()
			expectTypeOf(salesLinesService.find).toBeFunction()
			expectTypeOf(itemEntryService.find).toBeFunction()
		})

		it('should have correct findOne method types with proper ID types', () => {
			expectTypeOf(itemService.findOne).toBeFunction()
			expectTypeOf(userService.findOne).toBeFunction()
			expectTypeOf(storeService.findOne).toBeFunction()
			expectTypeOf(salesService.findOne).toBeFunction()
			expectTypeOf(salesLinesService.findOne).toBeFunction()
			expectTypeOf(itemEntryService.findOne).toBeFunction()

			// Test ID parameter types
			expectTypeOf(itemService.findOne).parameter(0).toEqualTypeOf<string>()
			expectTypeOf(userService.findOne).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(storeService.findOne).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(salesService.findOne).parameter(0).toEqualTypeOf<string>()
			expectTypeOf(salesLinesService.findOne)
				.parameter(0)
				.toEqualTypeOf<number>()
			expectTypeOf(itemEntryService.findOne)
				.parameter(0)
				.toEqualTypeOf<number>()
		})

		it('should have correct findBy method types', () => {
			expectTypeOf(itemService.findBy).toBeFunction()
			expectTypeOf(userService.findBy).toBeFunction()
			expectTypeOf(storeService.findBy).toBeFunction()
			expectTypeOf(salesService.findBy).toBeFunction()
			expectTypeOf(salesLinesService.findBy).toBeFunction()
			expectTypeOf(itemEntryService.findBy).toBeFunction()

			expectTypeOf(itemService.findBy)
				.parameter(0)
				.toExtend<CriteriaFilter<ItemEntity>>()
			expectTypeOf(userService.findBy)
				.parameter(0)
				.toExtend<CriteriaFilter<UserEntity>>()
			expectTypeOf(storeService.findBy)
				.parameter(0)
				.toExtend<CriteriaFilter<StoreEntity>>()
			expectTypeOf(salesService.findBy)
				.parameter(0)
				.toExtend<CriteriaFilter<SalesHeaderEntity>>()
			expectTypeOf(salesLinesService.findBy)
				.parameter(0)
				.toExtend<CriteriaFilter<SalesLineEntity>>()
			expectTypeOf(itemEntryService.findBy)
				.parameter(0)
				.toExtend<CriteriaFilter<ItemEntryEntity>>()
		})
	})

	describe('Mutation Operations Types', () => {
		it('should implement MutationOperations interface for all services', () => {
			expectTypeOf(itemService).toExtend<MutationOperations<ItemEntity>>()
			expectTypeOf(userService).toExtend<MutationOperations<UserEntity>>()
			expectTypeOf(storeService).toExtend<MutationOperations<StoreEntity>>()
			expectTypeOf(salesService).toExtend<
				MutationOperations<SalesHeaderEntity>
			>()
			expectTypeOf(salesLinesService).toExtend<
				MutationOperations<SalesLineEntity>
			>()
			expectTypeOf(itemEntryService).toExtend<
				MutationOperations<ItemEntryEntity>
			>()
		})

		it('should have correct create method types', () => {
			expectTypeOf(itemService.create).toBeFunction()
			expectTypeOf(userService.create).toBeFunction()
			expectTypeOf(storeService.create).toBeFunction()
			expectTypeOf(salesService.create).toBeFunction()
			expectTypeOf(salesLinesService.create).toBeFunction()
			expectTypeOf(itemEntryService.create).toBeFunction()

			expectTypeOf(itemService.create).parameter(0).toExtend<ItemInsert>()
			expectTypeOf(userService.create).parameter(0).toExtend<UserInsert>()
			expectTypeOf(storeService.create).parameter(0).toExtend<StoreInsert>()
			expectTypeOf(salesService.create)
				.parameter(0)
				.toExtend<SalesHeaderInsert>()
			expectTypeOf(salesLinesService.create)
				.parameter(0)
				.toExtend<SalesLineInsert>()
			expectTypeOf(itemEntryService.create)
				.parameter(0)
				.toExtend<ItemEntryInsert>()

			expectTypeOf(itemService.create).returns.toEqualTypeOf<
				Handler<ItemSelect>
			>()
			expectTypeOf(userService.create).returns.toEqualTypeOf<
				Handler<UserSelect>
			>()
			expectTypeOf(storeService.create).returns.toEqualTypeOf<
				Handler<StoreSelect>
			>()
			expectTypeOf(salesService.create).returns.toEqualTypeOf<
				Handler<SalesHeaderSelect>
			>()
			expectTypeOf(salesLinesService.create).returns.toEqualTypeOf<
				Handler<SalesLineSelect>
			>()
			expectTypeOf(itemEntryService.create).returns.toEqualTypeOf<
				Handler<ItemEntrySelect>
			>()
		})

		it('should have correct update method types', () => {
			expectTypeOf(itemService.update).toBeFunction()
			expectTypeOf(userService.update).toBeFunction()
			expectTypeOf(storeService.update).toBeFunction()
			expectTypeOf(salesService.update).toBeFunction()
			expectTypeOf(salesLinesService.update).toBeFunction()
			expectTypeOf(itemEntryService.update).toBeFunction()

			// Test ID parameter types
			expectTypeOf(itemService.update).parameter(0).toEqualTypeOf<string>()
			expectTypeOf(userService.update).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(storeService.update).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(salesService.update).parameter(0).toEqualTypeOf<string>()
			expectTypeOf(salesLinesService.update)
				.parameter(0)
				.toEqualTypeOf<number>()
			expectTypeOf(itemEntryService.update).parameter(0).toEqualTypeOf<number>()

			// Test update data parameter types
			expectTypeOf(itemService.update)
				.parameter(1)
				.toExtend<Partial<Omit<ItemInsert, 'createdAt' | 'id'>>>()
			expectTypeOf(userService.update)
				.parameter(1)
				.toExtend<Partial<Omit<UserInsert, 'createdAt' | 'id'>>>()
			expectTypeOf(storeService.update)
				.parameter(1)
				.toExtend<Partial<Omit<StoreInsert, 'createdAt' | 'id'>>>()

			// Test return types
			expectTypeOf(itemService.update).returns.toEqualTypeOf<
				Handler<ItemSelect[]> | Handler<ItemSelect>
			>()
			expectTypeOf(userService.update).returns.toEqualTypeOf<
				Handler<UserSelect[]> | Handler<UserSelect>
			>()
			expectTypeOf(storeService.update).returns.toEqualTypeOf<
				Handler<StoreSelect[]> | Handler<StoreSelect>
			>()
			expectTypeOf(salesService.update).returns.toEqualTypeOf<
				Handler<SalesHeaderSelect[]> | Handler<SalesHeaderSelect>
			>()
			expectTypeOf(salesLinesService.update).returns.toEqualTypeOf<
				Handler<SalesLineSelect[]> | Handler<SalesLineSelect>
			>()
			expectTypeOf(itemEntryService.update).returns.toEqualTypeOf<
				Handler<ItemEntrySelect[]> | Handler<ItemEntrySelect>
			>()
		})

		it('should have correct delete method types', () => {
			expectTypeOf(itemService.delete).toBeFunction()
			expectTypeOf(userService.delete).toBeFunction()
			expectTypeOf(storeService.delete).toBeFunction()
			expectTypeOf(salesService.delete).toBeFunction()
			expectTypeOf(salesLinesService.delete).toBeFunction()
			expectTypeOf(itemEntryService.delete).toBeFunction()

			// Test ID parameter types
			expectTypeOf(itemService.delete).parameter(0).toEqualTypeOf<string>()
			expectTypeOf(userService.delete).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(storeService.delete).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(salesService.delete).parameter(0).toEqualTypeOf<string>()
			expectTypeOf(salesLinesService.delete)
				.parameter(0)
				.toEqualTypeOf<number>()
			expectTypeOf(itemEntryService.delete).parameter(0).toEqualTypeOf<number>()

			// Test return types
			expectTypeOf(itemService.delete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
			expectTypeOf(userService.delete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
			expectTypeOf(storeService.delete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
			expectTypeOf(salesService.delete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
			expectTypeOf(salesLinesService.delete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
			expectTypeOf(itemEntryService.delete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
		})

		it('should have correct hardDelete method types', () => {
			expectTypeOf(itemService.hardDelete).toBeFunction()
			expectTypeOf(userService.hardDelete).toBeFunction()
			expectTypeOf(storeService.hardDelete).toBeFunction()
			expectTypeOf(salesService.hardDelete).toBeFunction()
			expectTypeOf(salesLinesService.hardDelete).toBeFunction()
			expectTypeOf(itemEntryService.hardDelete).toBeFunction()

			// Test ID parameter types
			expectTypeOf(itemService.hardDelete).parameter(0).toEqualTypeOf<string>()
			expectTypeOf(userService.hardDelete).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(storeService.hardDelete).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(salesService.hardDelete).parameter(0).toEqualTypeOf<string>()
			expectTypeOf(salesLinesService.hardDelete)
				.parameter(0)
				.toEqualTypeOf<number>()
			expectTypeOf(itemEntryService.hardDelete)
				.parameter(0)
				.toEqualTypeOf<number>()

			// Test return types
			expectTypeOf(itemService.hardDelete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
			expectTypeOf(userService.hardDelete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
			expectTypeOf(storeService.hardDelete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
			expectTypeOf(salesService.hardDelete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
			expectTypeOf(salesLinesService.hardDelete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
			expectTypeOf(itemEntryService.hardDelete).returns.toEqualTypeOf<
				Promise<DeleteType>
			>()
		})
	})

	describe('Bulk Operations Types', () => {
		it('should implement MutationsBulkOperations interface for all services', () => {
			expectTypeOf(itemService).toExtend<MutationsBulkOperations<ItemEntity>>()
			expectTypeOf(userService).toExtend<MutationsBulkOperations<UserEntity>>()
			expectTypeOf(storeService).toExtend<
				MutationsBulkOperations<StoreEntity>
			>()
			expectTypeOf(salesService).toExtend<
				MutationsBulkOperations<SalesHeaderEntity>
			>()
			expectTypeOf(salesLinesService).toExtend<
				MutationsBulkOperations<SalesLineEntity, SalesLineOption>
			>()
			expectTypeOf(itemEntryService).toExtend<
				MutationsBulkOperations<ItemEntryEntity, ItemEntryOption>
			>()
		})

		it('should have correct bulkCreate method types', () => {
			expectTypeOf(itemService.bulkCreate).toBeFunction()
			expectTypeOf(userService.bulkCreate).toBeFunction()
			expectTypeOf(storeService.bulkCreate).toBeFunction()
			expectTypeOf(salesService.bulkCreate).toBeFunction()
			expectTypeOf(salesLinesService.bulkCreate).toBeFunction()
			expectTypeOf(itemEntryService.bulkCreate).toBeFunction()

			expectTypeOf(itemService.bulkCreate)
				.parameter(0)
				.toEqualTypeOf<ItemInsert[]>()
			expectTypeOf(userService.bulkCreate)
				.parameter(0)
				.toEqualTypeOf<UserInsert[]>()
			expectTypeOf(storeService.bulkCreate)
				.parameter(0)
				.toEqualTypeOf<StoreInsert[]>()
			expectTypeOf(salesService.bulkCreate)
				.parameter(0)
				.toEqualTypeOf<SalesHeaderInsert[]>()
			expectTypeOf(salesLinesService.bulkCreate)
				.parameter(0)
				.toEqualTypeOf<SalesLineInsert[]>()
			expectTypeOf(itemEntryService.bulkCreate)
				.parameter(0)
				.toEqualTypeOf<ItemEntryInsert[]>()

			expectTypeOf(itemService.bulkCreate)
				.parameter(1)
				.toExtend<ServiceHooks<ItemInsert[], ItemSelect[]> | undefined>()
			expectTypeOf(userService.bulkCreate)
				.parameter(1)
				.toExtend<ServiceHooks<UserInsert[], UserSelect[]> | undefined>()

			expectTypeOf(itemService.bulkCreate).returns.toExtend<
				Promise<BulkOperationResult<ItemSelect[], ItemEntity>>
			>()
			expectTypeOf(userService.bulkCreate).returns.toExtend<
				Promise<BulkOperationResult<UserSelect[], UserEntity>>
			>()
			expectTypeOf(storeService.bulkCreate).returns.toExtend<
				Promise<BulkOperationResult<StoreSelect[], StoreEntity>>
			>()
			expectTypeOf(salesService.bulkCreate).returns.toExtend<
				Promise<BulkOperationResult<SalesHeaderSelect[], SalesHeaderEntity>>
			>()
			expectTypeOf(salesLinesService.bulkCreate).returns.toExtend<
				Promise<BulkOperationResult<SalesLineSelect[], SalesLineEntity>>
			>()
			expectTypeOf(itemEntryService.bulkCreate).returns.toExtend<
				Promise<BulkOperationResult<ItemEntrySelect[], ItemEntryEntity>>
			>()
		})

		it('should have correct bulkUpdate method types', () => {
			expectTypeOf(itemService.bulkUpdate).toBeFunction()
			expectTypeOf(userService.bulkUpdate).toBeFunction()
			expectTypeOf(storeService.bulkUpdate).toBeFunction()
			expectTypeOf(salesService.bulkUpdate).toBeFunction()
			expectTypeOf(salesLinesService.bulkUpdate).toBeFunction()
			expectTypeOf(itemEntryService.bulkUpdate).toBeFunction()

			expectTypeOf(itemService.bulkUpdate).parameter(0).toExtend<
				Array<{
					id: string
					changes: Partial<Omit<ItemInsert, 'createdAt' | 'id'>>
				}>
			>()
			expectTypeOf(userService.bulkUpdate).parameter(0).toExtend<
				Array<{
					id: number
					changes: Partial<Omit<UserInsert, 'createdAt' | 'id'>>
				}>
			>()
			expectTypeOf(storeService.bulkUpdate).parameter(0).toExtend<
				Array<{
					id: number
					changes: Partial<Omit<StoreInsert, 'createdAt' | 'id'>>
				}>
			>()
			expectTypeOf(salesService.bulkUpdate).parameter(0).toExtend<
				Array<{
					id: string
					changes: Partial<Omit<SalesHeaderInsert, 'createdAt' | 'id'>>
				}>
			>()

			expectTypeOf(itemService.bulkUpdate).returns.toEqualTypeOf<
				Promise<BulkOperationResult<ItemSelect[], ItemEntity>>
			>()
			expectTypeOf(userService.bulkUpdate).returns.toEqualTypeOf<
				Promise<BulkOperationResult<UserSelect[], UserEntity>>
			>()
			expectTypeOf(storeService.bulkUpdate).returns.toEqualTypeOf<
				Promise<BulkOperationResult<StoreSelect[], StoreEntity>>
			>()
			expectTypeOf(salesService.bulkUpdate).returns.toEqualTypeOf<
				Promise<BulkOperationResult<SalesHeaderSelect[], SalesHeaderEntity>>
			>()
			expectTypeOf(salesLinesService.bulkUpdate).returns.toEqualTypeOf<
				Promise<BulkOperationResult<SalesLineSelect[], SalesLineEntity>>
			>()
			expectTypeOf(itemEntryService.bulkUpdate).returns.toEqualTypeOf<
				Promise<BulkOperationResult<ItemEntrySelect[], ItemEntryEntity>>
			>()
		})

		it('should have correct bulkDelete method types', () => {
			expectTypeOf(itemService.bulkDelete).toBeFunction()
			expectTypeOf(userService.bulkDelete).toBeFunction()
			expectTypeOf(storeService.bulkDelete).toBeFunction()
			expectTypeOf(salesService.bulkDelete).toBeFunction()
			expectTypeOf(salesLinesService.bulkDelete).toBeFunction()
			expectTypeOf(itemEntryService.bulkDelete).toBeFunction()

			expectTypeOf(itemService.bulkDelete)
				.parameter(0)
				.toEqualTypeOf<string[]>()
			expectTypeOf(userService.bulkDelete)
				.parameter(0)
				.toEqualTypeOf<number[]>()
			expectTypeOf(storeService.bulkDelete)
				.parameter(0)
				.toEqualTypeOf<number[]>()
			expectTypeOf(salesService.bulkDelete)
				.parameter(0)
				.toEqualTypeOf<string[]>()
			expectTypeOf(salesLinesService.bulkDelete)
				.parameter(0)
				.toEqualTypeOf<Array<number>>()
			expectTypeOf(itemEntryService.bulkDelete)
				.parameter(0)
				.toEqualTypeOf<number[]>()

			expectTypeOf(itemService.bulkDelete).returns.toEqualTypeOf<
				Promise<
					BulkOperationResult<
						DeleteType,
						ItemEntity
					>
				>
			>()
			expectTypeOf(userService.bulkDelete).returns.toEqualTypeOf<
				Promise<
					BulkOperationResult<
						DeleteType,
						UserEntity
					>
				>
			>()
		})

		it('should have correct bulkHardDelete method types', () => {
			expectTypeOf(itemService.bulkHardDelete).toBeFunction()
			expectTypeOf(userService.bulkHardDelete).toBeFunction()
			expectTypeOf(storeService.bulkHardDelete).toBeFunction()
			expectTypeOf(salesService.bulkHardDelete).toBeFunction()
			expectTypeOf(salesLinesService.bulkHardDelete).toBeFunction()
			expectTypeOf(itemEntryService.bulkHardDelete).toBeFunction()

			expectTypeOf(itemService.bulkHardDelete)
				.parameter(0)
				.toEqualTypeOf<string[]>()
			expectTypeOf(userService.bulkHardDelete)
				.parameter(0)
				.toEqualTypeOf<number[]>()
			expectTypeOf(storeService.bulkHardDelete)
				.parameter(0)
				.toEqualTypeOf<number[]>()
			expectTypeOf(salesService.bulkHardDelete)
				.parameter(0)
				.toEqualTypeOf<string[]>()
			expectTypeOf(salesLinesService.bulkHardDelete)
				.parameter(0)
				.toEqualTypeOf<Array<number>>()
			expectTypeOf(itemEntryService.bulkHardDelete)
				.parameter(0)
				.toEqualTypeOf<number[]>()

			expectTypeOf(itemService.bulkHardDelete).returns.toEqualTypeOf<
				Promise<
					BulkOperationResult<
						DeleteType,
						ItemEntity
					>
				>
			>()
			expectTypeOf(userService.bulkHardDelete).returns.toEqualTypeOf<
				Promise<
					BulkOperationResult<
						DeleteType,
						UserEntity
					>
				>
			>()
		})
	})

	describe('Handler Types', () => {
		it('should have correct Handler type structure for all entities', () => {
			type ItemHandler = Handler<ItemSelect>
			type UserHandler = Handler<UserSelect>
			type StoreHandler = Handler<StoreSelect>
			type SalesHeaderHandler = Handler<SalesHeaderSelect>
			type SalesLineHandler = Handler<SalesLineSelect>
			type ItemEntryHandler = Handler<ItemEntrySelect>

			expectTypeOf<ItemHandler>().toEqualTypeOf<Handler<ItemSelect>>()
			expectTypeOf<UserHandler>().toEqualTypeOf<Handler<UserSelect>>()
			expectTypeOf<StoreHandler>().toEqualTypeOf<Handler<StoreSelect>>()
			expectTypeOf<SalesHeaderHandler>().toEqualTypeOf<
				Handler<SalesHeaderSelect>
			>()
			expectTypeOf<SalesLineHandler>().toEqualTypeOf<Handler<SalesLineSelect>>()
			expectTypeOf<ItemEntryHandler>().toEqualTypeOf<Handler<ItemEntrySelect>>()
		})
	})

	describe('Database-Specific Types', () => {
		it('should use PostgreSQL-specific types', () => {
			expectTypeOf(itemService.db).toExtend<Db>()
			expectTypeOf(userService.db).toExtend<Db>()
			expectTypeOf(storeService.db).toExtend<Db>()
			expectTypeOf(salesService.db).toExtend<Db>()
			expectTypeOf(salesLinesService.db).toExtend<Db>()
			expectTypeOf(itemEntryService.db).toExtend<Db>()
		})

		it('should handle PostgreSQL-specific enum types', () => {
			type ItemStatus = ItemSelect['status']
			type ItemType = ItemSelect['type']
			type ItemCategory = ItemSelect['category']
			type UserStatus = UserSelect['status']
			type UserRole = UserSelect['type']
			type SalesDocumentType = SalesHeaderSelect['documentType']
			type SalesStatus = SalesHeaderSelect['status']
			type EntryType = ItemEntrySelect['type']

			expectTypeOf<ItemStatus>().toEqualTypeOf<
				' ' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'DISCONTINUED'
			>()
			expectTypeOf<ItemType>().toEqualTypeOf<
				'ITEM' | 'SERVICE' | 'BUNDLE' | ' '
			>()
			expectTypeOf<ItemCategory>().toEqualTypeOf<
				' ' | 'ELECTRONICS' | 'FURNITURE' | 'CLOTHING' | 'FOOD' | 'SPORTS'
			>()
			expectTypeOf<UserStatus>().toEqualTypeOf<
				' ' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
			>()
			expectTypeOf<UserRole>().toEqualTypeOf<
				' ' | 'ADMIN' | 'USER' | 'GUEST' | 'STAFF'
			>()

			expectTypeOf<SalesDocumentType>().toEqualTypeOf<
				| 'INVOICE'
				| 'ORDER'
				| 'QUOTE'
				| 'CREDIT_MEMO'
				| 'RETURN'
				| 'POS_TRANSACTION'
				| ' '
			>()
			expectTypeOf<SalesStatus>().toEqualTypeOf<
				| ' '
				| 'DRAFT'
				| 'PENDING_APPROVAL'
				| 'APPROVED'
				| 'REJECTED'
				| 'CANCELED'
				| 'COMPLETED'
			>()
			expectTypeOf<EntryType>().toEqualTypeOf<
				' ' | 'POSITIVE_ADJ' | 'NEGATIVE_ADJ'
			>()
		})
	})

	describe('Inferred Types', () => {
		it('should correctly infer select types for all entities', () => {
			expectTypeOf<ItemSelect>().toExtend<{
				id: string
				name: string
				createdAt: Date | null
				updatedAt: Date | null
				sku: string
				description: string
				type: 'ITEM' | 'SERVICE' | 'BUNDLE' | ' '
				status: ' ' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'DISCONTINUED'
				category:
					| ' '
					| 'ELECTRONICS'
					| 'FURNITURE'
					| 'CLOTHING'
					| 'FOOD'
					| 'SPORTS'
				barcode: string | null
				price: number
			}>()

			expectTypeOf<UserSelect>().toExtend<{
				id: number
				name: string
				createdAt: Date | null
				updatedAt: Date | null
				type: ' ' | 'ADMIN' | 'USER' | 'GUEST' | 'STAFF'
				status: ' ' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
				email: string
			}>()

			expectTypeOf<StoreSelect>().toExtend<{
				id: number
				name: string
				location: string
				createdAt: Date | null
				updatedAt: Date | null
				deletedAt: Date | null
			}>()
		})

		it('should correctly infer insert types for all entities', () => {
			expectTypeOf<ItemInsert>().toExtend<{
				name: string
				sku: string
				description: string
				price: number
				id?: string | undefined
				type?: 'ITEM' | 'SERVICE' | 'BUNDLE' | ' ' | undefined
				status?:
					| ' '
					| 'ACTIVE'
					| 'INACTIVE'
					| 'ARCHIVED'
					| 'DISCONTINUED'
					| undefined
				category?:
					| ' '
					| 'ELECTRONICS'
					| 'FURNITURE'
					| 'CLOTHING'
					| 'FOOD'
					| 'SPORTS'
					| undefined
				barcode?: string | null | undefined
				createdAt?: Date | null | undefined
				updatedAt?: Date | null | undefined
			}>()

			expectTypeOf<UserInsert>().toExtend<{
				email: string
				name: string
				id?: number | undefined
				type?: ' ' | 'ADMIN' | 'USER' | 'GUEST' | 'STAFF' | undefined
				status?: ' ' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | undefined
				createdAt?: Date | null | undefined
				updatedAt?: Date | null | undefined
			}>()

			expectTypeOf<StoreInsert>().toExtend<{
				name: string
				location: string
				id?: number | undefined
				createdAt?: Date | null | undefined
				updatedAt?: Date | null | undefined
				deletedAt?: Date | null | undefined
			}>()
		})

		it('should correctly infer complex relation types', () => {
			expectTypeOf<SalesHeaderSelect>().toExtend<{
				id: string
				status:
					| ' '
					| 'DRAFT'
					| 'PENDING_APPROVAL'
					| 'APPROVED'
					| 'REJECTED'
					| 'CANCELED'
					| 'COMPLETED'
				createdAt: Date
				updatedAt: Date
				documentNo: string
				documentType:
					| ' '
					| 'INVOICE'
					| 'ORDER'
					| 'QUOTE'
					| 'CREDIT_MEMO'
					| 'RETURN'
					| 'POS_TRANSACTION'
				postingDate: Date
				storeId: number
				amount: number
				tax: number
				total: number
			}>()

			expectTypeOf<SalesLineSelect>().toExtend<{
				createdAt: Date
				updatedAt: Date
				description: string
				documentNo: string
				documentType:
					| ' '
					| 'INVOICE'
					| 'ORDER'
					| 'QUOTE'
					| 'CREDIT_MEMO'
					| 'RETURN'
					| 'POS_TRANSACTION'
				amount: number
				tax: number
				lineNo: number
				itemNo: string
				itemType: 'ITEM' | 'SERVICE' | 'BUNDLE' | ' '
				quantity: number
				unitPrice: number
				taxAmount: number
			}>()

			expectTypeOf<ItemEntrySelect>().toExtend<{
				createdAt: Date
				updatedAt: Date
				description: string | null
				type: ' ' | 'POSITIVE_ADJ' | 'NEGATIVE_ADJ'
				storeId: number
				quantity: number
				entryNo: number
				itemId: string
			}>()
		})
	})

	describe('Service Methods Integration', () => {
		it('should implement ServiceMethods interface for all services', () => {
			expectTypeOf(itemService).toExtend<ServiceMethods<ItemEntity, Db>>()
			expectTypeOf(userService).toExtend<ServiceMethods<UserEntity, Db>>()
			expectTypeOf(storeService).toExtend<ServiceMethods<StoreEntity, Db>>()
			expectTypeOf(salesService).toExtend<
				ServiceMethods<SalesHeaderEntity, Db>
			>()
			expectTypeOf(salesLinesService).toExtend<
				ServiceMethods<SalesLineEntity, Db, SalesLineOption>
			>()
			expectTypeOf(itemEntryService).toExtend<
				ServiceMethods<ItemEntryEntity, Db, ItemEntryOption>
			>()
		})

		it('should expose underscore methods accessor for all services', () => {
			expectTypeOf(itemService._).toExtend<ServiceMethods<ItemEntity, Db>>()
			expectTypeOf(userService._).toExtend<ServiceMethods<UserEntity, Db>>()
			expectTypeOf(storeService._).toExtend<ServiceMethods<StoreEntity, Db>>()
			expectTypeOf(salesService._).toExtend<
				ServiceMethods<SalesHeaderEntity, Db>
			>()
			expectTypeOf(salesLinesService._).toExtend<
				ServiceMethods<SalesLineEntity, Db, SalesLineOption>
			>()
			expectTypeOf(itemEntryService._).toExtend<
				ServiceMethods<ItemEntryEntity, Db, ItemEntryOption>
			>()
		})
	})

	describe('Complex Composite Key Types', () => {
		it('should handle composite primary key types for sales lines', () => {
			// The service should accept the composite key as ID parameter
			expectTypeOf(salesLinesService.findOne)
				.parameter(0)
				.toEqualTypeOf<number>()
		})

		it('should handle composite primary key types for item entries', () => {
			// Item entries also use composite keys but with a generated ID
			expectTypeOf(itemEntryService.findOne)
				.parameter(0)
				.toEqualTypeOf<number>()
		})
	})
})
