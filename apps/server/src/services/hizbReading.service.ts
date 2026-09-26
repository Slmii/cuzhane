import prisma from '@db/prisma';
import { BAD_REQUEST, CONFLICT, FORBIDDEN, NOT_FOUND } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import {
	coverageFor,
	hasDelailRepetition,
	hasIstighfar,
	hasSekine,
	isPlanDays,
	PLAN_VERSION,
	portionForDay
} from '@utils/hizbPlans';
import { civilDayNumber, startOfCivilDay } from '@utils/rounds';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { Group, HizbEnrollment, Prisma } from '../generated/prisma/client';
import { lockGroup } from './rounds.service';

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
	for (const enrollment of active) {
		// A successful reading day is excluded; a never-read member owes the join day's portion.
		const endDay =
			Math.max(
				group.inactivitySinceDay ?? enrollment.joinedDay,
				enrollment.lastReadDay === null ? enrollment.joinedDay : enrollment.lastReadDay + 1
			) + group.inactivityDays;
		if (today >= endDay) {
			await tx.hizbEnrollment.update({
				where: { id: enrollment.id },
				data: { endDay, reason: 'INACTIVITY', removalDays: group.inactivityDays }
			});
		}
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
			const serialize = (a: NonNullable<typeof assignment>) => ({
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
				where: { enrollment: { groupId }, day: { gte: today - 29, lte: today }, completedAt: { not: null } },
				include: { enrollment: true }
			});
			const coverage = (day: number) =>
				coverageFor(
					reads.filter(a => a.day === day).map(a => ({ planDays: a.enrollment.planDays, portion: a.portion }))
				);
			const anchor = civilDayNumber(group.startedAt ?? group.startsAt, group.timezone);
			return {
				today: assignment ? serialize(assignment) : null,
				enrollment: current
					? {
							id: current.id,
							planDays: current.planDays,
							sequence: current.sequence,
							endDay: current.endDay,
							reason: current.reason,
							removalDays: current.removalDays
					  }
					: null,
				assignments: history.slice(0, 100).map(serialize),
				nextCursor: history.length > 100 ? history[99]!.id : null,
				missedCount: await tx.hizbAssignment.count({
					where: { ...mine, day: { lt: today }, completedAt: null }
				}),
				completedTraversals,
				coverage: coverage(today),
				date: dateOf(today),
				nextDayAt: startOfCivilDay(today + 1, group.timezone).toISOString(),
				dailyHistory: Array.from({ length: Math.min(30, today - anchor + 1) }, (_, i) => ({
					date: dateOf(today - i),
					...coverage(today - i)
				})),
				members: active.map(e => {
					const m = members.find(m => m.userId === e.userId);
					const anonymous = group.hideMemberNames && user !== group.ownerUserId && user !== e.userId;
					return {
						id: e.id,
						displayName: anonymous ? null : m?.displayName ?? null,
						planDays: e.planDays,
						portion: portionForDay(e.planDays, e.sequence + group.hizbStartPortion - 1, today - anchor),
						completed: reads.some(a => a.enrollmentId === e.id && a.day === today)
					};
				})
			};
		},
		{ timeout: 30000 }
	);
}

export type HizbAssignmentUpdate = {
	version: number;
	read?: boolean | undefined;
	repetitions?: number | undefined;
	delailRepetitions?: number | undefined;
	istighfarRepetitions?: number | undefined;
	istighfarTarget?: number | undefined;
	bookmark?: number | undefined;
};
export async function updateHizbAssignment(
	userId: string,
	groupId: string,
	assignmentId: string,
	input: HizbAssignmentUpdate
) {
	const user = normalizeUserId(userId);
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
		if (input.istighfarTarget !== undefined && ![11, 33, 100].includes(input.istighfarTarget)) {
			throw new HttpError(BAD_REQUEST, 'Choose 11, 33 or 100 istighfar repetitions');
		}
		if (
			input.bookmark !== undefined &&
			(!Number.isInteger(input.bookmark) || input.bookmark < 0 || input.bookmark > 1000)
		) {
			throw new HttpError(BAD_REQUEST, 'Invalid reading position');
		}
		if (
			input.read !== undefined &&
			input.read === (assignment.completedAt !== null) &&
			input.repetitions === undefined &&
			input.delailRepetitions === undefined &&
			!changesIstighfar &&
			input.bookmark === undefined
		) {
			return;
		}
		if (assignment.version !== input.version) {
			throw new HttpError(CONFLICT, 'Reading changed on another device. Refresh and try again.');
		}
		const repetitions = input.repetitions ?? assignment.repetitions;
		const read = input.read ?? assignment.completedAt !== null;
		if (read && hasSekine(assignment.enrollment.planDays, assignment.portion) && repetitions < 19) {
			throw new HttpError(CONFLICT, 'Complete all 19 Sekine repetitions first');
		}
		const delailRepetitions = input.delailRepetitions ?? assignment.delailRepetitions;
		if (
			read &&
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
			read &&
			hasIstighfar(assignment.enrollment.planDays, assignment.portion) &&
			(assignment.completedAt === null || changesIstighfar) &&
			istighfarRepetitions < istighfarTarget
		) {
			throw new HttpError(CONFLICT, 'Complete your selected istighfar repetitions first');
		}
		await tx.hizbAssignment.update({
			where: { id: assignment.id },
			data: {
				repetitions,
				delailRepetitions,
				istighfarRepetitions,
				istighfarTarget,
				bookmark: input.bookmark ?? assignment.bookmark,
				version: { increment: 1 },
				completedAt: read ? assignment.completedAt ?? new Date() : null
			}
		});
		if (input.read === true && assignment.completedAt === null) {
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
	return getHizbAssignment(user, groupId, assignmentId);
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
		const reads = await tx.hizbAssignment.findMany({
			where: { enrollment: { groupId }, day: today, completedAt: { not: null } },
			include: { enrollment: true }
		});
		const coverage = coverageFor(reads.map(a => ({ planDays: a.enrollment.planDays, portion: a.portion })));
		const mine = active.find(e => e.userId === viewerUserId);
		const own = mine
			? await tx.hizbAssignment.findUnique({ where: { enrollmentId_day: { enrollmentId: mine.id, day: today } } })
			: null;
		return {
			memberCount: active.length,
			readCount: group.hizbIndividual ? (own?.completedAt ? 1 : 0) : coverage.covered,
			partCount: group.hizbIndividual ? 1 : coverage.total,
			percent: group.hizbIndividual
				? own?.completedAt
					? 100
					: 0
				: Math.round((coverage.covered * 100) / coverage.total),
			completedAt: group.hizbIndividual
				? own?.completedAt?.toISOString() ?? null
				: coverage.complete
				? reads[0]?.completedAt?.toISOString() ?? null
				: null,
			hizbToday: mine
				? {
						planDays: mine.planDays,
						portion: portionForDay(
							mine.planDays,
							mine.sequence + group.hizbStartPortion - 1,
							today - civilDayNumber(group.startedAt ?? group.startsAt, group.timezone)
						),
						completed: own?.completedAt !== null && own?.completedAt !== undefined
				  }
				: null
		};
	});
}
