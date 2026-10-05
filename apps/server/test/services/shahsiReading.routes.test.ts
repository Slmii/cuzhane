import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@db/prisma';
import { clientCapabilities, parsePersonalKinds } from '@middleware/clientCapabilities.middleware';
import { hizbCompatibility } from '@middleware/hizbCompatibility.middleware';
import { errorHandler } from '@middleware/error.middleware';
import groupsRouter from '@routes/groups.route';
import babsRouter from '@routes/babs.route';
import membershipRouter from '@routes/membership.route';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/displayName', () => ({ resolveDisplayName: () => 'Owner' }));
vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));
assertIsTestDatabase(testDatabaseUrl());

/** What a build that draws Şahsi Cevşen and Kur'an readings sends. */
const headers = {
	'Content-Type': 'application/json',
	'X-Cuzhane-Kinds': 'CEVSEN,HATIM,HIZB',
	'X-Cuzhane-Hizb-Plans': '1',
	'X-Cuzhane-Hizb-Portions': '32',
	'X-Cuzhane-Personal-Kinds': 'CEVSEN,HATIM'
};
/** A build from before them: everything but the new header. */
const oldBuild = {
	'Content-Type': 'application/json',
	'X-Cuzhane-Kinds': 'CEVSEN,HATIM,HIZB',
	'X-Cuzhane-Hizb-Plans': '1',
	'X-Cuzhane-Hizb-Portions': '32'
};

let server: Server;
let base = '';

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
	app.use('/memberships', membershipRouter);
	app.use(errorHandler);
	server = await new Promise<Server>(resolve => {
		const s = app.listen(0, '127.0.0.1', () => resolve(s));
	});
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
	// Midday in the group's zone, so nothing here straddles its midnight.
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-01T09:00:00Z'));
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	vi.useRealTimers();
	await new Promise<void>((resolve, reject) => server.close(e => (e ? reject(e) : resolve())));
	await prisma.$disconnect();
});

const create = async (kind: 'CEVSEN' | 'HATIM', planDays: number) => {
	const response = await fetch(base + '/groups', {
		method: 'POST',
		headers,
		body: JSON.stringify({ name: 'Şahsi', kind, planDays, reminderTime: '21:00' })
	});
	expect(response.status).toBe(201);
	return response.json() as Promise<{ id: string; inviteCode: string; planDays: number }>;
};

type Day = { id: string; version: number; units: number[]; boardPortions: number[] };
const todayOf = async (groupId: string) =>
	((await (await fetch(base + `/groups/${groupId}/reading`, { headers })).json()) as { today: Day }).today;
const patch = (groupId: string, id: string, body: object) =>
	fetch(base + `/groups/${groupId}/reading/assignments/${id}`, {
		headers,
		method: 'PATCH',
		body: JSON.stringify(body)
	});

describe('parsePersonalKinds', () => {
	it('reads the kinds named, drops unknown ones, and is empty without the header', () => {
		expect([...parsePersonalKinds(' cevsen , HATIM,QURAN')]).toEqual(['CEVSEN', 'HATIM']);
		expect(parsePersonalKinds(undefined).size).toBe(0);
	});
});

describe('builds that cannot draw a Şahsi reading', () => {
	it('do not see it listed and are told to update when they open it', async () => {
		const group = await create('CEVSEN', 15);
		const listed = (await (await fetch(base + '/groups', { headers })).json()) as { id: string }[];
		expect(listed.map(g => g.id)).toEqual([group.id]);
		expect(await (await fetch(base + '/groups', { headers: oldBuild })).json()).toEqual([]);
		for (const path of [`/groups/${group.id}`, `/groups/${group.id}/reading`, `/babs/${group.id}`]) {
			expect((await fetch(base + path, { headers: oldBuild })).status).toBe(426);
		}
		const code = group.inviteCode.replace(/\W/g, '');
		expect((await fetch(base + `/memberships/preview/code/${code}`, { headers: oldBuild })).status).toBe(426);
		// One that draws only the Kur'an's still cannot draw this Cevşen.
		expect(
			(
				await fetch(base + `/groups/${group.id}`, {
					headers: { ...headers, 'X-Cuzhane-Personal-Kinds': 'HATIM' }
				})
			).status
		).toBe(426);
	});
});

