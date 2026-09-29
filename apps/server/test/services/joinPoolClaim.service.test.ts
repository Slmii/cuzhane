import prisma from '@db/prisma';
import { joinGroupForUser } from '@services/groupMembership.service';
import { markPoolReleasesSeenForUser } from '@services/pool.service';
import { sendPushToUser } from '@services/push.service';
import { BAB_COUNT, babNumbersForRound } from '@utils/babs';
import { DEFAULT_TIME_ZONE, roundEndsAt, roundStartedAtFor } from '@utils/rounds';
import { civilDayNumber, startOfCivilDay } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

/*
 * The push is asserted on rather than delivered: nobody here has a token, so the real sender
 * would return before composing anything worth checking. The copy it is handed is the point.
 */
vi.mock('@services/push.service', async () => {
	const actual = await vi.importActual<typeof import('@services/push.service')>('@services/push.service');

	return { ...actual, sendPushToUser: vi.fn(async () => 0) };
});

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

const blockFor = (slotIndex: number) => babNumbersForRound(slotIndex, SPOTS, ROUND_INDEX, BAB_COUNT);

/** A running group with three members, three empty seats, and two claimed pool blocks. */
const createGroup = async ({ readBabs = [] }: { readBabs?: number[] } = {}) => {
	const startedAt = daysAgo(ROUND_INDEX);
	const roundStartedAt = roundStartedAtFor(startedAt, 1, ROUND_INDEX, DEFAULT_TIME_ZONE);
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
			endsAt: roundEndsAt(startedAt, 1, ROUND_INDEX, DEFAULT_TIME_ZONE),
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

describe('joining a Hizb seat whose pool block is a single portion', () => {
	/**
	 * Twenty seats over 33 portions: the first thirteen blocks hold two, the last seven one.
	 * Seats 0-2 are taken, so the joiner lands in seat 3 — and at round 10 the rotation has
	 * seat 3 reading block 13, portion 27 alone.
	 */
	const HIZB_SPOTS = 20;
	const HIZB_ROUND = 10;
	const HIZB_PARTS = 33;
	const hizbBlockFor = (slotIndex: number) => babNumbersForRound(slotIndex, HIZB_SPOTS, HIZB_ROUND, HIZB_PARTS);

	const createHizbGroup = async () => {
		const startedAt = daysAgo(HIZB_ROUND);
		const claimed = new Set(hizbBlockFor(JOINED_SLOT));

		const group = await prisma.group.create({
			data: {
				ownerUserId: OWNER,
				name: 'Hizb Halkası',
				inviteCode: `Z${Math.floor(performance.now() * 1000)
					.toString(36)
					.toUpperCase()
					.slice(-7)}`,
				kind: 'HIZB',
				spots: HIZB_SPOTS,
				cycle: 'DAILY',
				timezone: DEFAULT_TIME_ZONE,
				splitMode: 'ROTATION',
				status: 'RUNNING',
				startedAt,
				roundIndex: HIZB_ROUND,
				roundStartedAt: roundStartedAtFor(startedAt, 1, HIZB_ROUND, DEFAULT_TIME_ZONE),
				endsAt: roundEndsAt(startedAt, 1, HIZB_ROUND, DEFAULT_TIME_ZONE),
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
			data: Array.from({ length: HIZB_PARTS }, (_, index) => ({
				groupId: group.id,
				number: index + 1,
				assignedUserId: claimed.has(index + 1) ? VOLUNTEER : null
			}))
		});

		return group;
	};

	it('is the case under test: seat 3’s block this round is one portion', () => {
		expect(hizbBlockFor(JOINED_SLOT)).toEqual([27]);
	});

	it('records the release as that one portion', async () => {
		const group = await createHizbGroup();

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		const release = await prisma.poolClaimRelease.findFirstOrThrow({ where: { groupId: group.id } });

		expect(release.userId).toBe(VOLUNTEER);
		expect(release.startBab).toBe(27);
		expect(release.endBab).toBe(27);
	});

	it('files the inbox row for the volunteer', async () => {
		const group = await createHizbGroup();

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		const rows = await prisma.notification.findMany({
			where: { groupId: group.id, userId: VOLUNTEER, kind: 'POOL_CLAIM_RELEASED' }
		});

		expect(rows).toHaveLength(1);
		expect(rows[0]?.payload).toEqual({ startBab: 27, endBab: 27 });
	});

	it('names the portion in the singular, as a bare number', async () => {
		const group = await createHizbGroup();

		await joinGroupForUser(JOINER, 'Joiner', group.id);

		// No settings row, so the copy is the default English. "Portions 27–27" is the bug.
		expect(sendPushToUser).toHaveBeenCalledWith(
			VOLUNTEER,
			expect.objectContaining({
				title: 'The portion you took was passed on',
				body: "Portion 27 became a new member's share. Anything you already read still counts for you."
			})
		);
	});
});
