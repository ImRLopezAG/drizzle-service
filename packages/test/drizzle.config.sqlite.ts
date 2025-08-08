import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: 'sqlite',
	dbCredentials: {
		url: 'file:./test/sqlite/db.sqlite',
	},
	verbose: true,
	casing: "snake_case",
	schema: "./test/sqlite/schema.ts",
	out: "./drizzle/sqlite",
});
