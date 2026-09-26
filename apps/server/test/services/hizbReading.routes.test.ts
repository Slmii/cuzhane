import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest';
import prisma from '@db/prisma';
import { clientCapabilities } from '@middleware/clientCapabilities.middleware';
import { hizbCompatibility } from '@middleware/hizbCompatibility.middleware';
import { errorHandler } from '@middleware/error.middleware';
import groupsRouter from '@routes/groups.route';
import babsRouter from '@routes/babs.route';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';
vi.mock('@utils/displayName', () => ({ resolveDisplayName: () => 'Owner' }));
vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));
assertIsTestDatabase(testDatabaseUrl());
let server: Server;
let base = '';
const headers = { 'Content-Type': 'application/json', 'X-Cuzhane-Kinds': 'CEVSEN,HIZB', 'X-Cuzhane-Hizb-Plans': '1' };
beforeAll(async () => {
	const app = express();
	app.use(express.json());
	app.use((req, res, next) => {
		res.locals.auth = { userId: req.get('x-reader') ?? 'owner' };
		next();
	});
	app.use(clientCapabilities, hizbCompatibility);
	app.use('/groups', groupsRouter);
	app.use('/babs', babsRouter);
	app.use(errorHandler);
	server = await new Promise<Server>(resolve => {
		const s = app.listen(0, '127.0.0.1', () => resolve(s));
	});
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});
afterAll(async () => {
	await new Promise<void>((resolve, reject) => server.close(e => (e ? reject(e) : resolve())));
	await prisma.$disconnect();
});
const create = async (plan = 7) => {
	const response = await fetch(base + '/groups', {
		method: 'POST',
		headers,
		body: JSON.stringify({
			name: 'Test plan',
			kind: 'HIZB',
			hizbPlan: plan,
			visibility: 'PRIVATE',
			reminderTime: '21:00',
			inactivityDays: 10
		})
	});
	expect(response.status).toBe(201);
	return response.json() as Promise<{ id: string }>;
};
it('serves personal plans only to capable clients and rejects legacy read paths', async () => {
	const group = await create();
	expect((await fetch(base + `/groups/${group.id}`, { headers: { 'X-Cuzhane-Kinds': 'CEVSEN,HIZB' } })).status).toBe(
		426
	);
	expect(await (await fetch(base + '/groups', { headers: { 'X-Cuzhane-Kinds': 'CEVSEN,HIZB' } })).json()).toEqual([]);
	expect(
		(await fetch(base + `/babs/${group.id}/1/read`, { headers, method: 'PATCH', body: '{"read":true}' })).status
	).toBe(400);
	const current = await fetch(base + `/groups/${group.id}/reading`, { headers });
	expect(current.status).toBe(200);
	const data = (await current.json()) as { today: { id: string; portion: number } };
	expect(data.today.portion).toBe(1);
	const updated = await fetch(base + `/groups/${group.id}/reading/assignments/${data.today.id}`, {
		headers,
		method: 'PATCH',
		body: '{"read":true,"version":0,"istighfarTarget":100,"istighfarRepetitions":100}'
	});
	expect(updated.status).toBe(200);
	expect(await updated.json()).toMatchObject({ istighfarTarget: 100, istighfarRepetitions: 100 });
	const invalidTarget = await fetch(base + `/groups/${group.id}/reading/assignments/${data.today.id}`, {
		headers,
		method: 'PATCH',
		body: '{"version":1,"istighfarTarget":12}'
	});
	expect(invalidTarget.status).toBe(400);
	expect(
		(await fetch(base + `/groups/${group.id}/reading`, { headers: { ...headers, 'x-reader': 'outsider' } })).status
	).toBe(403);
});
it('validates updates and allows current mixed members to choose a plan after admissions close', async () => {
	const group = await create(0);
	await prisma.group.update({ where: { id: group.id }, data: { openToJoin: false } });
	await prisma.groupMember.create({
		data: { groupId: group.id, userId: 'member', displayName: 'Member', slotIndex: 2 }
	});
	const request = { headers: { ...headers, 'x-reader': 'member' }, method: 'POST', body: '{"planDays":15}' };
	expect((await fetch(base + `/groups/${group.id}/reading/enroll`, request)).status).toBe(200);
	const invalid = await fetch(base + `/groups/${group.id}/reading/enroll`, { ...request, body: '{"planDays":8}' });
	expect(invalid.status).toBe(400);
});

it('validates and saves the independent Delail counter through the assignment endpoint', async () => {
	const created = await fetch(base + '/groups', {
		method: 'POST',
		headers,
		body: JSON.stringify({
			name: 'Delail reading',
			kind: 'HIZB',
			hizbPlan: 7,
			hizbIndividual: true,
			hizbStartPortion: 4,
			reminderTime: '21:00'
		})
	});
	expect(created.status).toBe(201);
	const group = (await created.json()) as { id: string };
	const state = (await (await fetch(base + `/groups/${group.id}/reading`, { headers })).json()) as {
		today: { id: string };
	};
	const url = base + `/groups/${group.id}/reading/assignments/${state.today.id}`;
	const patch = (body: object) => fetch(url, { headers, method: 'PATCH', body: JSON.stringify(body) });
	expect((await patch({ version: 0, delailRepetitions: 4 })).status).toBe(400);
	expect((await patch({ version: 0, delailRepetitions: 2, repetitions: 19, read: true })).status).toBe(409);
	const completed = await patch({ version: 0, delailRepetitions: 3, repetitions: 19, read: true });
	expect(completed.status).toBe(200);
	expect(await completed.json()).toMatchObject({
		delailRepetitions: 3,
		repetitions: 19,
		requiresDelailRepetition: true
	});
});
