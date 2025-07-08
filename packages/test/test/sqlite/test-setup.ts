import { beforeAll } from 'vitest'
import {
	tenantsService,
	testIds,
	uniquePrefix,
	userData,
	userService,
} from '../sqlite/repository'

// Track if setup has been completed to avoid duplicate setup
let isSetupComplete = false

// Reset function to clear the setup state for fresh runs
export function resetSetup() {
	isSetupComplete = false
	testIds.userId = 0
	testIds.tenantId = 0
	testIds.todoIds.length = 0
	testIds.bulkTodoIds.length = 0
}

// Shared setup for all PostgreSQL test suites
export async function setupTestData() {
	// Skip setup if already completed
	if (isSetupComplete) {
		return
	}

	try {
		// Create a tenant first
		const [tenantError, tenant] = await tenantsService.create({
			name: `${uniquePrefix}-Tenant`,
		})

		if (tenantError) {
			// If it's a duplicate key error, try to find existing tenant
			const errorMessage =
				tenantError instanceof Error ? tenantError.message : String(tenantError)
			if (
				errorMessage.includes('duplicate key') ||
				errorMessage.includes('unique constraint')
			) {
				const existingTenants = await tenantsService.findBy({
					name: `${uniquePrefix}-Tenant`,
				})
				if (existingTenants.length > 0 && existingTenants[0]) {
					testIds.tenantId = existingTenants[0].tenantId
					userData.tenant = existingTenants[0].tenantId
				} else {
					throw new Error('Failed to create or find test tenant')
				}
			} else {
				throw tenantError
			}
		} else if (tenant) {
			testIds.tenantId = tenant.tenantId
			userData.tenant = tenant.tenantId
		} else {
			throw new Error('Failed to create test tenant')
		}

		// Now create the user with the correct tenant ID
		const [userError, user] = await userService.create(userData)

		if (userError) {
			// If it's a duplicate key error, try to find existing user
			const errorMessage =
				userError instanceof Error ? userError.message : String(userError)
			if (
				errorMessage.includes('duplicate key') ||
				errorMessage.includes('unique constraint')
			) {
				const existingUsers = await userService.findBy({
					email: `${uniquePrefix}@example.com`,
				})
				if (existingUsers.length > 0 && existingUsers[0]) {
					testIds.userId = existingUsers[0].id
				} else {
					throw new Error('Failed to create or find test user')
				}
			} else {
				throw userError
			}
		} else if (user) {
			testIds.userId = user.id
		} else {
			throw new Error('Failed to create test user')
		}

		// Mark setup as complete
		isSetupComplete = true
	} catch (error) {
		console.error('Setup failed:', error)
		throw error
	}
}

// Export beforeAll setup for use in test files
export const setupBeforeAll = () => {
	beforeAll(async () => {
		await setupTestData()
	})
}
