import prisma from '@db/prisma';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import {
	createGroupForUser,
	discoverGroups,
	getGroupDetailForUser,
	regenerateInviteCodeForUser,
	updateGroupForUser
} from '@services/groups.service';
import {
	joinGroupByCodeForUser,
	joinGroupForUser,
	leaveGroupForUser,
	previewGroupByCode
} from '@services/groupMembership.service';
import {
	enrollHizb,
	getHizbAssignment,
	getHizbState,
	hizbSummary,
	openHizbAhead,
	updateHizbAssignment
} from '@services/hizbReading.service';
import { notifyHizbRead } from '@services/hizbReadNotice.service';
import { getProfileStatsForUser } from '@services/profile.service';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));
// Asserted on: a Şahsi reading has nobody to tell.
vi.mock('@services/hizbReadNotice.service', () => ({ notifyHizbRead: vi.fn(async () => undefined) }));
assertIsTestDatabase(testDatabaseUrl());

const start = new Date('2026-10-01T10:00:00Z');
const ZONE = 'Europe/Amsterdam';
const at = (n: number) => new Date(start.getTime() + n * 86400000);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

type Kind = 'CEVSEN' | 'HATIM';

const create = async (kind: Kind, planDays: number, extra: Record<string, unknown> = {}) => {
	vi.setSystemTime(start);
	return createGroupForUser(
		'owner',
		'Owner',
		CreateGroupBodySchema.parse({ name: 'Şahsi', kind, planDays, reminderTime: '21:00', timezone: ZONE, ...extra })
	);
};

type Reading = { id: string; version: number };
const readInApp = (groupId: string, a: Reading) =>
	updateHizbAssignment('owner', groupId, a.id, { version: a.version, read: true });
const undo = (groupId: string, a: Reading) =>
	updateHizbAssignment('owner', groupId, a.id, { version: a.version, read: false });

/** Every day of a plan's first round, read ahead one after another from today: each day's units. */
const unitsByDay = async (kind: Kind, planDays: number) => {
	const group = await create(kind, planDays);
	const today = (await getHizbState('owner', group.id)).today!;
	const days = [today.units];
	await readInApp(group.id, today);
	for (let i = 1; i < planDays; i++) {
		const next = await openHizbAhead('owner', group.id);
		days.push(next.units);
		await readInApp(group.id, next);
	}
	return days;
};

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.mocked(notifyHizbRead).mockClear();
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	vi.useRealTimers();
	await prisma.$disconnect();
});

describe('the split', () => {
	it.each([
		['CEVSEN', 10, [...Array(10).fill(10)]],
		['CEVSEN', 15, [...Array(10).fill(7), ...Array(5).fill(6)]],
		['CEVSEN', 30, [...Array(10).fill(4), ...Array(20).fill(3)]],
		['CEVSEN', 1, [100]],
		['CEVSEN', 90, [...Array(10).fill(2), ...Array(80).fill(1)]],
		['HATIM', 7, [5, 5, 4, 4, 4, 4, 4]],
		['HATIM', 10, Array(10).fill(3)],
		['HATIM', 15, Array(15).fill(2)],
		['HATIM', 30, Array(30).fill(1)],
		['HATIM', 1, [30]]
	] as const)('%s over %i days: contiguous blocks, the longer ones first', async (kind, planDays, sizes) => {
		const days = await unitsByDay(kind, planDays);
		expect(days.map(units => units?.length)).toEqual(sizes);
		expect(days.flatMap(units => units ?? [])).toEqual(range(1, kind === 'CEVSEN' ? 100 : 30));
	});
});

