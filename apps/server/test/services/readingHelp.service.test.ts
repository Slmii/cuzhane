import prisma from '@db/prisma';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import { createGroupForUser, startGroupForUser } from '@services/groups.service';
import { joinGroupForUser, leaveGroupForUser } from '@services/groupMembership.service';
import { getHizbState, getHizbAssignment, openHizbAhead, updateHizbAssignment } from '@services/hizbReading.service';
import { requestReadingHelp, listReadingHelp, actOnReadingHelp } from '@services/readingHelp.service';
import { getMyProgressForUser } from '@services/roundHistory.service';
import { getProfileStatsForUser } from '@services/profile.service';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';
vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));
assertIsTestDatabase(testDatabaseUrl());
const start = new Date('2026-10-01T10:00:00Z');
const setup = async (hizb: boolean) => {
	const g = await createGroupForUser(
		'owner',
		'Owner',
		CreateGroupBodySchema.parse({
			name: 'Help',
			kind: hizb ? 'HIZB' : 'CEVSEN',
			...(hizb ? { hizbPlan: 32 } : {}),
			splitMode: 'FIXED',
			spots: 20,
			visibility: 'OPEN',
			cycle: 'DAILY',
			reminderTime: '21:00',
			timezone: 'Europe/Amsterdam'
		})
	);
	await joinGroupForUser('helper', 'Helper', g.id);
	await joinGroupForUser('other', 'Other', g.id);
	if (!hizb) {
		await startGroupForUser('owner', g.id);
	}
	return g;
};
beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(start);
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});
afterAll(async () => {
	vi.useRealTimers();
	await prisma.$disconnect();
});
it.each([false, true])('claims without completing and signs off the original reading (Hizb=%s)', async hizb => {
	const g = await setup(hizb);
	const a = hizb ? (await getHizbState('owner', g.id)).today! : null;
	const input = a ? { assignmentId: a.id } : { roundIndex: 0 };
	const request = await requestReadingHelp('owner', g.id, input);
	expect((await requestReadingHelp('owner', g.id, input)).id).toBe(request.id);
	const results = await Promise.allSettled(
		['helper', 'other'].map(u => actOnReadingHelp(u, g.id, request.id, 'claim', request.version))
	);
	expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
	const winner = results[0].status === 'fulfilled' ? 'helper' : 'other';
	const claimed = (await listReadingHelp(winner, g.id)).find(r => r.id === request.id)!;
	expect(claimed.completed).toBe(false);
	expect(claimed.takenByMe).toBe(true);
	await expect(actOnReadingHelp('owner', g.id, request.id, 'complete', claimed.version)).rejects.toThrow();
	await actOnReadingHelp(winner, g.id, request.id, 'complete', claimed.version);
	const done = (await listReadingHelp('owner', g.id)).find(r => r.id === request.id)!;
	expect(done.completed).toBe(true);
	if (a) {
		const state = await getHizbState('owner', g.id);
		expect(state.today!.completedAt).not.toBeNull();
		expect(state.today!.id).toBe(a.id);
		expect(state.members.find(m => m.id === state.enrollment!.id)!.completed).toBe(true);
		expect((await getProfileStatsForUser(winner)).streakDays).toBe(1);
		expect((await getProfileStatsForUser('owner')).streakDays).toBe(0);
	} else {
		expect(
			await prisma.groupBab.count({
				where: { groupId: g.id, number: { in: request.babNumbers }, readAt: { not: null } }
			})
		).toBe(5);
		expect(await prisma.babRead.count({ where: { groupId: g.id, userId: winner, roundIndex: 0 } })).toBe(5);
	}
});
it.each([false, true])('catches up the requested day without marking today (Hizb=%s)', async hizb => {
	const g = await setup(hizb);
	const a = hizb ? (await getHizbState('owner', g.id)).today! : null;
	vi.setSystemTime(new Date(start.getTime() + 86400000));
	const request = await requestReadingHelp('owner', g.id, a ? { assignmentId: a.id } : { roundIndex: 0 });
	await actOnReadingHelp('helper', g.id, request.id, 'claim', request.version);
	await actOnReadingHelp('helper', g.id, request.id, 'complete', request.version + 1);
	if (a) {
		const state = await getHizbState('owner', g.id);
		expect(state.missedCount).toBe(0);
		expect(state.today!.completedAt).toBeNull();
	} else {
		expect((await getMyProgressForUser('owner', g.id)).missedCount).toBe(0);
		expect(await prisma.groupBab.count({ where: { groupId: g.id, readAt: { not: null } } })).toBe(0);
	}
});
it('only authorizes the current helper in the Hizb reader and revokes access on cancel', async () => {
	const g = await setup(true);
	const a = (await getHizbState('owner', g.id)).today!;
	await expect(getHizbAssignment('helper', g.id, a.id)).rejects.toThrow();
	const r = await requestReadingHelp('owner', g.id, { assignmentId: a.id });
	await actOnReadingHelp('helper', g.id, r.id, 'claim', r.version);
	const claimed = await getHizbAssignment('helper', g.id, a.id);
	expect(claimed.canEdit).toBe(true);
	await expect(
		updateHizbAssignment('owner', g.id, a.id, { version: claimed.version, read: true, istighfarRepetitions: 11 })
	).rejects.toThrow();
	await actOnReadingHelp('owner', g.id, r.id, 'cancel', r.version + 1);
	await expect(
		updateHizbAssignment('helper', g.id, a.id, { version: claimed.version, read: true, istighfarRepetitions: 11 })
	).rejects.toThrow();
});
it('rejects outsiders, wrong-group ids, future rounds, and requesting another person’s assignment', async () => {
	const g = await setup(true);
	const a = (await getHizbState('owner', g.id)).today!;
	await expect(requestReadingHelp('helper', g.id, { assignmentId: a.id })).rejects.toThrow();
	await expect(requestReadingHelp('outsider', g.id, { assignmentId: a.id })).rejects.toThrow();
	const r = await requestReadingHelp('owner', g.id, { assignmentId: a.id });
	await expect(actOnReadingHelp('outsider', g.id, r.id, 'claim', 0)).rejects.toThrow();
	await expect(actOnReadingHelp('helper', 'wrong-group', r.id, 'claim', 0)).rejects.toThrow();
	const c = await setup(false);
	await expect(requestReadingHelp('owner', c.id, { roundIndex: 99 })).rejects.toThrow();
});
it('releases a helper claim without losing partial reading and hides names in private groups', async () => {
	const g = await setup(true);
	const a = (await getHizbState('owner', g.id)).today!;
	await prisma.group.update({ where: { id: g.id }, data: { hideMemberNames: true } });
	const r = await requestReadingHelp('owner', g.id, { assignmentId: a.id });
	expect((await listReadingHelp('helper', g.id))[0]!.requesterName).toBeNull();
	await actOnReadingHelp('helper', g.id, r.id, 'claim', 0);
	const claimed = await getHizbAssignment('helper', g.id, a.id);
	await updateHizbAssignment('helper', g.id, a.id, { version: claimed.version, bookmark: 2 });
	await actOnReadingHelp('helper', g.id, r.id, 'release', 1);
	expect((await getHizbAssignment('owner', g.id, a.id)).bookmark).toBe(2);
	await actOnReadingHelp('other', g.id, r.id, 'claim', 2);
	await leaveGroupForUser('other', g.id);
	await expect(actOnReadingHelp('other', g.id, r.id, 'complete', 3)).rejects.toThrow();
	expect((await listReadingHelp('helper', g.id))[0]!.claimed).toBe(false);
});

