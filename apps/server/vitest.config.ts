import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		include: ['test/**/*.test.ts'],
		clearMocks: true,
		restoreMocks: true,
		// Provisions the `_test` database once, then repoints each worker's Prisma client at
		// it. Integration tests share one database, so they run single-file to keep one
		// file's truncation from cutting another's transaction out from under it.
		globalSetup: ['test/support/globalSetup.ts'],
		setupFiles: ['test/support/setupEnv.ts'],
		fileParallelism: false
	},
	resolve: {
		alias: {
			'@app': path.resolve(__dirname, 'src/app.ts'),
			'@config': path.resolve(__dirname, 'src/config'),
			'@middleware': path.resolve(__dirname, 'src/middleware'),
			'@routes': path.resolve(__dirname, 'src/routes'),
			'@schemas': path.resolve(__dirname, 'src/schemas'),
			'@services': path.resolve(__dirname, 'src/services'),
			'@utils': path.resolve(__dirname, 'src/utils'),
			'@interfaces': path.resolve(__dirname, 'src/types'),
			'@db': path.resolve(__dirname, 'src/db')
		}
	}
});
