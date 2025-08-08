import { defineConfig } from 'drizzle-kit'
export default defineConfig({
	dialect: 'postgresql',
	driver: 'pglite',
	verbose: true,
	dbCredentials: {
		url: 'file:./test/pg/db.sql',
	},
	casing: 'snake_case',
	schema: './test/pg/schema.ts',
	out: './drizzle/pg',
})
