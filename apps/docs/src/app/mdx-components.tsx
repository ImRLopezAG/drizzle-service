import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import * as FilesComponents from 'fumadocs-ui/components/files'
import * as TabsComponents from 'fumadocs-ui/components/tabs'
import { TypeTable } from 'fumadocs-ui/components/type-table'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import * as icons from 'lucide-react'

export function getMDXComponents(components?: any) {
	return {
		...(icons),
		...defaultMdxComponents,
		...TabsComponents,
		...FilesComponents,
		Accordion,
		Accordions,
		TypeTable,
		...components,
	}
}
