import { DrizzleQueryError } from 'drizzle-orm/errors'
import type { Handler, ServiceBuilderFn } from './types'

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
		console.error('Error handling: ', error)
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
