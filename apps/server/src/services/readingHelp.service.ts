import prisma from '@db/prisma';
import { BAD_REQUEST, CONFLICT, FORBIDDEN, NOT_FOUND } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import { normalizeUserId } from '@utils/normalizeUserId';
import { isAnonymousTo } from '@utils/groupPrivacy';
import { civilDayNumber, roundIndexSince, roundLengthFor } from '@utils/rounds';
import { hasSekine, hasDelailRepetition, hasIstighfar } from '@utils/hizbPlans';
import type {
	Prisma,
	ReadingHelp,
	Group,
	GroupMember,
	HizbAssignment,
	HizbEnrollment
} from '../generated/prisma/client';
import { ensureCurrentRound, lockGroup } from './rounds.service';
import { babNumbersInRound } from './groupSerializers';
import { syncCompletedAt } from './babs.service';
import { updateHizbAssignmentInTransaction } from './hizbReading.service';
import { notifyHizbRead } from './hizbReadNotice.service';
import { assertRepetitionsMet } from './repetitions.service';

type Tx = Prisma.TransactionClient;
type Help = ReadingHelp & { assignment: (HizbAssignment & { enrollment: HizbEnrollment }) | null };
const include = { assignment: { include: { enrollment: true } } } as const;
export type HelpTarget = { assignmentId?: string; roundIndex?: number };
export type HelpAction = 'claim' | 'release' | 'cancel' | 'complete';

async function context(tx: Tx, user: string, groupId: string) {
	await lockGroup(tx, groupId);
	let group = await tx.group.findUnique({ where: { id: groupId }, include: { members: true } });
	if (!group || !group.members.some(m => m.userId === user)) {
		throw new HttpError(FORBIDDEN, 'You must belong to this group');
	}
	if (group.hizbIndividual || group.status !== 'RUNNING') {
		throw new HttpError(BAD_REQUEST, 'Help is available in active shared groups');
	}
	// A seat-divided share is seat arithmetic. A hatim's cüz are stored holdings and a flexible group has no
	// shares at all, so neither has a "my reading" to hand over.
	if (group.hizbPlan === null && (group.kind === 'HATIM' || group.splitMode === 'FLEXIBLE')) {
		throw new HttpError(BAD_REQUEST, 'Help is available in Cevşen and Hizb groups');
	}
	if (group.hizbPlan === null) {
		await ensureCurrentRound(tx, groupId);
		group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, include: { members: true } });
	}
	// A departed helper must not hold a request indefinitely.
	const abandoned = await tx.readingHelp.findMany({
		where: { groupId, helperUserId: { not: null, notIn: group.members.map(m => m.userId) } }
	});
	for (const r of abandoned) {
		await tx.readingHelp.update({ where: { id: r.id }, data: { helperUserId: null, version: { increment: 1 } } });
		if (r.assignmentId) {
			await tx.hizbAssignment.update({ where: { id: r.assignmentId }, data: { version: { increment: 1 } } });
		}
	}
	return group;
}

async function remaining(tx: Tx, r: Help) {
	if (r.assignment) {
		return r.assignment.completedAt ? [] : [r.assignment.portion];
	}
	const reads = await tx.babRead.findMany({
		where: { groupId: r.groupId, roundIndex: r.roundIndex!, babNumber: { in: r.babNumbers } },
		select: { babNumber: true }
	});
	const done = new Set(reads.map(b => b.babNumber));
	return r.babNumbers.filter(n => !done.has(n));
}

async function serialize(tx: Tx, r: Help, user: string, group: Group & { members: GroupMember[] }) {
	const unread = await remaining(tx, r);
	return {
		id: r.id,
		version: r.version,
		assignmentId: r.assignmentId,
		roundIndex: r.roundIndex,
		babNumbers: r.babNumbers,
		remainingNumbers: unread,
		kind: group.kind,
		planDays: r.assignment?.enrollment.planDays ?? null,
		portion: r.assignment?.portion ?? null,
		date: r.assignment ? new Date(r.assignment.day * 86400000).toISOString().slice(0, 10) : null,
		mine: r.requesterUserId === user,
		takenByMe: r.helperUserId === user,
		claimed: r.helperUserId !== null,
		completed: unread.length === 0,
		requesterName: isAnonymousTo(group, user, r.requesterUserId)
			? null
			: group.members.find(m => m.userId === r.requesterUserId)?.displayName ?? null
	};
}

