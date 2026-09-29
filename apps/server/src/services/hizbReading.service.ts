import prisma from '@db/prisma';
import { BAD_REQUEST, CONFLICT, FORBIDDEN, NOT_FOUND } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import {
	hasDelailRepetition,
	hasIstighfar,
	hasSekine,
	isPlanDays,
	PLAN_SPANS,
	PLAN_VERSION,
	portionForDay,
	spansFor
} from '@utils/hizbPlans';
import { civilDayNumber, startOfCivilDay } from '@utils/rounds';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { Group, HizbEnrollment, Prisma } from '../generated/prisma/client';
import { lockGroup } from './rounds.service';
import { notifyHizbRead } from './hizbReadNotice.service';

const dayOf = (group: Group) => civilDayNumber(new Date(), group.timezone);
const dateOf = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);

async function requireReader(tx: Prisma.TransactionClient, userId: string, groupId: string) {
	const member = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
	if (!member) {
		throw new HttpError(FORBIDDEN, 'You must belong to this group');
	}
	const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
	if (group.hizbPlan === null) {
		throw new HttpError(BAD_REQUEST, 'This group does not use personal plans');
	}
	return group;
}

/** Called under the group lock. An absent app cannot accumulate assignments beyond its removal date. */
export async function expireHizb(tx: Prisma.TransactionClient, group: Group) {
	if (!group.inactivityDays) {
		return;
	}
	const today = dayOf(group);
	const active = await tx.hizbEnrollment.findMany({ where: { groupId: group.id, endDay: null } });
	// One write per end day, not per member: a big group's idle readers mostly share one.
	const endingOn = new Map<number, string[]>();
	for (const enrollment of active) {
		// A successful reading day is excluded; a never-read member owes the join day's portion.
		const endDay =
			Math.max(
				group.inactivitySinceDay ?? enrollment.joinedDay,
				enrollment.lastReadDay === null ? enrollment.joinedDay : enrollment.lastReadDay + 1
			) + group.inactivityDays;
		if (today >= endDay) {
			const ids = endingOn.get(endDay) ?? [];
			ids.push(enrollment.id);
			endingOn.set(endDay, ids);
		}
	}
	for (const [endDay, ids] of endingOn) {
		await tx.hizbEnrollment.updateMany({
			where: { id: { in: ids } },
			data: { endDay, reason: 'INACTIVITY', removalDays: group.inactivityDays }
		});
	}
}

export async function enrollHizbInTransaction(
	tx: Prisma.TransactionClient,
	group: Group,
	userId: string,
	requested?: number
) {
	const days = requested ?? (group.hizbPlan || 33);
	if (!isPlanDays(days) || (group.hizbPlan !== 0 && group.hizbPlan !== days)) {
		throw new HttpError(BAD_REQUEST, 'Follow the plan selected by the group creator');
	}
	await expireHizb(tx, group);
	const current = await tx.hizbEnrollment.findFirst({ where: { groupId: group.id, userId, endDay: null } });
	if (current) {
		if (current.planDays !== days) {
			throw new HttpError(CONFLICT, 'Your active plan cannot be changed mid-cycle');
		}
		return current;
	}
	const counter = days === 7 ? 'hizbNext7' : days === 15 ? 'hizbNext15' : 'hizbNext33';
	const allocated = await tx.group.update({
		where: { id: group.id },
		data: { [counter]: { increment: 1 }, hizbNextSlot: { increment: 1 } }
	});
	const today = dayOf(group);
	return tx.hizbEnrollment.create({
		data: {
			groupId: group.id,
			userId,
			planDays: days,
			planVersion: PLAN_VERSION,
			sequence: allocated[counter] - 1,
			ordinal: allocated.hizbNextSlot - 1,
			joinedDay: today,
			generatedThrough: today - 1
		}
	});
}

export async function enrollHizb(userId: string, groupId: string, days?: number) {
	const user = normalizeUserId(userId);
	await prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		const group = await requireReader(tx, user, groupId);
		await enrollHizbInTransaction(tx, group, user, days);
	});
	return getHizbState(user, groupId);
}

/**
 * A day's reading on the board: a completed one, or one marked part-read from the book, whose
 * `partial` names the board portions ticked so far.
 */
type DayReading = { planDays: number; portion: number; partial?: readonly number[] };

/**
 * The text spans one reading covers. A part-read day covers only the ticked portions' share of its
 * own text: a 15-day day reaches into portion 6, and ticking 6 must not paint the half of 6 that
 * belongs to the next day.
 */
const spansOfReading = (reading: DayReading) => {
	const own = spansFor(reading.planDays, reading.portion);
	if (!reading.partial) {
		return own;
	}
	const ticked = new Set(reading.partial.flatMap(portion => spansFor(33, portion)));
	return own.filter(span => ticked.has(span));
};

