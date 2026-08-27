import prisma from '@db/prisma';
import { normalizeUserId } from '@utils/normalizeUserId';
import { civilDayNumber, DEFAULT_TIME_ZONE } from '@utils/rounds';

export type ProfileStats = {
	babsRead: number;
	roundsCompleted: number;
	streakDays: number;
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
	const [memberships, userReads] = await Promise.all([
		prisma.groupMember.findMany({
			where: { userId: normalizedUserId },
			select: { joinedAt: true }
		}),
		prisma.babRead.findMany({
			where: { userId: normalizedUserId },
			select: { groupId: true, roundIndex: true, readAt: true }
		})
	]);

	const babsRead = userReads.length;

	// A round is "completed" once all 100 babs of a (groupId, roundIndex) have been read by
	// anyone. We only check rounds this user actually contributed a read to, then ask how many
	// BabRead rows exist in total for each of those rounds.
	const roundKeys = new Map<string, { groupId: string; roundIndex: number }>();
	for (const read of userReads) {
		roundKeys.set(`${read.groupId}:${read.roundIndex}`, { groupId: read.groupId, roundIndex: read.roundIndex });
	}

	const roundCounts =
		roundKeys.size > 0
			? await prisma.babRead.groupBy({
					by: ['groupId', 'roundIndex'],
					where: { OR: Array.from(roundKeys.values()) },
					_count: { _all: true }
			  })
			: [];

	const roundsCompleted = roundCounts.filter(round => round._count._all === 100).length;

	const joinDates = memberships.map(membership => membership.joinedAt.getTime());
	const memberSince =
		joinDates.length > 0 ? new Date(Math.min(...joinDates)).toISOString() : new Date().toISOString();

	const countsByDay = new Map<number, number>();
	for (const read of userReads) {
		const day = civilDayNumber(read.readAt, timeZone);
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

	const last30Days: { date: string; count: number }[] = [];
	for (let offset = LAST_N_DAYS - 1; offset >= 0; offset--) {
		const day = today - offset;
		last30Days.push({ date: dayKey(day), count: countsByDay.get(day) ?? 0 });
	}

	return { babsRead, roundsCompleted, streakDays, memberSince, last30Days };
};