describe('creating a Şahsi reading', () => {
	it.each([
		['CEVSEN', 1],
		['CEVSEN', 10],
		['CEVSEN', 15],
		['CEVSEN', 30],
		['CEVSEN', 90],
		['HATIM', 1],
		['HATIM', 10],
		['HATIM', 30]
	] as const)('accepts %s over %i days', (kind, planDays) => {
		expect(CreateGroupBodySchema.safeParse({ name: 'Ş', kind, planDays, reminderTime: '21:00' }).success).toBe(
			true
		);
	});

	it.each([
		['CEVSEN', 0],
		['CEVSEN', 91],
		['CEVSEN', 10.5],
		['HATIM', 0],
		['HATIM', 31]
	] as const)('refuses %s over %s days', (kind, planDays) => {
		expect(CreateGroupBodySchema.safeParse({ name: 'Ş', kind, planDays, reminderTime: '21:00' }).success).toBe(
			false
		);
	});

	it('refuses a length in days on a Hizb body, and still asks a shared hatim for its cüz', () => {
		expect(
			CreateGroupBodySchema.safeParse({ name: 'Ş', kind: 'HIZB', planDays: 10, reminderTime: '21:00' }).success
		).toBe(false);
		expect(CreateGroupBodySchema.safeParse({ name: 'Ş', kind: 'HATIM', reminderTime: '21:00' }).success).toBe(
			false
		);
	});

	it('refuses a length out of range given to the service directly', async () => {
		await expect(
			createGroupForUser('owner', 'Owner', {
				name: 'Ş',
				kind: 'HATIM',
				planDays: 31,
				distribution: 'FREE_PICK',
				maxPerMember: null,
				boundaryPolicy: 'KEEP',
				roundDays: 30,
				visibility: 'OPEN',
				reminderEnabled: true,
				reminderTime: '21:00',
				timezone: ZONE
			})
		).rejects.toMatchObject({ statusCode: 400 });
	});

	it.each(['CEVSEN', 'HATIM'] as const)('makes a %s one private, started, boardless and enrolled', async kind => {
		// Sharing settings sent along are ignored, not kept.
		const group = await create(kind, 10, { visibility: 'OPEN', splitMode: 'FLEXIBLE', cuzNumbers: [5] });
		expect(group).toMatchObject({
			kind,
			planDays: 10,
			hizbIndividual: true,
			hizbPlan: null,
			visibility: 'PRIVATE',
			openToJoin: false,
			status: 'RUNNING',
			cycle: 'DAILY',
			roundDays: 1,
			mustPickCuz: false,
			poolBabNumbers: [],
			myBabNumbers: [],
			babs: [],
			maxPerMember: null,
			boundaryPolicy: null,
			// Home's card: the day's one reading, as a Hizb Şahsi has it.
			readCount: 0,
			partCount: 1,
			hizbToday: {
				planDays: 10,
				portion: 1,
				units: kind === 'CEVSEN' ? range(1, 10) : [1, 2, 3],
				completed: false
			}
		});
		expect(await prisma.groupBab.count({ where: { groupId: group.id } })).toBe(0);
		expect(await prisma.cuzHolding.count({ where: { groupId: group.id } })).toBe(0);
		expect(await prisma.hizbEnrollment.findMany({ where: { groupId: group.id } })).toMatchObject([
			{ userId: 'owner', planDays: 10, sequence: 0, endDay: null }
		]);
		const g = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
		expect([g.hizbNext7, g.hizbNext15, g.hizbNext33]).toEqual([0, 0, 0]);
	});

	it('keeps it one person’s: no join, no invite, no preview for others, no leaving, no Keşfet', async () => {
		const group = await create('CEVSEN', 15);
		const code = group.inviteCode!;
		await expect(previewGroupByCode('other', code)).rejects.toMatchObject({ statusCode: 404 });
		await expect(joinGroupForUser('other', 'Other', group.id)).rejects.toMatchObject({ statusCode: 403 });
		await expect(joinGroupByCodeForUser('other', 'Other', code)).rejects.toMatchObject({ statusCode: 403 });
		await expect(leaveGroupForUser('owner', group.id)).rejects.toMatchObject({ statusCode: 400 });
		await expect(regenerateInviteCodeForUser('owner', group.id)).rejects.toMatchObject({ statusCode: 400 });
		await expect(updateGroupForUser('owner', group.id, { visibility: 'OPEN' })).rejects.toMatchObject({
			statusCode: 400
		});
		await expect(updateGroupForUser('owner', group.id, { openToJoin: true })).rejects.toMatchObject({
			statusCode: 400
		});
		// Staying private is no change of rule; only the flexible board's openness is not asked of it.
		expect(await updateGroupForUser('owner', group.id, { visibility: 'PRIVATE', name: 'Benim' })).toMatchObject({
			name: 'Benim',
			planDays: 15
		});
		// The owner is enrolled at creation; there is no plan to choose.
		await expect(enrollHizb('owner', group.id, 15)).rejects.toMatchObject({ statusCode: 400 });
		expect(await discoverGroups('other', {})).toEqual([]);
		expect(await prisma.groupMember.count({ where: { groupId: group.id } })).toBe(1);
		// The owner's own preview still works, and carries the plan.
		expect(await previewGroupByCode('owner', code)).toMatchObject({ planDays: 15, hizbToday: { portion: 1 } });
	});
});

