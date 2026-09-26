import prisma from '@db/prisma';
import { BAB_COUNT, babNumbersForRound } from '@utils/babs';
import {
	coverMissedBabsForUser,
	getMyProgressForUser,
	getRoundDetailForUser,
	listRoundsForUser
} from '@services/roundHistory.service';
import { civilDayNumber, DEFAULT_TIME_ZONE, ROUND_DAYS, startOfCivilDay } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const OTHER = 'test_other';
/** Seat 1's user id, built the same way `createGroup` builds it — a real member. */
const SEAT_ONE = `${OTHER}_1`;
const SPOTS = 10;
const BLOCK = 100 / SPOTS;

const daysAgo = (days: number): Date => {
	const today = civilDayNumber(new Date(), DEFAULT_TIME_ZONE);

	return new Date(startOfCivilDay(today - days, DEFAULT_TIME_ZONE).getTime() + 12 * 60 * 60 * 1000);
};

/**
 * A group started `startedDaysAgo` days ago, sitting on the round that implies with every
 * earlier one closed. `seats` decides which slots have a member — a slot left out is an
 * empty seat, and its block is pool.
 *
 * **`cycle` has to be set here, not patched afterwards.** `roundIndex` is derived from it,
 * and `ensureCurrentRound` only ever rolls *forward* (`target <= roundIndex` is a no-op) — so
 * creating a DAILY group 20 days old and then flipping the column to WEEKLY left it on round
 * 20 with weekly bounds, dating rounds 3–20 up to 140 days into the future. A real 20-day-old
 * WEEKLY group is on round 2, which is the case the strip's eight-column slice has to handle.
 */
