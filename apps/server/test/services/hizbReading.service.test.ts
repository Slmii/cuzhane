import prisma from '@db/prisma';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import { createGroupForUser } from '@services/groups.service';
import { joinGroupForUser, leaveGroupForUser } from '@services/groupMembership.service';
import {
	enrollHizb,
	getHizbState,
	hizbSummary,
	setHizbReadsFromBook,
	updateHizbAssignment
} from '@services/hizbReading.service';
import { spansFor } from '@utils/hizbPlans';
import { civilDayNumber } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';
vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));
assertIsTestDatabase(testDatabaseUrl());
const start = new Date('2026-10-01T10:00:00Z');
const day = (n: number) => new Date(start.getTime() + n * 86400000);
const create = async (plan = 7, inactivityDays: number | null = null) => {
	vi.setSystemTime(start);
	return createGroupForUser(
		'owner',
		'Owner',
		CreateGroupBodySchema.parse({
			name: 'Personal plans',
			kind: 'HIZB',
			hizbPlan: plan,
			inactivityDays,
			visibility: 'PRIVATE',
			cycle: 'DAILY',
			reminderTime: '21:00',
			timezone: 'Europe/Amsterdam'
		})
	);
};
beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});
afterAll(async () => {
	vi.useRealTimers();
	await prisma.$disconnect();
});

