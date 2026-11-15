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

const post = (body: string, contentType = 'application/json') =>
	fetch(`${origin}/api/feedback`, { body, headers: { 'Content-Type': contentType }, method: 'POST' });

describe('a bad request body', () => {
	it('answers 400 for malformed JSON, not 500', async () => {
		const response = await post('{"topic": ');

		expect(response.status).toBe(400);
	});

	it('answers 413 for a body over the limit, not 500', async () => {
		const response = await post(JSON.stringify({ message: 'x'.repeat(400 * 1024) }));

		expect(response.status).toBe(413);
	});

	it('answers with the parser’s own 4xx for any other body error, not 500', async () => {
		const response = await post('{}', 'application/json; charset=latin1');

		expect(response.status).toBe(415);
	});
});