/** The canonical text spans a day's readings cover — what the group's board draws. */
const spansCoveredBy = (readings: readonly DayReading[]) => [...new Set(readings.flatMap(spansOfReading))];

/**
 * How a reading was marked, for the day's card: the board portions it touches (what the book sheet
 * ticks), those ticked so far, and whether a finished day was read in the app or from the book.
 */
const bookFields = (a: {
	portion: number;
	readPortions: number[];
	readFrom: string | null;
	enrollment: { planDays: number };
}) => ({
	boardPortions: boardPortionsFor(a.enrollment.planDays, a.portion),
	readPortions: a.readPortions,
	readFrom: a.readFrom === 'BOOK' || a.readFrom === 'APP' ? a.readFrom : null
});

/** Coverage of the whole text by a day's spans. */
const coverageOfSpans = (spans: readonly number[]) => ({
	covered: spans.length,
	total: PLAN_SPANS.length,
	complete: spans.length === PLAN_SPANS.length
});

/** Which of the board's 33 a plan's day touches — what the book sheet offers to tick (the web's `boardPortionsOf`). */
export const boardPortionsFor = (planDays: number, portion: number) => {
	const own = new Set(spansFor(planDays, portion));
	return Array.from({ length: 33 }, (_, i) => i + 1).filter(board => spansFor(33, board).some(span => own.has(span)));
};

/**
 * How many of the board's 33 portions a day's spans read in full — the count the group's board
 * draws (the web's `planBoardCells`). Spans are finer than the 33 (35 of them), so they are never
 * the count shown.
 */
const boardPortionsRead = (spans: readonly number[]) => {
	const covered = new Set(spans);
	return Array.from({ length: 33 }, (_, i) => spansFor(33, i + 1)).filter(portion =>
		portion.every(span => covered.has(span))
	).length;
};

/** When the group's next reading day begins: the next local midnight in its own zone. */
const nextDayAtFor = (group: Group, today: number) => startOfCivilDay(today + 1, group.timezone).toISOString();

async function materialize(tx: Prisma.TransactionClient, group: Group, enrollment: HizbEnrollment) {
	const lastDay = Math.min(dayOf(group), enrollment.endDay === null ? Infinity : enrollment.endDay - 1);
	const anchor = civilDayNumber(group.startedAt ?? group.startsAt, group.timezone);
	for (let from = enrollment.generatedThrough + 1; from <= lastDay; from += 500) {
		const until = Math.min(from + 499, lastDay);
		await tx.hizbAssignment.createMany({
			data: Array.from({ length: until - from + 1 }, (_, i) => ({
				enrollmentId: enrollment.id,
				day: from + i,
				portion: portionForDay(
					enrollment.planDays,
					enrollment.sequence + group.hizbStartPortion - 1,
					from + i - anchor
				),
				traversal: Math.floor((from + i - enrollment.joinedDay) / enrollment.planDays)
			})),
			skipDuplicates: true
		});
	}
	if (lastDay > enrollment.generatedThrough) {
		await tx.hizbEnrollment.update({ where: { id: enrollment.id }, data: { generatedThrough: lastDay } });
	}
}

export async function closeHizbEnrollment(tx: Prisma.TransactionClient, group: Group, userId: string) {
	if (group.hizbPlan === null) {
		return;
	}
	await expireHizb(tx, group);
	const enrollments = await tx.hizbEnrollment.findMany({ where: { groupId: group.id, userId, endDay: null } });
	for (const enrollment of enrollments) {
		// Today's existing commitment remains available as historical catch-up.
		await materialize(tx, group, enrollment);
		await tx.hizbEnrollment.update({
			where: { id: enrollment.id },
			data: { endDay: dayOf(group) + 1, reason: 'LEFT' }
		});
	}
}

