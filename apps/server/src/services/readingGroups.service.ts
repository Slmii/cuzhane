import prisma from '@db/prisma';
import { HttpError } from '@config/httpError';
import { NOT_FOUND } from '@config/httpCodes';
import { HIZB_PLAN } from '../content/readingPlans';
import type { Prisma, ReadingGroup, ReadingMembership, ReadingCycle } from '../generated/prisma/client';
import { assignedPart, chooseStartingPart, cycleBoundary, stepAt, type ReadingCadence } from '@utils/readingRotation';
import { generateInviteCode, normalizeInviteCode } from '@utils/inviteCode';
import { normalizeUserId } from '@utils/normalizeUserId';

type Tx = Prisma.TransactionClient;
const missing = () => new HttpError(NOT_FOUND, 'Reading group or assignment not found');
const transact = <T>(work: (tx: Tx) => Promise<T>): Promise<T> =>
	prisma.$transaction(work, { maxWait: 20000, timeout: 20000 });

/** Every mutating path locks this row first, including lazy reads. No stale member arrays. */
const lockGroup = async (tx: Tx, groupId: string): Promise<ReadingGroup> => {
	const rows = await tx.$queryRaw<
		Array<{ id: string }>
	>`SELECT "id" FROM "ReadingGroup" WHERE "id" = ${groupId} FOR UPDATE`;
	if (!rows.length) {
		throw missing();
	}
	return tx.readingGroup.findUniqueOrThrow({ where: { id: groupId } });
};
const requireHistory = async (tx: Tx, groupId: string, userId: string) => {
	if (!(await tx.readingMembership.findFirst({ where: { groupId, userId } }))) {
		throw missing();
	}
};

const newCycle = async (tx: Tx, group: ReadingGroup, member: ReadingMembership, previous?: ReadingCycle) => {
	const late = previous?.completedAt && previous.completedAt > previous.endsAt;
	const scheduleAnchor = late ? previous.completedAt! : previous?.scheduleAnchor ?? member.joinedAt;
	const scheduleIndex = previous && !late ? previous.scheduleIndex + 1 : 0;
	return tx.readingCycle.create({
		data: {
			membershipId: member.id,
			index: previous ? previous.index + 1 : 0,
			scheduleAnchor,
			scheduleIndex,
			startedAt: cycleBoundary(scheduleAnchor, group.cadence, scheduleIndex, group.timezone),
			endsAt: cycleBoundary(scheduleAnchor, group.cadence, scheduleIndex + 1, group.timezone)
		}
	});
};

/** Backfills only due assignments; an unfinished cycle is a hard no-repeat gate. */
const materializeMember = async (tx: Tx, group: ReadingGroup, member: ReadingMembership, now: Date) => {
	if (!member.active) {
		return;
	}
	let cycle = await tx.readingCycle.findFirst({ where: { membershipId: member.id }, orderBy: { index: 'desc' } });
	if (!cycle) {
		cycle = await newCycle(tx, group, member);
	} else if (cycle.completedAt && now >= cycle.endsAt) {
		cycle = await newCycle(tx, group, member, cycle);
	}
	const duration = cycle.endsAt.getTime() - cycle.startedAt.getTime();
	const data = Array.from({ length: group.numberOfParts }, (_, ordinal) => ({
		cycleId: cycle.id,
		ordinal,
		partIndex: assignedPart(
			member.rotationOffset,
			member.joinedStep + cycle.index * group.numberOfParts + ordinal,
			group.numberOfParts
		),
		rotationStep: member.joinedStep + cycle.index * group.numberOfParts + ordinal,
		assignedAt: new Date(cycle.startedAt.getTime() + Math.floor((duration * ordinal) / group.numberOfParts))
	})).filter(assignment => assignment.assignedAt <= now);
	if (data.length) {
		await tx.readingAssignment.createMany({ data, skipDuplicates: true });
	}
};
const materializeGroup = async (tx: Tx, group: ReadingGroup, now: Date) => {
	const members = await tx.readingMembership.findMany({
		where: { groupId: group.id, active: true },
		orderBy: { joinSequence: 'asc' }
	});
	for (const member of members) {
		await materializeMember(tx, group, member, now);
	}
	return members;
};

