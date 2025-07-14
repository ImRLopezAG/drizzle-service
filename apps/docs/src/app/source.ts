import {
	type MetaData,
	type PageData,
	type Source,
	type VirtualFile,
	loader,
} from 'fumadocs-core/source'
import matter from 'gray-matter'

// Import all MDX and MD files from the content directory
const files = import.meta.glob('../content/docs/**/*.{md,mdx}', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

// Import meta files (JSON)
const metaFiles = import.meta.glob('../content/docs/**/meta.json', {
	import: 'default',
	eager: true,
}) as Record<string, Record<string, unknown>>

const virtualFiles: VirtualFile[] = []

// Process content files
for (const [file, content] of Object.entries(files)) {
	const virtualPath = file.replace('../content/docs/', '')

	const parsed = matter(content)

	virtualFiles.push({
		type: 'page',
		path: virtualPath,
		data: {
			...parsed.data,
			content: parsed.content,
		},
	})
}

// Process meta files
for (const [file, data] of Object.entries(metaFiles)) {
	const virtualPath = file.replace('../content/docs/', '')

	virtualFiles.push({
		type: 'meta',
		path: virtualPath,
		data,
	})
}

export const source = loader({
	source: {
		files: virtualFiles,
	} as Source<{
		pageData: PageData & {
			content: string
		}
		metaData: MetaData
	}>,
	baseUrl: '/',
})
