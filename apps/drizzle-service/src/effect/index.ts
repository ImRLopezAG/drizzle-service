import { DrizzleQueryError } from 'drizzle-orm/errors'
import { Console, Effect } from 'effect'
import type {
  BaseEntity,
	DatabaseError,
	NotFoundError,
	RepositoryBuilderFn,
	RepositoryError,
	RepositoryHooks,
	RepositoryOptions,
	ValidationError,
} from './types'

// Utility function for converting Promise to Effect
export function tryEffect<T, E = RepositoryError>(
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
  error: RepositoryError,
  hooks?: RepositoryHooks<T>
): Effect.Effect<never, RepositoryError, never> => {
  const onError = hooks?.onError
  if (onError) {
    return Effect.gen(function* () {
      yield* onError(error)
      return yield* Effect.fail(error)
    })
  }
  return Effect.fail(error)
}


// Error mapping function
function mapError(error: unknown): RepositoryError {
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
	effect: Effect.Effect<T, RepositoryError, never>,
): Effect.Effect<T, RepositoryError, never> {
	return Effect.catchAll(effect, (error) =>
		Effect.gen(function* () {
			yield* Console.error('Repository error:', error)
			return yield* Effect.fail(error)
		}),
	)
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function getTableName(table: any): string {
	// Find the Symbol that contains "drizzle:BaseName" in its description
	const baseNameSymbol = Object.getOwnPropertySymbols(table).find((sym) =>
		sym.description?.includes('drizzle:BaseName'),
	)

	// Return the value if the symbol exists, otherwise return "unknown"
	return baseNameSymbol ? table[baseNameSymbol] : 'unknown'
}

// Main repository builder function - Effect version
export function createRepository<DB>(
	builderFn: RepositoryBuilderFn<DB>,
): RepositoryBuilderFn<DB> {
	return builderFn
}

// Alternative Effect-based error handler
export function effectErrorHandler(
	error: unknown,
): Effect.Effect<never, RepositoryError, never> {
	const mappedError = mapError(error)
	return Effect.fail(mappedError)
}

// Utility to convert hooks to Effect
export function executeHooks<T>(
	hooks:
		| {
				beforeAction?: (data: T) => Effect.Effect<void, RepositoryError, never>
				afterAction?: (data: T) => Effect.Effect<void, RepositoryError, never>
				onError?: (error: RepositoryError) => Effect.Effect<void, never, never>
		  }
		| undefined,
	data: T,
	phase: 'before' | 'after',
): Effect.Effect<void, RepositoryError, never> {
	if (!hooks) return Effect.void

	const hook = phase === 'before' ? hooks.beforeAction : hooks.afterAction
	if (!hook) return Effect.void

	return hook(data)
}

// Utility to handle repository errors with hooks
export function withErrorHook<T>(
	effect: Effect.Effect<T, RepositoryError, never>,
	onError?: (error: RepositoryError) => Effect.Effect<void, never, never>,
): Effect.Effect<T, RepositoryError, never> {
	if (!onError) return effect

	return Effect.catchAll(effect, (error) =>
		Effect.gen(function* () {
			yield* onError(error)
			return yield* Effect.fail(error)
		}),
	)
}

// Factory function to create Effect-based repositories
export function createEffectRepository<DB>(
	db: DB,
	builderFn: RepositoryBuilderFn<DB>,
) {
	return <
		T extends BaseEntity,
		TExtensions = Record<string, unknown>,
	>(
		entity: T,
		opts?: RepositoryOptions<T, TExtensions>,
	) => {
		return builderFn(db, entity, opts)
	}
}

// Utility to validate entity data
export function validateEntity<T>(
	data: T,
	schema?: (data: T) => Effect.Effect<T, ValidationError, never>,
): Effect.Effect<T, ValidationError, never> {
	if (!schema) return Effect.succeed(data)
	return schema(data)
}

// Utility to create not found errors
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
