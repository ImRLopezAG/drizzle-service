import type {
	Handler,
	MutationOperations,
	MutationsBulkOperations,
	PostgresDb,
	QueryOperations,
	Repository,
	RepositoryHooks,
	RepositoryMethods,
} from 'drizzle-service/builder/types.d.ts'
import { describe, expectTypeOf, it } from 'vitest'
import { repository, todos, users } from './schema'

// Repository instances for type testing
const userRepository = repository(users)
const todosRepository = repository(todos, {
	soft: {
		field: 'status',
		deletedValue: 'canceled',
	},
	getSoftDeleted: async () => {
		return await todosRepository.findBy(
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

describe('PostgreSQL Repository Types', () => {
	describe('Base Repository Structure', () => {
		it('should have correct repository interface structure', () => {
			expectTypeOf(userRepository).toMatchTypeOf<
				Repository<UserEntity, PostgresDb>
			>()
			expectTypeOf(todosRepository).toMatchTypeOf<
				Repository<TodoEntity, PostgresDb>
			>()
		})

		it('should expose database instance', () => {
			expectTypeOf(userRepository.db).toMatchTypeOf<PostgresDb>()
			expectTypeOf(todosRepository.db).toMatchTypeOf<PostgresDb>()
		})

		it('should expose entity information', () => {
			expectTypeOf(userRepository.entity).toEqualTypeOf<UserEntity>()
			expectTypeOf(todosRepository.entity).toEqualTypeOf<TodoEntity>()
			expectTypeOf(userRepository.entityName).toEqualTypeOf<string>()
			expectTypeOf(todosRepository.entityName).toEqualTypeOf<string>()
		})
	})

	describe('Query Operations Types', () => {
		it('should implement QueryOperations interface', () => {
			expectTypeOf(userRepository).toMatchTypeOf<QueryOperations<UserEntity>>()
			expectTypeOf(todosRepository).toMatchTypeOf<QueryOperations<TodoEntity>>()
		})

		it('should have correct findAll method types', () => {
			expectTypeOf(userRepository.findAll).toBeFunction()
			expectTypeOf(todosRepository.findAll).toBeFunction()
		})

		it('should have correct findById method types', () => {
			expectTypeOf(userRepository.findById).toBeFunction()
			expectTypeOf(todosRepository.findById).toBeFunction()

			expectTypeOf(userRepository.findById).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(todosRepository.findById)
				.parameter(0)
				.toEqualTypeOf<string>()
		})

		it('should have correct findBy method types', () => {
			expectTypeOf(userRepository.findBy).toBeFunction()
			expectTypeOf(todosRepository.findBy).toBeFunction()

			expectTypeOf(userRepository.findBy)
				.parameter(0)
				.toMatchTypeOf<Partial<UserSelect>>()
			expectTypeOf(todosRepository.findBy)
				.parameter(0)
				.toMatchTypeOf<Partial<TodoSelect>>()
		})

		it('should have correct findByField method types', () => {
			expectTypeOf(userRepository.findByField).toBeFunction()
			expectTypeOf(todosRepository.findByField).toBeFunction()

			expectTypeOf(userRepository.findByField)
				.parameter(0)
				.toEqualTypeOf<keyof UserSelect>()
			expectTypeOf(todosRepository.findByField)
				.parameter(0)
				.toEqualTypeOf<keyof TodoSelect>()
		})
	})

	describe('Mutation Operations Types', () => {
		it('should implement MutationOperations interface', () => {
			expectTypeOf(userRepository).toMatchTypeOf<
				MutationOperations<UserEntity>
			>()
			expectTypeOf(todosRepository).toMatchTypeOf<
				MutationOperations<TodoEntity>
			>()
		})

		it('should have correct create method types', () => {
			expectTypeOf(userRepository.create).toBeFunction()
			expectTypeOf(todosRepository.create).toBeFunction()

			expectTypeOf(userRepository.create)
				.parameter(0)
				.toMatchTypeOf<UserInsert>()
			expectTypeOf(todosRepository.create)
				.parameter(0)
				.toMatchTypeOf<TodoInsert>()

			expectTypeOf(userRepository.create).returns.toEqualTypeOf<
				Handler<UserSelect>
			>()
			expectTypeOf(todosRepository.create).returns.toEqualTypeOf<
				Handler<TodoSelect>
			>()
		})

		it('should have correct update method types', () => {
			expectTypeOf(userRepository.update).toBeFunction()
			expectTypeOf(todosRepository.update).toBeFunction()

			expectTypeOf(userRepository.update).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(todosRepository.update).parameter(0).toEqualTypeOf<string>()
			expectTypeOf(userRepository.update)
				.parameter(1)
				.toMatchTypeOf<Partial<Omit<UserInsert, 'createdAt' | 'id'>>>()
			expectTypeOf(todosRepository.update)
				.parameter(1)
				.toMatchTypeOf<Partial<Omit<TodoInsert, 'createdAt' | 'id'>>>()

			expectTypeOf(userRepository.update).returns.toEqualTypeOf<
				Handler<UserSelect>
			>()
			expectTypeOf(todosRepository.update).returns.toEqualTypeOf<
				Handler<TodoSelect>
			>()
		})

		it('should have correct delete method types', () => {
			expectTypeOf(userRepository.delete).toBeFunction()
			expectTypeOf(todosRepository.delete).toBeFunction()

			expectTypeOf(userRepository.delete).parameter(0).toEqualTypeOf<number>()
			expectTypeOf(todosRepository.delete).parameter(0).toEqualTypeOf<string>()

			expectTypeOf(userRepository.delete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
			expectTypeOf(todosRepository.delete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
		})

		it('should have correct hardDelete method types', () => {
			expectTypeOf(userRepository.hardDelete).toBeFunction()
			expectTypeOf(todosRepository.hardDelete).toBeFunction()

			expectTypeOf(userRepository.hardDelete)
				.parameter(0)
				.toEqualTypeOf<number>()
			expectTypeOf(todosRepository.hardDelete)
				.parameter(0)
				.toEqualTypeOf<string>()

			expectTypeOf(userRepository.hardDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
			expectTypeOf(todosRepository.hardDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
		})
	})

	describe('Bulk Operations Types', () => {
		it('should implement MutationsBulkOperations interface', () => {
			expectTypeOf(userRepository).toMatchTypeOf<
				MutationsBulkOperations<UserEntity>
			>()
			expectTypeOf(todosRepository).toMatchTypeOf<
				MutationsBulkOperations<TodoEntity>
			>()
		})

		it('should have correct bulkCreate method types', () => {
			expectTypeOf(userRepository.bulkCreate).toBeFunction()
			expectTypeOf(todosRepository.bulkCreate).toBeFunction()

			expectTypeOf(userRepository.bulkCreate)
				.parameter(0)
				.toEqualTypeOf<UserInsert[]>()
			expectTypeOf(todosRepository.bulkCreate)
				.parameter(0)
				.toEqualTypeOf<TodoInsert[]>()
			expectTypeOf(userRepository.bulkCreate)
				.parameter(1)
				.toMatchTypeOf<RepositoryHooks<UserEntity> | undefined>()
			expectTypeOf(todosRepository.bulkCreate)
				.parameter(1)
				.toMatchTypeOf<RepositoryHooks<TodoEntity> | undefined>()

			expectTypeOf(userRepository.bulkCreate).returns.toEqualTypeOf<
				Handler<UserSelect[]>
			>()
			expectTypeOf(todosRepository.bulkCreate).returns.toEqualTypeOf<
				Handler<TodoSelect[]>
			>()
		})

		it('should have correct bulkUpdate method types', () => {
			expectTypeOf(userRepository.bulkUpdate).toBeFunction()
			expectTypeOf(todosRepository.bulkUpdate).toBeFunction()

			expectTypeOf(userRepository.bulkUpdate).parameter(0).toMatchTypeOf<
				Array<{
					id: number
					changes: Partial<Omit<UserInsert, 'createdAt' | 'id'>>
				}>
			>()
			expectTypeOf(todosRepository.bulkUpdate).parameter(0).toMatchTypeOf<
				Array<{
					id: string
					changes: Partial<Omit<TodoInsert, 'createdAt' | 'id'>>
				}>
			>()

			expectTypeOf(userRepository.bulkUpdate).returns.toEqualTypeOf<
				Handler<UserSelect[]>
			>()
			expectTypeOf(todosRepository.bulkUpdate).returns.toEqualTypeOf<
				Handler<TodoSelect[]>
			>()
		})

		it('should have correct bulkDelete method types', () => {
			expectTypeOf(userRepository.bulkDelete).toBeFunction()
			expectTypeOf(todosRepository.bulkDelete).toBeFunction()

			expectTypeOf(userRepository.bulkDelete)
				.parameter(0)
				.toEqualTypeOf<number[]>()
			expectTypeOf(todosRepository.bulkDelete)
				.parameter(0)
				.toEqualTypeOf<string[]>()

			expectTypeOf(userRepository.bulkDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
			expectTypeOf(todosRepository.bulkDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
		})

		it('should have correct bulkHardDelete method types', () => {
			expectTypeOf(userRepository.bulkHardDelete).toBeFunction()
			expectTypeOf(todosRepository.bulkHardDelete).toBeFunction()

			expectTypeOf(userRepository.bulkHardDelete)
				.parameter(0)
				.toEqualTypeOf<number[]>()
			expectTypeOf(todosRepository.bulkHardDelete)
				.parameter(0)
				.toEqualTypeOf<string[]>()

			expectTypeOf(userRepository.bulkHardDelete).returns.toEqualTypeOf<
				Promise<{ readonly success: boolean; readonly message?: string }>
			>()
			expectTypeOf(todosRepository.bulkHardDelete).returns.toEqualTypeOf<
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

	describe('Repository Extension Types', () => {
		it('should properly type custom extensions', () => {
			// Test soft delete extension
			expectTypeOf(todosRepository.getSoftDeleted).toBeFunction()
			expectTypeOf(todosRepository.getSoftDeleted).returns.toEqualTypeOf<
				Promise<TodoSelect[]>
			>()
		})
	})

	describe('Generic Repository Builder Types', () => {
		it('should handle generic repository creation', () => {
			// Test the repository builder function type
			expectTypeOf(repository).toBeFunction()
		})
	})

	describe('Database-Specific Types', () => {
		it('should use SQLite-specific types', () => {
			expectTypeOf(userRepository.db).toMatchTypeOf<PostgresDb>()
			expectTypeOf(todosRepository.db).toMatchTypeOf<PostgresDb>()
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

	describe('Repository Methods Integration', () => {
		it('should implement RepositoryMethods interface', () => {
			expectTypeOf(userRepository).toMatchTypeOf<
				RepositoryMethods<UserEntity>
			>()
			expectTypeOf(todosRepository).toMatchTypeOf<
				RepositoryMethods<TodoEntity>
			>()
		})

		it('should expose underscore methods accessor', () => {
			expectTypeOf(userRepository._).toMatchTypeOf<
				RepositoryMethods<UserEntity>
			>()
			expectTypeOf(todosRepository._).toMatchTypeOf<
				RepositoryMethods<TodoEntity>
			>()
		})
	})
})