export async function getHizbState(userId: string, groupId: string, cursor?: string) {
	const user = normalizeUserId(userId);
	return prisma.$transaction(
		async tx => {
			await lockGroup(tx, groupId);
			const group = await requireReader(tx, user, groupId);
			await expireHizb(tx, group);
			const today = dayOf(group);
			const enrollments = await tx.hizbEnrollment.findMany({
				where: { groupId, userId: user },
				orderBy: { ordinal: 'desc' }
			});
			for (const enrollment of enrollments) {
				await materialize(tx, group, enrollment);
			}
			const mine = { enrollment: { groupId, userId: user } };
			const current = enrollments.find(e => e.endDay === null) ?? enrollments[0] ?? null;
			const assignment =
				current?.endDay === null
					? await tx.hizbAssignment.findUnique({
							where: { enrollmentId_day: { enrollmentId: current.id, day: today } },
							include: { enrollment: true }
					  })
					: null;
			if (cursor && !(await tx.hizbAssignment.findFirst({ where: { ...mine, id: cursor } }))) {
				throw new HttpError(BAD_REQUEST, 'Invalid history cursor');
			}
			const history = await tx.hizbAssignment.findMany({
				where: { ...mine, day: { lte: today }, ...(assignment ? { id: { not: assignment.id } } : {}) },
				include: { enrollment: true },
				orderBy: [{ day: 'desc' }, { id: 'asc' }],
				take: 101,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
			});
			/*
			 * Rounds are counted across every enrollment — a member who left and came back carries on
			 * from where they were — while `traversal` restarts at 0 in each. So each enrollment's
			 * rounds are offset by all the rounds its earlier enrollments started.
			 */
			const roundsIn = (e: HizbEnrollment) => {
				const last = Math.min(today, e.endDay === null ? today : e.endDay - 1);
				return last < e.joinedDay ? 0 : Math.floor((last - e.joinedDay) / e.planDays) + 1;
			};
			const roundOffset = new Map<string, number>();
			let roundsStarted = 0;
			for (const e of [...enrollments].sort((a, b) => a.joinedDay - b.joinedDay || a.ordinal - b.ordinal)) {
				roundOffset.set(e.id, roundsStarted);
				roundsStarted += roundsIn(e);
			}
			const serialize = (a: NonNullable<typeof assignment>) => ({
				id: a.id,
				// The overall round this reading belongs to, 1-based.
				round: (roundOffset.get(a.enrollmentId) ?? 0) + a.traversal + 1,
				day: a.day,
				date: dateOf(a.day),
				planDays: a.enrollment.planDays,
				planVersion: a.enrollment.planVersion,
				portion: a.portion,
				traversal: a.traversal,
				repetitions: a.repetitions,
				delailRepetitions: a.delailRepetitions,
				requiresDelailRepetition: hasDelailRepetition(a.enrollment.planDays, a.portion),
				istighfarRepetitions: a.istighfarRepetitions,
				istighfarTarget: a.istighfarTarget,
				requiresIstighfar: hasIstighfar(a.enrollment.planDays, a.portion),
				version: a.version,
				bookmark: a.bookmark,
				requiresSekine: hasSekine(a.enrollment.planDays, a.portion),
				...bookFields(a),
				completedAt: a.completedAt?.toISOString() ?? null
			});
			const completeCycles = await tx.hizbAssignment.groupBy({
				by: ['enrollmentId', 'traversal'],
				where: { ...mine, completedAt: { not: null } },
				_count: { _all: true }
			});
			const completedTraversals = completeCycles.filter(
				c => c._count._all === enrollments.find(e => e.id === c.enrollmentId)?.planDays
			).length;
			const active = await tx.hizbEnrollment.findMany({
				where: { groupId, endDay: null },
				orderBy: { ordinal: 'asc' }
			});
			const members = await tx.groupMember.findMany({ where: { groupId }, orderBy: { slotIndex: 'asc' } });
			const reads = await tx.hizbAssignment.findMany({
				// Today and the thirty days before it: the board, yesterday, and T4's thirty bars.
				// A day part-read from the book counts on the board too, for the portions ticked.
				where: {
					enrollment: { groupId },
					day: { gte: today - 30, lte: today },
					OR: [{ completedAt: { not: null } }, { readPortions: { isEmpty: false } }]
				},
				select: {
					day: true,
					enrollmentId: true,
					portion: true,
					completedAt: true,
					readPortions: true,
					enrollment: { select: { planDays: true } }
				}
			});
			/*
			 * A big group reads the same few portions many times a day: keep each day's distinct
			 * (plan, portion) pairs once, and today's readers in a set, so the board and the
			 * readers list cost one pass over the reads rather than one per day or per member.
			 */
			const readingsOn = new Map<number, Map<string, DayReading>>();
			for (const a of reads) {
				const day = readingsOn.get(a.day) ?? new Map<string, DayReading>();
				const reading = { planDays: a.enrollment.planDays, portion: a.portion };
				day.set(
					a.completedAt
						? `${reading.planDays}:${reading.portion}`
						: `${reading.planDays}:${reading.portion}:${a.readPortions.join(',')}`,
					a.completedAt ? reading : { ...reading, partial: a.readPortions }
				);
				readingsOn.set(a.day, day);
			}
			const readingsFor = (day: number) => [...(readingsOn.get(day)?.values() ?? [])];
			const readToday = new Set(reads.filter(a => a.day === today && a.completedAt).map(a => a.enrollmentId));
			const memberByUser = new Map(members.map(m => [m.userId, m]));
			// Today's readings that are under way: a page turned or a count begun, not yet read. A
			// member who hasn't opened the app today has no row for today, so isn't started.
			const startedToday = new Set(
				(
					await tx.hizbAssignment.findMany({
						where: {
							enrollmentId: { in: active.map(e => e.id) },
							day: today,
							completedAt: null,
							OR: [
								{ bookmark: { gt: 0 } },
								{ repetitions: { gt: 0 } },
								{ istighfarRepetitions: { gt: 0 } },
								{ delailRepetitions: { gt: 0 } },
								{ readPortions: { isEmpty: false } }
							]
						},
						select: { enrollmentId: true }
					})
				).map(a => a.enrollmentId)
			);
			const anchor = civilDayNumber(group.startedAt ?? group.startsAt, group.timezone);
			// Which canonical text spans a day's readings cover, for the group's board.
			const spansOn = (day: number) => spansCoveredBy(readingsFor(day));
			const coverage = (day: number) => coverageOfSpans(spansOn(day));
			// The catch-up list: every unread day of the viewer's before today, newest first. Uncapped —
			// the history screen lists them all, and a day row is a few numbers.
			const missed = await tx.hizbAssignment.findMany({
				where: { ...mine, day: { lt: today }, completedAt: null },
				include: { enrollment: true },
				orderBy: [{ day: 'desc' }, { id: 'asc' }]
			});
			// The round today's reading is in: its number, its days read so far, and its days come round.
			const currentRound = assignment
				? {
						number: roundsStarted,
						read: await tx.hizbAssignment.count({
							where: {
								enrollmentId: assignment.enrollmentId,
								traversal: assignment.traversal,
								completedAt: { not: null }
							}
						}),
						days:
							today -
							(assignment.enrollment.joinedDay + assignment.traversal * assignment.enrollment.planDays) +
							1
				  }
				: null;
			return {
				today: assignment ? serialize(assignment) : null,
				currentRound,
				missed: missed.map(serialize),
				coveredSpans: spansOn(today),
				// The group's day before today — "Geçen tur" on a daily plan. Null on its first day.
				previousDay:
					today > anchor
						? { date: dateOf(today - 1), ...coverage(today - 1), coveredSpans: spansOn(today - 1) }
						: null,
				enrollment: current
					? {
							id: current.id,
							planDays: current.planDays,
							sequence: current.sequence,
							endDay: current.endDay,
							reason: current.reason,
							removalDays: current.removalDays,
							joinedDate: dateOf(current.joinedDay)
					  }
					: null,
				// The group's first day, for a late joiner's note (S7).
				startedDate: dateOf(anchor),
				// "Bu grupta hep kitaptan okuyorum": the book button leads on the day's card.
				readsFromBook: memberByUser.get(user)?.readsFromBook ?? false,
				// Back today after leaving or being removed (S3b): an active enrollment that began
				// today, with an earlier one behind it.
				isReturnedToday: current?.endDay === null && current.joinedDay === today && enrollments.length > 1,
				assignments: history.slice(0, 100).map(serialize),
				nextCursor: history.length > 100 ? history[99]!.id : null,
				missedCount: await tx.hizbAssignment.count({
					where: { ...mine, day: { lt: today }, completedAt: null }
				}),
				completedTraversals,
				coverage: coverage(today),
				date: dateOf(today),
				nextDayAt: nextDayAtFor(group, today),
				// Today first, then up to thirty days before it.
				dailyHistory: Array.from({ length: Math.min(31, today - anchor + 1) }, (_, i) => ({
					date: dateOf(today - i),
					...coverage(today - i)
				})),
				members: active.map(e => {
					const m = memberByUser.get(e.userId);
					const isMe = e.userId === user;
					const anonymous = namesHiddenFrom(group, user, memberByUser.get(user)) && !isMe;
					return {
						id: e.id,
						displayName: anonymous ? null : m?.displayName ?? null,
						planDays: e.planDays,
						portion: portionForDay(e.planDays, e.sequence + group.hizbStartPortion - 1, today - anchor),
						completed: readToday.has(e.id),
						// Opened and part-way, not yet read — "Başladı" on the readers list.
						started: startedToday.has(e.id),
						isMe
					};
				})
			};
		},
		{ timeout: 30000 }
	);
}

