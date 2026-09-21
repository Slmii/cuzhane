import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import { once } from 'node:events';
import prisma from '@db/prisma';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

// Only the identity provider is replaced; requests exercise the real app auth gate,
// validation, routes, services, transactions and PostgreSQL constraints.
vi.mock('@clerk/express', async importOriginal => ({
	...(await importOriginal<typeof import('@clerk/express')>()),
	clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
	getAuth: (req: Request) => ({ userId: req.headers['x-test-user'], sessionClaims: { name: 'Test Reader' } })
}));
import { createApp } from '@app';
assertIsTestDatabase(testDatabaseUrl());
let server: Server;
let base: string;
beforeAll(async () => {
	server = createApp().listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	if (!address || typeof address === 'string') {
		throw new Error('No test listener');
	}
	base = `http://127.0.0.1:${address.port}/api/reading-groups`;
});
beforeEach(async () => {
	await prisma.readingGroup.deleteMany();
});
afterAll(async () => {
	await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
	await prisma.$disconnect();
});
const request = (path: string, user = 'reader', method = 'GET', body?: unknown) =>
	fetch(base + path, {
		method,
		headers: { ...(user ? { 'x-test-user': user } : {}), 'content-type': 'application/json' },
		...(body ? { body: JSON.stringify(body) } : {})
	});

describe('reading group HTTP lifecycle', () => {
	it('requires authentication and rejects malformed creation', async () => {
		expect((await request('/', '', 'GET')).status).toBe(401);
		expect((await request('/', 'reader', 'POST', { name: 'Group', cadence: 'INVALID' })).status).toBe(400);
	});
	it('creates, joins, reads, completes idempotently, leaves and keeps history reachable', async () => {
		const created = await request('/', 'reader', 'POST', {
			name: 'HTTP group',
			cadence: 'MONTHLY',
			timezone: 'UTC'
		});
		expect(created.status).toBe(201);
		const group = await created.json();
		const joined = await request('/join', 'other', 'POST', { inviteCode: group.inviteCode });
		expect(joined.status).toBe(200);
		const assignment = group.myMemberships[0].cycles[0].assignments[0];
		const endpoint = `/${group.id}/assignments/${assignment.id}/complete`;
		const first = await request(endpoint, 'reader', 'POST');
		expect(first.status).toBe(200);
		expect((await first.json()).collective.completedParts).toBe(1);
		expect((await (await request(endpoint, 'reader', 'POST')).json()).collective.completedParts).toBe(1);
		expect((await request(`/${group.id}/leave`, 'reader', 'POST')).status).toBe(200);
		const detail = await (await request(`/${group.id}`)).json();
		expect(detail.myMemberships[0].active).toBe(false);
		expect(detail.myMemberships[0].cycles[0].assignments[0].status).toBe('completed');
		expect((await (await request('/')).json()).map((g: { id: string }) => g.id)).toContain(group.id);
	});
	it('does not expose private groups or other members assignments', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const group = await (
			await request('/', 'reader', 'POST', { name: 'Private', cadence: 'WEEKLY', timezone: 'UTC' })
		).json();
		expect((await request(`/${group.id}`, 'outsider')).status).toBe(404);
		const assignment = group.myMemberships[0].cycles[0].assignments[0];
		await request('/join', 'other', 'POST', { inviteCode: group.inviteCode });
		expect((await request(`/${group.id}/assignments/${assignment.id}/complete`, 'other', 'POST')).status).toBe(404);
	});
});
