import defaultMdxComponents from 'fumadocs-ui/mdx';
import * as FilesComponents from 'fumadocs-ui/components/files';
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import type { MDXComponents } from 'mdx/types';
import { Mermaid } from '@/components/mdx/mermaid';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import * as icons from 'lucide-react';
import { AutoTypeTable } from 'fumadocs-typescript/ui';
import { createGenerator } from 'fumadocs-typescript';
import { TypeTable } from 'fumadocs-ui/components/type-table'

const generator = createGenerator()

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...(icons as unknown as MDXComponents),
    ...defaultMdxComponents,
    ...TabsComponents,
    ...FilesComponents,
    Accordion,
    Accordions,
    Mermaid,
    AutoTypeTable: (props) => (
      <AutoTypeTable {...props} generator={generator} />
    ),
    TypeTable,
    ...components,
  };
}
