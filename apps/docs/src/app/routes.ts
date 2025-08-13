import { index, type RouteConfig, route } from '@react-router/dev/routes'

export default [
	route('api/search', 'docs/search.ts'),
	index('docs/page.tsx'),
	route('*', 'docs/page.tsx', {
		id: 'home',
	}),
] satisfies RouteConfig