describe('Hizb personal assignments', () => {
	it('starts immediately, advances through missed days and catches up without moving today', async () => {
		const group = await create();
		expect(group.status).toBe('RUNNING');
		const first = await getHizbState('owner', group.id);
		expect(first.today?.portion).toBe(1);
		vi.setSystemTime(day(2));
		const next = await getHizbState('owner', group.id);
		expect(next.today?.portion).toBe(3);
		expect(next.missedCount).toBe(2);
		await updateHizbAssignment('owner', group.id, first.today!.id, {
			version: 0,
			read: true,
			istighfarRepetitions: 11
		});
		const caught = await getHizbState('owner', group.id);
		expect(caught.today?.portion).toBe(3);
		expect(caught.missedCount).toBe(1);
		expect(caught.completedTraversals).toBe(0);
	});
	it('lists missed days newest first, and the spans today and the day before cover', async () => {
		const group = await create();
		expect((await getHizbState('owner', group.id)).previousDay).toBeNull();
		vi.setSystemTime(day(2));
		const state = await getHizbState('owner', group.id);
		expect(state.missed.map(a => a.day)).toEqual([state.today!.day - 1, state.today!.day - 2]);
		expect(state.previousDay).toMatchObject({ covered: 0, coveredSpans: [] });
		expect(state.coveredSpans).toEqual([]);
		await updateHizbAssignment('owner', group.id, state.today!.id, { version: 0, read: true });
		const read = await getHizbState('owner', group.id);
		expect(read.coveredSpans.sort((a, b) => a - b)).toEqual(spansFor(7, read.today!.portion));
		// Day 3 of round 1: today read, the two days before it not.
		expect(read.currentRound).toEqual({ number: 1, read: 1, days: 3 });
		vi.setSystemTime(day(8));
		expect((await getHizbState('owner', group.id)).currentRound).toEqual({ number: 2, read: 0, days: 2 });
	});
	it('marks the viewer and a started reading on the readers list, and keeps thirty past days', async () => {
		const group = await create();
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		await joinGroupForUser('reader', 'Reader', group.id);
		const mine = (await getHizbState('owner', group.id)).today!;
		await updateHizbAssignment('owner', group.id, mine.id, { version: 0, bookmark: 1 });
		const state = await getHizbState('reader', group.id);
		expect(state.members.map(m => [m.isMe, m.started])).toEqual([
			[false, true],
			[true, false]
		]);
		vi.setSystemTime(day(40));
		expect((await getHizbState('owner', group.id)).dailyHistory).toHaveLength(31);
	});
	it('numbers rounds across a leave and a rejoin, for today and for a missed day alike', async () => {
		const group = await create();
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		await joinGroupForUser('reader', 'Reader', group.id);
		vi.setSystemTime(day(8));
		await getHizbState('reader', group.id);
		await leaveGroupForUser('reader', group.id);
		vi.setSystemTime(day(9));
		await joinGroupForUser('reader', 'Reader', group.id);
		const state = await getHizbState('reader', group.id);
		// Days 7–8 were round 2 of the first enrollment; the rejoin today opens round 3.
		expect(state.currentRound?.number).toBe(3);
		expect(state.today?.round).toBe(3);
		expect(state.missed[0]?.round).toBe(2);
		// S3b: back today, with the earlier enrollment behind it; S7: joined after the group began.
		expect(state.isReturnedToday).toBe(true);
		expect(state.enrollment?.joinedDate > state.startedDate).toBe(true);
	});
	it("stamps the member's own finish on the summary, for Home's read-today list", async () => {
		const group = await create();
		const { getGroupDetailForUser } = await import('@services/groups.service');
		expect((await getGroupDetailForUser('owner', group.id)).myShareDoneAt).toBeNull();
		const today = (await getHizbState('owner', group.id)).today!;
		await updateHizbAssignment('owner', group.id, today.id, { version: 0, read: true, istighfarRepetitions: 11 });
		expect((await getGroupDetailForUser('owner', group.id)).myShareDoneAt).toBe(start.toISOString());
	});
	it('allows unlimited members, preserves personal ownership, and appends after a departure', async () => {
		const group = await create();
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		for (let i = 1; i <= 8; i++) {
			await joinGroupForUser(`reader${i}`, `Reader ${i}`, group.id);
		}
		const eighth = await getHizbState('reader7', group.id);
		expect(eighth.today?.portion).toBe(1);
		const owner = await getHizbState('owner', group.id);
		await expect(
			updateHizbAssignment('reader7', group.id, owner.today!.id, { version: 0, read: true })
		).rejects.toThrow();
		await updateHizbAssignment('reader7', group.id, eighth.today!.id, {
			version: 0,
			read: true,
			istighfarRepetitions: 11
		});
		expect((await getHizbState('owner', group.id)).today?.completedAt).toBeNull();
		await leaveGroupForUser('reader8', group.id);
		await joinGroupForUser('reader9', 'Reader 9', group.id);
		expect((await getHizbState('reader9', group.id)).enrollment?.sequence).toBe(9);
	});
	it('enforces fixed plans and supports independent sequences in mixed groups', async () => {
		const fixed = await create();
		await expect(enrollHizb('owner', fixed.id, 15)).rejects.toThrow();
		const group = await create(0);
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		await joinGroupForUser('reader', 'Reader', group.id);
		expect((await getHizbState('reader', group.id)).enrollment).toBeNull();
		await Promise.all([enrollHizb('reader', group.id, 15), enrollHizb('reader', group.id, 15)]);
		expect(await prisma.hizbEnrollment.count({ where: { groupId: group.id, userId: 'reader' } })).toBe(1);
		expect((await getHizbState('reader', group.id)).enrollment?.planDays).toBe(15);
	});
	it('removes at the exact inactivity cutoff, preserves catch-up and rejoins at the tail', async () => {
		const group = await create(7, 10);
		vi.setSystemTime(day(9));
		expect((await getHizbState('owner', group.id)).enrollment?.endDay).toBeNull();
		vi.setSystemTime(day(30));
		const removed = await getHizbState('owner', group.id);
		expect(removed.enrollment?.reason).toBe('INACTIVITY');
		expect(removed.today).toBeNull();
		expect(removed.missedCount).toBe(10);
		await enrollHizb('owner', group.id, 7);
		const rejoined = await getHizbState('owner', group.id);
		expect(rejoined.enrollment?.sequence).toBe(1);
		expect(rejoined.today).not.toBeNull();
		expect(rejoined.missedCount).toBe(10);
	});
	it('gates Sekine at 19, rejects stale counter edits, and makes retries idempotent', async () => {
		const group = await create();
		vi.setSystemTime(day(3));
		const a = (await getHizbState('owner', group.id)).today!;
		expect(a.portion).toBe(4);
		await expect(updateHizbAssignment('owner', group.id, a.id, { version: 0, read: true })).rejects.toThrow();
		await updateHizbAssignment('owner', group.id, a.id, { version: 0, repetitions: 18 });
		await expect(updateHizbAssignment('owner', group.id, a.id, { version: 0, repetitions: 19 })).rejects.toThrow();
		await updateHizbAssignment('owner', group.id, a.id, { version: 1, repetitions: 19, delailRepetitions: 3 });
		await updateHizbAssignment('owner', group.id, a.id, { version: 2, read: true });
		await updateHizbAssignment('owner', group.id, a.id, { version: 2, read: true });
		expect((await getHizbState('owner', group.id)).today?.completedAt).not.toBeNull();
		vi.setSystemTime(day(10));
		expect((await getHizbState('owner', group.id)).today?.repetitions).toBe(0);
	});
});