/** Hidden names hide others' names from this viewer — not from the owner, nor from a responsible member. */
const namesHiddenFrom = (group: Group, viewerId: string, viewer: { seesReaders: boolean } | undefined) =>
	group.hideMemberNames &&
	viewerId !== group.ownerUserId &&
	!(group.readSeersEnabled && viewer?.seesReaders === true);

/** Days on one page of the group's history. */
const HISTORY_DAYS_PAGE = 30;

/**
 * Whoever was reading on a day: every enrollment running then, and every one with a reading that
 * day. Derived rather than read from the day's assignments alone — those are made only when a
 * member opens the app, so one who never did that day has no row, yet still owed its reading. And
 * not from the dates alone: the inactivity rule can end a plan before days already opened (an undone
 * read moves it back), and those stay readable from the catch-up list.
 */
const readersOn = <E extends { id: string; joinedDay: number; endDay: number | null }>(
	enrollments: readonly E[],
	day: number,
	withReading: ReadonlySet<string>
) => enrollments.filter(e => withReading.has(e.id) || (e.joinedDay <= day && (e.endDay === null || day < e.endDay)));

/**
 * "Tüm geçmiş" of a shared plan: the group's days, today first, each with how many of that day's
 * readers read. `before` pages on: the days before it.
 */
export async function getHizbHistoryDays(userId: string, groupId: string, before?: number) {
	const user = normalizeUserId(userId);
	return prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		const group = await requireReader(tx, user, groupId);
		await expireHizb(tx, group);
		const today = dayOf(group);
		const anchor = civilDayNumber(group.startedAt ?? group.startsAt, group.timezone);
		const newest = Math.min(today, before === undefined ? today : before - 1);
		const oldest = Math.max(anchor, newest - HISTORY_DAYS_PAGE + 1);
		if (newest < oldest) {
			return { days: [], nextBefore: null };
		}
		const enrollments = await tx.hizbEnrollment.findMany({
			where: { groupId },
			select: { id: true, joinedDay: true, endDay: true }
		});
		// Every reading in the page's days, read or not: a few numbers a row.
		const assignments = await tx.hizbAssignment.findMany({
			where: { enrollment: { groupId }, day: { gte: oldest, lte: newest } },
			select: { day: true, enrollmentId: true, completedAt: true }
		});
		const withReadingOn = new Map<number, Set<string>>();
		const readOn = new Map<number, number>();
		for (const a of assignments) {
			withReadingOn.set(a.day, (withReadingOn.get(a.day) ?? new Set()).add(a.enrollmentId));
			if (a.completedAt) {
				readOn.set(a.day, (readOn.get(a.day) ?? 0) + 1);
			}
		}
		return {
			days: Array.from({ length: newest - oldest + 1 }, (_, i) => newest - i).map(day => ({
				day,
				date: dateOf(day),
				isToday: day === today,
				read: readOn.get(day) ?? 0,
				readers: readersOn(enrollments, day, withReadingOn.get(day) ?? new Set()).length
			})),
			nextBefore: oldest > anchor ? oldest : null
		};
	});
}

