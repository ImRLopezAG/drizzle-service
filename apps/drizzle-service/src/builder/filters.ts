import {
	and,
	asc,
	between,
	type Column,
	desc,
	eq,
	gt,
	gte,
	inArray,
	like,
	lt,
	lte,
	ne,
	not,
	notInArray,
	SQL,
	type SQLWrapper,
	sql,
} from 'drizzle-orm'
import { Effect } from 'effect'
import { tryEffect } from '@/helpers'
import { createParserFunction } from './'
import type {
	BaseDatabase,
	BaseEntity,
	CriteriaFilter,
	CriteriaFilters,
	FilterOperators,
	FindOneOpts,
	QBuilders,
	QueryOpts,
	RelationType,
	SoftDeleteOption,
	WithRelations,
} from './types'

interface Filters<
	T extends BaseEntity,
	DB extends BaseDatabase = BaseDatabase,
	K extends keyof T['$inferSelect'] = keyof T['$inferSelect'],
> {
	table: T
	db: DB
	handleILike: (
		column: Column<T['$inferSelect'][K]>,
		value: string,
	) => SQLWrapper
	soft?: SoftDeleteOption<T>
	defaultLimit?: number
	maxLimit?: number
}

// Function overloads for createFilters
export function createFilters<
	T extends BaseEntity,
	Db extends BaseDatabase,
	QB extends QBuilders = QBuilders,
