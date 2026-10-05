import prisma from '@db/prisma';
import { BAD_REQUEST, CONFLICT, FORBIDDEN, NOT_FOUND } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import { babNumbersForSlot } from '@utils/babs';
import { isPersonalPlan, partCountFor, type GroupKindName } from '@utils/groupKinds';
import {
	hasDelailRepetition,
	hasIstighfar,
	hasSekine,
	isPlanDays,
	PLAN_SPANS,
	PLAN_VERSION,
	spansFor
} from '@utils/hizbPlans';
import { civilDayNumber, startOfCivilDay } from '@utils/rounds';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { Group, HizbAssignment, HizbEnrollment, Prisma } from '../generated/prisma/client';
import { lockGroup } from './rounds.service';
import { notifyHizbRead } from './hizbReadNotice.service';

/** The Hizb board's portions — also the length of the plan that reads one portion a day. */
const BOARD_PORTIONS = partCountFor('HIZB');

const dayOf = (group: Group) => civilDayNumber(new Date(), group.timezone);
const dateOf = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);

/*
 * The plan engine — days, rounds, reading ahead, catch-up, undo — is the same for every kind; only
 * what a day reads differs. A Hizb day is cut on its text (`utils/hizbPlans`) and carries its
 * repetition gates. A Şahsi Cevşen or Kur'an day is a block of babs or cüz: the book split over the
 * plan's days as seats split it (`rangeForSlot`), the first days one longer when it does not divide
 * evenly, with no gates. Its portion is the day of the plan, 1-based.
 */

/** Which day of its plan a reading day falls on, 1-based — `portionForDay` for any length. */
const planPortionFor = (days: number, sequence: number, dayIndex: number) =>
	((((sequence + dayIndex) % days) + days) % days) + 1;

/** A Cevşen or Kur'an plan day's babs or cüz. */
const unitsOfDay = (kind: GroupKindName, planDays: number, portion: number) =>
	babNumbersForSlot(portion - 1, planDays, partCountFor(kind));

/** What a Cevşen or Kur'an day reads, on whatever carries its portion; nothing extra on a Hizb one. */
const unitFields = (kind: GroupKindName, planDays: number, portion: number): { units?: number[] } =>
	kind === 'HIZB' ? {} : { units: unitsOfDay(kind, planDays, portion) };

/** The Hizb's repetition gates — Sekine, the opening istighfar, the Delâil salawat. Hizb only. */
const gatesOf = (kind: GroupKindName, planDays: number, portion: number) =>
	kind === 'HIZB'
		? {
				sekine: hasSekine(planDays, portion),
				istighfar: hasIstighfar(planDays, portion),
				delail: hasDelailRepetition(planDays, portion)
		  }
		: { sekine: false, istighfar: false, delail: false };