/**
 * One day of "Tüm geçmiş": its readers, each with the portion they owed and whether they read it.
 * The viewer's own row carries the reading's id, so an unread day of theirs can be opened.
 */
export async function getHizbHistoryDay(userId: string, groupId: string, day: number) {
	const user = normalizeUserId(userId);
	return prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		const group = await requireReader(tx, user, groupId);
		await expireHizb(tx, group);
		const today = dayOf(group);
		const anchor = civilDayNumber(group.startedAt ?? group.startsAt, group.timezone);
		if (day < anchor || day > today) {
			throw new HttpError(BAD_REQUEST, 'This day is not in the group’s history');
		}
		const enrollments = await tx.hizbEnrollment.findMany({ where: { groupId }, orderBy: { ordinal: 'asc' } });
		// The viewer's own day must exist to be opened from here.
		for (const enrollment of enrollments.filter(e => e.userId === user)) {
			await materialize(tx, group, enrollment);
		}
		const assignments = await tx.hizbAssignment.findMany({
			where: { enrollment: { groupId }, day },
			select: {
				id: true,
				enrollmentId: true,
				completedAt: true,
				bookmark: true,
				repetitions: true,
				istighfarRepetitions: true,
				delailRepetitions: true,
				readPortions: true
			}
		});
		const byEnrollment = new Map(assignments.map(a => [a.enrollmentId, a]));
		const readers = readersOn(enrollments, day, new Set(byEnrollment.keys()));
		const members = await tx.groupMember.findMany({ where: { groupId } });
		const memberByUser = new Map(members.map(m => [m.userId, m]));
		const hidden = namesHiddenFrom(group, user, memberByUser.get(user));
		return {
			day,
			date: dateOf(day),
			isToday: day === today,
			members: readers.map(e => {
				const a = byEnrollment.get(e.id);
				const isMe = e.userId === user;
				const member = memberByUser.get(e.userId);
				return {
					id: e.id,
					displayName: hidden && !isMe ? null : member?.displayName ?? null,
					planDays: e.planDays,
					portion: portionForDay(e.planDays, e.sequence + group.hizbStartPortion - 1, day - anchor),
					completed: Boolean(a?.completedAt),
					// Opened and part-way, not yet read.
					started:
						a !== undefined &&
						a.completedAt === null &&
						(a.bookmark > 0 ||
							a.repetitions > 0 ||
							a.istighfarRepetitions > 0 ||
							a.delailRepetitions > 0 ||
							a.readPortions.length > 0),
					isMe,
					// A member no longer in the group: their name went with them.
					hasLeft: member === undefined,
					assignmentId: isMe ? a?.id ?? null : null
				};
			})
		};
	});
}

