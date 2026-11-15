import prisma from '@db/prisma';
import { setBabReadForUser } from '@services/babs.service';
import { createGroupForUser, startGroupForUser } from '@services/groups.service';
import { joinGroupForUser } from '@services/groupMembership.service';
import { listPoolSlotsForUser, takePoolSlotForUser } from '@services/pool.service';
import { sendPushToUser } from '@services/push.service';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
// Asserted on, not delivered: nobody here has a device.
vi.mock('@services/push.service', () => ({ sendPushToUser: vi.fn(async () => 0) }));

const OWNER = 'inv_owner';
const MEMBER = 'inv_member';
const THIRD = 'inv_third';
/** The other two seats of a full five-seat group. */
const REST = ['inv_fourth', 'inv_fifth'];
/** The last bab of the owner's share (seat 0, 1–20) and of the member's (seat 1, 21–40). */
const OWNER_LAST = 20;
const MEMBER_LAST = 40;

/** A Cevşen group on fixed shares: five seats of twenty babs each. */
const createCevsen = async (spots: number) =>
	createGroupForUser(
		OWNER,
		'Owner',
		CreateGroupBodySchema.parse({
			name: 'Invariants',
			kind: 'CEVSEN',
			spots,
			cycle: 'DAILY',
			splitMode: 'FIXED',
			visibility: 'OPEN',
			reminderTime: '21:00',
			timezone: 'Europe/Istanbul'
		})
	);

/** Everyone gets a settings row, so the opt-in and opt-out switches have something to read. */
const withSettings = (userIds: string[], data: { cevsenGroupReadsEnabled?: boolean } = {}) =>
	prisma.userSettings.createMany({ data: userIds.map(userId => ({ userId, ...data })), skipDuplicates: true });

/**
 * A full, running five-seat group read in full except for the owner's last bab and the member's.
 * Everything else is marked read by whoever holds it — the board is what `syncCompletedAt` counts.
 */
const nearlyFinished = async () => {
	const group = await createCevsen(5);
	for (const userId of [MEMBER, THIRD, ...REST]) {
		await joinGroupForUser(userId, userId, group.id);
	}
	const running = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
	if (running.status !== 'RUNNING') {
		await startGroupForUser(OWNER, group.id);
	}
	await prisma.groupBab.updateMany({
		where: { groupId: group.id, number: { notIn: [OWNER_LAST, MEMBER_LAST] } },
		data: { readByUserId: THIRD, readAt: new Date() }
	});

	return group;
};

const pushesOfKind = (kind: string) =>
	vi
		.mocked(sendPushToUser)
		.mock.calls.filter(([, message]) => (message as { data?: { kind?: string } }).data?.kind === kind);

beforeEach(async () => {
	// Noon in Istanbul, frozen: a run that crossed the group's midnight would roll the round over and
	// clear the nearly-finished board before the assertions. Only `Date` is faked, so the concurrent
	// writes below still run for real.
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-01T09:00:00Z'));
	vi.mocked(sendPushToUser).mockClear();
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
	await prisma.userSettings.deleteMany({ where: { userId: { in: [OWNER, MEMBER, THIRD, ...REST] } } });
});

afterAll(async () => {
	vi.useRealTimers();
	await prisma.$disconnect();
});

describe('Cevşen invariants', () => {
	it('stamps completedAt exactly once when the last two babs are read at the same moment', async () => {
		await withSettings([OWNER, MEMBER]);

		// Repeated: a missing lock loses this race only some of the time.
		for (let attempt = 0; attempt < 5; attempt++) {
			vi.mocked(sendPushToUser).mockClear();
			const group = await nearlyFinished();

			await Promise.all([
				setBabReadForUser(OWNER, group.id, OWNER_LAST, true),
				setBabReadForUser(MEMBER, group.id, MEMBER_LAST, true)
			]);

			const after = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
			expect(after.completedAt).not.toBeNull();
			expect(await prisma.roundCompleteNotice.count({ where: { groupId: group.id } })).toBe(1);
			// Whoever closed it, the other member hears about it once — never both, never twice.
			expect(pushesOfKind('round-complete')).toHaveLength(1);
		}
	});

	it('does not announce a round twice when its last bab is undone and read again', async () => {
		await withSettings([OWNER, MEMBER]);
		const group = await nearlyFinished();
		await setBabReadForUser(OWNER, group.id, OWNER_LAST, true);
		await setBabReadForUser(MEMBER, group.id, MEMBER_LAST, true);
		expect(pushesOfKind('round-complete')).toHaveLength(1);

		await setBabReadForUser(MEMBER, group.id, MEMBER_LAST, false);
		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).completedAt).toBeNull();

		await setBabReadForUser(MEMBER, group.id, MEMBER_LAST, true);
		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).completedAt).not.toBeNull();
		expect(pushesOfKind('round-complete')).toHaveLength(1);
	});

	it('tells the group a share is finished once per round, and only those who opted in', async () => {
		await withSettings([OWNER]);
		await withSettings([MEMBER], { cevsenGroupReadsEnabled: true });
		const group = await nearlyFinished();

		await setBabReadForUser(OWNER, group.id, OWNER_LAST, true);
		expect(pushesOfKind('group-read').map(([userId]) => userId)).toEqual([MEMBER]);

		// Undo and finish again: the same share, the same round — no second buzz.
		await setBabReadForUser(OWNER, group.id, OWNER_LAST, false);
		await setBabReadForUser(OWNER, group.id, OWNER_LAST, true);
		expect(pushesOfKind('group-read')).toHaveLength(1);
	});

	it('gives an empty seat’s pool block to exactly one of two members who take it at once', async () => {
		// Three of five seats taken: two blocks go to the pool.
		const group = await createCevsen(5);
		await joinGroupForUser(MEMBER, 'Member', group.id);
		await joinGroupForUser(THIRD, 'Third', group.id);
		await startGroupForUser(OWNER, group.id);
		const [slot] = await listPoolSlotsForUser(OWNER, group.id);
		expect(slot).toBeDefined();

		const results = await Promise.allSettled([
			takePoolSlotForUser(OWNER, group.id, slot!.slotIndex),
			takePoolSlotForUser(MEMBER, group.id, slot!.slotIndex)
		]);

		expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
		expect(results.find(result => result.status === 'rejected')).toMatchObject({
			reason: { statusCode: 409 }
		});
		const holders = await prisma.groupBab.findMany({
			where: { groupId: group.id, assignedUserId: { not: null } },
			select: { assignedUserId: true }
		});
		expect(holders.length).toBeGreaterThan(0);
		expect(new Set(holders.map(bab => bab.assignedUserId)).size).toBe(1);
	});
});
