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
	sql
} from 'drizzle-orm'
import { DrizzleQueryError } from 'drizzle-orm/errors'
import type { BaseEntity, Handler, ServiceBuilderFn } from './types'

// Utility function for error handling
export async function tryHandler<T>(
	fn: () => Promise<T>,
	handlingFn?: (error: unknown) => Error | null,
): Handler<T> {
	try {
		const result = await fn()
		return [null, result] as [null, T]
	} catch (error) {
		if (handlingFn) {
			const handled = handlingFn(error)
			if (handled) return [handled, null] as [Error, null]
		}
		return [
			error instanceof Error ? error : new Error(String(error)),
			null,
		] as [Error, null]
	}
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
// Main service builder function
export function initializeService<DB>(
	builderFn: ServiceBuilderFn<DB>,
): ServiceBuilderFn<DB> {
	return builderFn
}

export function errorHandler(error: unknown): Error {
	if (error instanceof DrizzleQueryError) {
		const cause = error.cause
		if (!cause) return new Error(`Database error: ${error.message}`)
		const { message, name } = cause
		return new Error(`Database error: ${message} (${name})`)
	}
	return error instanceof Error
		? error
		: new Error(`Unexpected error: ${String(error)}`)
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
):  (field: K, filterExpr: [string, ...T['$inferSelect'][K][]]) => SQLWrapper {
	return (field: K, filterExpr: [string, ...T['$inferSelect'][K][]]) => {
		return parseFilterExpression(
			table,
			handleILike,
			field,
			filterExpr,
		)
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