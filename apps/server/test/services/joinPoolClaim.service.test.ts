import prisma from '@db/prisma';
import { joinGroupForUser } from '@services/groupMembership.service';
import { markPoolReleasesSeenForUser } from '@services/pool.service';
import { babNumbersForRound } from '@utils/babs';
import { DEFAULT_TIME_ZONE, ROUND_DAYS, roundEndsAt, roundStartedAtFor } from '@utils/rounds';
import { civilDayNumber, startOfCivilDay } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
/** The member who volunteered for an empty seat's block out of the pool. */
const VOLUNTEER = 'test_volunteer';
const JOINER = 'test_joiner';

const SPOTS = 6;
const ROUND_INDEX = 2;

/**
 * Seats 0-2 are taken and 3-5 are empty. At round 2 the rotation has seat 3 reading block
 * 5, so the pool block the joiner will be handed is 85-100 — deliberately *not* seat 3's
 * standing block, so a fix that released the wrong one would fail here.
 */
const JOINED_SLOT = 3;
const UNTOUCHED_SLOT = 5;

const daysAgo = (days: number): Date => {
	const today = civilDayNumber(new Date(), DEFAULT_TIME_ZONE);

	return new Date(startOfCivilDay(today - days, DEFAULT_TIME_ZONE).getTime() + 12 * 60 * 60 * 1000);
};

const blockFor = (slotIndex: number) => babNumbersForRound(slotIndex, SPOTS, ROUND_INDEX);

/** A running group with three members, three empty seats, and two claimed pool blocks. */
const createGroup = async ({ readBabs = [] }: { readBabs?: number[] } = {}) => {
	const startedAt = daysAgo(ROUND_INDEX);
	const roundStartedAt = roundStartedAtFor(startedAt, ROUND_DAYS.DAILY, ROUND_INDEX, DEFAULT_TIME_ZONE);
	const claimed = new Set([...blockFor(JOINED_SLOT), ...blockFor(UNTOUCHED_SLOT)]);

	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: 'Pool Claim Hatmi',
			inviteCode: `P${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			spots: SPOTS,
			cycle: 'DAILY',
			roundDays: 1,
			timezone: DEFAULT_TIME_ZONE,
			splitMode: 'ROTATION',
			status: 'RUNNING',
			startedAt,
			roundIndex: ROUND_INDEX,
			roundStartedAt,
			endsAt: roundEndsAt(roundStartedAt, 1, DEFAULT_TIME_ZONE),
			members: {
				create: [
					{ userId: OWNER, displayName: 'Owner', role: 'OWNER', slotIndex: 0 },
					{ userId: VOLUNTEER, displayName: 'Volunteer', role: 'MEMBER', slotIndex: 1 },
					{ userId: 'test_third', displayName: 'Third', role: 'MEMBER', slotIndex: 2 }
				]
			}
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: 100 }, (_, index) => {
			const number = index + 1;
			const isRead = readBabs.includes(number);

			return {
				groupId: group.id,
				number,
				assignedUserId: claimed.has(number) ? VOLUNTEER : null,
				readByUserId: isRead ? VOLUNTEER : null,
				readAt: isRead ? new Date() : null
			};
		})
	});

	if (readBabs.length > 0) {
		await prisma.babRead.createMany({
			data: readBabs.map(babNumber => ({
				groupId: group.id,
				babNumber,
				userId: VOLUNTEER,
				roundIndex: ROUND_INDEX
			}))
		});
	}

	return group;
};

const assignedIn = async (groupId: string, numbers: number[]) =>
	prisma.groupBab.count({ where: { groupId, number: { in: numbers }, assignedUserId: { not: null } } });

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('joining a seat somebody had covered from the pool', () => {
	it('takes the seat whose block was claimed', async () => {
		const group = await createGroup();

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		const member = await prisma.groupMember.findFirstOrThrow({ where: { groupId: group.id, userId: JOINER } });

		expect(member.slotIndex).toBe(JOINED_SLOT);
	});

	it('releases the volunteer’s claim on that seat’s block', async () => {
		const group = await createGroup();

		expect(await assignedIn(group.id, blockFor(JOINED_SLOT))).toBe(blockFor(JOINED_SLOT).length);

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		// Left standing, this claim strands the volunteer: the block stops being pool once the
		// seat is filled and was never their own seat's, so they could no longer mark babs
		// their own share was still listing.
		expect(await assignedIn(group.id, blockFor(JOINED_SLOT))).toBe(0);
	});

	it('leaves claims on the other empty seats alone', async () => {
		const group = await createGroup();

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		expect(await assignedIn(group.id, blockFor(UNTOUCHED_SLOT))).toBe(blockFor(UNTOUCHED_SLOT).length);
	});

	it('records the release against the volunteer, not the joiner', async () => {
		const group = await createGroup();
		const block = blockFor(JOINED_SLOT);

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		const release = await prisma.poolClaimRelease.findFirstOrThrow({ where: { groupId: group.id } });

		// The push may never arrive — denied permission, no token, phone off. This row is what
		// the volunteer still finds, and the only record the claim existed at all.
		expect(release.userId).toBe(VOLUNTEER);
		expect(release.roundIndex).toBe(ROUND_INDEX);
		expect(release.startBab).toBe(block[0]);
		expect(release.endBab).toBe(block[block.length - 1]);
		expect(release.seenAt).toBeNull();
	});

	it('records nothing when the seat was not covered', async () => {
		const group = await createGroup();

		await prisma.groupBab.updateMany({
			where: { groupId: group.id, number: { in: blockFor(JOINED_SLOT) } },
			data: { assignedUserId: null }
		});

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		expect(await prisma.poolClaimRelease.count({ where: { groupId: group.id } })).toBe(0);
	});

	it('marks the notices seen without deleting them', async () => {
		const group = await createGroup();

		await joinGroupForUser(JOINER, 'Joiner', group.id);
		await markPoolReleasesSeenForUser(VOLUNTEER, group.id);

		const release = await prisma.poolClaimRelease.findFirstOrThrow({ where: { groupId: group.id } });

		expect(release.seenAt).not.toBeNull();
	});

	it('leaves another member’s notices alone', async () => {
		const group = await createGroup();

		await joinGroupForUser(JOINER, 'Joiner', group.id);
		await markPoolReleasesSeenForUser(OWNER, group.id);

		const release = await prisma.poolClaimRelease.findFirstOrThrow({ where: { groupId: group.id } });

		expect(release.seenAt).toBeNull();
	});

	it('keeps the reads the volunteer already made, on the board and in the record', async () => {
		const covered = blockFor(JOINED_SLOT).slice(0, 3);
		const group = await createGroup({ readBabs: covered });

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		const stillRead = await prisma.groupBab.findMany({
			where: { groupId: group.id, number: { in: covered } },
			select: { number: true, readByUserId: true }
		});

		expect(stillRead.every(bab => bab.readByUserId === VOLUNTEER)).toBe(true);
		expect(await prisma.babRead.count({ where: { groupId: group.id, userId: VOLUNTEER } })).toBe(covered.length);
	});
});
