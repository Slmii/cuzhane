import { coverageFor } from '@utils/hizbPlans';
import prisma from '@db/prisma';
import { partCountFor } from '@utils/groupKinds';
import { normalizeUserId } from '@utils/normalizeUserId';
import { civilDayNumber, DEFAULT_TIME_ZONE } from '@utils/rounds';

export type ProfileStats = {
	/** Cevşen babs only — the label says babs, and a Hizb portion is not one. */
	babsRead: number;
	/** Every group's completed rounds, whatever it reads. */
	roundsCompleted: number;
	streakDays: number;
	/** The longest run of consecutive reading days, ever — what the current streak is measured against. */
	longestStreakDays: number;
	memberSince: string;
	last30Days: { date: string; count: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_N_DAYS = 30;

/**
 * Renders a civil day number back as `YYYY-MM-DD`. Exact rather than approximate: the
 * number was built from `Date.UTC(y, m, d)`, so multiplying back out round-trips it.
 */
const dayKey = (dayNumber: number): string => new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);

/**
 * These stats are bucketed in the VIEWER's zone, not any group's.
 *
 * A streak is a claim about the reader's own days, so unlike a round boundary there is no
 * coherence problem in letting it follow whoever is looking. Bucketing in UTC — as this did
 * — merged two evenings of reading into one square for anyone west of Greenwich: 21:00
 * Monday and 19:00 Tuesday in New York are both UTC Tuesday, so a two-day streak read as
 * one day and Monday's square showed empty.
 *
 * Days are walked as integers rather than by subtracting 24h, which is also what makes the
 * streak survive a DST change: in a 23- or 25-hour local day, stepping back by `DAY_MS`
 * either skips a day or lands on the same one twice.
 */
export const getProfileStatsForUser = async (
	userId: string,
	timeZone: string = DEFAULT_TIME_ZONE
): Promise<ProfileStats> => {
	const normalizedUserId = normalizeUserId(userId);

	// `GroupBab.readByUserId` / `readAt` describe only the CURRENT round — a rollover wipes
	// them clean. `BabRead` is the append-only log that survives rollovers, so every
	// historical stat here (total read, streak, heatmap, completed rounds) is derived from it.
	const [personalReads, memberships, userReads] = await Promise.all([
		prisma.hizbAssignment.findMany({
			where: { enrollment: { userId: normalizedUserId }, completedAt: { not: null } },
			include: { enrollment: true }
		}),
		prisma.groupMember.findMany({
			where: { userId: normalizedUserId },
			select: { joinedAt: true }
		}),
		prisma.babRead.findMany({
			where: { userId: normalizedUserId },
			select: { groupId: true, roundIndex: true, readAt: true }
		})
	]);

	/*
	 * What each group reads, for the two stats that depend on it. One lookup over the groups
	 * this reader has touched rather than a join on every read: a `BabRead` row can't outlive
	 * its group (the relation cascades), so every id here resolves.
	 */
	const groupIds = [...new Set(userReads.map(read => read.groupId))];

	// A round is "completed" once every part of a (groupId, roundIndex) has been read by
	// anyone — 100 for a Cevşen group, 33 for a Hizb one. We only check rounds this user
	// actually contributed a read to, then ask how many BabRead rows exist in total for each
	// of those rounds.
	const roundKeys = new Map<string, { groupId: string; roundIndex: number }>();
	for (const read of userReads) {
		roundKeys.set(`${read.groupId}:${read.roundIndex}`, { groupId: read.groupId, roundIndex: read.roundIndex });
	}

	// Both are derived from the reads alone, so neither waits on the other.
	const [groups, roundCounts] = await Promise.all([
		groupIds.length > 0
			? prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, kind: true } })
			: [],
		roundKeys.size > 0
			? prisma.babRead.groupBy({
					by: ['groupId', 'roundIndex'],
					where: { OR: Array.from(roundKeys.values()) },
					_count: { _all: true }
			  })
			: []
	]);
	const kindByGroupId = new Map(groups.map(group => [group.id, group.kind]));

	/*
	 * **Babs are the Cevşen's.** The screen labels this number "bab", and a Hizb portion is
	 * a different unit and a far longer one, so adding the two would make the total mean
	 * neither. Hizb reading still shows in the streak and the heatmap below, which count
	 * reading days rather than babs.
	 */
	const babsRead = userReads.filter(read => kindByGroupId.get(read.groupId) === 'CEVSEN').length;

	let roundsCompleted = roundCounts.filter(round => {
		const kind = kindByGroupId.get(round.groupId);

		return kind !== undefined && round._count._all === partCountFor(kind);
	}).length;

	const contributed = [
		...new Map(
			personalReads.map(a => [
				`${a.enrollment.groupId}:${a.day}`,
				{ day: a.day, enrollment: { groupId: a.enrollment.groupId } }
			])
		).values()
	];
	const shared = contributed.length
		? await prisma.hizbAssignment.findMany({
				where: { OR: contributed, completedAt: { not: null } },
				include: { enrollment: true }
		  })
		: [];
	const byDay = new Map<string, { planDays: number; portion: number }[]>();
	for (const a of shared) {
		const key = `${a.enrollment.groupId}:${a.day}`;
		const list = byDay.get(key) ?? [];
		list.push({ planDays: a.enrollment.planDays, portion: a.portion });
		byDay.set(key, list);
	}
	roundsCompleted += [...byDay.values()].filter(reads => coverageFor(reads).complete).length;

	const joinDates = memberships.map(membership => membership.joinedAt.getTime());
	const memberSince =
		joinDates.length > 0 ? new Date(Math.min(...joinDates)).toISOString() : new Date().toISOString();

	const countsByDay = new Map<number, number>();
	for (const read of userReads) {
		const day = civilDayNumber(read.readAt, timeZone);
		countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
	}

	for (const read of personalReads) {
		const day = civilDayNumber(read.completedAt!, timeZone);
		countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
	}
	const today = civilDayNumber(new Date(), timeZone);

	// A streak may end today or yesterday — not having read yet today shouldn't break one.
	let streakDays = 0;
	let cursor = countsByDay.has(today) ? today : countsByDay.has(today - 1) ? today - 1 : null;

	while (cursor !== null && countsByDay.has(cursor)) {
		streakDays += 1;
		cursor -= 1;
	}

	/*
	 * The best run, over every day this reader has ever read — not just the thirty the heatmap
	 * covers, which would quietly shrink somebody's record as it aged out of the window. The
	 * days are already collected; sorting them and walking for gaps costs one pass.
	 */
	const readDays = Array.from(countsByDay.keys()).sort((a, b) => a - b);
	let longestStreakDays = 0;
	let runLength = 0;

	readDays.forEach((day, index) => {
		runLength = index > 0 && readDays[index - 1] === day - 1 ? runLength + 1 : 1;
		longestStreakDays = Math.max(longestStreakDays, runLength);
	});

	const last30Days: { date: string; count: number }[] = [];
	for (let offset = LAST_N_DAYS - 1; offset >= 0; offset--) {
		const day = today - offset;
		last30Days.push({ date: dayKey(day), count: countsByDay.get(day) ?? 0 });
	}

	return { babsRead, roundsCompleted, streakDays, longestStreakDays, memberSince, last30Days };
};
