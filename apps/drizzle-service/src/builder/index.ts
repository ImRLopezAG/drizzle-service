import {
	type Column,
	type SQLWrapper,
	and,
	eq,
	gt,
	gte,
	inArray,
	like,
	lt,
	lte,
	ne,
	sql,
} from 'drizzle-orm'
import { DrizzleQueryError } from 'drizzle-orm/errors'
import { Console, Effect } from 'effect'
import type {
	BaseEntity,
	DatabaseError,
	Handler,
	NotFoundError,
	ServiceBuilderFn,
	ServiceError,
	ServiceHooks,
	ServiceOptions,
	ValidationError,
} from './types'

// Utility function for converting Promise to Effect
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
export function createService<DB>(
	builderFn: ServiceBuilderFn<DB>,
): ServiceBuilderFn<DB> {
	return builderFn
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

export function createParserFunction<
	T extends BaseEntity,
	K extends keyof T['$inferSelect'],
>(
	table: T,
	handleILike: (
		column: Column<T['$inferSelect'][K]>,
		value: string,
	) => SQLWrapper,
): (field: K, filterExpr: [string, ...T['$inferSelect'][K][]]) => SQLWrapper {
	return (field: K, filterExpr: [string, ...T['$inferSelect'][K][]]) => {
		return parseFilterExpression(table, handleILike, field, filterExpr)
	}
}

function parseFilterExpression<
	T extends BaseEntity,
	K extends keyof T['$inferSelect'],
>(
	table: T,
	handleILike: (
		column: Column<T['$inferSelect'][K]>,
		value: string,
	) => SQLWrapper,
	field: K,
	[filterExpr, ...values]: [string, ...T['$inferSelect'][K][]],
): SQLWrapper {
	const column = table[field] as Column<T['$inferSelect'][K]>
	let expression = filterExpr

	// Replace placeholder values (%1, %2, etc.) with actual values
	values.forEach((value, index) => {
		expression = expression.replace(
			new RegExp(`%${index + 1}`, 'g'),
			String(value),
		)
	})

	// Handle case-insensitive flag (@)
	const isCaseInsensitive = expression.startsWith('@')
	if (isCaseInsensitive) {
		expression = expression.substring(1)
	}

	// Parse different operators and patterns
	if (expression.includes('..')) {
		// Range operator: value1..value2
		const startVal = values[0]
		const endVal = values[1]
		const rangeCondition = and(gte(column, startVal), lte(column, endVal))
		return rangeCondition || eq(column, startVal) // Fallback in case and returns undefined
	}

	if (expression.includes('|')) {
		// OR operator: value1|value2|value3
		const orValues = expression.split('|').map((_, index) => values[index])
		return inArray(column, orValues)
	}

	if (expression.includes('&')) {
		// AND operator: condition1&condition2
		const andParts = expression.split('&')
		const conditions = andParts.map((part, index) => {
			if (part.startsWith('>=')) {
				return gte(column, values[index])
			}
			if (part.startsWith('<=')) {
				return lte(column, values[index])
			}
			if (part.startsWith('<>')) {
				return ne(column, values[index])
			}
			if (part.startsWith('>')) {
				return gt(column, values[index])
			}
			if (part.startsWith('<')) {
				return lt(column, values[index])
			}
			return eq(column, values[index])
		})
		const andCondition = and(...conditions)
		return andCondition || eq(column, values[0]) // Fallback in case and returns undefined
	}

	// Handle wildcard patterns with *
	if (expression.includes('*')) {
		const sqlLikePattern = expression.replace(/\*/g, '%')
		return isCaseInsensitive
			? handleILike(column, sqlLikePattern)
			: like(column, sqlLikePattern)
	}

	// Handle comparison operators
	if (expression.startsWith('>=')) {
		return gte(column, values[0])
	}
	if (expression.startsWith('<=')) {
		return lte(column, values[0])
	}
	if (expression.startsWith('<>')) {
		return ne(column, values[0])
	}
	if (expression.startsWith('>')) {
		return gt(column, values[0])
	}
	if (expression.startsWith('<')) {
		return lt(column, values[0])
	}

	// Default to equality
	return eq(column, values[0])
}

export function sqliteIlike(column: SQLWrapper, value: string): SQLWrapper {
	return sql`${column} LIKE ${`%${value}%`} COLLATE NOCASE`
}

// Factory function to create Effect-based repositories
export function createEffectService<DB>(
	db: DB,
	builderFn: ServiceBuilderFn<DB>,
) {
	return <T extends BaseEntity, TExtensions = Record<string, unknown>>(
		entity: T,
		opts?: ServiceOptions<T, TExtensions>,
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