describe('reading a Şahsi plan', () => {
	it('starts again from the first part after the last day, as the next round', async () => {
		const group = await create('CEVSEN', 3);
		vi.setSystemTime(at(3));
		const state = await getHizbState('owner', group.id);
		expect(state.today).toMatchObject({ portion: 1, units: range(1, 34), traversal: 1, round: 2 });
		expect(state.currentRound).toMatchObject({ number: 2 });
		expect(state.missed.map(a => [a.portion, a.round])).toEqual([
			[3, 1],
			[2, 1],
			[1, 1]
		]);
		expect(state.missed[0]!.units).toEqual(range(68, 100));
		vi.setSystemTime(at(4));
		expect((await getGroupDetailForUser('owner', group.id)).hizbToday).toMatchObject({
			portion: 2,
			units: range(35, 67)
		});
	});

	it('reads ahead one day at a time, in order, and undoes from the end', async () => {
		const group = await create('HATIM', 15);
		await expect(openHizbAhead('owner', group.id)).rejects.toMatchObject({ statusCode: 409 });
		const today = (await getHizbState('owner', group.id)).today!;
		const readToday = await readInApp(group.id, today);
		expect(readToday).toMatchObject({ readFrom: 'APP', units: [1, 2] });
		const next = await openHizbAhead('owner', group.id);
		expect(next).toMatchObject({ day: today.day + 1, portion: 2, units: [3, 4], completedAt: null });
		const readNext = await readInApp(group.id, next);
		const state = await getHizbState('owner', group.id);
		expect(state.ahead).toMatchObject({ day: today.day + 2, portion: 3, units: [5, 6], assignmentId: null });
		expect(state.aheadThrough).toMatchObject({ days: 1, readings: [{ portion: 2, units: [3, 4] }] });
		// Not today while tomorrow is read.
		await expect(undo(group.id, readToday)).rejects.toMatchObject({ statusCode: 409 });
		await undo(group.id, readNext);
		expect((await undo(group.id, readToday)).completedAt).toBeNull();
		expect(notifyHizbRead).not.toHaveBeenCalled();
	});

	it('lists missed days for catch-up, and a day made up leaves the list', async () => {
		const group = await create('CEVSEN', 10);
		vi.setSystemTime(at(3));
		const state = await getHizbState('owner', group.id);
		expect(state.missedCount).toBe(3);
		expect(state.missed.map(a => a.portion)).toEqual([3, 2, 1]);
		const made = await readInApp(group.id, state.missed[2]!);
		expect(made).toMatchObject({ portion: 1, units: range(1, 10), readFrom: 'APP' });
		expect((await getHizbState('owner', group.id)).missedCount).toBe(2);
	});

	it('marks a Kur’an day’s cüz from the book one at a time, and the last one finishes it', async () => {
		const group = await create('HATIM', 10);
		const today = (await getHizbState('owner', group.id)).today!;
		expect(today).toMatchObject({
			units: [1, 2, 3],
			boardPortions: [1, 2, 3],
			requiresSekine: false,
			requiresIstighfar: false,
			requiresDelailRepetition: false
		});
		// Outside the day, or alongside `read`: refused.
		for (const bookPortions of [[4], [3, 4], [2, 2]]) {
			await expect(
				updateHizbAssignment('owner', group.id, today.id, { version: 0, bookPortions })
			).rejects.toMatchObject({ statusCode: 400 });
		}
		const partial = await updateHizbAssignment('owner', group.id, today.id, { version: 0, bookPortions: [2] });
		expect(partial).toMatchObject({ readPortions: [2], completedAt: null, readFrom: null });
		const state = await getHizbState('owner', group.id);
		expect(state).toMatchObject({ coveredSpans: [], coveredUnits: [2], coverage: { covered: 1, total: 30 } });
		expect(state.missed).toEqual([]);
		// The shelf's card counts the cüz marked so far, not 0 until the day is done.
		expect((await hizbSummary(group.id, 'owner')).hizbToday).toMatchObject({
			completed: false,
			readUnits: [2],
			place: 0
		});
		// The place the reader keeps comes along too, for the shelf's pages.
		const placed = await updateHizbAssignment('owner', group.id, today.id, {
			version: partial.version,
			bookmark: 35
		});
		expect((await hizbSummary(group.id, 'owner')).hizbToday).toMatchObject({ place: 35 });
		const done = await updateHizbAssignment('owner', group.id, today.id, {
			version: placed.version,
			bookPortions: [3, 1, 2]
		});
		expect(done).toMatchObject({ readPortions: [], readFrom: 'BOOK' });
		expect(done.completedAt).not.toBeNull();
		expect((await getHizbState('owner', group.id)).coveredUnits).toEqual([1, 2, 3]);
		// One cüz unmarked on a finished day: undone in the same write, the others still marked.
		const unticked = await updateHizbAssignment('owner', group.id, today.id, {
			version: done.version,
			bookPortions: [1, 3]
		});
		expect(unticked).toMatchObject({ completedAt: null, readFrom: null, readPortions: [1, 3] });
		const again = await updateHizbAssignment('owner', group.id, today.id, {
			version: unticked.version,
			bookPortions: [1, 2, 3]
		});
		// The whole set again on a finished day changes nothing — refused, as before.
		await expect(
			updateHizbAssignment('owner', group.id, today.id, { version: again.version, bookPortions: [1, 2, 3] })
		).rejects.toMatchObject({ statusCode: 409 });
		expect(await undo(group.id, again)).toMatchObject({ completedAt: null, readFrom: null, readPortions: [] });
	});

	it('keeps the babs a Cevşen day marked with "Okudum", and reads the day in the app', async () => {
		const cevsen = await create('CEVSEN', 10);
		const day = (await getHizbState('owner', cevsen.id)).today!;
		// Moving with the arrows is only the place; "Okudum" ticks the bab.
		const moved = await updateHizbAssignment('owner', cevsen.id, day.id, { version: 0, bookmark: 3 });
		expect(moved).toMatchObject({ bookmark: 3, readPortions: [] });
		const partial = await updateHizbAssignment('owner', cevsen.id, day.id, {
			version: moved.version,
			bookPortions: [1, 2]
		});
		expect(partial).toMatchObject({ completedAt: null, readPortions: [1, 2] });
		const done = await updateHizbAssignment('owner', cevsen.id, day.id, {
			version: partial.version,
			bookPortions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
		});
		// All ten ticked in the app: read, and never "from the book".
		expect(done).toMatchObject({ readFrom: 'APP', readPortions: [] });
		expect(done.completedAt).not.toBeNull(); // "Geri al" on one bab of the read day: undone in one write, the other nine still marked.
		const unticked = await updateHizbAssignment('owner', cevsen.id, day.id, {
			version: done.version,
			bookPortions: [1, 2, 3, 4, 5, 6, 7, 8, 9]
		});
		expect(unticked).toMatchObject({
			completedAt: null,
			readFrom: null,
			readPortions: [1, 2, 3, 4, 5, 6, 7, 8, 9]
		});
	});

	it('reads a Cevşen day in the app only, and takes none of the Hizb’s counters', async () => {
		const cevsen = await create('CEVSEN', 10);
		const day = (await getHizbState('owner', cevsen.id)).today!;
		// No book to tick from: the sheet offers nothing.
		expect(day.boardPortions).toEqual([]);
		// A bab outside the day is refused.
		await expect(
			updateHizbAssignment('owner', cevsen.id, day.id, { version: 0, bookPortions: [11] })
		).rejects.toMatchObject({ statusCode: 400 });
		for (const counters of [
			{ repetitions: 1 },
			{ delailRepetitions: 1 },
			{ istighfarRepetitions: 1 },
			{ istighfarTarget: 11 }
		]) {
			await expect(
				updateHizbAssignment('owner', cevsen.id, day.id, { version: 0, ...counters })
			).rejects.toMatchObject({ statusCode: 400 });
		}
		const hatim = await create('HATIM', 10);
		const hatimDay = (await getHizbState('owner', hatim.id)).today!;
		await expect(
			updateHizbAssignment('owner', hatim.id, hatimDay.id, { version: 0, repetitions: 19 })
		).rejects.toMatchObject({ statusCode: 400 });
		// A bookmark is anyone's.
		expect(await updateHizbAssignment('owner', cevsen.id, day.id, { version: 0, bookmark: 12 })).toMatchObject({
			bookmark: 12,
			version: 1
		});
		expect(await getHizbAssignment('owner', cevsen.id, day.id)).toMatchObject({ units: range(1, 10) });
	});
});

