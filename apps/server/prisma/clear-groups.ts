import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Deletes every group — and, by cascade, its members, babs, reads, holdings and plan rows — so
 * `db:fresh` can seed onto an empty board. Accounts and their settings stay.
 *
 * **Local only.** It refuses any database that is not on this machine: a deployed database is
 * never reset from here, whatever `.env` happens to point at.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set.');
}

const host = new URL(connectionString).hostname;

if (host !== 'localhost' && host !== '127.0.0.1') {
	throw new Error(`Refusing to delete groups on "${host}": db:fresh only runs against a local database.`);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const main = async () => {
	const { count } = await prisma.group.deleteMany();

	console.log(`Deleted ${count} groups.`);
};

main()
	.catch(error => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