export type HizbAssignmentUpdate = {
	version: number;
	read?: boolean | undefined;
	repetitions?: number | undefined;
	delailRepetitions?: number | undefined;
	istighfarRepetitions?: number | undefined;
	istighfarTarget?: number | undefined;
	bookmark?: number | undefined;
	/**
	 * Read from the book: the board portions of this day read so far. All of them finishes the day
	 * (the counters are the reader's own business then); fewer paints them on the board and leaves
	 * the day owed.
	 */
	bookPortions?: number[] | undefined;
};
export async function updateHizbAssignment(
	userId: string,
	groupId: string,
	assignmentId: string,
	input: HizbAssignmentUpdate
) {
	const user = normalizeUserId(userId);
	// The portions to tell the group about, once this read has committed.
	let announced: number[] | null = null;
	await prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		const group = await requireReader(tx, user, groupId);
		await expireHizb(tx, group);
		const assignment = await tx.hizbAssignment.findFirst({
			where: { id: assignmentId, enrollment: { groupId, userId: user } },
			include: { enrollment: true }
		});
		if (!assignment) {
			throw new HttpError(NOT_FOUND, 'Reading not found');
		}
		if (assignment.day > dayOf(group)) {
			throw new HttpError(BAD_REQUEST, 'This reading is in the future');
		}
		if (!Number.isInteger(input.version) || input.version < 0) {
			throw new HttpError(BAD_REQUEST, 'Invalid version');
		}
		if (
			input.repetitions !== undefined &&
			(!Number.isInteger(input.repetitions) ||
				input.repetitions < 0 ||
				input.repetitions > 19 ||
				!hasSekine(assignment.enrollment.planDays, assignment.portion))
		) {
			throw new HttpError(BAD_REQUEST, 'Invalid repetition count');
		}
		if (
			input.delailRepetitions !== undefined &&
			(!Number.isInteger(input.delailRepetitions) ||
				input.delailRepetitions < 0 ||
				input.delailRepetitions > 3 ||
				!hasDelailRepetition(assignment.enrollment.planDays, assignment.portion))
		) {
			throw new HttpError(BAD_REQUEST, 'Invalid Delail repetition count');
		}
		const changesIstighfar = input.istighfarRepetitions !== undefined || input.istighfarTarget !== undefined;
		if (changesIstighfar && !hasIstighfar(assignment.enrollment.planDays, assignment.portion)) {
			throw new HttpError(BAD_REQUEST, 'This reading has no opening istighfar');
		}
		if (
			input.istighfarRepetitions !== undefined &&
			(!Number.isInteger(input.istighfarRepetitions) ||
				input.istighfarRepetitions < 0 ||
				input.istighfarRepetitions > 100)
		) {
			throw new HttpError(BAD_REQUEST, 'Invalid istighfar repetition count');
		}
		if (
			input.istighfarTarget !== undefined &&
			(!Number.isInteger(input.istighfarTarget) || input.istighfarTarget < 1 || input.istighfarTarget > 100)
		) {
			throw new HttpError(BAD_REQUEST, 'Choose between 1 and 100 istighfar repetitions');
		}
		const dayPortions = boardPortionsFor(assignment.enrollment.planDays, assignment.portion);
		if (input.bookPortions !== undefined) {
			const ticked = new Set(input.bookPortions);
			if (
				input.read !== undefined ||
				ticked.size !== input.bookPortions.length ||
				ticked.size === 0 ||
				input.bookPortions.some(p => !dayPortions.includes(p))
			) {
				throw new HttpError(BAD_REQUEST, 'Invalid portions');
			}
			if (assignment.completedAt !== null) {
				throw new HttpError(CONFLICT, 'This reading is already read');
			}
		}
		// Every portion ticked: the day is read, from the book.
		const completesFromBook = input.bookPortions !== undefined && input.bookPortions.length === dayPortions.length;
		if (
			input.bookmark !== undefined &&
			(!Number.isInteger(input.bookmark) || input.bookmark < 0 || input.bookmark > 1000)
		) {
			throw new HttpError(BAD_REQUEST, 'Invalid reading position');
		}
		if (
			input.read !== undefined &&
			input.read === (assignment.completedAt !== null) &&
			// Undoing a part-read day still has its ticks to clear.
			(input.read || assignment.readPortions.length === 0) &&
			input.repetitions === undefined &&
			input.delailRepetitions === undefined &&
			!changesIstighfar &&
			input.bookmark === undefined &&
			input.bookPortions === undefined
		) {
			return;
		}
		if (assignment.version !== input.version) {
			throw new HttpError(CONFLICT, 'Reading changed on another device. Refresh and try again.');
		}
		const repetitions = input.repetitions ?? assignment.repetitions;
		const read = completesFromBook || (input.read ?? assignment.completedAt !== null);
		// Read from the book, the counters were kept by the reader: no gate, now or on a later page turn.
		const isFromBook = completesFromBook || (assignment.completedAt !== null && assignment.readFrom === 'BOOK');
		const gated = read && !isFromBook;
		if (gated && hasSekine(assignment.enrollment.planDays, assignment.portion) && repetitions < 19) {
			throw new HttpError(CONFLICT, 'Complete all 19 Sekine repetitions first');
		}
		const delailRepetitions = input.delailRepetitions ?? assignment.delailRepetitions;
		if (
			gated &&
			hasDelailRepetition(assignment.enrollment.planDays, assignment.portion) &&
			(assignment.completedAt === null || input.delailRepetitions !== undefined) &&
			delailRepetitions < 3
		) {
			throw new HttpError(CONFLICT, 'Complete all three Delail repetitions first');
		}
		const istighfarRepetitions = input.istighfarRepetitions ?? assignment.istighfarRepetitions;
		const istighfarTarget = input.istighfarTarget ?? assignment.istighfarTarget;
		// Keep historical completions intact without inventing counts; new completions must meet the target.
		if (
			gated &&
			hasIstighfar(assignment.enrollment.planDays, assignment.portion) &&
			(assignment.completedAt === null || changesIstighfar) &&
			istighfarRepetitions < istighfarTarget
		) {
			throw new HttpError(CONFLICT, 'Complete your selected istighfar repetitions first');
		}
		// Today's reading, read for the first time, in a group with others in it. A missed day made
		// up later is not news, and undoing and reading again stays quiet (the claim below).
		const announces =
			read &&
			assignment.completedAt === null &&
			assignment.readNoticeSentAt === null &&
			assignment.day === dayOf(group) &&
			!group.hizbIndividual;
		await tx.hizbAssignment.update({
			where: { id: assignment.id },
			data: {
				repetitions,
				delailRepetitions,
				istighfarRepetitions,
				istighfarTarget,
				bookmark: input.bookmark ?? assignment.bookmark,
				version: { increment: 1 },
				completedAt: read ? assignment.completedAt ?? new Date() : null,
				...(announces ? { readNoticeSentAt: new Date() } : {}),
				// A partial book read keeps its ticks; a finished or undone day has none to keep.
				readPortions:
					input.bookPortions && !completesFromBook
						? [...input.bookPortions].sort((a, b) => a - b)
						: read || input.read === false
						? []
						: assignment.readPortions,
				readFrom: read
					? assignment.completedAt
						? assignment.readFrom
						: completesFromBook
						? 'BOOK'
						: 'APP'
					: null
			}
		});
		if (announces) {
			announced = dayPortions;
		}
		if (read && assignment.completedAt === null) {
			await tx.hizbEnrollment.updateMany({
				where: { groupId, userId: user, endDay: null },
				data: { lastReadDay: dayOf(group) }
			});
		}
		if (input.read === false) {
			const active = await tx.hizbEnrollment.findFirst({ where: { groupId, userId: user, endDay: null } });
			if (active) {
				const last = await tx.hizbAssignment.findFirst({
					where: {
						enrollment: { groupId, userId: user },
						completedAt: { gte: startOfCivilDay(active.joinedDay, group.timezone) }
					},
					orderBy: { completedAt: 'desc' }
				});
				await tx.hizbEnrollment.update({
					where: { id: active.id },
					data: { lastReadDay: last?.completedAt ? civilDayNumber(last.completedAt, group.timezone) : null }
				});
			}
		}
	});
	if (announced) {
		await notifyHizbRead({ groupId, portions: announced, readerId: user });
	}
	return getHizbAssignment(user, groupId, assignmentId);
}

