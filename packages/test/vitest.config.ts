import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		typecheck: {
			enabled: true,
		},
		reporters: ['default', 'verbose'],
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
		fileParallelism: false,
	},
})
