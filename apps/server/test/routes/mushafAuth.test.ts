import { createApp } from '@app';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: Server;
let origin: string;

beforeAll(async () => {
	server = createApp().listen(0);
	await new Promise(resolve => server.once('listening', resolve));
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
	await new Promise(resolve => server.close(resolve));
});

describe('the mushaf page images', () => {
	it('refuses a page without a session', async () => {
		const response = await fetch(`${origin}/api/mushaf/page-000.png`);

		expect(response.status).toBe(401);
	});

	it("refuses the Hatim duası's pages without a session", async () => {
		const response = await fetch(`${origin}/api/mushaf/dua-1.png`);

		expect(response.status).toBe(401);
	});

	it('no longer serves them on the old public path', async () => {
		const response = await fetch(`${origin}/mushaf/page-000.png`);

		expect(response.status).toBe(404);
		expect(response.headers.get('content-type')).not.toContain('image/png');
	});
});