>(config: Filters<T, Db>): FiltersReturn<T, QB>
export function createFilters<T extends BaseEntity, Db extends BaseDatabase>({
	table,
	soft,
	defaultLimit = 100,
	maxLimit = 100,
	handleILike,
}: Filters<T, Db>) {
	const lower = (
		col: Column<T['$inferSelect'][keyof T['$inferSelect']]>,
	): SQLWrapper => sql`lower(${col})`
	const contains = (
		col: Column<T['$inferSelect'][keyof T['$inferSelect']]>,
		value: string,
	): SQLWrapper => like(col, `%${value}%`)
	const startsWith = (
		col: Column<T['$inferSelect'][keyof T['$inferSelect']]>,
		value: string,
	): SQLWrapper => like(col, `${value}%`)
	const endsWith = (
		col: Column<T['$inferSelect'][keyof T['$inferSelect']]>,
		value: string,
	): SQLWrapper => like(col, `%${value}`)
	function withPagination<Q extends QBuilders, TResult>(
		q: Q,
		options?: QueryOpts<T, TResult>,
	): Q {
		const pageSize = Math.min(options?.limit || defaultLimit, maxLimit)
		const page = Math.max(0, (options?.page || 1) - 1)
		return q.limit(pageSize).offset(page * pageSize) as Q
	}

	function withOrderBy<Q extends QBuilders, TResult>(
		q: Q,
		orderBy: QueryOpts<T, TResult>['orderBy'],
	): Q {
		if (!orderBy) return q

		// Collect all ordering expressions
		const orderExpressions = Object.entries(orderBy)
			.filter(([_, direction]) => direction)
			.map(([field, direction]) => {
				const column = table[field as keyof T] as Column<
					T['$inferSelect'][keyof T['$inferSelect']]
				>
				if (column.columnType === 'string') {
					return direction === 'asc' ? asc(lower(column)) : desc(lower(column))
				}
				return direction === 'asc' ? asc(column) : desc(column)
			})

		if (orderExpressions.length === 0) return q

		//@ts-ignore
		return q.orderBy(...orderExpressions)
	}

	function withCursor<Q extends QBuilders, TResult>(
		q: Q,
		cursor?: QueryOpts<T, TResult>['cursor'],
	): Q {
		if (!cursor) return q

		// Assuming createdAt exists on the table for cursor pagination
		return q.where(gt(table.createdAt, cursor)).$dynamic() as Q
	}

	function withRelations<Q extends QBuilders>(
		q: Q,
		relations: WithRelations[] = [],
	): Q {
		if (relations.length === 0) return q

		// biome-ignore lint/suspicious/noExplicitAny: Join operations change query type
		let query: any = q
		for (const { on, type, table } of relations) {
			switch (type) {
				case 'left':
					query = query.leftJoin(table, on)
					break
				case 'inner':
					query = query.innerJoin(table, on)
					break
				case 'right':
					query = query.rightJoin(table, on)
					break
			}
		}

		return query as Q
	}

	function withCustom<Q extends QBuilders, TResult>(
		q: Q,
		custom?: QueryOpts<T, TResult>['where'],
	): Q {
		if (!custom) return q

		return q.where(custom) as Q
	}

	const parseFilterExpression = createParserFunction<
		T,
		keyof T['$inferSelect']
	>(table, (column, value) => {
		return handleILike(column, value)
	})

	function withSoftDeleted<Q extends QBuilders>(q: Q, skip = false): Q {
		if (skip) {
			return q
		}
		if (soft) {
			return q.where(
				ne(table[soft.field] as SQLWrapper, soft.deletedValue),
			) as Q
		}
		return q
	}

	function withWorkspace<Q extends QBuilders, TResult>(
		q: Q,
		workspace?: QueryOpts<T, TResult>['workspace'],
	): Q {
		if (!workspace) return q
		const { field, value } = workspace
		return q.where(
			eq(table[field as keyof T['$inferSelect']] as SQLWrapper, value),
		) as Q
	}

	function withOpts<
		Q extends QBuilders,
		TResult,
		TRels extends WithRelations[] = [],
	>(q: Q, opts: Omit<QueryOpts<T, TResult, TRels>, 'parse'>): Q {
		let query = withSoftDeleted(q, opts.withDeleted)

		query = withWorkspace(query, opts.workspace)
		if (opts.relations && opts.relations.length > 0) {
			query = withRelations(query, opts.relations)
		}

		query = withOrderBy(query, opts.orderBy)

		// Only apply pagination when explicitly requested
		if (opts.page !== undefined || opts.limit !== undefined) {
			query = withPagination(query, {
				page: opts.page || 1,
				limit: opts.limit || defaultLimit,
			})
		}

		if (opts.cursor) {
			query = withCursor(query, opts.cursor)
		}

		if (opts.where) {
			query = withCustom(query, opts.where)
		}

		return query
	}

	function handleQueries<
		Q extends QBuilders,
		TResult,
		TRels extends WithRelations[] = [],
	>(
		query: Q,
		queryOpts: QueryOpts<T, TResult, TRels>,
		hooks?: {
			beforeParse?: (q: Q) => Q
			afterParse?: (data: TResult) => TResult
		},
	) {
		return Effect.gen(function* () {
			const { parse, ...opts } = queryOpts
			const { beforeParse, afterParse } = hooks || {}
			let q = withOpts(query, opts)

			if (beforeParse) {
				q = beforeParse(q)
			}

			const data = yield* tryEffect(async () => await q)

			// Apply custom parse function if provided
			if (parse) {
				return parse(data as unknown as T['$inferSelect'][])
			}

			if (afterParse) {
				return afterParse(data as unknown as TResult)
			}

			return data
		})
	}
	function handleOneQuery<
		Q extends QBuilders,
		TResult,
		TRels extends WithRelations[] = [],
	>(
		query: Q,
		queryOpts: FindOneOpts<T, TResult, TRels>,
		hooks?: {
			beforeParse?: (q: Q) => Q
			afterParse?: (data: TResult | null) => TResult | null
		},
	) {
		return Effect.gen(function* () {
			const { parse, ...opts } = queryOpts
			const { beforeParse, afterParse } = hooks || {}
			let q = withOpts(query, opts)

			if (beforeParse) {
				q = beforeParse(q)
			}

			const data = yield* tryEffect(async () => await q)

			const isArray = Array.isArray(data)
			const hasRelations = opts.relations && opts.relations.length > 0

			if (parse) {
				if (isArray && data.length === 0) return parse(null)

				if (hasRelations) {
					//@ts-ignore
					return parse(data as unknown as RelationType<T, TRels>[])
				}
				if (isArray)
					return parse(
						data[0] as unknown as
							| (T['$inferSelect'] & RelationType<T, TRels>[])
							| null,
					)
				return parse(
					data as unknown as
						| (T['$inferSelect'][] & RelationType<T, TRels>)
						| null,
				)
			}

			if (afterParse) {
				return afterParse(data as unknown as TResult | null)
			}

			return data as unknown as TResult | null
		})
	}

	function createConditionEnhanced<K extends keyof T['$inferSelect']>(
		column: Column<T['$inferSelect'][K]>,
		value: T['$inferSelect'][K],
		matchType: 'startWith' | 'contains' | 'exact' | 'endsWith',
		caseSensitive: boolean = false,
	): SQLWrapper {
		const likeOperator = caseSensitive ? like : handleILike

		if (column.enumValues) return eq(column, value)

		switch (matchType) {
			case 'exact':
				return eq(column, value)
			case 'startWith':
				return likeOperator(column, `${value}%`)
			case 'contains':
				return likeOperator(column, `%${value}%`)
			case 'endsWith':
				return likeOperator(column, `%${value}`)
			default:
				return eq(column, value)
		}
	}

	function conditionsFromCriteria(
		criteria: CriteriaFilter<T>,
		matchType: 'startWith' | 'contains' | 'exact' | 'endsWith',
		caseSensitive: boolean = false,
	): SQLWrapper[] {
		const conditions: SQLWrapper[] = []

		for (const [key, filter] of Object.entries(criteria)) {
			const column = table[key as keyof BaseEntity] as Column<
				T['$inferSelect'][keyof T['$inferSelect']]
			>
			// Primitives values
			if (typeof filter !== 'object' || filter instanceof Date) {
				conditions.push(
					createConditionEnhanced(
						column,
						filter,
						matchType || 'exact',
						caseSensitive,
					),
				)
				continue
			}

			// SQL instances or expressions
			if (filter instanceof SQL) {
				conditions.push(filter)
				continue
			}

			const wrapper: SQLWrapper[] = []

			type FilterEntry<T> = {
				[K in CriteriaFilters]: K extends keyof FilterOperators<T>
					? FilterOperators<T>[K] extends undefined
						? never
						: [K, FilterOperators<T>[K]]
					: never
			}[CriteriaFilters]

			function getFilterEntries<T>(
				filter: FilterOperators<T>,
			): FilterEntry<T>[] {
				return Object.entries(filter).filter(
					([, value]) => value !== undefined,
				) as FilterEntry<T>[]
			}

			// Criteria Filters
			for (const [op, value] of getFilterEntries(
				filter as FilterOperators<T['$inferSelect'][keyof T['$inferSelect']]>,
			)) {
				if (value === undefined) continue
				const columnType = column.columnType

				switch (op) {
					case '$gt':
						wrapper.push(gt(column, value))
						break
					case '$gte':
						wrapper.push(gte(column, value))
						break
					case '$lt':
						wrapper.push(lt(column, value))
						break
					case '$lte':
						wrapper.push(lte(column, value))
						break
					case '$eq':
						wrapper.push(eq(column, value))
						break
					case '$neq':
						wrapper.push(not(eq(column, value)))
						break
					case '$between':
						if (columnType === 'number') {
							wrapper.push(between(column, Number(value[0]), Number(value[1])))
						} else if (columnType === 'date') {
							wrapper.push(
								between(column, new Date(value[0]), new Date(value[1])),
							)
						} else {
							wrapper.push(between(column, value[0], value[1]))
						}
						break
					case '$in':
						wrapper.push(inArray(column, value))
						break
					case '$nin':
						wrapper.push(notInArray(column, value))
						break
					case '$like':
						wrapper.push(like(column, value))
						break
					case '$ilike':
						wrapper.push(handleILike(column, value))
						break
					case '$contains':
						wrapper.push(contains(column, value))
						break
					case '$startsWith':
						wrapper.push(startsWith(column, value))
						break
					case '$endsWith':
						wrapper.push(endsWith(column, value))
						break
					default:
						wrapper.push(eq(column, value))
				}
			}
			if (wrapper.length === 1) {
				const valid = wrapper[0]
				if (!valid) continue
				conditions.push(valid)
			} else if (wrapper.length > 1) {
				const valid = and(...wrapper)
				if (!valid) continue
				conditions.push(valid)
			}
		}
		return conditions
	}

	return {
		withPagination,
		withOrderBy,
		withCursor,
		withRelations,
		withCustom,
		withSoftDeleted,
		withWorkspace,
		withOpts,
		parseFilterExpression,
		handleQueries,
		handleOneQuery,
		createConditionEnhanced,
		conditionsFromCriteria,
	}
}

