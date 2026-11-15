import prisma from '@db/prisma';
import { roundEndsAt, roundIndexSince, roundLengthFor, roundStartedAtFor } from '@utils/rounds';
import type { Prisma } from '../generated/prisma/client';
import type { Group } from '../generated/prisma/client';

/**
 * Takes the group row's write lock for the rest of the caller's transaction.
 *
 * Every path that mutates a group's board takes this FIRST, before touching any bab. The
 * rollover locks the group and then the babs, so a path that grabbed babs first would
 * deadlock against it — this keeps one lock order everywhere. Re-taking it inside the same
 * transaction is free, which is why `syncCompletedAt` can call it unconditionally.
 *
 * It lives here, beside the rollover it orders against, rather than in `babs.service`: the
 * services that take it import this file already, so none of them has to import another
 * service — and `babs.service` itself imports one that takes it.
 */
export const lockGroup = async (tx: Prisma.TransactionClient, groupId: string): Promise<void> => {
	await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
};

/**
 * Which round the calendar says a group should be on right now.
 *
 * "The calendar" means the group's own — boundaries are local midnights in `group.timezone`,
 * so a group in New York rolls at New York midnight for all of its members, wherever they are —
 * and its own length, which `roundLengthFor` reads (days, or a Hizb's calendar month).
 */
export const expectedRoundIndex = (
	group: Pick<Group, 'cycle' | 'kind' | 'roundDays' | 'startedAt' | 'status' | 'timezone'>,
	now = new Date()
) => {
	/*
	 * **A CUSTOM group never leaves round 0 — it is a length, not a cadence.**
	 *
	 * The three presets are promises about *when it comes round again*: a daily group rolls
	 * every day, a weekly one every seven. "Özel" is the other kind of answer — a hatim that
	 * runs for the number of days chosen and is then finished. Rolling it would start a
	 * second pass nobody asked for, wipe the board that had just been completed, and do it
	 * again every N days for ever.
	 *
	 * Pinned here rather than guarded at each call site because this function is the single
	 * place the rollover asks what round a group should be on.
	 */
	if (group.cycle === 'CUSTOM') {
		return 0;
	}

	return group.status === 'RUNNING' && group.startedAt
		? roundIndexSince(group.startedAt, roundLengthFor(group), now, group.timezone)
		: 0;
};

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
			kind: true,
			boundaryPolicy: true,
			roundDays: true,
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

	const startedAt = roundStartedAtFor(group.startedAt, roundLengthFor(group), target, group.timezone);

	// Guarded on the round we believe we are leaving, so two requests arriving together
	// after a boundary cannot both roll — the loser matches zero rows and stops here
	// rather than wiping a board the winner has already reset.
	const rolled = await tx.group.updateMany({
		where: { id: groupId, roundIndex: group.roundIndex },
		data: {
			roundIndex: target,
			roundStartedAt: startedAt,
			endsAt: roundEndsAt(group.startedAt, roundLengthFor(group), target, group.timezone),
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

	/*
	 * **A hatim's holdings do not survive on their own — they are per round.**
	 *
	 * `CuzHolding` is keyed by `(groupId, roundIndex, cuzNumber)`, so the moment the index
	 * moves every member holds nothing: the share is empty, the whole board is pool, and a
	 * group that was half read wakes up looking abandoned. Nothing shouted, because an empty
	 * result is a valid answer to "what do you hold".
	 *
	 * Which of the two things should happen is what QC3's "Tur bitiminde" asked:
	 *
	 * · `KEEP` — everyone carries on with the cüz they had. Copied forward from the round
	 *   being *left*, not from the target, because a group nobody opened for three rounds
	 *   rolls straight from the last one anybody touched.
	 * · `REPICK` — the map empties and everyone chooses again, which is this doing nothing.
	 *
	 * **A loan is never carried, under either policy.** A cüz taken out of the havuz
	 * mid-round is "I'll cover this spare one this time round", not a cüz you joined with —
	 * so it goes back to the havuz at the boundary, exactly as a Cevşen pool claim does when
	 * the rollover clears `assignedUserId`. Without the filter, KEEP would quietly turn every
	 * favour into a permanent holding and the havuz would drain one round at a time.
	 *
	 * `skipDuplicates` because the unique key is the safety net: two requests arriving
	 * together are already settled by the guarded `updateMany` above, and a row that somehow
	 * exists is the outcome we wanted anyway.
	 */
	if (group.kind === 'HATIM' && group.boundaryPolicy === 'KEEP') {
		const carried = await tx.cuzHolding.findMany({
			select: { cuzNumber: true, userId: true },
			where: { groupId, isLoan: false, roundIndex: group.roundIndex }
		});

		if (carried.length > 0) {
			await tx.cuzHolding.createMany({
				data: carried.map(holding => ({
					cuzNumber: holding.cuzNumber,
					groupId,
					roundIndex: target,
					userId: holding.userId
				})),
				skipDuplicates: true
			});
		}
	}

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