describe('Hizb on the Discover card and the invite preview', () => {
	const ascending = (spans: readonly number[]) => [...spans].sort((a, b) => a - b);

	it('lists only personal-plan Hizb groups on Discover, never a seat or flexible board', async () => {
		const plan = await create();
		const flexible = await create();
		const seats = await create();
		await prisma.group.updateMany({
			where: { id: { in: [plan.id, flexible.id, seats.id] } },
			data: { visibility: 'OPEN' }
		});
		await prisma.group.update({ where: { id: flexible.id }, data: { hizbPlan: null } });
		await prisma.group.update({ where: { id: seats.id }, data: { hizbPlan: null, splitMode: 'FIXED' } });
		const { discoverGroups } = await import('@services/groups.service');
		const ids = (await discoverGroups('outsider', {})).map(g => g.id);
		expect(ids).toContain(plan.id);
		expect(ids).not.toContain(flexible.id);
		expect(ids).not.toContain(seats.id);
	});
	it("carries today's covered spans and the next day's start, as the group screen has them", async () => {
		const group = await create();
		vi.setSystemTime(day(2));
		const today = (await getHizbState('owner', group.id)).today!;
		await updateHizbAssignment('owner', group.id, today.id, { version: 0, read: true });
		const state = await getHizbState('owner', group.id);
		const summary = await hizbSummary(group.id, 'outsider');
		expect(summary.hizbCoveredSpans.length).toBeGreaterThan(0);
		expect(ascending(summary.hizbCoveredSpans)).toEqual(ascending(state.coveredSpans));
		expect(summary.nextDayAt).toBe(state.nextDayAt);
	});
	it("counts the group's day from 1 on the day it began", async () => {
		const group = await create();
		expect((await hizbSummary(group.id, 'outsider')).hizbDay).toBe(1);
		vi.setSystemTime(day(40));
		expect((await hizbSummary(group.id, 'outsider')).hizbDay).toBe(41);
	});
	it('says the viewer was taken out of the order, until they rejoin', async () => {
		const group = await create(7, 10);
		expect((await hizbSummary(group.id, 'owner')).hizbRemoved).toBe(false);
		expect((await hizbSummary(group.id, 'outsider')).hizbRemoved).toBe(false);
		vi.setSystemTime(day(30));
		expect((await hizbSummary(group.id, 'owner')).hizbRemoved).toBe(true);
		// The rule that removed them, not the group's current one.
		await prisma.group.update({ where: { id: group.id }, data: { inactivityDays: 21 } });
		expect((await hizbSummary(group.id, 'owner')).hizbRemovalDays).toBe(10);
		await enrollHizb('owner', group.id, 7);
		expect((await hizbSummary(group.id, 'owner')).hizbRemoved).toBe(false);
		expect((await hizbSummary(group.id, 'owner')).hizbRemovalDays).toBeNull();
	});
});