/** "Bu grupta hep kitaptan okuyorum": the member's own choice for this group, kept on the account. */
export async function setHizbReadsFromBook(userId: string, groupId: string, readsFromBook: boolean) {
	const user = normalizeUserId(userId);
	const { count } = await prisma.groupMember.updateMany({
		where: { groupId, userId: user },
		data: { readsFromBook }
	});
	if (count === 0) {
		throw new HttpError(FORBIDDEN, 'You must belong to this group');
	}
	return { readsFromBook };
}

export async function getHizbAssignment(userId: string, groupId: string, id: string) {
	const user = normalizeUserId(userId);
	return prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		const group = await requireReader(tx, user, groupId);
		await expireHizb(tx, group);
		const a = await tx.hizbAssignment.findFirst({
			where: { id, enrollment: { groupId, userId: user } },
			include: { enrollment: true }
		});
		if (!a) {
			throw new HttpError(NOT_FOUND, 'Reading not found');
		}
		return {
			id: a.id,
			day: a.day,
			date: dateOf(a.day),
			planDays: a.enrollment.planDays,
			planVersion: a.enrollment.planVersion,
			portion: a.portion,
			traversal: a.traversal,
			repetitions: a.repetitions,
			delailRepetitions: a.delailRepetitions,
			requiresDelailRepetition: hasDelailRepetition(a.enrollment.planDays, a.portion),
			istighfarRepetitions: a.istighfarRepetitions,
			istighfarTarget: a.istighfarTarget,
			requiresIstighfar: hasIstighfar(a.enrollment.planDays, a.portion),
			version: a.version,
			bookmark: a.bookmark,
			requiresSekine: hasSekine(a.enrollment.planDays, a.portion),
			...bookFields(a),
			completedAt: a.completedAt?.toISOString() ?? null
		};
	});
}