export async function listReadingHelp(userId: string, groupId: string) {
	const user = normalizeUserId(userId);
	return prisma.$transaction(async tx => {
		const group = await context(tx, user, groupId);
		const requests = await tx.readingHelp.findMany({
			where: { groupId, requesterUserId: { in: group.members.map(m => m.userId) } },
			include,
			orderBy: { createdAt: 'desc' }
		});
		const items = await Promise.all(requests.map(r => serialize(tx, r, user, group)));
		// Completed requests remain visible to the requester and helper as confirmation.
		return items.filter(r => !r.completed || r.mine || r.takenByMe);
	});
}

export async function requestReadingHelp(userId: string, groupId: string, target: HelpTarget) {
	const user = normalizeUserId(userId);
	return prisma.$transaction(async tx => {
		const group = await context(tx, user, groupId);
		const member = group.members.find(m => m.userId === user)!;
		let babNumbers: number[] = [];
		let assignmentId: string | null = null;
		let roundIndex: number | null = null;
		let targetKey: string;
		if (group.hizbPlan !== null) {
			if (!target.assignmentId || target.roundIndex !== undefined) {
				throw new HttpError(BAD_REQUEST, 'Choose a reading');
			}
			const a = await tx.hizbAssignment.findFirst({
				where: { id: target.assignmentId, enrollment: { groupId, userId: user } }
			});
			if (!a || a.day > civilDayNumber(new Date(), group.timezone)) {
				throw new HttpError(NOT_FOUND, 'Reading not found');
			}
			if (a.completedAt) {
				throw new HttpError(CONFLICT, 'This reading is already complete');
			}
			assignmentId = a.id;
			targetKey = `assignment:${a.id}`;
		} else {
			roundIndex = target.roundIndex ?? group.roundIndex;
			const joinedRound = roundIndexSince(
				group.startedAt!,
				roundLengthFor(group),
				member.joinedAt,
				group.timezone
			);
			if (
				target.assignmentId ||
				!Number.isInteger(roundIndex) ||
				roundIndex < Math.max(0, joinedRound) ||
				roundIndex > group.roundIndex
			) {
				throw new HttpError(BAD_REQUEST, 'Invalid round');
			}
			babNumbers = babNumbersInRound(group, member.slotIndex, roundIndex);
			if (roundIndex === group.roundIndex) {
				const claimed = await tx.groupBab.findMany({
					where: { groupId, assignedUserId: user },
					select: { number: true }
				});
				babNumbers = [...new Set([...babNumbers, ...claimed.map(b => b.number)])].sort((a, b) => a - b);
			}
			const reads = await tx.babRead.findMany({
				where: { groupId, roundIndex, babNumber: { in: babNumbers } },
				select: { babNumber: true }
			});
			const done = new Set(reads.map(b => b.babNumber));
			babNumbers = babNumbers.filter(n => !done.has(n));
			if (!babNumbers.length) {
				throw new HttpError(CONFLICT, 'There is no unread share to request help for');
			}
			// Each request keeps its original commitment. Extra pool passages can be offered later.
			const existing = await tx.readingHelp.findMany({
				where: { groupId, requesterUserId: user, roundIndex },
				include
			});
			const alreadyRequested = new Set(existing.flatMap(r => r.babNumbers));
			const newNumbers = babNumbers.filter(n => !alreadyRequested.has(n));
			if (!newNumbers.length) {
				const active = existing.find(r => r.babNumbers.some(n => babNumbers.includes(n)));
				if (active) {
					return serialize(tx, active, user, group);
				}
			}
			babNumbers = newNumbers;
			targetKey = `round:${roundIndex}:${babNumbers.join(',')}`;
		}
		const r = await tx.readingHelp.upsert({
			where: { groupId_requesterUserId_targetKey: { groupId, requesterUserId: user, targetKey } },
			create: { groupId, requesterUserId: user, targetKey, assignmentId, roundIndex, babNumbers },
			update: {},
			include
		});
		return serialize(tx, r, user, group);
	});
}

