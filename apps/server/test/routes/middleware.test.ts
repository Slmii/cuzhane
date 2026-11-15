import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { errorHandler } from '@middleware/error.middleware';
import { joinRateLimit } from '@middleware/rateLimit.middleware';
import { validateData } from '@middleware/validate.middleware';
import { GroupIdParamsSchema } from '@schemas/group.schema';
import { RegisterPushTokenBodySchema } from '@schemas/pushToken.schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: Server;
let base = '';

beforeAll(async () => {
	const app = express();
	app.use(express.json());
	// Who is asking, as `populateAuthLocals` would put it; no header is a request without a user.
	app.use((req, res, next) => {
		const userId = req.get('x-user');
		if (userId) {
			res.locals.auth = { userId };
		}
		next();
	});
	app.post('/join', joinRateLimit, (_req, res) => {
		res.json({ ok: true });
	});
	app.post('/token', validateData(RegisterPushTokenBodySchema, 'body'), (_req, res) => {
		res.json({ token: res.locals.validatedBody });
	});
	app.get('/groups/:groupId', (req, res) => {
		res.json(GroupIdParamsSchema.parse(req.params));
	});
	app.use(errorHandler);
	server = await new Promise<Server>(resolve => {
		const s = app.listen(0, '127.0.0.1', () => resolve(s));
	});
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

const join = (userId?: string) =>
	fetch(`${base}/join`, { headers: userId ? { 'x-user': userId } : {}, method: 'POST' });

describe('the per-user rate limit', () => {
	it('lets ten joins a minute through, turns the eleventh away, and counts per user', async () => {
		for (let attempt = 1; attempt <= 10; attempt++) {
			expect((await join('busy')).status).toBe(200);
		}

		const refused = await join('busy');
		expect(refused.status).toBe(429);
		expect(await refused.json()).toEqual({ error: 'Too many requests, please slow down.' });
		// Somebody else is not held back by one user's loop.
		expect((await join('calm')).status).toBe(200);
	});

	it('refuses to run without a signed-in user rather than counting everyone as one', async () => {
		expect((await join()).status).toBe(500);
	});
});

describe('validating a request', () => {
	it('answers 400 with the error shape for a bad body, and hands the parsed body on', async () => {
		const bad = await fetch(`${base}/token`, {
			body: JSON.stringify({ token: 'not-a-token' }),
			headers: { 'Content-Type': 'application/json' },
			method: 'POST'
		});
		expect(bad.status).toBe(400);
		expect(await bad.json()).toMatchObject({ details: expect.any(Object), error: 'Invalid data' });

		const good = await fetch(`${base}/token`, {
			body: JSON.stringify({ token: '  ExponentPushToken[abc]  ' }),
			headers: { 'Content-Type': 'application/json' },
			method: 'POST'
		});
		expect(good.status).toBe(200);
		expect(await good.json()).toEqual({ token: { token: 'ExponentPushToken[abc]' } });
	});

	it('caps an id param at 64 characters', async () => {
		expect((await fetch(`${base}/groups/${'a'.repeat(64)}`)).status).toBe(200);

		const tooLong = await fetch(`${base}/groups/${'a'.repeat(65)}`);
		expect(tooLong.status).toBe(400);
		expect(await tooLong.json()).toMatchObject({ error: 'Validation failed' });
	});
});
