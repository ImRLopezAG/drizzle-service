import { source } from '@/lib/source'
import { getMDXComponents } from '@/mdx-components'
import { getPageTreePeers } from 'fumadocs-core/server'
import { Card, Cards } from 'fumadocs-ui/components/card'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from 'fumadocs-ui/page'
import { Globe, Mail } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
export default async function Page(props: {
	params: Promise<{ slug?: string[] }>
}) {
	const params = await props.params
	const page = source.getPage(params.slug)
	if (!page) notFound()

	const MDXContent = page.data.body

	return (
		<DocsPage
			toc={page.data.toc}
			full={page.data.full}
			tableOfContent={{
				style: 'clerk',
			}}
		>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody>
				<MDXContent
					components={getMDXComponents({
						// this allows you to link to other pages with relative file paths
						a: createRelativeLink(source, page),
						DocsCategory: ({ url }) => {
							return <DocsCategory url={url ?? page.url} />
						},
					})}
				/>
			</DocsBody>
			<section className='mt-8'>
				<div className='mt-4 flex gap-2'>
					<Link
						href='mailto:contact@imrlopez.dev'
						className='flex items-center gap-2'
					>
						<Mail className='h-4 w-4' />
						contact@imrlopez.dev
					</Link>
					<Link href='https://imrlopez.dev' className='flex items-center gap-2'>
						<Globe className='h-4 w-4' />
						imrlopez.dev
					</Link>
				</div>
			</section>
		</DocsPage>
	)
}

export async function generateStaticParams() {
	return source.generateParams()
}

export async function generateMetadata(props: {
	params: Promise<{ slug?: string[] }>
}) {
	const params = await props.params
	const page = source.getPage(params.slug)
	if (!page) notFound()

	return {
		title: page.data.title,
		description: page.data.description,
	}
}

function DocsCategory({ url }: { url: string }) {
	return (
		<Cards>
			{getPageTreePeers(source.pageTree, url).map((peer) => (
				<Card key={peer.url} title={peer.name} href={peer.url}>
					{peer.description}
				</Card>
			))}
		</Cards>
	)
}