describe('Hizb edge cases', () => {
	it('does not reuse a deleted account’s rotation position', async () => {
		const { deleteAccountForUser } = await import('@services/account.service');
		const group = await create();
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		await joinGroupForUser('reader', 'Reader', group.id);
		await deleteAccountForUser('reader');
		await joinGroupForUser('next', 'Next', group.id);
		expect((await getHizbState('next', group.id)).enrollment?.sequence).toBe(2);
	});
	it('paints a part-read day from the book on the board and leaves it owed, then finishes it', async () => {
		const group = await create(15);
		const today = (await getHizbState('owner', group.id)).today!;
		// Day 1 of 15 has the opening istighfar; from the book, its count is not asked.
		expect(today.requiresIstighfar).toBe(true);
		const [first, ...rest] = today.boardPortions;
		expect(rest.length).toBeGreaterThan(0);
		const partial = await updateHizbAssignment('owner', group.id, today.id, { version: 0, bookPortions: [first!] });
		expect(partial).toMatchObject({ completedAt: null, readPortions: [first], readFrom: null });
		const state = await getHizbState('owner', group.id);
		expect(state.coveredSpans.sort((a, b) => a - b)).toEqual(spansFor(32, first!));
		expect(state.members.find(m => m.isMe)).toMatchObject({ completed: false, started: true });
		expect((await hizbSummary(group.id, 'owner')).readCount).toBe(1);
		// Still owed tomorrow.
		vi.setSystemTime(day(1));
		expect((await getHizbState('owner', group.id)).missedCount).toBe(1);
		const done = await updateHizbAssignment('owner', group.id, today.id, {
			version: 1,
			bookPortions: today.boardPortions
		});
		expect(done).toMatchObject({ readFrom: 'BOOK', readPortions: [], istighfarRepetitions: 0 });
		expect(done.completedAt).not.toBeNull();
		// A later page turn in the reader does not ask for the counts it skipped.
		await expect(
			updateHizbAssignment('owner', group.id, today.id, { version: 2, bookmark: 1 })
		).resolves.toMatchObject({ bookmark: 1, readFrom: 'BOOK' });
		expect((await getHizbState('owner', group.id)).missedCount).toBe(0);
	});
	it('undoes a part-read day, and refuses portions the day does not have', async () => {
		const group = await create(15);
		const today = (await getHizbState('owner', group.id)).today!;
		await updateHizbAssignment('owner', group.id, today.id, {
			version: 0,
			bookPortions: [today.boardPortions[0]!]
		});
		const undone = await updateHizbAssignment('owner', group.id, today.id, { version: 1, read: false });
		expect(undone).toMatchObject({ readPortions: [], completedAt: null });
		expect((await getHizbState('owner', group.id)).coveredSpans).toEqual([]);
		const outside = [32].find(p => !today.boardPortions.includes(p))!;
		await expect(
			updateHizbAssignment('owner', group.id, today.id, { version: 2, bookPortions: [outside] })
		).rejects.toMatchObject({ statusCode: 400 });
	});
	it('keeps an app reading gated, and records how a day was read', async () => {
		const group = await create(15);
		const today = (await getHizbState('owner', group.id)).today!;
		await expect(
			updateHizbAssignment('owner', group.id, today.id, { version: 0, read: true })
		).rejects.toMatchObject({ statusCode: 409 });
		const read = await updateHizbAssignment('owner', group.id, today.id, {
			version: 0,
			read: true,
			istighfarRepetitions: 11
		});
		expect(read.readFrom).toBe('APP');
	});
	it('takes any istighfar target from 1 to 100', async () => {
		const group = await create(15);
		const today = (await getHizbState('owner', group.id)).today!;
		await expect(
			updateHizbAssignment('owner', group.id, today.id, { version: 0, istighfarTarget: 25 })
		).resolves.toMatchObject({ istighfarTarget: 25 });
		for (const target of [0, 101, 2.5]) {
			await expect(
				updateHizbAssignment('owner', group.id, today.id, { version: 1, istighfarTarget: target })
			).rejects.toMatchObject({ statusCode: 400 });
		}
	});
	it('keeps “hep kitaptan” per member, on the account', async () => {
		const group = await create(15);
		expect((await getHizbState('owner', group.id)).readsFromBook).toBe(false);
		await setHizbReadsFromBook('owner', group.id, true);
		expect((await getHizbState('owner', group.id)).readsFromBook).toBe(true);
		await expect(setHizbReadsFromBook('stranger', group.id, true)).rejects.toMatchObject({ statusCode: 403 });
	});
	it('counts members as the group’s members, not only the readers in the order', async () => {
		const group = await create(0);
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		// Joined but no plan chosen yet: a member, not yet a reader.
		await joinGroupForUser('reader', 'Reader', group.id);
		expect((await hizbSummary(group.id, 'reader')).memberCount).toBe(2);
	});
	it('counts the summary in the board’s 32 portions, not in text spans', async () => {
		const group = await create(15);
		const today = (await getHizbState('owner', group.id)).today!;
		await updateHizbAssignment('owner', group.id, today.id, { version: 0, read: true, istighfarRepetitions: 11 });
		const read = new Set(spansFor(15, today.portion));
		const portions = Array.from({ length: 32 }, (_, i) => i + 1).filter(p =>
			spansFor(32, p).every(span => read.has(span))
		).length;
		const summary = await hizbSummary(group.id, 'owner');
		expect(summary.partCount).toBe(32);
		expect(summary.readCount).toBe(portions);
		expect(summary.percent).toBe(Math.round((portions * 100) / 32));
	});
	it('keeps a deleted account’s completed readings in the group’s coverage', async () => {
		const { deleteAccountForUser } = await import('@services/account.service');
		const { getGroupDetailForUser } = await import('@services/groups.service');
		const group = await create();
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		await joinGroupForUser('reader', 'Reader', group.id);
		const today = (await getHizbState('reader', group.id)).today!;
		await updateHizbAssignment('reader', group.id, today.id, { version: 0, read: true });
		const before = (await getGroupDetailForUser('owner', group.id)).readCount;
		expect(before).toBeGreaterThan(0);
		await deleteAccountForUser('reader');
		expect((await getGroupDetailForUser('owner', group.id)).readCount).toBe(before);
	});
	it('shows an earlier assignment on the same day after leaving and rejoining', async () => {
		const group = await create();
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN' } });
		await joinGroupForUser('reader', 'Reader', group.id);
		const original = (await getHizbState('reader', group.id)).today!;
		await leaveGroupForUser('reader', group.id);
		await joinGroupForUser('reader', 'Reader', group.id);
		const state = await getHizbState('reader', group.id);
		expect(state.today?.id).not.toBe(original.id);
		expect(state.assignments.map(a => a.id)).toContain(original.id);
	});
	it('a bookmark edit on an already completed reading is not new reading activity', async () => {
		const group = await create(7, 10);
		const original = (await getHizbState('owner', group.id)).today!;
		await updateHizbAssignment('owner', group.id, original.id, {
			version: 0,
			read: true,
			istighfarRepetitions: 11
		});
		vi.setSystemTime(day(8));
		await updateHizbAssignment('owner', group.id, original.id, { version: 1, read: true, bookmark: 1 });
		vi.setSystemTime(day(11));
		expect((await getHizbState('owner', group.id)).enrollment?.reason).toBe('INACTIVITY');
	});
	it('enabling inactivity gives a new grace period rather than backdating removal', async () => {
		const { updateGroupForUser } = await import('@services/groups.service');
		const group = await create();
		vi.setSystemTime(day(5));
		expect((await getHizbState('owner', group.id)).today).not.toBeNull();
		await updateGroupForUser('owner', group.id, { inactivityDays: 2 });
		expect((await getHizbState('owner', group.id)).enrollment?.endDay).toBeNull();
		vi.setSystemTime(day(7));
		const expired = await getHizbState('owner', group.id);
		expect(expired.enrollment?.reason).toBe('INACTIVITY');
		expect(expired.missedCount).toBe(7);
	});
	it('counts a full personal traversal only after its missing assignment is caught up', async () => {
		const group = await create();
		const original = (await getHizbState('owner', group.id)).today!;
		for (let i = 1; i < 7; i++) {
			vi.setSystemTime(day(i));
			let a = (await getHizbState('owner', group.id)).today!;
			if (a.requiresSekine) {
				a = await updateHizbAssignment('owner', group.id, a.id, {
					version: 0,
					repetitions: 19,
					delailRepetitions: 3
				});
			}
			await updateHizbAssignment('owner', group.id, a.id, { version: a.version, read: true });
		}
		vi.setSystemTime(day(7));
		expect((await getHizbState('owner', group.id)).completedTraversals).toBe(0);
		await updateHizbAssignment('owner', group.id, original.id, {
			version: 0,
			read: true,
			istighfarRepetitions: 11
		});
		const complete = await getHizbState('owner', group.id);
		expect(complete.completedTraversals).toBe(1);
		expect(complete.today?.completedAt).toBeNull();
	});
	it('concurrent joins give distinct tail positions and complete group coverage requires all passages', async () => {
		const group = await create();
		await prisma.group.update({ where: { id: group.id }, data: { visibility: 'OPEN', hideMemberNames: true } });
		await Promise.all(Array.from({ length: 6 }, (_, i) => joinGroupForUser(`r${i}`, `Reader ${i}`, group.id)));
		const enrolled = await prisma.hizbEnrollment.findMany({ where: { groupId: group.id } });
		expect(new Set(enrolled.map(e => e.sequence)).size).toBe(7);
		for (const e of enrolled) {
			let a = (await getHizbState(e.userId, group.id)).today!;
			if (a.requiresSekine) {
				a = await updateHizbAssignment(e.userId, group.id, a.id, {
					version: 0,
					repetitions: 19,
					delailRepetitions: 3
				});
			}
			await updateHizbAssignment(e.userId, group.id, a.id, {
				version: a.version,
				read: true,
				...(a.requiresIstighfar ? { istighfarRepetitions: 11 } : {})
			});
		}
		const state = await getHizbState('r0', group.id);
		expect(state.coverage.complete).toBe(true);
		expect(state.members.filter(m => m.displayName !== null)).toHaveLength(1);
		await expect(getHizbState('outsider', group.id)).rejects.toThrow();
	});
	it('advances exactly once across the Amsterdam daylight-saving boundary', async () => {
		vi.setSystemTime(new Date('2026-10-24T21:59:00Z'));
		const group = await create();
		await prisma.group.update({ where: { id: group.id }, data: { startedAt: new Date('2026-10-24T10:00:00Z') } });
		await prisma.hizbEnrollment.updateMany({
			where: { groupId: group.id },
			data: {
				joinedDay: civilDayNumber(new Date('2026-10-24T10:00:00Z'), 'Europe/Amsterdam'),
				generatedThrough: civilDayNumber(new Date('2026-10-24T10:00:00Z'), 'Europe/Amsterdam') - 1
			}
		});
		vi.setSystemTime(new Date('2026-10-24T22:01:00Z'));
		const a = (await getHizbState('owner', group.id)).today!;
		vi.setSystemTime(new Date('2026-10-25T22:59:00Z'));
		expect((await getHizbState('owner', group.id)).today?.id).toBe(a.id);
		vi.setSystemTime(new Date('2026-10-25T23:01:00Z'));
		expect((await getHizbState('owner', group.id)).today?.portion).toBe(a.portion + 1);
	});
	it('uses a stable history cursor across assignments on the same date', async () => {
		const group = await create();
		const first = (await getHizbState('owner', group.id)).enrollment!;
		const e = await prisma.hizbEnrollment.findUniqueOrThrow({ where: { id: first.id } });
		await prisma.hizbEnrollment.update({ where: { id: e.id }, data: { endDay: e.joinedDay + 1, reason: 'LEFT' } });
		for (let i = 1; i <= 101; i++) {
			const old = await prisma.hizbEnrollment.create({
				data: {
					groupId: group.id,
					userId: 'owner',
					planDays: 7,
					sequence: i,
					joinedDay: e.joinedDay,
					endDay: e.joinedDay + 1,
					reason: 'LEFT',
					generatedThrough: e.joinedDay - 1
				}
			});
			expect(old.id).toBeTruthy();
		}
		const page = await getHizbState('owner', group.id);
		expect(page.assignments).toHaveLength(100);
		expect(page.nextCursor).toBeTruthy();
		const next = await getHizbState('owner', group.id, page.nextCursor!);
		expect(new Set([...page.assignments, ...next.assignments].map(a => a.id)).size).toBe(102);
	});
});

