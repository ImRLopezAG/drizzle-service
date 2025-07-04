import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
process.loadEnvFile()
export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		typecheck: {
			enabled: true,
		},
		reporters: ['default', 'verbose', 'html'],
	},
})