// Helper type for the return value
type FiltersReturn<T extends BaseEntity, QB extends QBuilders> = {
	withPagination: <Q extends QB, TResult>(
		q: Q,
		options?: QueryOpts<T, TResult>,
	) => Q
	withOrderBy: <Q extends QB, TResult>(
		q: Q,
		orderBy: QueryOpts<T, TResult>['orderBy'],
	) => Q
	withCursor: <Q extends QB, TResult>(
		q: Q,
		cursor?: QueryOpts<T, TResult>['cursor'],
	) => Q
	withRelations: <Q extends QB>(q: Q, relations?: WithRelations[]) => Q
	withCustom: <Q extends QB, TResult>(
		q: Q,
		custom?: QueryOpts<T, TResult>['where'],
	) => Q
	withSoftDeleted: <Q extends QB>(q: Q, skip?: boolean) => Q
	withWorkspace: <Q extends QB, TResult>(
		q: Q,
		workspace?: QueryOpts<T, TResult>['workspace'],
	) => Q
	withOpts: <Q extends QB, TResult, TRels extends WithRelations[] = []>(
		q: Q,
		opts: Omit<QueryOpts<T, TResult, TRels>, 'parse'>,
	) => Q
	parseFilterExpression: (
		field: keyof T['$inferSelect'],
		[filterExpr, ...values]: [
			string,
			...T['$inferSelect'][keyof T['$inferSelect']][],
		],
	) => SQLWrapper
	handleQueries: <TResult, TRels extends WithRelations[] = []>(
		query: QB,
		queryOpts: QueryOpts<T, TResult, TRels>,
		hooks?: {
			beforeParse?: (q: QB) => QB
			afterParse?: (data: TResult) => TResult
		},
	) => Effect.Effect<TResult>
	handleOneQuery: <TResult, TRels extends WithRelations[] = []>(
		query: QB,
		queryOpts: FindOneOpts<T, TResult, TRels>,
		hooks?: {
			beforeParse?: (q: QB) => QB
			afterParse?: (data: TResult) => TResult | null
		},
	) => Effect.Effect<TResult>
	createConditionEnhanced: <K extends keyof T['$inferSelect']>(
		column: Column<T['$inferSelect'][K]>,
		value: T['$inferSelect'][K],
		matchType: 'startWith' | 'contains' | 'exact' | 'endsWith',
		caseSensitive?: boolean,
	) => SQLWrapper
	conditionsFromCriteria: (
		criteria: CriteriaFilter<T>,
		matchType: 'startWith' | 'contains' | 'exact' | 'endsWith',
		caseSensitive?: boolean,
	) => SQLWrapper[]
}
