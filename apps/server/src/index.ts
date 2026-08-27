import { createApp } from '@app';
import { env } from '@config/env';
import prisma from '@db/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
	console.log(`Server running on http://localhost:${env.PORT}`);
});

const shutdown = async () => {
	server.close(async () => {
		await prisma.$disconnect();
		process.exit(0);
	});
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