export async function actOnReadingHelp(
	userId: string,
	groupId: string,
	id: string,
	action: HelpAction,
	version: number
) {
	const user = normalizeUserId(userId);
	// The portions to tell the group about once a completed reading has committed.
	let announced: number[] | null = null;
	const result = await prisma.$transaction(async tx => {
		const group = await context(tx, user, groupId);
		const r = await tx.readingHelp.findFirst({ where: { id, groupId }, include });
		if (!r || !group.members.some(m => m.userId === r.requesterUserId)) {
			throw new HttpError(NOT_FOUND, 'Request not found');
		}
		if (!Number.isInteger(version) || r.version !== version) {
			throw new HttpError(CONFLICT, 'Request changed. Refresh and try again.');
		}
		const unread = await remaining(tx, r);
		if (!unread.length) {
			throw new HttpError(CONFLICT, 'This reading is already complete');
		}
		if (action === 'claim') {
			if (r.requesterUserId === user || r.helperUserId) {
				throw new HttpError(CONFLICT, 'This request cannot be taken');
			}
			await tx.readingHelp.update({ where: { id }, data: { helperUserId: user, version: { increment: 1 } } });
		} else if (action === 'cancel') {
			if (r.requesterUserId !== user) {
				throw new HttpError(FORBIDDEN, 'Only the requester can cancel');
			}
			await tx.readingHelp.delete({ where: { id } });
		} else if (action === 'release' || action === 'complete') {
			if (r.helperUserId !== user) {
				throw new HttpError(FORBIDDEN, 'Take the request first');
			}
			if (action === 'release') {
				await tx.readingHelp.update({ where: { id }, data: { helperUserId: null, version: { increment: 1 } } });
			} else if (r.assignment) {
				const a = r.assignment;
				announced = await updateHizbAssignmentInTransaction(tx, user, groupId, a.id, {
					version: a.version,
					read: true,
					...(hasSekine(a.enrollment.planDays, a.portion) ? { repetitions: 19 } : {}),
					...(hasDelailRepetition(a.enrollment.planDays, a.portion) ? { delailRepetitions: 3 } : {}),
					...(hasIstighfar(a.enrollment.planDays, a.portion)
						? { istighfarRepetitions: Math.max(a.istighfarRepetitions, a.istighfarTarget) }
						: {})
				});
			} else {
				// Confirmation means these passages have actually been read. Existing reads keep their author.
				await assertRepetitionsMet(tx, { group, userId: user, roundIndex: r.roundIndex!, babNumbers: unread });
				await tx.babRead.createMany({
					data: unread.map(babNumber => ({ groupId, roundIndex: r.roundIndex!, babNumber, userId: user })),
					skipDuplicates: true
				});
				if (r.roundIndex === group.roundIndex) {
					await tx.groupBab.updateMany({
						where: { groupId, number: { in: unread }, readAt: null },
						data: { readAt: new Date(), readByUserId: user }
					});
					await syncCompletedAt(tx, groupId);
				}
			}
		} else {
			throw new HttpError(BAD_REQUEST, 'Invalid action');
		}
		if (r.assignmentId && action !== 'complete') {
			await tx.hizbAssignment.update({ where: { id: r.assignmentId }, data: { version: { increment: 1 } } });
		}
		return { success: true as const };
	});
	if (announced) {
		await notifyHizbRead({ groupId, portions: announced, readerId: user });
	}
	return result;
}
