import { defineConfig } from 'tsup'

export default defineConfig({
	clean: true,
	entry: ['src/index.ts', 'src/pg/index.ts', 'src/sqlite/index.ts', 'src/builder/index.ts', 'src/builder/types.ts'],
	format: ['esm'],
	minify: true,
	target: 'es2024',
	outDir: 'lib',
	dts: true,
	keepNames: true,
	minifySyntax: true,
	sourcemap: false,
	external: ['drizzle-orm'],
	minifyIdentifiers: true,
	skipNodeModulesBundle: true,
})