describe('a Şahsi reading over the wire', () => {
	it('is created and served with its plan', async () => {
		const group = await create('HATIM', 10);
		expect(group.planDays).toBe(10);
		const detail = await (await fetch(base + `/groups/${group.id}`, { headers })).json();
		expect(detail).toMatchObject({
			kind: 'HATIM',
			planDays: 10,
			hizbIndividual: true,
			hizbToday: { units: [1, 2, 3] }
		});
		expect(await todayOf(group.id)).toMatchObject({ portion: 1, planDays: 10, units: [1, 2, 3] });
		const invalid = await fetch(base + '/groups', {
			method: 'POST',
			headers,
			body: JSON.stringify({ name: 'Şahsi', kind: 'HATIM', planDays: 31, reminderTime: '21:00' })
		});
		expect(invalid.status).toBe(400);
	});

	it('has no board: the shared-board endpoints refuse it', async () => {
		const group = await create('HATIM', 10);
		const refused: [string, string][] = [
			['GET', `/babs/${group.id}`],
			['PATCH', `/babs/${group.id}/1/read`],
			['GET', `/groups/${group.id}/pool`],
			['GET', `/groups/${group.id}/pool-cuz`],
			['POST', `/groups/${group.id}/round-cuz`],
			['POST', `/groups/${group.id}/round-skip`],
			['GET', `/groups/${group.id}/rounds`],
			['GET', `/groups/${group.id}/my-progress`],
			['POST', `/groups/${group.id}/start`]
		];
		for (const [method, path] of refused) {
			const response = await fetch(base + path, { headers, method, ...(method === 'GET' ? {} : { body: '{}' }) });
			expect([method, path, response.status]).toEqual([method, path, 400]);
		}
		expect(
			(
				await fetch(base + `/groups/${group.id}/reading/enroll`, {
					headers,
					method: 'POST',
					body: '{"planDays":7}'
				})
			).status
		).toBe(400);
	});

	it('takes each kind’s own fields on a day, and refuses the Hizb’s', async () => {
		const cevsen = await create('CEVSEN', 10);
		const cevsenDay = await todayOf(cevsen.id);
		for (const body of [
			// A bab outside the day; the day's own are ticked by "Okudum".
			{ version: 0, bookPortions: [11] },
			{ version: 0, repetitions: 1 },
			{ version: 0, istighfarTarget: 11 },
			{ version: 0, delailRepetitions: 1 }
		]) {
			expect((await patch(cevsen.id, cevsenDay.id, body)).status).toBe(400);
		}
		// A late day's babs pass the wire's bound — the 33 was the Hizb's alone.
		const late = await create('CEVSEN', 1);
		const lateDay = await todayOf(late.id);
		const ticked = await patch(late.id, lateDay.id, { version: 0, bookPortions: [40, 99] });
		expect(ticked.status).toBe(200);
		expect(await ticked.json()).toMatchObject({ readPortions: [40, 99] });
		const read = await patch(cevsen.id, cevsenDay.id, { version: 0, read: true });
		expect(read.status).toBe(200);
		expect(await read.json()).toMatchObject({ readFrom: 'APP', units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });

		const hatim = await create('HATIM', 15);
		const hatimDay = await todayOf(hatim.id);
		expect((await patch(hatim.id, hatimDay.id, { version: 0, bookPortions: [3] })).status).toBe(400);
		const part = await patch(hatim.id, hatimDay.id, { version: 0, bookPortions: [1] });
		expect(await part.json()).toMatchObject({ readPortions: [1], completedAt: null });
		const whole = await patch(hatim.id, hatimDay.id, { version: 1, bookPortions: [1, 2] });
		expect(await whole.json()).toMatchObject({ readFrom: 'BOOK', readPortions: [] });
	});

	it('is the owner’s alone: nobody else can preview, join or read it', async () => {
		const group = await create('CEVSEN', 30);
		const other = { ...headers, 'x-reader': 'other' };
		const code = group.inviteCode.replace(/\W/g, '');
		expect((await fetch(base + `/memberships/preview/code/${code}`, { headers: other })).status).toBe(404);
		expect(
			(
				await fetch(base + '/memberships/join/code', {
					headers: other,
					method: 'POST',
					body: JSON.stringify({ code })
				})
			).status
		).toBe(403);
		expect((await fetch(base + `/groups/${group.id}/reading`, { headers: other })).status).toBe(403);
	});
});
