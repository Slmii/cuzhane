import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
	// A folder, not a file: every `.prisma` inside is merged into one schema.
	schema: 'prisma/schema',
	migrations: {
		path: 'prisma/migrations',
		seed: 'tsx prisma/seed.ts'
	},
	datasource: {
		url: env('DATABASE_URL')
	}
});
