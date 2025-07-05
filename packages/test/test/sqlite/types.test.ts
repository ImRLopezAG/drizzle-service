
import { describe, expectTypeOf, it } from 'vitest'
import { service, todos, users } from './schema'
import type { Service, SQLiteDb, QueryOperations, MutationOperations, Handler, MutationsBulkOperations, ServiceHooks, ServiceMethods } from 'drizzle-service/builder/types.d.ts'

// Service instances for type testing
const userService = service(users)
const todosService = service(todos, {
	soft: {
		field: 'status',
		deletedValue: 'canceled',
		notDeletedValue: 'todo', // Default value for not deleted
	},
	getSoftDeleted: async () => {
		return await todosService.findBy(
			{ status: 'canceled' },
			{ withDeleted: true },
		)
	},
})

// Type aliases for clarity
type UserEntity = typeof users
type TodoEntity = typeof todos
type UserSelect = typeof users.$inferSelect
type UserInsert = typeof users.$inferInsert
type TodoSelect = typeof todos.$inferSelect
type TodoInsert = typeof todos.$inferInsert

describe('SQLite Service Types', () => {
	describe('Base Service Structure', () => {
		it('should have correct repository interface structure', () => {
			expectTypeOf(userService).toMatchTypeOf<
				Service<UserEntity, SQLiteDb>
			>()
			expectTypeOf(todosService).toMatchTypeOf<
				Service<TodoEntity, SQLiteDb>
			>()
		})

		it('should expose database instance', () => {
			expectTypeOf(userService.db).toMatchTypeOf<SQLiteDb>()
			expectTypeOf(todosService.db).toMatchTypeOf<SQLiteDb>()
		})

		it('should expose entity information', () => {
			expectTypeOf(userService.entity).toEqualTypeOf<UserEntity>()
			expectTypeOf(todosService.entity).toEqualTypeOf<TodoEntity>()
			expectTypeOf(userService.entityName).toEqualTypeOf<string>()
			expectTypeOf(todosService.entityName).toEqualTypeOf<string>()
		})
	})

	describe('Query Operations Types', () => {
		it('should implement QueryOperations interface', () => {
			expectTypeOf(userService).toMatchTypeOf<QueryOperations<UserEntity>>()
			expectTypeOf(todosService).toMatchTypeOf<QueryOperations<TodoEntity>>()
		})

		it('should have correct findAll method types', () => {
			expectTypeOf(userService.findAll).toBeFunction()
			expectTypeOf(todosService.findAll).toBeFunction()
		})

		it('should have correct findById method types', () => {
			expectTypeOf(userService.findById).toBeFunction()
			expectTypeOf(todosService.findById).toBeFunction()

			expectTypeOf(userService.findById).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(todosService.findById)
				.parameter(0)
				.toEqualTypeOf<string>()
		})

		it('should have correct findBy method types', () => {
			expectTypeOf(userService.findBy).toBeFunction()
			expectTypeOf(todosService.findBy).toBeFunction()

			expectTypeOf(userService.findBy)
				.parameter(0)
				.toMatchTypeOf<Partial<UserSelect>>()
			expectTypeOf(todosService.findBy)
				.parameter(0)
				.toMatchTypeOf<Partial<TodoSelect>>()
		})

		it('should have correct findByField method types', () => {
			expectTypeOf(userService.findByField).toBeFunction()
			expectTypeOf(todosService.findByField).toBeFunction()

			expectTypeOf(userService.findByField)
				.parameter(0)
				.toEqualTypeOf<keyof UserSelect>()
			expectTypeOf(todosService.findByField)
				.parameter(0)
				.toEqualTypeOf<keyof TodoSelect>()
		})
	})

	describe('Mutation Operations Types', () => {
		it('should implement MutationOperations interface', () => {
			expectTypeOf(userService).toMatchTypeOf<
				MutationOperations<UserEntity>
			>()
			expectTypeOf(todosService).toMatchTypeOf<
				MutationOperations<TodoEntity>
			>()
		})

		it('should have correct create method types', () => {
			expectTypeOf(userService.create).toBeFunction()
			expectTypeOf(todosService.create).toBeFunction()

			expectTypeOf(userService.create)
				.parameter(0)
				.toMatchTypeOf<UserInsert>()
			expectTypeOf(todosService.create)
				.parameter(0)
				.toMatchTypeOf<TodoInsert>()

			expectTypeOf(userService.create).returns.toEqualTypeOf<
				Handler<UserSelect>
			>()
			expectTypeOf(todosService.create).returns.toEqualTypeOf<
				Handler<TodoSelect>
			>()
		})

		it('should have correct update method types', () => {
			expectTypeOf(userService.update).toBeFunction()
			expectTypeOf(todosService.update).toBeFunction()

			expectTypeOf(userService.update).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(todosService.update).parameter(0).toEqualTypeOf<string>()
			expectTypeOf(userService.update)
				.parameter(1)
				.toMatchTypeOf<Partial<Omit<UserInsert, 'createdAt' | 'id'>>>()
			expectTypeOf(todosService.update)
				.parameter(1)
				.toMatchTypeOf<Partial<Omit<TodoInsert, 'createdAt' | 'id'>>>()

			expectTypeOf(userService.update).returns.toEqualTypeOf<
				Handler<UserSelect>
			>()
			expectTypeOf(todosService.update).returns.toEqualTypeOf<
				Handler<TodoSelect>
			>()
		})

		it('should have correct delete method types', () => {
			expectTypeOf(userService.delete).toBeFunction()
			expectTypeOf(todosService.delete).toBeFunction()

			expectTypeOf(userService.delete).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(todosService.delete).parameter(0).toEqualTypeOf<string>()

			expectTypeOf(userService.delete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
			expectTypeOf(todosService.delete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
		})

		it('should have correct hardDelete method types', () => {
			expectTypeOf(userService.hardDelete).toBeFunction()
			expectTypeOf(todosService.hardDelete).toBeFunction()

			expectTypeOf(userService.hardDelete)
				.parameter(0)
				.toEqualTypeOf<number>()
			expectTypeOf(todosService.hardDelete)
				.parameter(0)
				.toEqualTypeOf<string>()

			expectTypeOf(userService.hardDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
			expectTypeOf(todosService.hardDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
		})
	})

	describe('Bulk Operations Types', () => {
		it('should implement MutationsBulkOperations interface', () => {
			expectTypeOf(userService).toMatchTypeOf<
				MutationsBulkOperations<UserEntity>
			>()
			expectTypeOf(todosService).toMatchTypeOf<
				MutationsBulkOperations<TodoEntity>
			>()
		})

		it('should have correct bulkCreate method types', () => {
			expectTypeOf(userService.bulkCreate).toBeFunction()
			expectTypeOf(todosService.bulkCreate).toBeFunction()

			expectTypeOf(userService.bulkCreate)
				.parameter(0)
				.toEqualTypeOf<UserInsert[]>()
			expectTypeOf(todosService.bulkCreate)
				.parameter(0)
				.toEqualTypeOf<TodoInsert[]>()
			expectTypeOf(userService.bulkCreate)
				.parameter(1)
				.toMatchTypeOf<ServiceHooks<UserEntity> | undefined>()
			expectTypeOf(todosService.bulkCreate)
				.parameter(1)
				.toMatchTypeOf<ServiceHooks<TodoEntity> | undefined>()

			expectTypeOf(userService.bulkCreate).returns.toEqualTypeOf<
				Handler<UserSelect[]>
			>()
			expectTypeOf(todosService.bulkCreate).returns.toEqualTypeOf<
				Handler<TodoSelect[]>
			>()
		})

		it('should have correct bulkUpdate method types', () => {
			expectTypeOf(userService.bulkUpdate).toBeFunction()
			expectTypeOf(todosService.bulkUpdate).toBeFunction()

			expectTypeOf(userService.bulkUpdate).parameter(0).toMatchTypeOf<
				Array<{
					id: number
					changes: Partial<Omit<UserInsert, 'createdAt' | 'id'>>
				}>
			>()
			expectTypeOf(todosService.bulkUpdate).parameter(0).toMatchTypeOf<
				Array<{
					id: string
					changes: Partial<Omit<TodoInsert, 'createdAt' | 'id'>>
				}>
			>()

			expectTypeOf(userService.bulkUpdate).returns.toEqualTypeOf<
				Handler<UserSelect[]>
			>()
			expectTypeOf(todosService.bulkUpdate).returns.toEqualTypeOf<
				Handler<TodoSelect[]>
			>()
		})

		it('should have correct bulkDelete method types', () => {
			expectTypeOf(userService.bulkDelete).toBeFunction()
			expectTypeOf(todosService.bulkDelete).toBeFunction()

			expectTypeOf(userService.bulkDelete)
				.parameter(0)
				.toEqualTypeOf<number[]>()
			expectTypeOf(todosService.bulkDelete)
				.parameter(0)
				.toEqualTypeOf<string[]>()

			expectTypeOf(userService.bulkDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
			expectTypeOf(todosService.bulkDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
		})

		it('should have correct bulkHardDelete method types', () => {
			expectTypeOf(userService.bulkHardDelete).toBeFunction()
			expectTypeOf(todosService.bulkHardDelete).toBeFunction()

			expectTypeOf(userService.bulkHardDelete)
				.parameter(0)
				.toEqualTypeOf<number[]>()
			expectTypeOf(todosService.bulkHardDelete)
				.parameter(0)
				.toEqualTypeOf<string[]>()

			expectTypeOf(userService.bulkHardDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
			expectTypeOf(todosService.bulkHardDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
		})
	})

	describe('Handler Types', () => {
		it('should have correct Handler type structure', () => {
			type UserHandler = Handler<UserSelect>
			type TodoHandler = Handler<TodoSelect>

			expectTypeOf<UserHandler>().toEqualTypeOf<
				Promise<[Error, null] | [null, UserSelect]>
			>()
			expectTypeOf<TodoHandler>().toEqualTypeOf<
				Promise<[Error, null] | [null, TodoSelect]>
			>()
		})
	})

	describe('Service Extension Types', () => {
		it('should properly type custom extensions', () => {
			// Test soft delete extension
			expectTypeOf(todosService.getSoftDeleted).toBeFunction()
			expectTypeOf(todosService.getSoftDeleted).returns.toEqualTypeOf<
				Promise<TodoSelect[]>
			>()
		})
	})

	describe('Generic Service Builder Types', () => {
		it('should handle generic repository creation', () => {
			// Test the repository builder function type
			expectTypeOf(service).toBeFunction()
		})
	})

	describe('Database-Specific Types', () => {
		it('should use SQLite-specific types', () => {
			expectTypeOf(userService.db).toMatchTypeOf<SQLiteDb>()
			expectTypeOf(todosService.db).toMatchTypeOf<SQLiteDb>()
		})

		it('should handle SQLite-specific enum types', () => {
			type TodoStatus = TodoSelect['status']
			type TodoPriority = TodoSelect['priority']
			type TodoLabel = TodoSelect['label']

			expectTypeOf<TodoStatus>().toEqualTypeOf<
				'todo' | 'backlog' | 'in-progress' | 'done' | 'canceled'
			>()
			expectTypeOf<TodoPriority>().toEqualTypeOf<'low' | 'medium' | 'high'>()
			expectTypeOf<TodoLabel>().toEqualTypeOf<
				'bug' | 'feature' | 'documentation'
			>()
		})
	})

	describe('Inferred Types', () => {
		it('should correctly infer select types', () => {
			expectTypeOf<UserSelect>().toMatchTypeOf<{
				id: number
				email: string
				name: string
				createdAt: Date
				updatedAt: Date
			}>()

			expectTypeOf<TodoSelect>().toMatchTypeOf<{
				id: string
				title: string
				description: string | null
				createdAt: Date
				updatedAt: Date
				userId: number
				status: 'todo' | 'backlog' | 'in-progress' | 'done' | 'canceled'
				priority: 'low' | 'medium' | 'high'
				label: 'bug' | 'feature' | 'documentation'
			}>()
		})

		it('should correctly infer insert types', () => {
			expectTypeOf<UserInsert>().toMatchTypeOf<{
				id?: number | undefined
				email: string
				name: string
				createdAt?: Date | undefined
				updatedAt?: Date | undefined
			}>()

			expectTypeOf<TodoInsert>().toMatchTypeOf<{
				id?: string | undefined
				title: string
				description?: string | null | undefined
				createdAt?: Date | undefined
				updatedAt?: Date | undefined
				userId: number
				status?:
					| 'todo'
					| 'backlog'
					| 'in-progress'
					| 'done'
					| 'canceled'
					| undefined
				priority?: 'low' | 'medium' | 'high' | undefined
				label?: 'bug' | 'feature' | 'documentation' | undefined
			}>()
		})
	})

	describe('Service Methods Integration', () => {
		it('should implement ServiceMethods interface', () => {
			expectTypeOf(userService).toMatchTypeOf<
				ServiceMethods<UserEntity>
			>()
			expectTypeOf(todosService).toMatchTypeOf<
				ServiceMethods<TodoEntity>
			>()
		})

		it('should expose underscore methods accessor', () => {
			expectTypeOf(userService._).toMatchTypeOf<
				ServiceMethods<UserEntity>
			>()
			expectTypeOf(todosService._).toMatchTypeOf<
				ServiceMethods<TodoEntity>
			>()
		})
	})

	describe('SQLite-specific Type Differences', () => {
		it('should handle timestamp differences from PostgreSQL', () => {
			// SQLite uses Date objects but internally stores as timestamps
			expectTypeOf<UserSelect['createdAt']>().toEqualTypeOf<Date>()
			expectTypeOf<UserSelect['updatedAt']>().toEqualTypeOf<Date>()
			expectTypeOf<TodoSelect['createdAt']>().toEqualTypeOf<Date>()
			expectTypeOf<TodoSelect['updatedAt']>().toEqualTypeOf<Date>()
		})

		it('should handle integer ID types correctly', () => {
			// SQLite user ID is integer, todo ID is text
			expectTypeOf<UserSelect['id']>().toEqualTypeOf<number>()
			expectTypeOf<TodoSelect['id']>().toEqualTypeOf<string>()
			expectTypeOf<TodoSelect['userId']>().toEqualTypeOf<number>()
		})

		it('should handle enum-like text constraints', () => {
			// SQLite uses text with enum constraints instead of native enums
			expectTypeOf<TodoSelect['status']>().toEqualTypeOf<
				'todo' | 'backlog' | 'in-progress' | 'done' | 'canceled'
			>()
			expectTypeOf<TodoSelect['priority']>().toEqualTypeOf<
				'low' | 'medium' | 'high'
			>()
			expectTypeOf<TodoSelect['label']>().toEqualTypeOf<
				'bug' | 'feature' | 'documentation'
			>()
		})
	})
})
