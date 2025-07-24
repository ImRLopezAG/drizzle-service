import { DrizzleQueryError } from 'drizzle-orm/errors'
import { Console, Effect } from 'effect'
import type {
	BaseEntity,
	DatabaseError,
	Handler,
	NotFoundError,
	ServiceError,
	ServiceHooks,
	ValidationError,
} from './builder/types'

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
export const handleOptionalErrorHook = <T extends BaseEntity>(
	error: ServiceError,
	hooks?: ServiceHooks<T>,
): Effect.Effect<never, ServiceError, never> => {
	const onError = hooks?.onError
	if (onError) {
		return Effect.gen(function* () {
			yield* tryEffect(() => onError(error))
			return yield* Effect.fail(error)
		})
	}
	return Effect.fail(error)
}

// Error mapping function
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

// Error handling with logging
export function handleError<T>(
	effect: Effect.Effect<T, ServiceError, never>,
): Promise<T> {
	return Effect.catchAll(effect, (error) =>
		Effect.gen(function* () {
			yield* Console.error('Service error:', error)
			return yield* Effect.fail(error)
		}),
	).pipe(Effect.runPromise)
}

export function tryHandleError<T>(
	effect: Effect.Effect<T, ServiceError, never>,
): Handler<T> {
	return Effect.matchEffect(effect, {
		onFailure: (error) => Effect.succeed<[ServiceError, null]>([error, null]),
		onSuccess: (result) => Effect.succeed<[null, T]>([null, result]),
	}).pipe(Effect.runPromise)
}

// Alternative Effect-based error handler
export function effectErrorHandler(
	error: unknown,
): Effect.Effect<never, ServiceError, never> {
	const mappedError = mapError(error)
	return Effect.fail(mappedError)
}

// Utility to convert hooks to Effect
export function executeHooks<T>(
	hooks:
		| {
				beforeAction?: (data: T) => Promise<void>
				afterAction?: (data: T) => Promise<void>
				onError?: (error: ServiceError) => Promise<void>
		  }
		| undefined,
	data: T,
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

// Utility to handle repository errors with hooks
export function withErrorHook<T>(
	effect: Effect.Effect<T, ServiceError, never>,
	onError?: (error: ServiceError) => Effect.Effect<void, never, never>,
): Effect.Effect<T, ServiceError, never> {
	if (!onError) return effect

	return Effect.catchAll(effect, (error) =>
		Effect.gen(function* () {
			yield* onError(error)
			return yield* Effect.fail(error)
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

// Utility to create validation errors
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

// Utility to create database errors
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