async function requireReader(tx: Prisma.TransactionClient, userId: string, groupId: string) {
	const member = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
	if (!member) {
		throw new HttpError(FORBIDDEN, 'You must belong to this group');
	}
	const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
	if (!isPersonalPlan(group)) {
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
	if (endingOn.size > 0) {
		// A day opened ahead goes with the plan, as it does when the member leaves. Never a read one:
		// a day read ahead keeps the plan running past it.
		await tx.hizbAssignment.deleteMany({
			where: { enrollmentId: { in: [...endingOn.values()].flat() }, day: { gt: today } }
		});
	}
}

export async function enrollHizbInTransaction(
	tx: Prisma.TransactionClient,
	group: Group,
	userId: string,
	requested?: number
) {
	if (group.planDays !== null) {
		return enrollShahsiReader(tx, group, group.planDays, userId);
	}
	const days = requested ?? (group.hizbPlan || BOARD_PORTIONS);
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
	const counter = days === 7 ? 'hizbNext7' : days === 15 ? 'hizbNext15' : 'hizbNext32';
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

/**
 * A Şahsi Cevşen or Kur'an reading's one plan, made with the group: its reader is enrolled at
 * creation, from the first part (sequence 0), on the group's own length. No plan counter — nobody
 * else ever joins.
 */
async function enrollShahsiReader(tx: Prisma.TransactionClient, group: Group, planDays: number, userId: string) {
	const current = await tx.hizbEnrollment.findFirst({ where: { groupId: group.id, userId, endDay: null } });
	if (current) {
		return current;
	}
	const allocated = await tx.group.update({ where: { id: group.id }, data: { hizbNextSlot: { increment: 1 } } });
	const today = dayOf(group);
	return tx.hizbEnrollment.create({
		data: {
			groupId: group.id,
			userId,
			planDays,
			planVersion: PLAN_VERSION,
			sequence: 0,
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
		if (group.planDays !== null) {
			throw new HttpError(BAD_REQUEST, 'This reading began when it was created');
		}
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
	const ticked = new Set(reading.partial.flatMap(portion => spansFor(BOARD_PORTIONS, portion)));
	return own.filter(span => ticked.has(span));
};

/** What one reading covers on the board: a Hizb day's text spans, or a Cevşen/Kur'an day's babs or cüz. */
const coverOf = (kind: GroupKindName, reading: DayReading) =>
	kind === 'HIZB'
		? spansOfReading(reading)
		: unitsOfDay(kind, reading.planDays, reading.portion).filter(
				unit => !reading.partial || reading.partial.includes(unit)
		  );

/** What a day's readings cover — what the group's board draws: text spans for the Hizb, else units. */
const coveredBy = (kind: GroupKindName, readings: readonly DayReading[]) => [
	...new Set(readings.flatMap(reading => coverOf(kind, reading)))
];

/**
 * The parts of the day the book sheet offers to tick: the board's portions a Hizb day touches, or a Kur'an
 * day's own cüz. A Cevşen is read in the app only, so it offers none.
 */
const bookPortionsOf = (kind: GroupKindName, planDays: number, portion: number) =>
	kind === 'HIZB' ? boardPortionsFor(planDays, portion) : kind === 'HATIM' ? unitsOfDay(kind, planDays, portion) : [];

/**
 * How a reading was marked, for the day's card: the board portions it touches (what the book sheet
 * ticks), those ticked so far, and whether a finished day was read in the app or from the book.
 */
const bookFields = (
	kind: GroupKindName,
	a: {
		portion: number;
		readPortions: number[];
		readFrom: string | null;
		enrollment: { planDays: number };
	}
) => ({
	boardPortions: bookPortionsOf(kind, a.enrollment.planDays, a.portion),
	readPortions: a.readPortions,
	readFrom: a.readFrom === 'BOOK' || a.readFrom === 'APP' ? a.readFrom : null
});

/** Coverage of the whole book by a day's spans (Hizb) or units (Cevşen, Kur'an). */
const coverageOf = (kind: GroupKindName, covered: readonly number[]) => {
	const total = kind === 'HIZB' ? PLAN_SPANS.length : partCountFor(kind);
	return { covered: covered.length, total, complete: covered.length === total };
};

/**
 * A day's cover as the state carries it: a Hizb's `coveredSpans`; a Cevşen's or Kur'an's
 * `coveredUnits`, with `coveredSpans` left empty for the shape.
 */
const coverFields = (kind: GroupKindName, covered: number[]): { coveredSpans: number[]; coveredUnits?: number[] } =>
	kind === 'HIZB' ? { coveredSpans: covered } : { coveredSpans: [], coveredUnits: covered };

/** Which of the board's portions a plan's day touches — what the book sheet offers to tick (the web's `boardPortionsOf`). */
export const boardPortionsFor = (planDays: number, portion: number) => {
	const own = new Set(spansFor(planDays, portion));
	return Array.from({ length: BOARD_PORTIONS }, (_, i) => i + 1).filter(board =>
		spansFor(BOARD_PORTIONS, board).some(span => own.has(span))
	);
};

/**
 * How many of the board's portions a day's spans read in full — the count the group's board
 * draws (the web's `planBoardCells`). Every plan now cuts on the portions' own starts, so the 32 spans
 * are the portions; the count is still taken from portions, so a plan cut inside one never shows.
 */
const boardPortionsRead = (spans: readonly number[]) => {
	const covered = new Set(spans);
	return Array.from({ length: BOARD_PORTIONS }, (_, i) => spansFor(BOARD_PORTIONS, i + 1)).filter(portion =>
		portion.every(span => covered.has(span))
	).length;
};

/** When the group's next reading day begins: the next local midnight in its own zone. */
const nextDayAtFor = (group: Group, today: number) => startOfCivilDay(today + 1, group.timezone).toISOString();

/** A day's row of a plan: what `materialize` writes on the day, and reading ahead writes early. */
const rowFor = (group: Group, enrollment: HizbEnrollment, anchor: number, day: number) => ({
	enrollmentId: enrollment.id,
	day,
	portion: planPortionFor(enrollment.planDays, enrollment.sequence + group.hizbStartPortion - 1, day - anchor),
	traversal: Math.floor((day - enrollment.joinedDay) / enrollment.planDays)
});

/** Days read ahead never move `generatedThrough`: their rows are skipped here when their day comes. */
async function materialize(tx: Prisma.TransactionClient, group: Group, enrollment: HizbEnrollment) {
	const lastDay = Math.min(dayOf(group), enrollment.endDay === null ? Infinity : enrollment.endDay - 1);
	const anchor = civilDayNumber(group.startedAt ?? group.startsAt, group.timezone);
	for (let from = enrollment.generatedThrough + 1; from <= lastDay; from += 500) {
		const until = Math.min(from + 499, lastDay);
		await tx.hizbAssignment.createMany({
			data: Array.from({ length: until - from + 1 }, (_, i) => rowFor(group, enrollment, anchor, from + i)),
			skipDuplicates: true
		});
	}
	if (lastDay > enrollment.generatedThrough) {
		await tx.hizbEnrollment.update({ where: { id: enrollment.id }, data: { generatedThrough: lastDay } });
	}
}

/**
 * Reading ahead past today: how many days after it are read, one after another, and the first that
 * is not — the day offered next, with its row if one was opened. Read ahead strictly in order, the
 * read days are always the ones straight after today.
 */
async function aheadOf(tx: Prisma.TransactionClient, enrollmentId: string, today: number) {
	const upcoming = await tx.hizbAssignment.findMany({
		where: { enrollmentId, day: { gt: today } },
		orderBy: { day: 'asc' },
		select: { id: true, day: true, completedAt: true, portion: true }
	});
	let read = 0;
	while (upcoming[read]?.day === today + 1 + read && upcoming[read]?.completedAt) {
		read++;
	}
	const next = today + 1 + read;
	return {
		read,
		next,
		row: upcoming[read]?.day === next ? upcoming[read]! : null,
		// The days read ahead, in order — for the list behind "N gün ileridesin".
		readDays: upcoming.slice(0, read)
	};
}

export async function closeHizbEnrollment(tx: Prisma.TransactionClient, group: Group, userId: string) {
	if (!isPersonalPlan(group)) {
		return;
	}
	await expireHizb(tx, group);
	const enrollments = await tx.hizbEnrollment.findMany({ where: { groupId: group.id, userId, endDay: null } });
	for (const enrollment of enrollments) {
		// Today's existing commitment remains available as historical catch-up; days read ahead go.
		await materialize(tx, group, enrollment);
		await tx.hizbAssignment.deleteMany({ where: { enrollmentId: enrollment.id, day: { gt: dayOf(group) } } });
		await tx.hizbEnrollment.update({
			where: { id: enrollment.id },
			data: { endDay: dayOf(group) + 1, reason: 'LEFT' }
		});
	}
}

/*
 * Rounds are counted across every enrollment — a member who left and came back carries on from
 * where they were — while `traversal` restarts at 0 in each. So each enrollment's rounds are offset
 * by all the rounds its earlier enrollments started.
 */
function roundsOf(enrollments: readonly HizbEnrollment[], today: number) {
	const roundsIn = (e: HizbEnrollment) => {
		const last = Math.min(today, e.endDay === null ? today : e.endDay - 1);
		return last < e.joinedDay ? 0 : Math.floor((last - e.joinedDay) / e.planDays) + 1;
	};
	const offset = new Map<string, number>();
	let started = 0;
	for (const e of [...enrollments].sort((a, b) => a.joinedDay - b.joinedDay || a.ordinal - b.ordinal)) {
		offset.set(e.id, started);
		started += roundsIn(e);
	}
	return { offset, started };
}

/** A day's reading on its own, as its reader opens it. */
const readingOf = (kind: GroupKindName, a: HizbAssignment & { enrollment: HizbEnrollment }) => {
	const gates = gatesOf(kind, a.enrollment.planDays, a.portion);
	return {
		id: a.id,
		day: a.day,
		date: dateOf(a.day),
		planDays: a.enrollment.planDays,
		planVersion: a.enrollment.planVersion,
		portion: a.portion,
		...unitFields(kind, a.enrollment.planDays, a.portion),
		traversal: a.traversal,
		repetitions: a.repetitions,
		delailRepetitions: a.delailRepetitions,
		requiresDelailRepetition: gates.delail,
		istighfarRepetitions: a.istighfarRepetitions,
		istighfarTarget: a.istighfarTarget,
		requiresIstighfar: gates.istighfar,
		version: a.version,
		bookmark: a.bookmark,
		requiresSekine: gates.sekine,
		...bookFields(kind, a),
		completedAt: a.completedAt?.toISOString() ?? null
	};
};

/** A day's reading as the group screen has it: today's, a missed one, one in history or read ahead. */
const serializeAssignment = (
	kind: GroupKindName,
	a: HizbAssignment & { enrollment: HizbEnrollment },
	roundOffset: ReadonlyMap<string, number>
) => ({
	...readingOf(kind, a),
	// The overall round this reading belongs to, 1-based.
	round: (roundOffset.get(a.enrollmentId) ?? 0) + a.traversal + 1
});

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
			const rounds = roundsOf(enrollments, today);
			const serialize = (a: NonNullable<typeof assignment>) => serializeAssignment(group.kind, a, rounds.offset);
			// A day read ahead counts once its day comes, here as on the board.
			const completeCycles = await tx.hizbAssignment.groupBy({
				by: ['enrollmentId', 'traversal'],
				where: { ...mine, completedAt: { not: null }, day: { lte: today } },
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
			// Who read today, and when — the time shows on the readers' rows ("✓ 09:27").
			const readToday = new Map(
				reads.filter(a => a.day === today && a.completedAt).map(a => [a.enrollmentId, a.completedAt!])
			);
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
			// What a day's readings cover, for the group's board: text spans, or babs or cüz.
			const coveredOn = (day: number) => coveredBy(group.kind, readingsFor(day));
			const coverage = (day: number) => coverageOf(group.kind, coveredOn(day));
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
						number: rounds.started,
						read: await tx.hizbAssignment.count({
							where: {
								enrollmentId: assignment.enrollmentId,
								traversal: assignment.traversal,
								completedAt: { not: null },
								day: { lte: today }
							}
						}),
						days:
							today -
							(assignment.enrollment.joinedDay + assignment.traversal * assignment.enrollment.planDays) +
							1
				  }
				: null;
			const ahead = current?.endDay === null ? await aheadOf(tx, current.id, today) : null;
			const aheadPortion = current && ahead ? rowFor(group, current, anchor, ahead.next).portion : null;
			return {
				today: assignment ? serialize(assignment) : null,
				// Once today is read: the next day's portion, offered to read ahead.
				ahead:
					current && ahead && assignment?.completedAt
						? {
								day: ahead.next,
								date: dateOf(ahead.next),
								portion: aheadPortion!,
								...unitFields(group.kind, current.planDays, aheadPortion!),
								assignmentId: ahead.row?.id ?? null
						  }
						: null,
				// How far past today the member has read.
				aheadThrough: ahead?.read
					? {
							days: ahead.read,
							date: dateOf(ahead.next - 1),
							readings: ahead.readDays.map(row => ({
								day: row.day,
								date: dateOf(row.day),
								portion: row.portion,
								...unitFields(group.kind, current!.planDays, row.portion),
								completedAt: row.completedAt!.toISOString()
							}))
					  }
					: null,
				currentRound,
				missed: missed.map(serialize),
				...coverFields(group.kind, coveredOn(today)),
				// The group's day before today — "Geçen tur" on a daily plan. Null on its first day.
				previousDay:
					today > anchor
						? {
								date: dateOf(today - 1),
								...coverage(today - 1),
								...coverFields(group.kind, coveredOn(today - 1))
						  }
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
					const portion = planPortionFor(e.planDays, e.sequence + group.hizbStartPortion - 1, today - anchor);
					return {
						id: e.id,
						displayName: anonymous ? null : m?.displayName ?? null,
						planDays: e.planDays,
						portion,
						...unitFields(group.kind, e.planDays, portion),
						completed: readToday.has(e.id),
						// When, for a hidden name too: a time says nothing about who.
						completedAt: readToday.get(e.id)?.toISOString() ?? null,
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
				const portion = planPortionFor(e.planDays, e.sequence + group.hizbStartPortion - 1, day - anchor);
				return {
					id: e.id,
					displayName: hidden && !isMe ? null : member?.displayName ?? null,
					planDays: e.planDays,
					portion,
					...unitFields(group.kind, e.planDays, portion),
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

/**
 * Reading ahead: with today read, the next day's portion — then the one after, one day at a time,
 * with no limit. Its row is opened early, as `materialize` would open it on its day, and counts for
 * that day when it comes. Asked again before it is read, the same row comes back.
 */
export async function openHizbAhead(userId: string, groupId: string) {
	const user = normalizeUserId(userId);
	return prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		const group = await requireReader(tx, user, groupId);
		await expireHizb(tx, group);
		const enrollments = await tx.hizbEnrollment.findMany({ where: { groupId, userId: user } });
		const current = enrollments.find(e => e.endDay === null);
		if (!current) {
			throw new HttpError(NOT_FOUND, 'You have no reading plan in this group');
		}
		await materialize(tx, group, current);
		const today = dayOf(group);
		const todays = await tx.hizbAssignment.findUnique({
			where: { enrollmentId_day: { enrollmentId: current.id, day: today } }
		});
		if (!todays?.completedAt) {
			throw new HttpError(CONFLICT, 'Read today’s portion first');
		}
		const { next, row } = await aheadOf(tx, current.id, today);
		const anchor = civilDayNumber(group.startedAt ?? group.startsAt, group.timezone);
		const offered = row
			? await tx.hizbAssignment.findUniqueOrThrow({ where: { id: row.id } })
			: await tx.hizbAssignment.create({ data: rowFor(group, current, anchor, next) });
		return serializeAssignment(
			group.kind,
			{ ...offered, enrollment: current },
			roundsOf(enrollments, today).offset
		);
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
		const today = dayOf(group);
		// A finished Kur'an or Cevşen day with one cüz or bab unmarked: undone, keeping the rest
		// marked, in one write.
		const unticks =
			group.kind !== 'HIZB' &&
			input.bookPortions !== undefined &&
			input.read === undefined &&
			assignment.completedAt !== null;
		const undoes = input.read === false || unticks;
		// A later day is read ahead in order: today and every day up to it read first. Undoing a read day
		// is not reading — the rule below governs it — but anything else on an unread day is.
		if (assignment.day > today && (!undoes || assignment.completedAt === null)) {
			const readBefore = await tx.hizbAssignment.count({
				where: {
					enrollmentId: assignment.enrollmentId,
					day: { gte: today, lt: assignment.day },
					completedAt: { not: null }
				}
			});
			if (readBefore !== assignment.day - today) {
				throw new HttpError(CONFLICT, 'This reading is in the future');
			}
		}
		// Read ahead is undone from the end: today, or a day after it, only with no later day read.
		if (undoes && assignment.completedAt !== null && assignment.day >= today) {
			const readAfter = await tx.hizbAssignment.count({
				where: {
					enrollmentId: assignment.enrollmentId,
					day: { gt: assignment.day },
					completedAt: { not: null }
				}
			});
			if (readAfter > 0) {
				throw new HttpError(CONFLICT, 'Undo the later days first');
			}
		}
		if (!Number.isInteger(input.version) || input.version < 0) {
			throw new HttpError(BAD_REQUEST, 'Invalid version');
		}
		const changesIstighfar = input.istighfarRepetitions !== undefined || input.istighfarTarget !== undefined;
		// The repetition counters are the Hizb's; a Cevşen or Kur'an day has none.
		if (
			group.kind !== 'HIZB' &&
			(input.repetitions !== undefined || input.delailRepetitions !== undefined || changesIstighfar)
		) {
			throw new HttpError(BAD_REQUEST, 'This reading has no repetitions');
		}
		const gates = gatesOf(group.kind, assignment.enrollment.planDays, assignment.portion);
		if (
			input.repetitions !== undefined &&
			(!Number.isInteger(input.repetitions) || input.repetitions < 0 || input.repetitions > 19 || !gates.sekine)
		) {
			throw new HttpError(BAD_REQUEST, 'Invalid repetition count');
		}
		if (
			input.delailRepetitions !== undefined &&
			(!Number.isInteger(input.delailRepetitions) ||
				input.delailRepetitions < 0 ||
				input.delailRepetitions > 3 ||
				!gates.delail)
		) {
			throw new HttpError(BAD_REQUEST, 'Invalid Delail repetition count');
		}
		if (changesIstighfar && !gates.istighfar) {
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
		// What a day's ticks may name: the book sheet's portions — or, for a Cevşen read in the app, the
		// day's babs, each ticked by its "Okudum" while the reader moves freely with its arrows.
		const dayPortions =
			group.kind === 'CEVSEN'
				? unitsOfDay(group.kind, assignment.enrollment.planDays, assignment.portion)
				: bookPortionsOf(group.kind, assignment.enrollment.planDays, assignment.portion);
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
			if (assignment.completedAt !== null && !(unticks && ticked.size < dayPortions.length)) {
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
		const read = completesFromBook || (!unticks && (input.read ?? assignment.completedAt !== null));
		// Read from the book, the counters were kept by the reader: no gate, now or on a later page turn.
		const isFromBook = completesFromBook || (assignment.completedAt !== null && assignment.readFrom === 'BOOK');
		const gated = read && !isFromBook;
		if (gated && gates.sekine && repetitions < 19) {
			throw new HttpError(CONFLICT, 'Complete all 19 Sekine repetitions first');
		}
		const delailRepetitions = input.delailRepetitions ?? assignment.delailRepetitions;
		if (
			gated &&
			gates.delail &&
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
			gates.istighfar &&
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
			assignment.day === today &&
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
						: read || undoes
						? []
						: assignment.readPortions,
				readFrom: read
					? assignment.completedAt
						? assignment.readFrom
						: completesFromBook && group.kind !== 'CEVSEN'
						? 'BOOK'
						: 'APP'
					: null
			}
		});
		if (announces) {
			announced = dayPortions;
		}
		if (read && assignment.completedAt === null) {
			// Active through today — and through a day read ahead, which keeps the plan running until then.
			const active = await tx.hizbEnrollment.findFirst({ where: { groupId, userId: user, endDay: null } });
			if (active) {
				await tx.hizbEnrollment.update({
					where: { id: active.id },
					data: { lastReadDay: Math.max(today, assignment.day, active.lastReadDay ?? today) }
				});
			}
		}
		if (undoes) {
			const active = await tx.hizbEnrollment.findFirst({ where: { groupId, userId: user, endDay: null } });
			if (active) {
				const last = await tx.hizbAssignment.findFirst({
					where: {
						enrollment: { groupId, userId: user },
						completedAt: { gte: startOfCivilDay(active.joinedDay, group.timezone) }
					},
					orderBy: { completedAt: 'desc' }
				});
				// The furthest day still read, which may be ahead of the last day anything was read on.
				const furthest = await tx.hizbAssignment.findFirst({
					where: { enrollmentId: active.id, completedAt: { not: null } },
					orderBy: { day: 'desc' }
				});
				const lastReadDay = Math.max(
					last?.completedAt ? civilDayNumber(last.completedAt, group.timezone) : -Infinity,
					furthest?.day ?? -Infinity
				);
				await tx.hizbEnrollment.update({
					where: { id: active.id },
					data: { lastReadDay: Number.isFinite(lastReadDay) ? lastReadDay : null }
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
		return readingOf(group.kind, a);
	});
}

/** The viewer's day for Home and reminders: its plan day and, on a Cevşen or Kur'an plan, its units. */
const todayOf = (group: Group, mine: HizbEnrollment, today: number, own: HizbAssignment | null) => {
	const portion = planPortionFor(
		mine.planDays,
		mine.sequence + group.hizbStartPortion - 1,
		today - civilDayNumber(group.startedAt ?? group.startsAt, group.timezone)
	);
	return {
		planDays: mine.planDays,
		portion,
		...unitFields(group.kind, mine.planDays, portion),
		// A Kur'an day's cüz marked so far, and the place kept in it (the reader's `bookmark`) — the
		// shelf counts its pages before the day is done.
		...(group.kind === 'HATIM' ? { readUnits: own?.readPortions ?? [], place: own?.bookmark ?? 0 } : {}),
		completed: own?.completedAt !== null && own?.completedAt !== undefined,
		assignmentId: own?.id ?? null
	};
};

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
		const activeIds = new Set(active.map(e => e.id));
		const covered = coveredBy(
			group.kind,
			marked.map(a => ({
				planDays: a.enrollment.planDays,
				portion: a.portion,
				...(a.completedAt ? {} : { partial: a.readPortions })
			}))
		);
		const coverage = coverageOf(group.kind, covered);
		// A shared board is the Hizb's alone; a Şahsi Cevşen or Kur'an reading counts its one day.
		const coveredSpans = group.kind === 'HIZB' ? covered : [];
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
			partCount: group.hizbIndividual ? 1 : BOARD_PORTIONS,
			percent: group.hizbIndividual
				? own?.completedAt
					? 100
					: 0
				: Math.round((portionsRead * 100) / BOARD_PORTIONS),
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
			// Every card's count, whatever the group's size or mix of plans: everyone on a plan now,
			// and how many of them read today. A count only — nothing about who.
			hizbReaders: {
				read: reads.filter(a => activeIds.has(a.enrollmentId)).length,
				total: active.length
			},
			nextDayAt: nextDayAtFor(group, today),
			hizbRemoved: latest?.reason === 'INACTIVITY',
			// The rule's length when it removed them — the group's may have changed since.
			hizbRemovalDays: latest?.reason === 'INACTIVITY' ? latest.removalDays : null,
			// "41. gün" on the card: the group's own day, counted from 1 on the day it began.
			hizbDay: today - civilDayNumber(group.startedAt ?? group.startsAt, group.timezone) + 1,
			hizbToday: mine ? todayOf(group, mine, today, own) : null,
			// The days straight after today already read ahead — the daily reminder skips them.
			hizbAheadDays: mine ? (await aheadOf(tx, mine.id, today)).read : 0
		};
	});
}
