import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '@/app/source'
import type { Route } from './+types/search'

const server = createFromSource(source, {
	language: 'english',
})

export async function loader({ request }: Route.LoaderArgs) {
	return server.GET(request)
}
