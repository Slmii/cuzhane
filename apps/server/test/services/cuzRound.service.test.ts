import prisma from '@db/prisma';
import { pickRoundCuzForUser, skipRoundForUser } from '@services/cuzRound.service';
import { ensureCurrentRound } from '@services/rounds.service';
import { civilDayNumber, DEFAULT_TIME_ZONE, startOfCivilDay } from '@utils/rounds';
import { CUZ_COUNT } from '@utils/units';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const MEMBER = 'test_member';

const daysAgo = (days: number): Date =>
	startOfCivilDay(civilDayNumber(new Date(), DEFAULT_TIME_ZONE) - days, DEFAULT_TIME_ZONE);

/**
 * **The round-start screen (QR1): pick a cüz, or sit the round out.** A member of a running
 * hatim must hold a cüz to open the group; these are the two ways past that — choosing cüz for
 * the round, and skipping it.
 */
const createHatim = async ({
	boundaryPolicy = 'REPICK' as 'KEEP' | 'REPICK',
	kind = 'HATIM' as 'CEVSEN' | 'HATIM',
	maxPerMember = null as number | null,
	ownerCuz = [1] as number[],
	status = 'RUNNING' as 'GATHERING' | 'RUNNING'
} = {}) => {
	const startedAt = daysAgo(0);
	const group = await prisma.group.create({
		data: {
			boundaryPolicy: kind === 'HATIM' ? boundaryPolicy : null,
			cycle: 'WEEKLY',
			distribution: kind === 'HATIM' ? 'FREE_PICK' : null,
			inviteCode: `R${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind,
			maxPerMember,
			name: 'Tur Hatmi',
			ownerUserId: OWNER,
			roundDays: 7,
			roundIndex: 0,
			roundStartedAt: status === 'RUNNING' ? startedAt : null,
			spots: kind === 'HATIM' ? CUZ_COUNT : 10,
			splitMode: kind === 'HATIM' ? 'FIXED' : 'ROTATION',
			startedAt: status === 'RUNNING' ? startedAt : null,
			startsAt: startedAt,
			status,
			timezone: DEFAULT_TIME_ZONE,
			visibility: 'OPEN'
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: kind === 'HATIM' ? CUZ_COUNT : 100 }, (_, index) => ({
			groupId: group.id,
			number: index + 1
		}))
	});
	await prisma.groupMember.createMany({
		data: [
			{
				displayName: 'Owner',
				groupId: group.id,
				joinedAt: startedAt,
				role: 'OWNER',
				slotIndex: 0,
				userId: OWNER
			},
			{
				displayName: 'Member',
				groupId: group.id,
				joinedAt: startedAt,
				role: 'MEMBER',
				slotIndex: 1,
				userId: MEMBER
			}
		]
	});

	if (kind === 'HATIM' && ownerCuz.length > 0) {
		await prisma.cuzHolding.createMany({
			data: ownerCuz.map(cuzNumber => ({ cuzNumber, groupId: group.id, roundIndex: 0, userId: OWNER }))
		});
	}

	return group;
};

const holdingsOf = (groupId: string, userId: string, roundIndex = 0) =>
	prisma.cuzHolding.findMany({
		orderBy: { cuzNumber: 'asc' },
		select: { cuzNumber: true, isLoan: true },
		where: { groupId, roundIndex, userId }
	});

const skipsOf = (groupId: string, userId: string) =>
	prisma.cuzRoundSkip.findMany({ select: { roundIndex: true }, where: { groupId, userId } });

beforeEach(async () => {
	await prisma.cuzRoundSkip.deleteMany();
	await prisma.babRead.deleteMany();
	await prisma.cuzHolding.deleteMany();
	await prisma.groupMember.deleteMany();
	await prisma.groupBab.deleteMany();
	await prisma.group.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('picking cüz for the round', () => {
	it('holds the chosen cüz for this round as the member’s own, not as a loan', async () => {
		const group = await createHatim();

		await pickRoundCuzForUser(MEMBER, group.id, [22, 7, 7]);

		// Deduplicated, and not a loan: a pick is what "Cüzler korunur" carries forward.
		expect(await holdingsOf(group.id, MEMBER)).toEqual([
			{ cuzNumber: 7, isLoan: false },
			{ cuzNumber: 22, isLoan: false }
		]);
	});

	it('takes back a skip made earlier in the same round', async () => {
		const group = await createHatim();

		await skipRoundForUser(MEMBER, group.id);
		await pickRoundCuzForUser(MEMBER, group.id, [5]);

		expect(await skipsOf(group.id, MEMBER)).toEqual([]);
	});

	it('refuses a cüz somebody holds, and takes none of the others with it', async () => {
		const group = await createHatim({ ownerCuz: [1] });

		await expect(pickRoundCuzForUser(MEMBER, group.id, [2, 1])).rejects.toThrow(/already been taken/i);
		expect(await holdingsOf(group.id, MEMBER)).toEqual([]);
	});

	it('counts what the member already holds against the cap', async () => {
		const group = await createHatim({ maxPerMember: 2 });

		await pickRoundCuzForUser(MEMBER, group.id, [3]);

		await expect(pickRoundCuzForUser(MEMBER, group.id, [4, 5])).rejects.toThrow(/at most 2/i);
	});

	it('refuses an empty pick, a Cevşen group and a hatim that has not started', async () => {
		const running = await createHatim();
		const cevsen = await createHatim({ kind: 'CEVSEN' });
		const gathering = await createHatim({ status: 'GATHERING' });

		await expect(pickRoundCuzForUser(MEMBER, running.id, [])).rejects.toThrow(/at least one/i);
		await expect(pickRoundCuzForUser(MEMBER, cevsen.id, [3])).rejects.toThrow(/does not read cüz/i);
		await expect(pickRoundCuzForUser(MEMBER, gathering.id, [3])).rejects.toThrow(/not started/i);
	});
});

describe('skipping the round', () => {
	it('returns the member’s cüz to the havuz and records the skip', async () => {
		const group = await createHatim({ ownerCuz: [1, 2] });

		await skipRoundForUser(OWNER, group.id);

		expect(await holdingsOf(group.id, OWNER)).toEqual([]);
		expect(await skipsOf(group.id, OWNER)).toEqual([{ roundIndex: 0 }]);
	});

	it('is refused once a cüz has been read this round — a read is permanent', async () => {
		const group = await createHatim({ ownerCuz: [1, 2] });

		await prisma.babRead.create({ data: { babNumber: 1, groupId: group.id, roundIndex: 0, userId: OWNER } });

		await expect(skipRoundForUser(OWNER, group.id)).rejects.toThrow(/already read/i);
		expect(await holdingsOf(group.id, OWNER)).toHaveLength(2);
	});

	it('lasts one round: the next one asks again, even when cüz are kept', async () => {
		const group = await createHatim({ boundaryPolicy: 'KEEP', ownerCuz: [1] });

		await skipRoundForUser(OWNER, group.id);

		// Age the group past its first round and let the rollover run.
		await prisma.group.update({
			data: { roundStartedAt: daysAgo(8), startedAt: daysAgo(8) },
			where: { id: group.id }
		});
		await prisma.$transaction(tx => ensureCurrentRound(tx, group.id));

		// Nothing was held in the skipped round, so nothing carried; and the skip was that
		// round's alone.
		expect(await holdingsOf(group.id, OWNER, 1)).toEqual([]);
		expect(await skipsOf(group.id, OWNER)).toEqual([{ roundIndex: 0 }]);
	});
});

describe('a member removed from the group', () => {
	it('cannot pick or skip in it any more', async () => {
		const group = await createHatim();

		await prisma.groupMember.delete({ where: { groupId_userId: { groupId: group.id, userId: MEMBER } } });

		await expect(pickRoundCuzForUser(MEMBER, group.id, [3])).rejects.toThrow();
		await expect(skipRoundForUser(MEMBER, group.id)).rejects.toThrow();
		expect(await holdingsOf(group.id, MEMBER)).toEqual([]);
	});
});
