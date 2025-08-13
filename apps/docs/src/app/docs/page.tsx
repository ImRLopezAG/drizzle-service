import type { PageTree } from 'fumadocs-core/server'
import { getPageTreePeers } from 'fumadocs-core/server'
import { toClientRenderer } from 'fumadocs-mdx/runtime/vite'
import { Card, Cards } from 'fumadocs-ui/components/card'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from 'fumadocs-ui/page'
import { source } from '@/app/source'
import { docs } from '../../../source.generated'
import { getMDXComponents } from '../mdx-components'
import type { Route } from './+types/page'

export async function loader({ params }: Route.LoaderArgs) {
	const slugs = params['*']
		?.toString()
		.split('/')
		.filter((v) => v.length > 0)
	const page = source.getPage(slugs)
	if (!page) throw new Response('Not found', { status: 404 })

	return {
		page,
		path: page.path,
		tree: source.pageTree,
	}
}

export function meta({ loaderData: data }: Route.MetaArgs) {
	const defaultMeta = [
		{ title: 'Drizzle Service - Type-Safe Service Layer for Drizzle ORM' },
		{
			name: 'description',
			content:
				'A powerful, type-safe service layer library for Drizzle ORM that provides advanced CRUD operations, pagination, soft deletes, relations, and bulk operations for PostgreSQL and SQLite.',
		},
		{
			name: 'keywords',
			content:
				'drizzle, orm, typescript, database, postgresql, sqlite, service layer, crud, pagination, soft delete, type-safe',
		},
		{ name: 'author', content: 'Angel Lopez' },
		{
			property: 'og:title',
			content: 'Drizzle Service - Type-Safe Service Layer for Drizzle ORM',
		},
		{
			property: 'og:description',
			content:
				'A powerful, type-safe service layer library for Drizzle ORM that provides advanced CRUD operations, pagination, soft deletes, relations, and bulk operations for PostgreSQL and SQLite.',
		},
		{ property: 'og:type', content: 'website' },
		{
			property: 'og:image',
			content:
				'https://raw.githubusercontent.com/drizzle-team/drizzle-orm/ac1dcd9d1c4b8f171479af4a5dd731db1e164f58/misc/readme/logo-github-sq-dark.svg',
		},
		{ name: 'twitter:card', content: 'summary_large_image' },
		{
			name: 'twitter:title',
			content: 'Drizzle Service - Type-Safe Service Layer for Drizzle ORM',
		},
		{
			name: 'twitter:description',
			content:
				'A powerful, type-safe service layer library for Drizzle ORM that provides advanced CRUD operations, pagination, soft deletes, relations, and bulk operations for PostgreSQL and SQLite.',
		},
		{
			name: 'twitter:image',
			content:
				'https://raw.githubusercontent.com/drizzle-team/drizzle-orm/ac1dcd9d1c4b8f171479af4a5dd731db1e164f58/misc/readme/logo-github-sq-dark.svg',
		},
	]
	if (!data) {
		return defaultMeta
	}
	const { page } = data
	if (!page) {
		return defaultMeta
	}
	return [
		{ title: `Drizzle Service | ${page.data.title}` },
		{
			name: 'description',
			content: page.data.description || defaultMeta[1].content,
		},
		{
			name: 'keywords',
			content: defaultMeta[2].content,
		},
		{ name: 'author', content: defaultMeta[3].content },
		{
			property: 'og:title',
			content: `Drizzle Service | ${page.data.title}`,
		},
		{
			property: 'og:description',
			content: page.data.description || defaultMeta[1].content,
		},
		{ property: 'og:type', content: 'website' },
		{
			property: 'og:image',
			content:
				'https://raw.githubusercontent.com/drizzle-team/drizzle-orm/ac1dcd9d1c4b8f171479af4a5dd731db1e164f58/misc/readme/logo-github-sq-dark.svg',
		},
		{ name: 'twitter:card', content: 'summary_large_image' },
		{
			name: 'twitter:title',
			content: `Drizzle Service | ${page.data.title}`,
		},
		{
			name: 'twitter:description',
			content: page.data.description || defaultMeta[1].content,
		},
		{
			name: 'twitter:image',
			content:
				'https://raw.githubusercontent.com/drizzle-team/drizzle-orm/ac1dcd9d1c4b8f171479af4a5dd731db1e164f58/misc/readme/logo-github-sq-dark.svg',
		},
	]
}

const renderer = toClientRenderer(
	docs.doc,
	({ toc, default: Mdx, frontmatter }) => {
		return (
			<DocsPage
				toc={toc}
				tableOfContent={{
					style: 'clerk',
				}}
			>
				<title>{frontmatter.title}</title>
				<meta name='description' content={frontmatter.description} />
				<DocsTitle>{frontmatter.title}</DocsTitle>
				<DocsDescription>{frontmatter.description}</DocsDescription>
				<DocsBody>
					<Mdx
						components={getMDXComponents({
							DocsCategory: ({ url }: { url: string }) => {
								return <DocsCategory url={url} />
							},
						})}
					/>
				</DocsBody>
			</DocsPage>
		)
	},
)

export default function Page(props: Route.ComponentProps) {
	const { tree, path } = props.loaderData
	const Content = renderer[path]

	return (
		<DocsLayout
			nav={{
				title: 'React Router',
			}}
			tree={tree as PageTree.Root}
		>
			<Content />
		</DocsLayout>
	)
}

function DocsCategory({ url }: { url: string }) {
	return (
		<Cards className='my-4'>
			{getPageTreePeers(source.pageTree, url).map((peer) => (
				<Card key={peer.url} title={peer.name} href={peer.url}>
					{peer.description}
				</Card>
			))}
		</Cards>
	)
}
