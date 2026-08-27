import { testDatabaseUrl } from './testDatabase';

/**
 * Points this worker's Prisma client at the test database.
 *
 * Must happen before anything imports `@db/prisma`, which builds its client from
 * `env.DATABASE_URL` at module load. Setting the variable here works because `env.ts` calls
 * `dotenv.config()`, and dotenv does not overwrite a variable that is already set — so this
 * assignment wins over `.env` rather than racing it.
 */
process.env.DATABASE_URL = testDatabaseUrl();

// Vitest sets NODE_ENV to 'test', which `config/env.ts` rejects — it deliberately allows
// only 'development' and 'production' so a typo can't quietly put the server in a third
// mode. Pinning it here keeps that validation strict rather than widening the app's schema
// to accommodate the test runner.
process.env.NODE_ENV = 'development';
