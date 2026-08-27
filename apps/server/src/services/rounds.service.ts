import prisma from '@db/prisma';
import { ROUND_DAYS, roundEndsAt, roundIndexSince, roundStartedAtFor } from '@utils/rounds';
import type { Prisma } from '../generated/prisma/client';
import type { Group } from '../generated/prisma/client';

/**
 * Which round the calendar says a group should be on right now.
 *
 * "The calendar" means the group's own — boundaries are local midnights in `group.timezone`,
 * so a group in New York rolls at New York midnight for all of its members, wherever they are.
 */
export const expectedRoundIndex = (
	group: Pick<Group, 'cycle' | 'startedAt' | 'status' | 'timezone'>,
	now = new Date()
) =>
	group.status === 'RUNNING' && group.startedAt
		? roundIndexSince(group.startedAt, ROUND_DAYS[group.cycle], now, group.timezone)
		: 0;

/**
 * Rolls a group forward to whatever round the calendar is on, if it has fallen behind.
 *
 * There is no scheduler in this app, so the rollover happens lazily: the first request to
 * touch a group after a boundary performs it. A group nobody opens simply rolls when
 * someone opens it, which from the outside is indistinguishable from having rolled at
 * midnight — nothing observes a group except through these paths.
 *
 * The board is wiped rather than carried over: the cycle is a promise about *when*, so an
 * unfinished round ends unfinished. Nothing is lost — every read was already written to
 * `BabRead`, which this never touches.
 *
 * Returns true when it actually rolled, so callers can re-read the group.
 */
export const ensureCurrentRound = async (tx: Prisma.TransactionClient, groupId: string): Promise<boolean> => {
	const group = await tx.group.findUnique({
		where: { id: groupId },
		select: {
			id: true,
			cycle: true,
			spots: true,
			splitMode: true,
			status: true,
			startedAt: true,
			roundIndex: true,
			timezone: true
		}
	});

	if (!group || group.status !== 'RUNNING' || !group.startedAt) {
		return false;
	}

	const target = expectedRoundIndex(group);

	if (target <= group.roundIndex) {
		return false;
	}

	const startedAt = roundStartedAtFor(group.startedAt, ROUND_DAYS[group.cycle], target, group.timezone);

	// Guarded on the round we believe we are leaving, so two requests arriving together
	// after a boundary cannot both roll — the loser matches zero rows and stops here
	// rather than wiping a board the winner has already reset.
	const rolled = await tx.group.updateMany({
		where: { id: groupId, roundIndex: group.roundIndex },
		data: {
			roundIndex: target,
			roundStartedAt: startedAt,
			endsAt: roundEndsAt(startedAt, group.cycle, group.timezone),
			// A finished round's stamp belongs to that round, not to the fresh one.
			completedAt: null
		}
	});

	if (rolled.count === 0) {
		return false;
	}

	// The board starts empty. `BabRead` keeps the history, so this clears display state
	// only — see the note on `GroupBab` in the schema.
	await tx.groupBab.updateMany({
		where: { groupId },
		data: { readByUserId: null, readAt: null }
	});

	// Every pool claim expires with the round it was made in — "I'll cover this leftover
	// this time round", not a standing seat. Since `assignedUserId` now means nothing but a
	// claim, clearing the column outright is both the whole job and the simplest way to do
	// it: no need to work out which blocks were the pool in the round being left.
	//
	// This is also what reopens a group to joiners who were locked out because a member had
	// volunteered for the last free block.
	await tx.groupBab.updateMany({
		where: { groupId, assignedUserId: { not: null } },
		data: { assignedUserId: null }
	});

	return true;
};

/**
 * Brings a group up to date before anything reads or writes it. Every entry point that
 * touches a group goes through one of these, which is what makes the lazy rollover
 * invisible: by the time a request sees a group, it is on the right round.
 */
export const ensureCurrentRoundFor = async (groupId: string): Promise<void> => {
	await prisma.$transaction(tx => ensureCurrentRound(tx, groupId));
};

/**
 * The same for a list. Each group rolls in its own transaction so one failure can't take
 * the whole page down, and a group already on the right round costs a single indexed read.
 */
export const ensureCurrentRoundsFor = async (groupIds: string[]): Promise<void> => {
	for (const groupId of groupIds) {
		await ensureCurrentRoundFor(groupId);
	}
};