it('finishes through the ordinary Hizb reader and updates the request without a second confirmation', async () => {
	const g = await setup(true);
	const original = (await getHizbState('owner', g.id)).today!;
	const r = await requestReadingHelp('owner', g.id, { assignmentId: original.id });
	await actOnReadingHelp('helper', g.id, r.id, 'claim', 0);
	const a = await getHizbAssignment('helper', g.id, original.id);
	await expect(updateHizbAssignment('helper', g.id, a.id, { version: a.version, read: true })).rejects.toThrow();
	await updateHizbAssignment('helper', g.id, a.id, { version: a.version, read: true, istighfarRepetitions: 11 });
	expect((await listReadingHelp('owner', g.id))[0]!.completed).toBe(true);
	expect((await getHizbState('owner', g.id)).today!.completedByOther).toBe(true);
});

it('keeps a current Cevsen request on its old round when the helper finishes after midnight', async () => {
	const g = await setup(false);
	const r = await requestReadingHelp('owner', g.id, { roundIndex: 0 });
	await actOnReadingHelp('helper', g.id, r.id, 'claim', 0);
	vi.setSystemTime(new Date(start.getTime() + 86400000));
	await actOnReadingHelp('helper', g.id, r.id, 'complete', 1);
	expect((await getMyProgressForUser('owner', g.id)).missedCount).toBe(0);
	expect(await prisma.groupBab.count({ where: { groupId: g.id, readAt: { not: null } } })).toBe(0);
	expect(await prisma.babRead.count({ where: { groupId: g.id, roundIndex: 0, userId: 'helper' } })).toBe(5);
});