describe('profile stats', () => {
	it('counts Şahsi days and finished passes beside a Hizb plan, never as babs', async () => {
		vi.setSystemTime(start);
		const hizb = await createGroupForUser(
			'owner',
			'Owner',
			CreateGroupBodySchema.parse({
				name: 'Hizb',
				kind: 'HIZB',
				hizbPlan: 15,
				visibility: 'PRIVATE',
				reminderTime: '21:00',
				timezone: ZONE
			})
		);
		const hizbDay = (await getHizbState('owner', hizb.id)).today!;
		await updateHizbAssignment('owner', hizb.id, hizbDay.id, {
			version: 0,
			bookPortions: hizbDay.boardPortions
		});
		// Two days, both read: one pass.
		const cevsen = await create('CEVSEN', 2);
		await readInApp(cevsen.id, (await getHizbState('owner', cevsen.id)).today!);
		vi.setSystemTime(at(1));
		await readInApp(cevsen.id, (await getHizbState('owner', cevsen.id)).today!);
		// A 7-day Kur'an plan read ahead through its last day: done only once that day comes.
		const hatim = await create('HATIM', 7);
		await readInApp(hatim.id, (await getHizbState('owner', hatim.id)).today!);
		for (let i = 1; i < 7; i++) {
			vi.setSystemTime(start);
			await readInApp(hatim.id, await openHizbAhead('owner', hatim.id));
		}

		vi.setSystemTime(at(1));
		const before = await getProfileStatsForUser('owner', ZONE);
		expect(before).toMatchObject({ babsRead: 0, roundsCompleted: 1, streakDays: 2 });
		vi.setSystemTime(at(6));
		expect((await getProfileStatsForUser('owner', ZONE)).roundsCompleted).toBe(2);
	});
});
