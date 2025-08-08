import { DrizzleQueryError } from 'drizzle-orm/errors'
import { Console, Effect } from 'effect'
import type {
	DatabaseError,
	Handler,
	NotFoundError,
	ServiceError,
	ServiceHooks,
	ValidationError,
} from './builder/types'

// Helper function to extract clean error details from database errors (any dialect)
function extractCleanErrorDetails(error: any): string {
	if (error && typeof error === 'object') {
		const details: string[] = []

		if (error.message) {
			details.push(`error: ${error.message}`)
		}

		// Common database error fields across different dialects
		const dbFields = [
			'length',
			'severity',
			'detail',
			'hint',
			'position',
			'internalPosition',
			'internalQuery',
			'where',
			'schema',
			'table',
			'column',
			'dataType',
			'constraint',
			'file',
			'routine',
			'code',
			'errno',
			'sqlState',
			'sqlMessage',
			'rawCode',
		]

		dbFields.forEach((field) => {
			if (error[field] !== undefined) {
				// Format undefined as the string "undefined" for consistency
				const value = error[field] === undefined ? 'undefined' : error[field]
				details.push(`${field.padStart(15)}: ${value}`)
			}
		})

		return details.join('\n')
	}

	return `error: ${String(error)}`
}

// Create a clean error object without the cause to prevent bundled code from showing
function createCleanError(originalError: ServiceError): ServiceError {
	const cleanError = new (class extends Error {
		readonly _tag = originalError._tag as any
		constructor(message: string) {
			super(message)
		}
	})(originalError.message)

	// Copy other properties but exclude cause
	Object.keys(originalError).forEach((key) => {
		if (key !== 'cause' && key !== 'stack') {
			;(cleanError as any)[key] = (originalError as any)[key]
		}
	})

	return cleanError as ServiceError
}

// Enhanced error mapping function
function mapError(error: unknown): ServiceError {
	if (error instanceof DrizzleQueryError) {
		const cause = error.cause
		if (!cause) {
			return new (class extends Error {
				readonly _tag = 'DatabaseError'
				constructor(
					message: string,
					public override readonly cause?: unknown,
				) {
					super(message)
				}
			})(`Database error: ${error.message}`)
		}

		const { message, name } = cause
		return new (class extends Error {
			readonly _tag = 'DatabaseError'
			constructor(
				message: string,
				public override readonly cause?: unknown,
			) {
				super(message)
			}
		})(`Database error: ${message} (${name})`, cause)
	}

	if (error instanceof Error) {
		return new (class extends Error {
			readonly _tag = 'DatabaseError'
			constructor(
				message: string,
				public override readonly cause?: unknown,
			) {
				super(message)
			}
		})(error.message, error)
	}

	return new (class extends Error {
		readonly _tag = 'DatabaseError'
		constructor(
			message: string,
			public override readonly cause?: unknown,
		) {
			super(message)
		}
	})(`Unexpected error: ${String(error)}`, error)
}

// Enhanced error handling with clean logging
export function handleError<T>(
	effect: Effect.Effect<T, ServiceError, never>,
): Promise<T> {
	return Effect.catchAll(effect, (error) =>
		Effect.gen(function* () {
			// Log clean error details
			if (error._tag === 'DatabaseError' && error.cause) {
				const cleanDetails = extractCleanErrorDetails(error.cause)
				yield* Console.error(cleanDetails)
			} else {
				// For non-database errors or simple format
				yield* Console.error(`error: ${error.message}`)
				yield* Console.error(`  _tag: "${error._tag}"`)
			}

			// Return a clean error without the cause to prevent bundled code from showing
			const cleanError = createCleanError(error)
			return yield* Effect.fail(cleanError)
		}),
	).pipe(Effect.runPromise)
}

// Custom logger for specific error types
export function logCleanError(
	error: ServiceError,
): Effect.Effect<void, never, never> {
	return Effect.gen(function* () {
		if (error._tag === 'DatabaseError' && error.cause) {
			const cleanDetails = extractCleanErrorDetails(error.cause)
			yield* Console.error(cleanDetails)
		} else {
			// Other error types
			yield* Console.error(`error: ${error.message}`)
			yield* Console.error(`  _tag: "${error._tag}"`)
		}
	})
}

// Updated tryEffect with clean error logging
export function tryEffect<T, E = ServiceError>(
	fn: () => Promise<T>,
	errorMapFn?: (error: unknown) => E,
): Effect.Effect<T, E, never> {
	return Effect.tryPromise({
		try: fn,
		catch: (error) => {
			if (errorMapFn) {
				return errorMapFn(error)
			}
			return mapError(error) as E
		},
	})
}