const addMembership = async (tx: Tx, group: ReadingGroup, userId: string, displayName: string, now: Date) => {
	if (await tx.readingMembership.findFirst({ where: { groupId: group.id, userId, active: true } })) {
		return;
	}
	const members = await materializeGroup(tx, group, now);
	const currentParts: number[] = [];
	for (const member of members) {
		const current = await tx.readingAssignment.findFirst({
			where: { cycle: { membershipId: member.id } },
			orderBy: { rotationStep: 'desc' }
		});
		if (current) {
			currentParts.push(current.partIndex);
		}
	}
	const joinedStep = stepAt(group.startedAt, group.cadence, group.numberOfParts, group.timezone, now);
	const part = chooseStartingPart(group.numberOfParts, currentParts);
	const member = await tx.readingMembership.create({
		data: {
			groupId: group.id,
			userId,
			displayName,
			joinSequence: group.nextJoinSequence,
			rotationOffset: assignedPart(part, -joinedStep, group.numberOfParts),
			joinedStep,
			joinedAt: now
		}
	});
	await tx.readingGroup.update({ where: { id: group.id }, data: { nextJoinSequence: { increment: 1 } } });
	await materializeMember(tx, group, member, now);
};

const detail = async (tx: Tx, group: ReadingGroup, userId: string, now: Date) => {
	const memberships = await tx.readingMembership.findMany({
		where: { groupId: group.id, userId },
		orderBy: { joinSequence: 'asc' },
		include: {
			cycles: { orderBy: { index: 'asc' }, include: { assignments: { orderBy: { ordinal: 'asc' } } } }
		}
	});
	// Other members contribute only their current position, never their entire history.
	const activeMembers = await tx.readingMembership.findMany({
		where: { groupId: group.id, active: true },
		orderBy: { joinSequence: 'asc' },
		include: {
			cycles: {
				orderBy: { index: 'desc' },
				take: 1,
				include: { assignments: { orderBy: { ordinal: 'desc' }, take: 1 } }
			}
		}
	});
	const completedParts = await tx.readingAssignment.count({
		where: { cycle: { membership: { groupId: group.id } }, completedAt: { not: null } }
	});
	return {
		id: group.id,
		name: group.name,
		planKey: group.planKey,
		numberOfParts: group.numberOfParts,
		cadence: group.cadence,
		timezone: group.timezone,
		startedAt: group.startedAt,
		inviteCode: group.inviteCode,
		asOf: now,
		rotationStep: stepAt(group.startedAt, group.cadence, group.numberOfParts, group.timezone, now),
		members: activeMembers.map(m => ({
			id: m.id,
			userId: m.userId,
			displayName: m.displayName,
			joinSequence: m.joinSequence,
			rotationOffset: m.rotationOffset,
			joinedAt: m.joinedAt,
			currentPartIndex: m.cycles.at(-1)?.assignments.at(-1)?.partIndex ?? null
		})),
		myMemberships: memberships.map(m => ({
			id: m.id,
			joinSequence: m.joinSequence,
			rotationOffset: m.rotationOffset,
			joinedStep: m.joinedStep,
			joinedAt: m.joinedAt,
			leftAt: m.leftAt,
			active: m.active,
			completedCycles: m.cycles.filter(c => c.completedAt !== null).length,
			cycles: m.cycles.map(c => ({
				id: c.id,
				index: c.index,
				startedAt: c.startedAt,
				endsAt: c.endsAt,
				completedAt: c.completedAt,
				completedParts: c.assignments.filter(a => a.completedAt !== null).length,
				nextAssignmentAt:
					m.active && c.index === m.cycles.at(-1)?.index && c.assignments.length < group.numberOfParts
						? new Date(
								c.startedAt.getTime() +
									Math.floor(
										((c.endsAt.getTime() - c.startedAt.getTime()) * c.assignments.length) /
											group.numberOfParts
									)
						  )
						: null,
				assignments: c.assignments.map(a => ({
					...a,
					status: a.completedAt ? ('completed' as const) : ('pending' as const)
				}))
			}))
		})),
		collective: {
			completedParts,
			fullReadings: Math.floor(completedParts / group.numberOfParts),
			remainderParts: completedParts % group.numberOfParts
		}
	};
};

