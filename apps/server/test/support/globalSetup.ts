import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { assertIsTestDatabase, databaseNameOf, maintenanceUrl, testDatabaseUrl } from './testDatabase';

/**
 * Creates the test database if it doesn't exist and brings it up to the current migration
 * state. Runs once for the whole suite, before any worker starts.
 *
 * Doing this here rather than in a shell script means `pnpm test` is self-contained: there
 * is no separate "set up the test db" step to forget, and a schema change is picked up on
 * the next run without anyone re-running anything.
 */
export default async function setup(): Promise<void> {
	const url = testDatabaseUrl();
	assertIsTestDatabase(url);

	const name = databaseNameOf(url);
	const admin = new Client({ connectionString: maintenanceUrl(url) });

	try {
		await admin.connect();
	} catch (error) {
		throw new Error(
			`Cannot reach Postgres for integration tests. Start it with \`pnpm db:up\`.\n${(error as Error).message}`
		);
	}

	try {
		const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);

		if (existing.rowCount === 0) {
			// Identifier can't be parameterised; it comes from our own derivation, not input.
			await admin.query(`CREATE DATABASE "${name}"`);
		}
	} finally {
		await admin.end();
	}

	// `migrate deploy` rather than `migrate dev`: it applies the committed migrations and
	// never prompts or invents a new one, which is what a test database wants.
	execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
		cwd: fileURLToPath(new URL('../..', import.meta.url)),
		env: { ...process.env, DATABASE_URL: url },
		stdio: 'pipe'
	});
}