it('personal readings contribute to the profile activity without adding Cevsen babs', async () => {
	const { getProfileStatsForUser } = await import('@services/profile.service');
	const group = await create();
	const a = (await getHizbState('owner', group.id)).today!;
	await updateHizbAssignment('owner', group.id, a.id, { version: 0, read: true, istighfarRepetitions: 11 });
	const stats = await getProfileStatsForUser('owner', 'Europe/Amsterdam');
	expect(stats.streakDays).toBe(1);
	expect(stats.babsRead).toBe(0);
	expect(stats.last30Days.at(-1)?.count).toBe(1);
});

describe('individual Hizb reading', () => {
	const input = (plan = 7, portion = 6) =>
		CreateGroupBodySchema.parse({
			name: 'My outside group',
			kind: 'HIZB',
			hizbPlan: plan,
			hizbIndividual: true,
			hizbStartPortion: portion,
			visibility: 'OPEN',
			inactivityDays: 10,
			reminderTime: '21:00',
			timezone: 'Europe/Amsterdam'
		});
	it.each([7, 15, 32])(
		'starts the %i-day plan at the selected portion and wraps without past arrears',
		async plan => {
			vi.setSystemTime(start);
			const group = await createGroupForUser('owner', 'Owner', input(plan, plan));
			const first = await getHizbState('owner', group.id);
			expect(first.today?.portion).toBe(plan);
			expect(first.missedCount).toBe(0);
			expect(first.assignments).toHaveLength(0);
			vi.setSystemTime(day(1));
			const next = await getHizbState('owner', group.id);
			expect(next.today?.portion).toBe(1);
			expect(next.missedCount).toBe(1);
			const { getGroupDetailForUser } = await import('@services/groups.service');
			expect((await getGroupDetailForUser('owner', group.id)).hizbToday?.portion).toBe(1);
			// Home opens the day's reading from the summary alone, before the group screen has loaded it.
			vi.setSystemTime(day(2));
			const summaryToday = (await getGroupDetailForUser('owner', group.id)).hizbToday;
			expect(summaryToday?.assignmentId).toBe((await getHizbState('owner', group.id)).today?.id);
			vi.setSystemTime(day(40));
			expect((await getHizbState('owner', group.id)).enrollment?.endDay).toBeNull();
		}
	);
	it('is private and owner-only, including invite codes, and cannot be reopened', async () => {
		vi.setSystemTime(start);
		const group = await createGroupForUser('owner', 'Owner', input());
		expect(group.visibility).toBe('PRIVATE');
		expect(group.openToJoin).toBe(false);
		expect(group.inactivityDays).toBeNull();
		const { previewGroupByCode, joinGroupByCodeForUser } = await import('@services/groupMembership.service');
		const { updateGroupForUser, discoverGroups, regenerateInviteCodeForUser } = await import(
			'@services/groups.service'
		);
		const row = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
		await expect(previewGroupByCode('outsider', row.inviteCode)).rejects.toThrow();
		await expect(joinGroupByCodeForUser('outsider', 'Outside', row.inviteCode)).rejects.toThrow();
		await expect(joinGroupForUser('outsider', 'Outside', group.id)).rejects.toThrow();
		await expect(regenerateInviteCodeForUser('owner', group.id)).rejects.toThrow();
		await expect(updateGroupForUser('owner', group.id, { visibility: 'OPEN' })).rejects.toThrow();
		await expect(updateGroupForUser('owner', group.id, { openToJoin: true })).rejects.toThrow();
		await expect(updateGroupForUser('owner', group.id, { inactivityDays: 1 })).rejects.toThrow();
		expect((await discoverGroups('outsider', {})).map(g => g.id)).not.toContain(group.id);
		expect((await updateGroupForUser('owner', group.id, { name: 'My reading' })).name).toBe('My reading');
	});
	it('cannot abandon an individual reading through the group leave endpoint', async () => {
		vi.setSystemTime(start);
		const group = await createGroupForUser('owner', 'Owner', input());
		await expect(leaveGroupForUser('owner', group.id)).rejects.toThrow();
		expect((await getHizbState('owner', group.id)).today?.portion).toBe(6);
		const { deleteGroupForUser } = await import('@services/groups.service');
		await deleteGroupForUser('owner', group.id);
		expect(await prisma.hizbEnrollment.count({ where: { groupId: group.id } })).toBe(0);
	});
	it('shows individual daily progress independently of shared book coverage', async () => {
		vi.setSystemTime(start);
		const group = await createGroupForUser('owner', 'Owner', input());
		const a = (await getHizbState('owner', group.id)).today!;
		await updateHizbAssignment('owner', group.id, a.id, { version: 0, read: true });
		const { getGroupDetailForUser } = await import('@services/groups.service');
		const done = await getGroupDetailForUser('owner', group.id);
		expect(done.percent).toBe(100);
		expect(done.readCount).toBe(1);
		expect(done.partCount).toBe(1);
		vi.setSystemTime(day(1));
		expect((await getGroupDetailForUser('owner', group.id)).percent).toBe(0);
	});
	it('rejects starting portions outside the selected plan and individual mixed plans', () => {
		expect(() => input(7, 8)).toThrow();
		expect(() => input(15, 16)).toThrow();
		expect(() => input(32, 33)).toThrow();
		expect(() => input(7, 0)).toThrow();
		expect(() => input(0, 1)).toThrow();
		expect(() =>
			CreateGroupBodySchema.parse({ name: 'No', kind: 'CEVSEN', hizbIndividual: true, reminderTime: '21:00' })
		).toThrow();
		expect(() =>
			CreateGroupBodySchema.parse({
				name: 'No',
				kind: 'HIZB',
				hizbPlan: 7,
				hizbStartPortion: 3,
				reminderTime: '21:00'
			})
		).toThrow();
	});
});