export const createReadingGroup = async (
	userId: string,
	displayName: string,
	input: { name: string; cadence: ReadingCadence; timezone: string },
	now = new Date()
) => {
	const user = normalizeUserId(userId);
	return transact(async tx => {
		const group = await tx.readingGroup.create({
			data: {
				...input,
				ownerUserId: user,
				inviteCode: generateInviteCode(),
				planKey: HIZB_PLAN.key,
				numberOfParts: HIZB_PLAN.parts.length,
				startedAt: now
			}
		});
		await addMembership(tx, group, user, displayName, now);
		return detail(tx, group, user, now);
	});
};
export const joinReadingGroup = async (userId: string, displayName: string, inviteCode: string, now = new Date()) => {
	const user = normalizeUserId(userId);
	return transact(async tx => {
		const found = await tx.readingGroup.findUnique({ where: { inviteCode: normalizeInviteCode(inviteCode) } });
		if (!found) {
			throw missing();
		}
		const group = await lockGroup(tx, found.id);
		await addMembership(tx, group, user, displayName, now);
		return detail(tx, group, user, now);
	});
};
export const getReadingGroup = async (userId: string, groupId: string, now = new Date()) => {
	const user = normalizeUserId(userId);
	return transact(async tx => {
		const group = await lockGroup(tx, groupId);
		await requireHistory(tx, groupId, user);
		await materializeGroup(tx, group, now);
		return detail(tx, group, user, now);
	});
};
export const listReadingGroups = async (userId: string) => {
	const user = normalizeUserId(userId);
	// Include former memberships so their pending readings and history remain reachable.
	return prisma.readingGroup.findMany({
		where: { memberships: { some: { userId: user } } },
		orderBy: { startedAt: 'desc' },
		select: {
			id: true,
			name: true,
			cadence: true,
			numberOfParts: true,
			memberships: { where: { userId: user }, select: { active: true } }
		}
	});
};
export const leaveReadingGroup = async (userId: string, groupId: string, now = new Date()) => {
	const user = normalizeUserId(userId);
	return transact(async tx => {
		const group = await lockGroup(tx, groupId);
		await requireHistory(tx, groupId, user);
		const member = await tx.readingMembership.findFirst({ where: { groupId, userId: user, active: true } });
		if (member) {
			// Capture everything owed up to departure; never generate a post-departure assignment.
			await materializeMember(tx, group, member, now);
			await tx.readingMembership.update({ where: { id: member.id }, data: { active: false, leftAt: now } });
		}
		return { success: true as const };
	});
};
export const completeReadingAssignment = async (
	userId: string,
	groupId: string,
	assignmentId: string,
	now = new Date()
) => {
	const user = normalizeUserId(userId);
	return transact(async tx => {
		const group = await lockGroup(tx, groupId);
		await requireHistory(tx, groupId, user);
		const assignment = await tx.readingAssignment.findFirst({
			where: { id: assignmentId, cycle: { membership: { groupId, userId: user } } },
			include: { cycle: true }
		});
		if (!assignment || assignment.assignedAt > now) {
			throw missing();
		}
		await tx.readingAssignment.updateMany({
			where: { id: assignmentId, completedAt: null },
			data: { completedAt: now }
		});
		const count = await tx.readingAssignment.count({
			where: { cycleId: assignment.cycleId, completedAt: { not: null } }
		});
		if (count === group.numberOfParts) {
			await tx.readingCycle.updateMany({
				where: { id: assignment.cycleId, completedAt: null },
				data: { completedAt: now }
			});
		}
		await materializeGroup(tx, group, now);
		return detail(tx, group, user, now);
	});
};