/** Public-safe aggregate for discovery and the group shelf; no personal history or names. */
export async function hizbSummary(groupId: string, viewerUserId: string) {
	return prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
		await expireHizb(tx, group);
		const today = dayOf(group);
		const active = await tx.hizbEnrollment.findMany({ where: { groupId, endDay: null } });
		const marked = await tx.hizbAssignment.findMany({
			// A day part-read from the book is on the board too, for the portions ticked.
			where: {
				enrollment: { groupId },
				day: today,
				OR: [{ completedAt: { not: null } }, { readPortions: { isEmpty: false } }]
			},
			include: { enrollment: true }
		});
		const reads = marked.filter(a => a.completedAt !== null);
		const coveredSpans = spansCoveredBy(
			marked.map(a => ({
				planDays: a.enrollment.planDays,
				portion: a.portion,
				...(a.completedAt ? {} : { partial: a.readPortions })
			}))
		);
		const coverage = coverageOfSpans(coveredSpans);
		const portionsRead = boardPortionsRead(coveredSpans);
		const mine = active.find(e => e.userId === viewerUserId);
		// Out of the reading order: no enrollment running, and the last one ended by the inactivity rule.
		const latest = mine
			? null
			: await tx.hizbEnrollment.findFirst({
					where: { groupId, userId: viewerUserId },
					orderBy: { ordinal: 'desc' }
			  });
		// Home opens today's reading straight from here, so the day must exist before the group
		// screen has been visited.
		if (mine) {
			await materialize(tx, group, mine);
		}
		const own = mine
			? await tx.hizbAssignment.findUnique({ where: { enrollmentId_day: { enrollmentId: mine.id, day: today } } })
			: null;
		return {
			// The group's members, as the word "üye" says wherever this is shown — one who has not chosen a
			// plan yet, or was taken out of the order, is still a member.
			memberCount: await tx.groupMember.count({ where: { groupId } }),
			readCount: group.hizbIndividual ? (own?.completedAt ? 1 : 0) : portionsRead,
			partCount: group.hizbIndividual ? 1 : 33,
			percent: group.hizbIndividual ? (own?.completedAt ? 100 : 0) : Math.round((portionsRead * 100) / 33),
			completedAt: group.hizbIndividual
				? own?.completedAt?.toISOString() ?? null
				: coverage.complete
				? reads[0]?.completedAt?.toISOString() ?? null
				: null,
			// A plan has no board rows, so the board-derived stamp is always null; Home's "Bugün
			// okunanlar" needs today's own assignment instead.
			myShareDoneAt: own?.completedAt?.toISOString() ?? null,
			// The Discover card and the invite preview: today's board, the reset, and whether the
			// viewer was taken out of the order (P6).
			hizbCoveredSpans: coveredSpans,
			nextDayAt: nextDayAtFor(group, today),
			hizbRemoved: latest?.reason === 'INACTIVITY',
			// The rule's length when it removed them — the group's may have changed since.
			hizbRemovalDays: latest?.reason === 'INACTIVITY' ? latest.removalDays : null,
			// "41. gün" on the card: the group's own day, counted from 1 on the day it began.
			hizbDay: today - civilDayNumber(group.startedAt ?? group.startsAt, group.timezone) + 1,
			hizbToday: mine
				? {
						planDays: mine.planDays,
						portion: portionForDay(
							mine.planDays,
							mine.sequence + group.hizbStartPortion - 1,
							today - civilDayNumber(group.startedAt ?? group.startsAt, group.timezone)
						),
						completed: own?.completedAt !== null && own?.completedAt !== undefined,
						assignmentId: own?.id ?? null
				  }
				: null
		};
	});
}
