import { BAD_REQUEST, CONFLICT } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { partCountFor, requiredRepetitions } from '@utils/groupKinds';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { Group, Prisma } from '../generated/prisma/client';
import { requireMembership } from './groupAccess.service';
import { ensureCurrentRound, ensureCurrentRoundFor, lockGroup } from './rounds.service';

/**
 * A part that has to be read more than once before it counts — Sekine, nineteen times from its
 * Besmele — and how far one reader has got with it.
 *
 * **The count is the reader's own and the round's own.** Sekine is one person's recitation, so
 * another member's nineteen cannot stand in for mine; and a round is a fresh pass at the whole
 * text, so last round's nineteen say nothing about this one. That is the row's unique key, and
 * it is why nothing here is ever reset: a new round simply has no row yet.
 *
 * **Nothing about the board lives here.** The part is still marked read through the ordinary
 * read paths, which keep `GroupBab`, `BabRead` and `completedAt` in step; this only decides
 * whether they may. Undoing a read never looks at it, and leaves the count where it was.
 */
/**
 * `roundIndex` is the round the count belongs to — the one asked about, or the current one when
 * nothing was named. A client counting in the open round learns from it which round that is.
 */
export type PartRepetitions = { count: number; required: number; roundIndex: number };

/**
 * Checks the part is one that is repeated at all, and resolves which round is meant.
 *
 * The caller has already rolled the group, so "the current round" — what a request without a
 * `roundIndex` means — is the one the calendar is on, not one the rollover is about to close.
 * A round the group has not reached is refused: a count for it would be waiting for somebody
 * the day the round opened, having been recited before it did.
 */
const resolveRepeatedPart = (
	group: Pick<Group, 'kind' | 'roundIndex'>,
	partNumber: number,
	roundIndex: number | undefined
) => {
	const isPart = Number.isInteger(partNumber) && partNumber >= 1 && partNumber <= partCountFor(group.kind);
	const required = isPart ? requiredRepetitions(group.kind, partNumber) : 0;

	if (required <= 1) {
		throw new HttpError(BAD_REQUEST, 'This part is not read more than once');
	}

	const round = roundIndex ?? group.roundIndex;

	if (round > group.roundIndex) {
		throw new HttpError(BAD_REQUEST, 'That round has not started');
	}

	return { required, round };
};

/** Rolls first, like every read path, and needs no lock: a read that races a rollover is only a moment stale. */
export const getPartRepetitionsForUser = async (
	userId: string,
	groupId: string,
	partNumber: number,
	roundIndex?: number
): Promise<PartRepetitions> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
	await ensureCurrentRoundFor(groupId);

	const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
	const { required, round } = resolveRepeatedPart(group, partNumber, roundIndex);

	const row = await prisma.groupPartRepetition.findUnique({
		where: {
			groupId_userId_roundIndex_partNumber: { groupId, userId: normalizedUserId, roundIndex: round, partNumber }
		},
		select: { count: true }
	});

	// No row is the ordinary state of a round nobody has started counting in.
	return { count: row?.count ?? 0, required, roundIndex: round };
};

/**
 * Sets the caller's count for a part, absolutely.
 *
 * **A value, not an increment.** The reader taps once per recitation and the client sends where
 * they are; a request retried after a dropped response then writes the same number twice rather
 * than counting one recitation as two.
 *
 * **One transaction, group lock first**, the order every write path uses. Rolling in a
 * transaction of its own and writing after it left a window at midnight: a boundary passing
 * between the two filed a tap made in the new round under the one just closed.
 *
 * Refused before the hatim starts, for the same reason a read is: nothing is counted while a
 * group is still gathering, and a count written then would be waiting in the first round.
 *
 * **`isOpenRound` makes the named round a precondition.** The reader counting in the open round
 * names the round it is showing, and learns that the group has rolled only when it next asks —
 * so for a moment after a boundary it still names the round that just closed. Without the flag
 * those taps are filed under the closed round and the read that follows is refused for a count
 * the open round never got. Omitting the round instead is no better: the count is absolute, so
 * the number computed against the closed round would be written into the new one, carrying
 * yesterday's recitations over. Refusing (409) writes nothing wrong anywhere, and tells the
 * client to fetch the group and count again in the round that is actually open. A count for a
 * closed round on purpose — covering it — leaves the flag off.
 */
export const setPartRepetitionsForUser = async (
	userId: string,
	groupId: string,
	partNumber: number,
	input: { count: number; roundIndex?: number | undefined; isOpenRound?: boolean | undefined }
): Promise<PartRepetitions> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	return prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
		const { required, round } = resolveRepeatedPart(group, partNumber, input.roundIndex);

		if (group.status !== 'RUNNING') {
			throw new HttpError(BAD_REQUEST, 'This hatim has not started yet');
		}

		// The schema already holds it to a whole number from zero; only the ceiling is the part's own.
		if (input.count > required) {
			throw new HttpError(BAD_REQUEST, `The count must be between 0 and ${required}`);
		}

		if (input.isOpenRound && round !== group.roundIndex) {
			throw new HttpError(CONFLICT, 'That round has closed');
		}

		const row = await tx.groupPartRepetition.upsert({
			where: {
				groupId_userId_roundIndex_partNumber: {
					groupId,
					userId: normalizedUserId,
					roundIndex: round,
					partNumber
				}
			},
			create: { groupId, userId: normalizedUserId, roundIndex: round, partNumber, count: input.count },
			update: { count: input.count },
			select: { count: true }
		});

		return { count: row.count, required, roundIndex: round };
	});
};

/**
 * Refuses a read of any part the caller has not yet repeated enough times **in that round**.
 *
 * Every path that marks a part read calls this before it writes — the single read, "read my
 * whole share", and covering a closed round, which passes that round's index rather than the
 * current one. It reads only the caller's rows, so another member's count never satisfies it.
 * Parts that are read once cost nothing: they are filtered out before any query runs, so a
 * Cevşen group never touches the table.
 */
export const assertRepetitionsMet = async (
	tx: Prisma.TransactionClient,
	input: { group: Pick<Group, 'id' | 'kind'>; userId: string; roundIndex: number; babNumbers: number[] }
): Promise<void> => {
	const { group, userId, roundIndex, babNumbers } = input;
	const repeated = babNumbers.filter(number => requiredRepetitions(group.kind, number) > 1);

	if (repeated.length === 0) {
		return;
	}

	const rows = await tx.groupPartRepetition.findMany({
		where: { groupId: group.id, userId, roundIndex, partNumber: { in: repeated } },
		select: { partNumber: true, count: true }
	});
	const countByPart = new Map(rows.map(row => [row.partNumber, row.count]));
	const short = repeated.find(number => (countByPart.get(number) ?? 0) < requiredRepetitions(group.kind, number));

	if (short !== undefined) {
		throw new HttpError(
			CONFLICT,
			`Part ${short} must be read ${requiredRepetitions(group.kind, short)} times first`
		);
	}
};
