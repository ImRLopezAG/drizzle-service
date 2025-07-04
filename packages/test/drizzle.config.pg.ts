import { defineConfig } from 'drizzle-kit'
process.loadEnvFile('.env.test')
export default defineConfig({
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL ?? '',
	},
	verbose: true,
	casing: 'snake_case',
	schema: './test/postgres/schema.ts',
	out: './drizzle',
})