it('preserves existing Cevsen reads and updates group completion exactly once', async () => {
	const g = await setup(false);
	const r = await requestReadingHelp('owner', g.id, { roundIndex: 0 });
	await actOnReadingHelp('helper', g.id, r.id, 'claim', 0);
	const otherNumbers = Array.from({ length: 99 }, (_, i) => i + 2);
	await prisma.groupBab.updateMany({
		where: { groupId: g.id, number: { in: otherNumbers } },
		data: { readAt: start, readByUserId: 'other' }
	});
	await prisma.babRead.createMany({
		data: otherNumbers.map(babNumber => ({ groupId: g.id, roundIndex: 0, babNumber, userId: 'other' }))
	});
	await actOnReadingHelp('helper', g.id, r.id, 'complete', 1);
	expect((await prisma.group.findUniqueOrThrow({ where: { id: g.id } })).completedAt).not.toBeNull();
	expect(await prisma.babRead.count({ where: { groupId: g.id, userId: 'helper' } })).toBe(1);
	expect(await prisma.babRead.count({ where: { groupId: g.id, userId: 'other' } })).toBe(99);
	await expect(actOnReadingHelp('helper', g.id, r.id, 'complete', 1)).rejects.toThrow();
});

it('rejects individual readings, future assignments, completed readings and self-claims', async () => {
	const g = await setup(true);
	const state = await getHizbState('owner', g.id);
	const a = state.today!;
	const r = await requestReadingHelp('owner', g.id, { assignmentId: a.id });
	await expect(actOnReadingHelp('owner', g.id, r.id, 'claim', 0)).rejects.toThrow();
	await updateHizbAssignment('owner', g.id, a.id, { version: a.version, read: true, istighfarRepetitions: 11 });
	await expect(requestReadingHelp('owner', g.id, { assignmentId: a.id })).rejects.toThrow();
	const future = await openHizbAhead('owner', g.id);
	await expect(requestReadingHelp('owner', g.id, { assignmentId: future.id })).rejects.toThrow();
	const personal = await createGroupForUser(
		'owner',
		'Owner',
		CreateGroupBodySchema.parse({
			name: 'Private',
			kind: 'HIZB',
			hizbPlan: 32,
			hizbIndividual: true,
			reminderTime: '21:00'
		})
	);
	await expect(listReadingHelp('owner', personal.id)).rejects.toThrow();
});

it('creates a fresh request for extra pool passages without changing a completed commitment', async () => {
	const { takePoolSlotForUser } = await import('@services/pool.service');
	const g = await setup(false);
	const first = await requestReadingHelp('owner', g.id, { roundIndex: 0 });
	await actOnReadingHelp('helper', g.id, first.id, 'claim', 0);
	await actOnReadingHelp('helper', g.id, first.id, 'complete', 1);
	await takePoolSlotForUser('owner', g.id, 3);
	const extra = await requestReadingHelp('owner', g.id, { roundIndex: 0 });
	expect(extra.id).not.toBe(first.id);
	expect(extra.babNumbers).toEqual([16, 17, 18, 19, 20]);
	expect(extra.completed).toBe(false);
	const requests = await listReadingHelp('owner', g.id);
	expect(requests.find(r => r.id === first.id)!.babNumbers).toEqual([1, 2, 3, 4, 5]);
	expect(requests.find(r => r.id === first.id)!.completed).toBe(true);
});

it('lets a helper finish a reading, then not change or undo it', async () => {
	const g = await setup(true);
	const a = (await getHizbState('owner', g.id)).today!;
	const r = await requestReadingHelp('owner', g.id, { assignmentId: a.id });
	await actOnReadingHelp('helper', g.id, r.id, 'claim', 0);
	await actOnReadingHelp('helper', g.id, r.id, 'complete', 1);
	const completed = await getHizbAssignment('helper', g.id, a.id);
	expect(completed.canEdit).toBe(false);
	await expect(
		updateHizbAssignment('helper', g.id, a.id, { version: completed.version, read: false })
	).rejects.toThrow('This reading is already complete');
	await expect(
		updateHizbAssignment('helper', g.id, a.id, { version: completed.version, bookmark: 3 })
	).rejects.toThrow('This reading is already complete');
	expect((await getHizbAssignment('owner', g.id, a.id)).completedAt).not.toBeNull();
	const active = await prisma.hizbEnrollment.findFirstOrThrow({
		where: { groupId: g.id, userId: 'helper', endDay: null }
	});
	expect(active.lastReadDay).toBe(a.day);
});

it('refuses help where a share is not seat arithmetic: a flexible group and a hatim', async () => {
	const g = await setup(false);
	for (const shape of [{ splitMode: 'FLEXIBLE' as const }, { kind: 'HATIM' as const }]) {
		// Neither shape is creatable alongside the others here, so the row is moved onto it directly.
		await prisma.group.update({ where: { id: g.id }, data: shape });
		await expect(requestReadingHelp('owner', g.id, { roundIndex: 0 })).rejects.toThrow(
			'Help is available in Cevşen and Hizb groups'
		);
		await expect(listReadingHelp('owner', g.id)).rejects.toThrow('Help is available in Cevşen and Hizb groups');
		await prisma.group.update({ where: { id: g.id }, data: { splitMode: 'FIXED', kind: 'CEVSEN' } });
	}
});
