import prisma from '@db/prisma';
import { setBabReadForUser } from '@services/babs.service';
import { listPoolCuzForUser, takePoolCuzForUser } from '@services/cuzPool.service';
import { toGroupSummary } from '@services/groupSerializers';
import { ensureCurrentRound } from '@services/rounds.service';
import { holdingsFor } from '@services/unitPlan';
import { civilDayNumber, DEFAULT_TIME_ZONE, startOfCivilDay } from '@utils/rounds';
import { CUZ_COUNT } from '@utils/units';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const READER = 'test_reader';

const daysAgo = (days: number): Date =>
	startOfCivilDay(civilDayNumber(new Date(), DEFAULT_TIME_ZONE) - days, DEFAULT_TIME_ZONE);

/**
 * **`isLoan`, end to end — the whole life of a borrowed cüz.**
 *
 * The unit tests beside this pin each rule on its own. This one walks a member through the
 * thing the flag exists for: they joined with one cüz, borrow another out of the havuz, read
 * both, and the round rolls. What must be true afterwards, under each policy, is the whole
 * meaning of "a loan": the cüz they joined with follows `boundaryPolicy`; the one they
 * borrowed goes back to the havuz regardless; and nothing they read is lost from the record.
 */
const createHatim = async (boundaryPolicy: 'KEEP' | 'REPICK') => {
	const startedAt = daysAgo(0);
	const group = await prisma.group.create({
		data: {
			boundaryPolicy,
			cycle: 'WEEKLY',
			distribution: 'FREE_PICK',
			inviteCode: `L${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind: 'HATIM',
			name: 'Loan Hatmi',
			ownerUserId: OWNER,
			roundDays: 7,
			roundIndex: 0,
			roundStartedAt: startedAt,
			spots: CUZ_COUNT,
			splitMode: 'FIXED',
			startedAt,
			startsAt: startedAt,
			status: 'RUNNING',
			timezone: DEFAULT_TIME_ZONE,
			visibility: 'OPEN'
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: CUZ_COUNT }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});
	await prisma.groupMember.createMany({
		data: [
			{ displayName: 'Owner', groupId: group.id, role: 'OWNER', slotIndex: 0, userId: OWNER },
			{ displayName: 'Reader', groupId: group.id, role: 'MEMBER', slotIndex: 1, userId: READER }
		]
	});
	// What each joined with — written the way `performJoin` writes it, with `isLoan` left to
	// its default. That default being `false` is itself part of what this proves.
	await prisma.cuzHolding.createMany({
		data: [
			{ cuzNumber: 1, groupId: group.id, roundIndex: 0, userId: OWNER },
			{ cuzNumber: 7, groupId: group.id, roundIndex: 0, userId: READER }
		]
	});

	return group;
};

/** Ages the group past one boundary and rolls it, the way the first request after would. */
const rollOnce = async (groupId: string) => {
	await prisma.group.update({ data: { roundStartedAt: daysAgo(8), startedAt: daysAgo(8) }, where: { id: groupId } });
	await prisma.$transaction(tx => ensureCurrentRound(tx, groupId));

	return prisma.group.findUniqueOrThrow({ include: { babs: true, members: true }, where: { id: groupId } });
};

beforeEach(async () => {
	await prisma.babRead.deleteMany();
	await prisma.cuzHolding.deleteMany();
	await prisma.groupMember.deleteMany();
	await prisma.groupBab.deleteMany();
	await prisma.group.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('a borrowed cüz, start to finish', () => {
	it('joined with 7, borrows 22, reads both — under KEEP only 7 survives the boundary', async () => {
		const group = await createHatim('KEEP');

		await takePoolCuzForUser(READER, group.id, 22);

		// Both readable: the one they joined with and the one they borrowed. This is the read
		// path answering through the seam — before it, "Okudum" on a held cüz was refused.
		await setBabReadForUser(READER, group.id, 7, true);
		await setBabReadForUser(READER, group.id, 22, true);

		const before = await prisma.group.findUniqueOrThrow({
			include: { babs: true, members: true },
			where: { id: group.id }
		});
		const summaryBefore = toGroupSummary(
			before,
			before.babs,
			before.members,
			READER,
			await holdingsFor(prisma, before, before.roundIndex)
		);

		// While the round is open the loan is theirs in every way that shows: in their share,
		// off the havuz, and counted as read.
		expect([...summaryBefore.myBabNumbers].sort((a, b) => a - b)).toEqual([7, 22]);
		expect(summaryBefore.myReadCount).toBe(2);
		expect(summaryBefore.poolBabNumbers).not.toContain(22);

		const after = await rollOnce(group.id);
		const held = await holdingsFor(prisma, after, after.roundIndex);
		const summaryAfter = toGroupSummary(after, after.babs, after.members, READER, held);

		expect(after.roundIndex).toBe(1);
		// The joined cüz followed the policy; the loan did not.
		expect(held.map(holding => holding.cuzNumber).sort((a, b) => a - b)).toEqual([1, 7]);
		expect(summaryAfter.myBabNumbers).toEqual([7]);
		// Back in the havuz, on offer again.
		expect(summaryAfter.poolBabNumbers).toContain(22);
		expect(
			(await listPoolCuzForUser(READER, group.id)).find(cuz => cuz.cuzNumber === 22)?.takenByUserId
		).toBeNull();
		// The board is a fresh round; the record is not. Both reads stand in `BabRead`.
		expect(summaryAfter.myReadCount).toBe(0);
		expect(await prisma.babRead.count({ where: { groupId: group.id, roundIndex: 0, userId: READER } })).toBe(2);
	});

	it('under REPICK nothing survives — joined and borrowed alike go back', async () => {
		const group = await createHatim('REPICK');

		await takePoolCuzForUser(READER, group.id, 22);
		await setBabReadForUser(READER, group.id, 22, true);

		const after = await rollOnce(group.id);
		const held = await holdingsFor(prisma, after, after.roundIndex);
		const summaryAfter = toGroupSummary(after, after.babs, after.members, READER, held);

		expect(held).toEqual([]);
		expect(summaryAfter.myBabNumbers).toEqual([]);
		expect(summaryAfter.poolBabNumbers).toHaveLength(CUZ_COUNT);
		// Still on the record, whichever policy: a repick forgets nothing, it starts over.
		expect(await prisma.babRead.count({ where: { babNumber: 22, groupId: group.id, roundIndex: 0 } })).toBe(1);
	});

	it('a free cüz cannot be marked read without borrowing it first', async () => {
		// A Cevşen pool bab carries a claim the write checks; a free cüz carries nothing, so
		// the havuz is not a back door around "Üstlen".
		const group = await createHatim('KEEP');

		await expect(setBabReadForUser(READER, group.id, 22, true)).rejects.toThrow(/not yours to mark/i);
	});

	it('the cüz somebody else joined with is not yours to mark either', async () => {
		const group = await createHatim('KEEP');

		await expect(setBabReadForUser(READER, group.id, 1, true)).rejects.toThrow(/not yours to mark/i);
	});
});