describe('opening istighfar repetitions', () => {
	it('requires the default 11 and persists higher chosen targets independently of Sekine', async () => {
		const group = await create();
		let a = (await getHizbState('owner', group.id)).today!;
		expect(a.requiresIstighfar).toBe(true);
		expect(a.istighfarTarget).toBe(11);
		await expect(updateHizbAssignment('owner', group.id, a.id, { version: 0, read: true })).rejects.toThrow();
		a = await updateHizbAssignment('owner', group.id, a.id, { version: 0, istighfarRepetitions: 10 });
		await expect(
			updateHizbAssignment('owner', group.id, a.id, { version: a.version, read: true })
		).rejects.toThrow();
		a = await updateHizbAssignment('owner', group.id, a.id, {
			version: a.version,
			istighfarRepetitions: 11,
			read: true
		});
		expect(a.completedAt).not.toBeNull();
		expect(a.repetitions).toBe(0);
		a = await updateHizbAssignment('owner', group.id, a.id, {
			version: a.version,
			read: false,
			istighfarTarget: 33
		});
		await expect(
			updateHizbAssignment('owner', group.id, a.id, { version: a.version, read: true })
		).rejects.toThrow();
		a = await updateHizbAssignment('owner', group.id, a.id, {
			version: a.version,
			istighfarRepetitions: 33,
			read: true
		});
		expect(a.istighfarTarget).toBe(33);
		expect((await getHizbState('owner', group.id)).today?.istighfarRepetitions).toBe(33);
		vi.setSystemTime(day(7));
		const fresh = (await getHizbState('owner', group.id)).today!;
		expect(fresh.istighfarRepetitions).toBe(0);
		expect(fresh.istighfarTarget).toBe(11);
	});
	it('validates counts and targets, rejects stale edits and unrelated portions, and supports 100', async () => {
		const group = await create();
		let a = (await getHizbState('owner', group.id)).today!;
		// Any count from 1 to 100 ("Sayıyı gir"); nothing outside it.
		for (const target of [0, 101, 2.5]) {
			await expect(
				updateHizbAssignment('owner', group.id, a.id, { version: 0, istighfarTarget: target })
			).rejects.toThrow();
		}
		for (const count of [-1, 101, 2.5]) {
			await expect(
				updateHizbAssignment('owner', group.id, a.id, { version: 0, istighfarRepetitions: count })
			).rejects.toThrow();
		}
		a = await updateHizbAssignment('owner', group.id, a.id, {
			version: 0,
			istighfarTarget: 100,
			istighfarRepetitions: 99
		});
		await expect(
			updateHizbAssignment('owner', group.id, a.id, { version: 0, read: false, istighfarRepetitions: 100 })
		).rejects.toThrow();
		await expect(
			updateHizbAssignment('owner', group.id, a.id, { version: a.version, read: true })
		).rejects.toThrow();
		a = await updateHizbAssignment('owner', group.id, a.id, {
			version: a.version,
			istighfarRepetitions: 100,
			read: true
		});
		expect(a.completedAt).not.toBeNull();
		vi.setSystemTime(day(1));
		const unrelated = (await getHizbState('owner', group.id)).today!;
		expect(unrelated.requiresIstighfar).toBe(false);
		await expect(
			updateHizbAssignment('owner', group.id, unrelated.id, { version: 0, istighfarRepetitions: 11 })
		).rejects.toThrow();
	});
	it('preserves old completed history without inventing repetition counts', async () => {
		const group = await create();
		const a = (await getHizbState('owner', group.id)).today!;
		await prisma.hizbAssignment.update({ where: { id: a.id }, data: { completedAt: start } });
		const edited = await updateHizbAssignment('owner', group.id, a.id, { version: 0, bookmark: 1 });
		expect(edited.istighfarRepetitions).toBe(0);
		expect(edited.completedAt).not.toBeNull();
		await updateHizbAssignment('owner', group.id, a.id, { version: edited.version, read: false });
		await expect(
			updateHizbAssignment('owner', group.id, a.id, { version: edited.version + 1, read: true })
		).rejects.toThrow();
	});
});

