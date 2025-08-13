/// <reference types="vite/client" />
import { fromConfig } from 'fumadocs-mdx/runtime/vite';
import type * as Config from './source.config';

export const create = fromConfig<typeof Config>();

export const docs = create.docs("docs", {
  doc: import.meta.glob(["./**/*.{mdx,md}"], {
    "query": {
      "collection": "docs"
    },
    "base": "/src/content/docs"
  }),
  meta: import.meta.glob(["./**/*.{json,yaml}"], {
    "query": {
      "collection": "docs"
    },
    "base": "/src/content/docs",
    "import": "default"
  })
});