// Enhanced handleOptionalErrorHook with clean logging
export const handleOptionalErrorHook = <T, O>(
	error: ServiceError,
	hooks?: ServiceHooks<T, O>,
): Effect.Effect<never, ServiceError, never> => {
	const onError = hooks?.onError
	if (onError) {
		return Effect.gen(function* () {
			// Log clean error before calling hook
			yield* logCleanError(error)
			yield* tryEffect(() => onError(error))
			// Return clean error without cause
			const cleanError = createCleanError(error)
			return yield* Effect.fail(cleanError)
		})
	}

	// Log clean error even without hooks
	return Effect.gen(function* () {
		yield* logCleanError(error)
		// Return clean error without cause
		const cleanError = createCleanError(error)
		return yield* Effect.fail(cleanError)
	})
}

// Alternative function that returns only clean errors
export function tryHandleErrorClean<T>(
	effect: Effect.Effect<T, ServiceError, never>,
): Handler<T> {
	return Effect.matchEffect(effect, {
		onFailure: (error) => {
			// Log the clean error details
			if (error._tag === 'DatabaseError' && error.cause) {
				const cleanDetails = extractCleanErrorDetails(error.cause)
				console.error(cleanDetails)
			} else {
				console.error(`error: ${error.message}`)
				console.error(`  _tag: "${error._tag}"`)
			}

			// Return clean error without cause
			const cleanError = createCleanError(error)
			return Effect.succeed<[ServiceError, null]>([cleanError, null])
		},
		onSuccess: (result) => Effect.succeed<[null, T]>([null, result]),
	}).pipe(Effect.runPromise)
}

// Rest of your existing utility functions...
export function tryHandleError<T>(
	effect: Effect.Effect<T, ServiceError, never>,
): Handler<T> {
	return Effect.matchEffect(effect, {
		onFailure: (error) => {
			const cleanError = createCleanError(error)
			return Effect.succeed<[ServiceError, null]>([cleanError, null])
		},
		onSuccess: (result) => Effect.succeed<[null, T]>([null, result]),
	}).pipe(Effect.runPromise)
}

export function effectErrorHandler(
	error: unknown,
): Effect.Effect<never, ServiceError, never> {
	const mappedError = mapError(error)
	const cleanError = createCleanError(mappedError)
	return Effect.fail(cleanError)
}

export function executeHooks<_T, TBefore, TAfter = TBefore>(
	hooks:
		| {
				beforeAction?: (data: TBefore) => Promise<void>
				afterAction?: (data: TAfter) => Promise<void>
				onError?: (error: ServiceError) => Promise<void>
		  }
		| undefined,
	data: any,
	phase: 'before' | 'after',
): Effect.Effect<void, ServiceError, never> {
	if (!hooks) return Effect.void
	if (phase !== 'before' && phase !== 'after') return Effect.void
	const { beforeAction, afterAction } = hooks
	return Effect.gen(function* () {
		if (phase === 'before' && beforeAction) {
			yield* tryEffect(async () => await beforeAction(data))
		} else if (phase === 'after' && afterAction) {
			yield* tryEffect(async () => await afterAction(data))
		}
	})
}

export function withErrorHook<T>(
	effect: Effect.Effect<T, ServiceError, never>,
	onError?: (error: ServiceError) => Effect.Effect<void, never, never>,
): Effect.Effect<T, ServiceError, never> {
	if (!onError) return effect

	return Effect.catchAll(effect, (error) =>
		Effect.gen(function* () {
			yield* onError(error)
			const cleanError = createCleanError(error)
			return yield* Effect.fail(cleanError)
		}),
	)
}

export function createNotFoundError(
	entityType: string,
	id: unknown,
): Effect.Effect<never, NotFoundError, never> {
	return Effect.fail(
		new (class extends Error {
			readonly _tag = 'NotFoundError'
			constructor(
				message: string,
				public entityType?: string,
				public id?: unknown,
			) {
				super(message)
			}
		})(`${entityType} with id ${id} not found`, entityType, id),
	)
}

export function createValidationError(
	message: string,
	field?: string,
): Effect.Effect<never, ValidationError, never> {
	return Effect.fail(
		new (class extends Error {
			readonly _tag = 'ValidationError'
			constructor(
				message: string,
				public field?: string,
			) {
				super(message)
			}
		})(message, field),
	)
}

export function createDatabaseError(
	message: string,
	cause?: unknown,
): Effect.Effect<never, DatabaseError, never> {
	return Effect.fail(
		new (class extends Error {
			readonly _tag = 'DatabaseError'
			constructor(
				message: string,
				public override readonly cause?: unknown,
			) {
				super(message)
			}
		})(message, cause),
	)
}
