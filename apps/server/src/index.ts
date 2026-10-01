import { createApp } from '@app';
import { env } from '@config/env';
import prisma from '@db/prisma';
import { attachLiveSockets } from '@services/liveSocket.service';

const app = createApp();

const server = app.listen(env.PORT, () => {
	console.log(`Server running on http://localhost:${env.PORT}`);
});

// Live reading's socket shares this server's port — see `liveSocket.service.ts`.
const liveSockets = attachLiveSockets(server);

const shutdown = async () => {
	// Before `server.close()`: open sockets would otherwise hold it open until they time out.
	liveSockets.close();
	server.close(async () => {
		await prisma.$disconnect();
		process.exit(0);
	});
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
