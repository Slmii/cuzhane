import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@db/prisma';
import { errorHandler } from '@middleware/error.middleware';
import babsRouter from '@routes/babs.route';
import { DEFAULT_TIME_ZONE, civilDayNumber, startOfCivilDay } from '@utils/rounds';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
assertIsTestDatabase(testDatabaseUrl());

const READER = 'reader';
const STRANGER = 'stranger';

let server: Server;
let base = '';

beforeAll(async () => {
	const app = express();
	app.use(express.json());
	app.use((req, res, next) => {
		res.locals.auth = { userId: req.get('x-reader') ?? READER };
		next();
	});
	app.use('/babs', babsRouter);
	app.use(errorHandler);
	server = await new Promise<Server>(resolve => {
		const s = app.listen(0, '127.0.0.1', () => resolve(s));
	});
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
	// Midday in the group's zone: a day's round runs until its midnight, well clear of here.
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-01T09:00:00Z'));
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	vi.useRealTimers();
	await new Promise<void>((resolve, reject) => server.close(e => (e ? reject(e) : resolve())));
	await prisma.$disconnect();
});

/** A running seat-divided Hizb group, started today, with the reader in a seat. */
const createGroup = async () => {
	const startedAt = startOfCivilDay(civilDayNumber(new Date(), DEFAULT_TIME_ZONE), DEFAULT_TIME_ZONE);

	return prisma.group.create({
		data: {
			ownerUserId: READER,
			name: 'Hizb Halkası',
			inviteCode: 'CNTRROUT',
			kind: 'HIZB',
			spots: 11,
			cycle: 'DAILY',
			roundDays: 1,
			splitMode: 'FIXED',
			status: 'RUNNING',
			startedAt,
			roundIndex: 0,
			roundStartedAt: startedAt,
			timezone: DEFAULT_TIME_ZONE,
			members: {
				create: [{ userId: READER, displayName: 'Reader', role: 'OWNER', slotIndex: 0, joinedAt: startedAt }]
			}
		}
	});
};

const call = (path: string, init: { method?: string; body?: unknown; reader?: string } = {}) =>
	fetch(`${base}${path}`, {
		method: init.method ?? 'GET',
		headers: { 'Content-Type': 'application/json', 'x-reader': init.reader ?? READER },
		...(init.body === undefined ? {} : { body: JSON.stringify(init.body) })
	});

describe('/babs/:groupId/counters', () => {
	it('keeps the reader’s Delâil and istighfar counts between visits', async () => {
		const group = await createGroup();

		const put = await call(`/babs/${group.id}/counters`, {
			method: 'PUT',
			body: { delailCount: 2, istighfarCount: 5, isOpenRound: true, roundIndex: 0 }
		});
		expect(put.status).toBe(200);

		const get = await call(`/babs/${group.id}/counters`);
		expect(get.status).toBe(200);
		expect(await get.json()).toEqual({ delailCount: 2, istighfarCount: 5, istighfarTarget: 11, roundIndex: 0 });
	});

	it('refuses a body that counts nothing, or a count below zero', async () => {
		const group = await createGroup();

		expect((await call(`/babs/${group.id}/counters`, { method: 'PUT', body: {} })).status).toBe(400);
		expect((await call(`/babs/${group.id}/counters`, { method: 'PUT', body: { delailCount: -1 } })).status).toBe(
			400
		);
		expect((await call(`/babs/${group.id}/counters`, { method: 'PUT', body: { istighfarTarget: 0 } })).status).toBe(
			400
		);
	});

	it('refuses a reader who is not in the group', async () => {
		const group = await createGroup();

		expect((await call(`/babs/${group.id}/counters`, { reader: STRANGER })).status).toBeGreaterThanOrEqual(400);
		expect(
			(await call(`/babs/${group.id}/counters`, { method: 'PUT', body: { delailCount: 1 }, reader: STRANGER }))
				.status
		).toBeGreaterThanOrEqual(400);
		expect(await prisma.groupRoundCounter.count()).toBe(0);
	});
});
