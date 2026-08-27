import dotenv from 'dotenv';

/**
 * Where the integration tests point Prisma.
 *
 * Derived from the dev `DATABASE_URL` by suffixing the database name, so it lands on the
 * same Postgres instance `pnpm db:up` already starts — no second container, no extra
 * config to keep in sync. The suffix is the whole safety story: `assertIsTestDatabase`
 * refuses to truncate anything whose database name doesn't end in `_test`, so a
 * misconfigured URL fails loudly instead of emptying your dev data.
 */
export const testDatabaseUrl = (): string => {
	dotenv.config();

	const base = process.env.DATABASE_URL;

	if (!base) {
		throw new Error('DATABASE_URL is not set — integration tests need apps/server/.env');
	}

	const url = new URL(base);
	const name = url.pathname.replace(/^\//, '');

	url.pathname = `/${name.endsWith('_test') ? name : `${name}_test`}`;

	return url.toString();
};

/** The maintenance database to connect to when creating the test database itself. */
export const maintenanceUrl = (databaseUrl: string): string => {
	const url = new URL(databaseUrl);
	url.pathname = '/postgres';

	return url.toString();
};

export const databaseNameOf = (databaseUrl: string): string => new URL(databaseUrl).pathname.replace(/^\//, '');

/**
 * The interlock. Every destructive helper calls this first, so the only way to point the
 * suite at a real database is to also rename that database to end in `_test`.
 */
export const assertIsTestDatabase = (databaseUrl: string): void => {
	if (!databaseNameOf(databaseUrl).endsWith('_test')) {
		throw new Error(
			`Refusing to run destructive tests against "${databaseNameOf(databaseUrl)}" — expected a _test database`
		);
	}
};
