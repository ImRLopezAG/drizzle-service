import { defineConfig } from 'drizzle-kit'
export default defineConfig({
	dialect: 'postgresql',
	driver: 'pglite',
	verbose: true,
	dbCredentials: {
		url: 'file:./test/postgres/db.sql',
	},
	casing: 'snake_case',
	schema: './test/postgres/schema.ts',
	out: './drizzle',
})