const createGroup = async ({
	cycle = 'DAILY' as 'DAILY' | 'WEEKLY',
	startedDaysAgo = 3,
	seats = [0, 1],
	splitMode = 'ROTATION' as 'ROTATION' | 'FIXED'
} = {}) => {
	const startedAt = daysAgo(startedDaysAgo);
	const roundIndex = Math.floor(startedDaysAgo / ROUND_DAYS[cycle]);

	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: 'History Hatmi',
			inviteCode: `H${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			spots: SPOTS,
			cycle,
			splitMode,
			status: 'RUNNING',
			startedAt,
			roundIndex,
			roundStartedAt: startedAt,
			timezone: DEFAULT_TIME_ZONE
		}
	});

	await prisma.groupMember.createMany({
		// `joinedAt` matters: the seats here were in place from the start, as a real owner's
		// row is (written in the group's own transaction). Left at its `now()` default these
		// members would look like they joined today, and anything that floors a window at the
		// round somebody joined in would see no history at all.
		data: seats.map(slotIndex => ({
			groupId: group.id,
			userId: slotIndex === 0 ? OWNER : `${OTHER}_${slotIndex}`,
			displayName: `Seat ${slotIndex}`,
			joinedAt: startedAt,
			role: slotIndex === 0 ? ('OWNER' as const) : ('MEMBER' as const),
			slotIndex
		}))
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: 100 }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});

	return group;
};

const recordHistory = (groupId: string, roundIndex: number, babNumbers: number[], userId = OWNER) =>
	prisma.babRead.createMany({
		data: babNumbers.map(babNumber => ({ babNumber, groupId, roundIndex, userId }))
	});

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('listRoundsForUser', () => {
	it('lists every round newest first and flags only the current one as open', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		const rounds = await listRoundsForUser(OWNER, group.id);

		expect(rounds.map(round => round.roundIndex)).toEqual([3, 2, 1, 0]);
		expect(rounds.filter(round => round.isOpen).map(round => round.roundIndex)).toEqual([3]);
	});

	it('counts a closed round’s misses from the history, not the board', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });
		await recordHistory(group.id, 1, [1, 2, 3, 4, 5]);

		const round1 = (await listRoundsForUser(OWNER, group.id)).find(round => round.roundIndex === 1);

		expect(round1?.readCount).toBe(5);
		expect(round1?.missedCount).toBe(95);
	});

	it('never reports the open round as having missed anything — the day is not over', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		const open = (await listRoundsForUser(OWNER, group.id)).find(round => round.isOpen);

		expect(open?.readCount).toBe(0);
		expect(open?.missedCount).toBe(0);
	});
});

describe('getRoundDetailForUser', () => {
	it('attributes each bab to the seat that owed it in THAT round, not today', async () => {
		const group = await createGroup({ startedDaysAgo: 3, splitMode: 'ROTATION' });

		const round0 = await getRoundDetailForUser(OWNER, group.id, 0);
		const round1 = await getRoundDetailForUser(OWNER, group.id, 1);

		// Seat 0 read block 0 in round 0 and block 1 in round 1, so bab 1 was owed by seat 0
		// in round 0 and by the seat that rotated onto block 0 — seat 9 — in round 1.
		expect(round0.babs[0]?.owedBySlotIndex).toBe(0);
		expect(round1.babs[0]?.owedBySlotIndex).toBe(SPOTS - 1);
		// And the block seat 0 owed in round 1 is the next one along.
		expect(round1.babs[BLOCK]?.owedBySlotIndex).toBe(0);
	});

	it('keeps a FIXED group’s attribution still across rounds', async () => {
		const group = await createGroup({ startedDaysAgo: 3, splitMode: 'FIXED' });

		const round0 = await getRoundDetailForUser(OWNER, group.id, 0);
		const round2 = await getRoundDetailForUser(OWNER, group.id, 2);

		expect(round0.babs[0]?.owedBySlotIndex).toBe(0);
		expect(round2.babs[0]?.owedBySlotIndex).toBe(0);
	});

	it('marks blocks belonging to empty seats as pool, owed by nobody', async () => {
		// Only seats 0 and 1 are filled, so eight blocks have no member behind them.
		const group = await createGroup({ startedDaysAgo: 2, seats: [0, 1] });

		const detail = await getRoundDetailForUser(OWNER, group.id, 0);
		const pool = detail.babs.filter(bab => bab.isPool);

		expect(pool).toHaveLength(100 - 2 * BLOCK);
		expect(pool.every(bab => bab.owedByUserId === null)).toBe(true);
	});

	it('counts people, not babs, for the missed-people stat', async () => {
		const group = await createGroup({ startedDaysAgo: 2, seats: [0, 1] });
		// Everything read except two babs, both owed by seat 0 in round 0.
		const all = Array.from({ length: 100 }, (_, index) => index + 1);
		await recordHistory(
			group.id,
			0,
			all.filter(number => number !== 1 && number !== 2)
		);

		const detail = await getRoundDetailForUser(OWNER, group.id, 0);

		expect(detail.missedCount).toBe(2);
		expect(detail.missedPeopleCount).toBe(1);
	});
});

describe('coverMissedBabsForUser', () => {
	it('records the cover against the round that missed it, crediting the coverer', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		await coverMissedBabsForUser(SEAT_ONE, group.id, 1, [7]);

		const row = await prisma.babRead.findFirst({ where: { groupId: group.id, roundIndex: 1, babNumber: 7 } });

		expect(row?.userId).toBe(SEAT_ONE);
		// Written into round 1's history — not moved into the round now open.
		expect(await prisma.babRead.count({ where: { groupId: group.id, roundIndex: 3 } })).toBe(0);
	});

	it('turns a miss into a read without touching the current board', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		const before = await getRoundDetailForUser(OWNER, group.id, 1);
		await coverMissedBabsForUser(OWNER, group.id, 1, [7]);
		const after = await getRoundDetailForUser(OWNER, group.id, 1);

		expect(after.missedCount).toBe(before.missedCount - 1);
		expect(after.readCount).toBe(before.readCount + 1);
		// `GroupBab` describes the round in progress; a closed round must not write to it.
		expect(await prisma.groupBab.count({ where: { groupId: group.id, readByUserId: { not: null } } })).toBe(0);
	});

	it('leaves the original reader in place — a cover fills a gap, it never displaces', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });
		await recordHistory(group.id, 1, [7], OWNER);

		await expect(coverMissedBabsForUser(SEAT_ONE, group.id, 1, [7])).rejects.toThrow();

		const row = await prisma.babRead.findFirst({ where: { groupId: group.id, roundIndex: 1, babNumber: 7 } });
		expect(row?.userId).toBe(OWNER);
	});

	it('refuses to cover the open round, which the ordinary read paths own', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		await expect(coverMissedBabsForUser(OWNER, group.id, 3, [7])).rejects.toThrow();
	});

	it('refuses a round the group has never reached', async () => {
		const group = await createGroup({ startedDaysAgo: 1 });

		await expect(coverMissedBabsForUser(OWNER, group.id, 9, [7])).rejects.toThrow();
	});

	it('covers a whole block in one act', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });
		const block = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

		const detail = await coverMissedBabsForUser(SEAT_ONE, group.id, 1, block);

		expect(detail.readCount).toBe(block.length);
		expect(await prisma.babRead.count({ where: { groupId: group.id, roundIndex: 1, userId: SEAT_ONE } })).toBe(
			block.length
		);
	});

	it('writes what is still missing when part of the block was already covered', async () => {
		// Losing the whole generous act because one bab was taken a second earlier would be
		// a poor way to answer it — the rest still goes through.
		const group = await createGroup({ startedDaysAgo: 3 });
		await recordHistory(group.id, 1, [2], OWNER);

		const detail = await coverMissedBabsForUser(SEAT_ONE, group.id, 1, [1, 2, 3]);

		expect(detail.readCount).toBe(3);
		expect(
			(await prisma.babRead.findFirst({ where: { groupId: group.id, roundIndex: 1, babNumber: 2 } }))?.userId
		).toBe(OWNER);
	});

	it('is permanent — a later rollover does not undo it', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });
		await coverMissedBabsForUser(OWNER, group.id, 1, [7]);

		// Age the group so the next read rolls it forward again.
		await prisma.group.update({
			where: { id: group.id },
			data: { startedAt: daysAgo(9), roundStartedAt: daysAgo(9) }
		});

		const detail = await getRoundDetailForUser(OWNER, group.id, 1);

		expect(detail.babs.find(bab => bab.number === 7)?.readByUserId).toBe(OWNER);
	});
});

/**
 * A read placed *inside* the round it belongs to.
 *
 * `recordHistory` above lets `readAt` default to `now()`, which for a closed round is
 * always after that round ended — fine where only the row's existence matters, useless
 * here, because "read it in time" is precisely what `getMyProgressForUser` measures.
 * Round `r` of a group started `startedDaysAgo` ago runs over the civil day
 * `startedDaysAgo - r`, so noon on that day is inside it.
 */
const recordOnTime = (
	groupId: string,
	roundIndex: number,
	babNumbers: number[],
	startedDaysAgo: number,
	userId = OWNER
) =>
	prisma.babRead.createMany({
		data: babNumbers.map(babNumber => ({
			babNumber,
			groupId,
			readAt: daysAgo(startedDaysAgo - roundIndex),
			roundIndex,
			userId
		}))
	});

describe('covering a closed round is silent', () => {
	/*
	 * **Nothing about a closed round may notify anybody**, and the guarantee currently rests
	 * on an absence — `coverMissedBabsForUser` simply never calls the notify helpers. An
	 * absence is easy to undo: the open round's read paths all announce a finished share and
	 * a completed hundred, and adding the same two calls here "for symmetry" would look like
	 * a fix. It is not one. Covering is a private act of catching up, days after the fact;
	 * telling the group that somebody finished a share last Tuesday is noise about a round
	 * nobody is reading any more.
	 *
	 * So these assert on the rows the notify paths would leave behind, not on a mock.
	 */
	const readsOf = (slotIndex: number, roundIndex: number) =>
		babNumbersForRound(slotIndex, SPOTS, roundIndex, BAB_COUNT);

	it('files no inbox rows and claims no notice when a whole share is covered', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });
		// Seat 0's entire block for round 1 — a finished share, in the open round's terms.
		const share = readsOf(0, 1);

		await coverMissedBabsForUser(OWNER, group.id, 1, share);

		expect(await prisma.notification.count({ where: { groupId: group.id } })).toBe(0);
		expect(await prisma.shareReadNotice.count({ where: { groupId: group.id } })).toBe(0);
		expect(await prisma.roundCompleteNotice.count({ where: { groupId: group.id } })).toBe(0);
	});

	it('files nothing even when the cover closes the whole hundred', async () => {
		const group = await createGroup({ startedDaysAgo: 3 });
		const everyBab = Array.from({ length: 100 }, (_, index) => index + 1);

		await coverMissedBabsForUser(OWNER, group.id, 0, everyBab);

		expect(await prisma.notification.count({ where: { groupId: group.id } })).toBe(0);
		expect(await prisma.roundCompleteNotice.count({ where: { groupId: group.id } })).toBe(0);
	});

	it("leaves the open round's completion stamp alone", async () => {
		const group = await createGroup({ startedDaysAgo: 3 });

		await coverMissedBabsForUser(OWNER, group.id, 1, readsOf(0, 1));

		// `completedAt` describes the round in progress. A closed round's gaps have no
		// bearing on it, and `syncCompletedAt` is deliberately not called here.
		const after = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });

		expect(after.completedAt).toBeNull();
		expect(after.roundIndex).toBe(3);
	});
});

describe('getMyProgressForUser', () => {
	it('covers every round the member has been in, oldest first, ending on the open one', async () => {
		const group = await createGroup({ startedDaysAgo: 9 });

		const progress = await getMyProgressForUser(OWNER, group.id);

		/*
		 * Ten rounds, not the seven the strip draws. The banner's counts and the missed list
		 * are about the whole record — they read "62 kaçırılan · son 7 gün" when this was a
		 * window, which answered a narrower question than anybody asked. The strip takes its
		 * seven cells off the end of this client-side.
		 */
		expect(progress.cycle).toBe('DAILY');
		expect(progress.periods).toHaveLength(10);
		expect(progress.periods.map(period => period.roundIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		expect(progress.periods.at(-1)?.isOpen).toBe(true);
		expect(progress.periods.filter(period => period.isOpen)).toHaveLength(1);
	});

	it('stops at round 0 rather than padding a young group to a full window', async () => {
		const group = await createGroup({ startedDaysAgo: 2 });

		const progress = await getMyProgressForUser(OWNER, group.id);

		// Three rounds exist, so three cells. A blank cell is not the same claim as a
		// missed one, and a group two days old has no seventh day to report.
		expect(progress.periods.map(period => period.roundIndex)).toEqual([0, 1, 2]);
	});

	it('follows the rotation: the seat owes a different block each round', async () => {
		const group = await createGroup({ startedDaysAgo: 2 });

		const progress = await getMyProgressForUser(OWNER, group.id);

		// Seat 0 of a ten-seat group reads block `(0 + roundIndex) % 10`.
		expect(progress.periods.map(period => period.owedCount)).toEqual([BLOCK, BLOCK, BLOCK]);
		expect(progress.periods[0]?.missedBabs.map(missed => missed.babNumber)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10
		]);
		expect(progress.periods[1]?.missedBabs.map(missed => missed.babNumber)).toEqual([
			11, 12, 13, 14, 15, 16, 17, 18, 19, 20
		]);
	});

	it('counts only my own reads, and only of babs I owed', async () => {
		const group = await createGroup({ startedDaysAgo: 2 });
		// Mine, in time.
		await recordOnTime(group.id, 0, [1, 2, 3], 2);
		// Someone else's block that round — not mine to be credited for.
		await recordOnTime(group.id, 0, [55, 56], 2, SEAT_ONE);

		const progress = await getMyProgressForUser(OWNER, group.id);

		expect(progress.periods[0]?.readCount).toBe(3);
		expect(progress.periods[0]?.owedCount).toBe(BLOCK);
	});

	it('credits a read that landed after the round closed', async () => {
		const group = await createGroup({ startedDaysAgo: 2 });
		// `recordHistory` leaves `readAt` at now(), which is after round 0 ended.
		await recordHistory(group.id, 0, [1, 2, 3]);

		const progress = await getMyProgressForUser(OWNER, group.id);

		/*
		 * Catching up counts. `readCount` was once on-time reads only, so that the strip
		 * could be the record as it stood at the boundary — and covering every outstanding
		 * bab then left the card reading "0 kaçırılan · 0% tamamlama", which cannot be true
		 * both halves at once.
		 */
		expect(progress.periods[0]?.readCount).toBe(3);
		expect(progress.periods[0]?.missedBabs.map(missed => missed.babNumber)).not.toContain(1);
	});

	it('reports the same number of misses as it lists', async () => {
		const group = await createGroup({ startedDaysAgo: 2 });
		// Three of round 0's ten covered late, so the two rules would disagree by three.
		await recordHistory(group.id, 0, [1, 2, 3]);

		const progress = await getMyProgressForUser(OWNER, group.id);

		// The card's number and the list's are one quantity — they were 74 and 62 on a real
		// group before this, under the same word.
		const listed = progress.periods.reduce((total, period) => total + period.missedBabs.length, 0);

		expect(progress.missedCount).toBe(listed);
		expect(progress.periods[0]?.missedCount).toBe(BLOCK - 3);
	});

	it('drops a bab somebody else covered from the missed list without crediting it', async () => {
		const group = await createGroup({ startedDaysAgo: 2 });
		await recordHistory(group.id, 0, [4], SEAT_ONE);

		const progress = await getMyProgressForUser(OWNER, group.id);

		expect(progress.periods[0]?.missedBabs.map(missed => missed.babNumber)).not.toContain(4);
		expect(progress.periods[0]?.readCount).toBe(0);
	});

	it('never reports the open round as missing anything', async () => {
		const group = await createGroup({ startedDaysAgo: 2 });

		const progress = await getMyProgressForUser(OWNER, group.id);

		const open = progress.periods.at(-1);

		expect(open?.isOpen).toBe(true);
		expect(open?.missedBabs).toEqual([]);
	});

	it('excludes the open round from the missed total but includes it in the rate', async () => {
		const group = await createGroup({ startedDaysAgo: 2 });
		await recordOnTime(group.id, 0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2);
		await recordOnTime(group.id, 1, [11, 12, 13, 14, 15], 2);
		await recordOnTime(group.id, 2, [21, 22], 2);

		const progress = await getMyProgressForUser(OWNER, group.id);

		// Closed rounds owed 20 and delivered 15 — the open round's 8 outstanding babs are
		// not "missed", they are still in play.
		expect(progress.missedCount).toBe(5);
		// The rate spans the whole window, open round included: 17 of 30.
		expect(progress.owedCount).toBe(30);
		expect(progress.readCount).toBe(17);
		expect(progress.ratePercent).toBe(57);
	});

	it('never charges a member for rounds that closed before they joined', async () => {
		const group = await createGroup({ seats: [0], startedDaysAgo: 6 });
		// Seat 1 arrives on the fifth day, so rounds 0-3 were never theirs to read.
		await prisma.groupMember.create({
			data: {
				displayName: 'Latecomer',
				groupId: group.id,
				joinedAt: daysAgo(2),
				role: 'MEMBER',
				slotIndex: 1,
				userId: SEAT_ONE
			}
		});

		const progress = await getMyProgressForUser(SEAT_ONE, group.id);

		// Without the join floor this said 7 periods and 30 missed babs on their first day.
		expect(progress.periods.map(period => period.roundIndex)).toEqual([4, 5, 6]);
		expect(progress.missedCount).toBe(2 * BLOCK);
	});

	it('keeps rounds that share a block attached to it across a rotation wrap', async () => {
		// Ten seats, so seat 0 owes 1–10 in round 0 and again in round 10 — the query groups
		// those rounds under one clause, and a mistake there would silently drop one of them.
		const group = await createGroup({ startedDaysAgo: 12 });
		await recordOnTime(group.id, 0, [1, 2], 12);
		await recordOnTime(group.id, 10, [3, 4, 5], 12);

		const progress = await getMyProgressForUser(OWNER, group.id);
		const byRound = new Map(progress.periods.map(period => [period.roundIndex, period]));

		expect(byRound.get(0)?.readCount).toBe(2);
		expect(byRound.get(10)?.readCount).toBe(3);
		expect(byRound.get(0)?.owedCount).toBe(BLOCK);
	});

	it('counts a WEEKLY group in weeks, and rotates its share by round not by day', async () => {
		// Twenty days at seven days a round is round 2, with rounds 0 and 1 closed.
		const group = await createGroup({ cycle: 'WEEKLY', startedDaysAgo: 20 });

		const progress = await getMyProgressForUser(OWNER, group.id);

		expect(progress.cycle).toBe('WEEKLY');
		expect(progress.periods.map(period => period.roundIndex)).toEqual([0, 1, 2]);
		// Every round, as for DAILY — `PeriodStrip` slices the last eight off the end, and
		// three is what a twenty-day-old weekly group actually has to show.
		expect(progress.periods.map(period => period.owedCount)).toEqual([BLOCK, BLOCK, BLOCK]);
		// The rotation advances one seat per *round*: seat 0 owes 1–10, then 11–20.
		expect(progress.periods[0]?.missedBabs.map(missed => missed.babNumber)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10
		]);
		expect(progress.periods[1]?.missedBabs.map(missed => missed.babNumber)).toEqual([
			11, 12, 13, 14, 15, 16, 17, 18, 19, 20
		]);
	});

	it('refuses a group the caller is not in', async () => {
		const group = await createGroup({ startedDaysAgo: 2, seats: [0] });

		await expect(getMyProgressForUser('test_stranger', group.id)).rejects.toThrow();
	});
});
