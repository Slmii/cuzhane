import prisma from '@db/prisma';
import { toGroupSummary } from '@services/groupSerializers';
import { listGroupsForUser } from '@services/groups.service';
import { BAB_COUNT, babNumbersForRound } from '@utils/babs';
import { DEFAULT_TIME_ZONE, roundEndsAt } from '@utils/rounds';
import { CUZ_COUNT } from '@utils/units';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const READER = 'test_reader';
/** Not a member at all, so there is no share to have finished. */
const STRANGER = 'test_stranger';
const SPOTS = 2;

/**
 * A running group in round 0, every unit unread: Cevşen with two seats (or `spots`), or a hatim.
 * The owner sits in seat 0 and the reader in seat 1; any further seats are left empty.
 */
const createGroup = async ({ kind = 'CEVSEN', spots = SPOTS }: { kind?: 'CEVSEN' | 'HATIM'; spots?: number } = {}) => {
	const startedAt = new Date();

	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: 'Bitiş Hatmi',
			inviteCode: `D${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind,
			spots,
			cycle: 'DAILY',
			roundDays: 1,
			timezone: DEFAULT_TIME_ZONE,
			splitMode: 'FIXED',
			status: 'RUNNING',
			startedAt,
			roundIndex: 0,
			roundStartedAt: startedAt,
			endsAt: roundEndsAt(startedAt, 1, 0, DEFAULT_TIME_ZONE),
			members: {
				create: [
					{ userId: OWNER, displayName: 'Owner', role: 'OWNER', slotIndex: 0 },
					{ userId: READER, displayName: 'Reader', role: 'MEMBER', slotIndex: 1 }
				]
			}
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: kind === 'HATIM' ? CUZ_COUNT : 100 }, (_, index) => ({
			groupId: group.id,
			number: index + 1
		}))
	});

	return group;
};

const markRead = (groupId: string, numbers: number[], readAt: Date) =>
	prisma.groupBab.updateMany({
		data: { readAt, readByUserId: READER },
		where: { groupId, number: { in: numbers } }
	});

const summaryFor = async (groupId: string, viewer: string) => {
	const group = await prisma.group.findUniqueOrThrow({
		include: { babs: true, members: true },
		where: { id: groupId }
	});
	const holdings = await prisma.cuzHolding.findMany({ where: { groupId, roundIndex: 0 } });

	return toGroupSummary(group, group.babs, group.members, viewer, holdings);
};

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('myShareDoneAt', () => {
	it('is null while any of the share is unread', async () => {
		const group = await createGroup();
		const share = babNumbersForRound(1, SPOTS, 0, BAB_COUNT);

		await markRead(group.id, share.slice(0, -1), new Date('2026-09-25T07:12:00Z'));

		expect((await summaryFor(group.id, READER)).myShareDoneAt).toBeNull();
	});

	it('is the latest read once the whole share is read', async () => {
		const group = await createGroup();
		const share = babNumbersForRound(1, SPOTS, 0, BAB_COUNT);
		const last = new Date('2026-09-25T13:40:00Z');

		await markRead(group.id, share.slice(0, -1), new Date('2026-09-25T07:12:00Z'));
		await markRead(group.id, share.slice(-1), last);

		expect((await summaryFor(group.id, READER)).myShareDoneAt).toBe(last.toISOString());
	});

	it('counts a pool block the viewer took, not only their seat', async () => {
		// Three seats, the third empty: its block is the pool, and the reader has taken it.
		const group = await createGroup({ spots: 3 });
		const seat = babNumbersForRound(1, 3, 0, BAB_COUNT);
		const pool = babNumbersForRound(2, 3, 0, BAB_COUNT);
		const last = new Date('2026-09-25T13:40:00Z');

		await prisma.groupBab.updateMany({
			data: { assignedUserId: READER },
			where: { groupId: group.id, number: { in: pool } }
		});
		await markRead(group.id, seat, new Date('2026-09-25T07:12:00Z'));

		expect((await summaryFor(group.id, READER)).myShareDoneAt).toBeNull();

		await markRead(group.id, pool, last);

		expect((await summaryFor(group.id, READER)).myShareDoneAt).toBe(last.toISOString());
	});

	it('follows the cüz a hatim member holds', async () => {
		const group = await createGroup({ kind: 'HATIM', spots: CUZ_COUNT });
		const last = new Date('2026-09-25T22:31:00Z');

		await prisma.cuzHolding.createMany({
			data: [7, 22].map(cuzNumber => ({ cuzNumber, groupId: group.id, roundIndex: 0, userId: READER }))
		});
		await markRead(group.id, [7], new Date('2026-09-25T07:12:00Z'));

		expect((await summaryFor(group.id, READER)).myShareDoneAt).toBeNull();

		await markRead(group.id, [22], last);

		expect((await summaryFor(group.id, READER)).myShareDoneAt).toBe(last.toISOString());
	});

	it('asks a hatim member holding nothing to pick, unless they sit the round out', async () => {
		const group = await createGroup({ kind: 'HATIM', spots: CUZ_COUNT });

		expect((await summaryFor(group.id, READER)).mustPickCuz).toBe(true);

		// Through the list the viewer actually loads, which is where the skip is looked up.
		await prisma.cuzRoundSkip.create({ data: { groupId: group.id, roundIndex: 0, userId: READER } });
		const listed = (await listGroupsForUser(READER)).find(summary => summary.id === group.id);

		expect(listed?.mustPickCuz).toBe(false);
	});

	it('never asks a Cevşen member, or someone outside the group, to pick', async () => {
		const cevsen = await createGroup();
		const hatim = await createGroup({ kind: 'HATIM', spots: CUZ_COUNT });

		expect((await summaryFor(cevsen.id, READER)).mustPickCuz).toBe(false);
		expect((await summaryFor(hatim.id, STRANGER)).mustPickCuz).toBe(false);
	});

	it('is null for a viewer with no share', async () => {
		const group = await createGroup();

		await markRead(group.id, babNumbersForRound(1, SPOTS, 0, BAB_COUNT), new Date('2026-09-25T07:12:00Z'));

		expect((await summaryFor(group.id, STRANGER)).myShareDoneAt).toBeNull();
	});
});
