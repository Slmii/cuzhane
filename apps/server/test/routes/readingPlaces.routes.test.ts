import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@db/prisma';
import { clientCapabilities } from '@middleware/clientCapabilities.middleware';
import { hizbCompatibility } from '@middleware/hizbCompatibility.middleware';
import { errorHandler } from '@middleware/error.middleware';
import groupsRouter from '@routes/groups.route';
import { deleteAccountForUser } from '@services/account.service';
import { leaveGroupForUser } from '@services/groupMembership.service';
import { DEFAULT_TIME_ZONE, civilDayNumber, startOfCivilDay } from '@utils/rounds';
import { PART_COUNT } from '@utils/units';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));
assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'owner';
const READER = 'reader';
const OTHER = 'other';
const STRANGER = 'stranger';

const headers = {
	'Content-Type': 'application/json',
	'X-Cuzhane-Kinds': 'CEVSEN,HATIM,HIZB',
	'X-Cuzhane-Hizb-Plans': '1',
	'X-Cuzhane-Hizb-Portions': '32',
	'X-Cuzhane-Personal-Kinds': 'CEVSEN,HATIM'
};

let server: Server;
let base = '';
let codes = 0;

beforeAll(async () => {
	const app = express();
	app.use(express.json());
	app.use((req, res, next) => {
		res.locals.auth = { userId: req.get('x-reader') ?? READER };
		next();
	});
	app.use(clientCapabilities, hizbCompatibility);
	app.use('/groups', groupsRouter);
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

type Kind = 'CEVSEN' | 'HATIM' | 'HIZB';

/** A running daily board group of `kind`, started today, with owner, reader and other in seats. */
const createGroup = async (
	kind: Kind,
	plan: {
		hizbIndividual?: boolean;
		hizbPlan?: number;
		openToJoin?: boolean;
		planDays?: number;
		visibility?: 'PRIVATE';
	} = {}
) => {
	const startedAt = startOfCivilDay(civilDayNumber(new Date(), DEFAULT_TIME_ZONE), DEFAULT_TIME_ZONE);
	const group = await prisma.group.create({
		data: {
			...(kind === 'HATIM' ? { boundaryPolicy: 'KEEP' as const, distribution: 'FREE_PICK' as const } : {}),
			...plan,
			cycle: 'DAILY',
			inviteCode: `R${String(++codes).padStart(7, '0')}`,
			kind,
			name: 'Places',
			ownerUserId: OWNER,
			roundDays: 1,
			roundIndex: 0,
			roundStartedAt: startedAt,
			spots: 10,
			splitMode: 'FIXED',
			startedAt,
			startsAt: startedAt,
			status: 'RUNNING',
			timezone: DEFAULT_TIME_ZONE
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: PART_COUNT[kind] }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});
	await prisma.groupMember.createMany({
		data: [OWNER, READER, OTHER].map((userId, slotIndex) => ({
			displayName: userId,
			groupId: group.id,
			role: userId === OWNER ? ('OWNER' as const) : ('MEMBER' as const),
			slotIndex,
			userId
		}))
	});

	return group;
};

const put = (groupId: string, unit: number | string, body: object, as = READER) =>
	fetch(base + `/groups/${groupId}/reading-places/${unit}`, {
		body: JSON.stringify(body),
		headers: { ...headers, 'x-reader': as },
		method: 'PUT'
	});

const get = (groupId: string, as = READER) =>
	fetch(base + `/groups/${groupId}/reading-places`, { headers: { ...headers, 'x-reader': as } });

type Places = {
	roundIndex: number;
	places: { unitNumber: number; position: number | null; textPagesRead: number; husrevPagesRead: number }[];
};

const placesOf = async (groupId: string, as = READER) => {
	const response = await get(groupId, as);
	expect(response.status).toBe(200);
	return (await response.json()) as Places;
};

describe('a Kur’an group member’s place', () => {
	it('is saved, read back and overwritten', async () => {
		const group = await createGroup('HATIM');

		const saved = await put(group.id, 7, { position: 4 });
		expect(saved.status).toBe(200);
		expect(await saved.json()).toEqual({ husrevPagesRead: 0, position: 4, textPagesRead: 0, unitNumber: 7 });

		expect((await put(group.id, 7, { position: 9 })).status).toBe(200);
		expect((await put(group.id, 12, { position: 1 })).status).toBe(200);

		expect(await placesOf(group.id)).toEqual({
			places: [
				{ husrevPagesRead: 0, position: 9, textPagesRead: 0, unitNumber: 7 },
				{ husrevPagesRead: 0, position: 1, textPagesRead: 0, unitNumber: 12 }
			],
			roundIndex: 0
		});
		expect(await prisma.readingPlace.count()).toBe(2);
	});

	it('only ever raises the pages read, per pagination, and keeps a place it is not given', async () => {
		const group = await createGroup('HATIM');

		await put(group.id, 3, { position: 6, textPagesRead: 5 });
		await put(group.id, 3, { textPagesRead: 3 });
		await put(group.id, 3, { husrevPagesRead: 2 });

		// Pages read with no place yet: the place stays unknown.
		const onlyRead = await put(group.id, 4, { textPagesRead: 20 });
		expect(await onlyRead.json()).toEqual({ husrevPagesRead: 0, position: null, textPagesRead: 20, unitNumber: 4 });

		expect((await placesOf(group.id)).places).toEqual([
			{ husrevPagesRead: 2, position: 6, textPagesRead: 5, unitNumber: 3 },
			{ husrevPagesRead: 0, position: null, textPagesRead: 20, unitNumber: 4 }
		]);
	});

	it('belongs to its round: after the round rolls, last round’s place is not returned', async () => {
		const group = await createGroup('HATIM');
		await put(group.id, 7, { position: 15, textPagesRead: 14 });

		vi.setSystemTime(new Date('2026-10-02T09:00:00Z'));

		expect(await placesOf(group.id)).toEqual({ places: [], roundIndex: 1 });

		await put(group.id, 7, { position: 2 });
		expect((await placesOf(group.id)).places).toEqual([
			{ husrevPagesRead: 0, position: 2, textPagesRead: 0, unitNumber: 7 }
		]);
		// Last round's row is still its own, untouched by the new one.
		const old = await prisma.readingPlace.findFirstOrThrow({ where: { roundIndex: 0 } });
		expect(old.position).toBe(15);
	});
});

describe('board groups of every kind', () => {
	it('keeps a place in a Cevşen bab and a Hizb portion, bounded by the group’s own count', async () => {
		const cevsen = await createGroup('CEVSEN');
		const hizb = await createGroup('HIZB');

		expect((await put(cevsen.id, PART_COUNT.CEVSEN, { position: 1 })).status).toBe(200);
		expect((await put(hizb.id, PART_COUNT.HIZB, { position: 12 })).status).toBe(200);
		expect((await put(hizb.id, PART_COUNT.HIZB + 1, { position: 1 })).status).toBe(400);

		expect((await placesOf(cevsen.id)).places).toEqual([
			{ husrevPagesRead: 0, position: 1, textPagesRead: 0, unitNumber: PART_COUNT.CEVSEN }
		]);
		expect((await placesOf(hizb.id)).places).toEqual([
			{ husrevPagesRead: 0, position: 12, textPagesRead: 0, unitNumber: PART_COUNT.HIZB }
		]);
	});

	it('rolls a Cevşen group’s places with its round too', async () => {
		const cevsen = await createGroup('CEVSEN');
		await put(cevsen.id, 5, { position: 2 });

		vi.setSystemTime(new Date('2026-10-02T09:00:00Z'));

		expect(await placesOf(cevsen.id)).toEqual({ places: [], roundIndex: 1 });
	});
});

describe('refusals', () => {
	it('hides the group from a non-member, both ways', async () => {
		const group = await createGroup('HATIM');

		expect((await get(group.id, STRANGER)).status).toBe(404);
		expect((await put(group.id, 1, { position: 1 }, STRANGER)).status).toBe(404);
		expect(await prisma.readingPlace.count()).toBe(0);
	});

	it('refuses a personal-plan group of every kind', async () => {
		const shahsi = { hizbIndividual: true, openToJoin: false, visibility: 'PRIVATE' as const };
		const shahsiHatim = await createGroup('HATIM', { ...shahsi, planDays: 10 });
		const shahsiCevsen = await createGroup('CEVSEN', { ...shahsi, planDays: 15 });
		const hizbPlan = await createGroup('HIZB', { hizbPlan: 7 });

		for (const group of [shahsiHatim, shahsiCevsen, hizbPlan]) {
			expect((await get(group.id)).status).toBe(400);
			expect((await put(group.id, 1, { position: 1 })).status).toBe(400);
		}
		expect(await prisma.readingPlace.count()).toBe(0);
	});

	it('refuses a unit or a page out of bounds, and a body with nothing to save', async () => {
		const group = await createGroup('HATIM');

		for (const unit of [0, PART_COUNT.HATIM + 1, 'x', 1.5]) {
			expect((await put(group.id, unit, { position: 1 })).status).toBe(400);
		}
		for (const body of [
			{ position: 0 },
			{ position: 31 },
			{ position: 2.5 },
			{ textPagesRead: -1 },
			{ husrevPagesRead: 31 },
			{},
			{ position: 1, extra: true }
		]) {
			expect((await put(group.id, 1, body)).status).toBe(400);
		}
		expect((await put(group.id, 1, { position: 30, textPagesRead: 0, husrevPagesRead: 30 })).status).toBe(200);
	});

	it('caps the group id at 64 characters', async () => {
		expect((await get('g'.repeat(65))).status).toBe(400);
		expect((await put('g'.repeat(65), 1, { position: 1 })).status).toBe(400);
	});
});

describe('privacy', () => {
	it('never returns another member’s places, nor lets a write touch them', async () => {
		const group = await createGroup('HATIM');

		await put(group.id, 7, { position: 3 }, OTHER);
		await put(group.id, 7, { position: 11 });

		expect((await placesOf(group.id)).places).toEqual([
			{ husrevPagesRead: 0, position: 11, textPagesRead: 0, unitNumber: 7 }
		]);
		expect((await placesOf(group.id, OTHER)).places).toEqual([
			{ husrevPagesRead: 0, position: 3, textPagesRead: 0, unitNumber: 7 }
		]);
		expect((await placesOf(group.id, OWNER)).places).toEqual([]);
	});
});

describe('leaving', () => {
	it('takes the member’s places in that group with them, and nobody else’s', async () => {
		const group = await createGroup('HATIM');
		const elsewhere = await createGroup('CEVSEN');
		await put(group.id, 7, { position: 3 });
		await put(elsewhere.id, 2, { position: 1 });
		await put(group.id, 7, { position: 5 }, OTHER);

		await leaveGroupForUser(READER, group.id);

		const left = await prisma.readingPlace.findMany({ select: { groupId: true, userId: true } });
		expect(left).toHaveLength(2);
		expect(left).toEqual(
			expect.arrayContaining([
				{ groupId: group.id, userId: OTHER },
				{ groupId: elsewhere.id, userId: READER }
			])
		);
	});

	it('goes with the account, in every group', async () => {
		const group = await createGroup('HATIM');
		const elsewhere = await createGroup('HIZB');
		await put(group.id, 7, { position: 3 });
		await put(elsewhere.id, 2, { position: 1 });
		await put(group.id, 7, { position: 5 }, OTHER);

		await deleteAccountForUser(READER);

		expect(await prisma.readingPlace.findMany({ select: { userId: true } })).toEqual([{ userId: OTHER }]);
	});
});