describe('Delail three repetitions', () => {
	it('requires three independent repetitions and all nineteen Sekine readings in the seven-day assignment', async () => {
		const group = await create();
		vi.setSystemTime(day(3));
		let a = (await getHizbState('owner', group.id)).today!;
		expect(a.requiresDelailRepetition).toBe(true);
		expect(a.delailRepetitions).toBe(0);
		a = await updateHizbAssignment('owner', group.id, a.id, { version: 0, repetitions: 18, delailRepetitions: 3 });
		await expect(
			updateHizbAssignment('owner', group.id, a.id, { version: a.version, read: true })
		).rejects.toThrow();
		a = await updateHizbAssignment('owner', group.id, a.id, {
			version: a.version,
			repetitions: 19,
			delailRepetitions: 2
		});
		await expect(
			updateHizbAssignment('owner', group.id, a.id, { version: a.version, read: true })
		).rejects.toThrow();
		await expect(
			updateHizbAssignment('owner', group.id, a.id, { version: 0, delailRepetitions: 3 })
		).rejects.toThrow();
		a = await updateHizbAssignment('owner', group.id, a.id, {
			version: a.version,
			delailRepetitions: 3,
			read: true
		});
		expect(a.completedAt).not.toBeNull();
		expect((await getHizbState('owner', group.id)).today?.delailRepetitions).toBe(3);
		await expect(
			updateHizbAssignment('outsider', group.id, a.id, { version: a.version, delailRepetitions: 0 })
		).rejects.toThrow();
		vi.setSystemTime(day(10));
		const fresh = (await getHizbState('owner', group.id)).today!;
		expect(fresh.delailRepetitions).toBe(0);
	});
	it('rejects invalid counts and unrelated readings without altering old completed history', async () => {
		const group = await create();
		let a = (await getHizbState('owner', group.id)).today!;
		await expect(
			updateHizbAssignment('owner', group.id, a.id, { version: 0, delailRepetitions: 3 })
		).rejects.toThrow();
		vi.setSystemTime(day(3));
		a = (await getHizbState('owner', group.id)).today!;
		for (const count of [-1, 4, 1.5]) {
			await expect(
				updateHizbAssignment('owner', group.id, a.id, { version: 0, delailRepetitions: count })
			).rejects.toThrow();
		}
		await prisma.hizbAssignment.update({ where: { id: a.id }, data: { completedAt: day(3), repetitions: 19 } });
		const old = await updateHizbAssignment('owner', group.id, a.id, { version: 0, bookmark: 1 });
		expect(old.completedAt).not.toBeNull();
		expect(old.delailRepetitions).toBe(0);
	});
});
