import { BAD_REQUEST, CONFLICT } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { partCountFor, requiredRepetitions } from '@utils/groupKinds';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { Group, Prisma } from '../generated/prisma/client';
import { requireMembership } from './groupAccess.service';
import { ensureCurrentRoundFor } from './rounds.service';

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
export type PartRepetitions = { count: number; required: number };

/**
 * Loads the group on its current round and checks the part is one that is repeated at all.
 *
 * `ensureCurrentRoundFor` comes first so that "the current round" — what a request without a
 * `roundIndex` means — is the one the calendar is on, not one the rollover is about to close.
 * A round the group has not reached is refused: a count for it would be waiting for somebody
 * the day the round opened, having been recited before it did.
 */
const loadRepeatedPart = async (
	userId: string,
	groupId: string,
	partNumber: number,
	roundIndex: number | undefined
) => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
	await ensureCurrentRoundFor(groupId);

	const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
	const isPart = Number.isInteger(partNumber) && partNumber >= 1 && partNumber <= partCountFor(group.kind);
	const required = isPart ? requiredRepetitions(group.kind, partNumber) : 0;

	if (required <= 1) {
		throw new HttpError(BAD_REQUEST, 'This part is not read more than once');
	}

	const round = roundIndex ?? group.roundIndex;

	if (round > group.roundIndex) {
		throw new HttpError(BAD_REQUEST, 'That round has not started');
	}

	return { group, normalizedUserId, required, round };
};

export const getPartRepetitionsForUser = async (
	userId: string,
	groupId: string,
	partNumber: number,
	roundIndex?: number
): Promise<PartRepetitions> => {
	const { normalizedUserId, required, round } = await loadRepeatedPart(userId, groupId, partNumber, roundIndex);

	const row = await prisma.groupPartRepetition.findUnique({
		where: {
			groupId_userId_roundIndex_partNumber: { groupId, userId: normalizedUserId, roundIndex: round, partNumber }
		},
		select: { count: true }
	});

	// No row is the ordinary state of a round nobody has started counting in.
	return { count: row?.count ?? 0, required };
};

/**
 * Sets the caller's count for a part, absolutely.
 *
 * **A value, not an increment.** The reader taps once per recitation and the client sends where
 * they are; a request retried after a dropped response then writes the same number twice rather
 * than counting one recitation as two.
 *
 * Refused before the hatim starts, for the same reason a read is: nothing is counted while a
 * group is still gathering, and a count written then would be waiting in the first round.
 */
export const setPartRepetitionsForUser = async (
	userId: string,
	groupId: string,
	partNumber: number,
	input: { count: number; roundIndex?: number | undefined }
): Promise<PartRepetitions> => {
	const { group, normalizedUserId, required, round } = await loadRepeatedPart(
		userId,
		groupId,
		partNumber,
		input.roundIndex
	);

	if (group.status !== 'RUNNING') {
		throw new HttpError(BAD_REQUEST, 'This hatim has not started yet');
	}

	if (!Number.isInteger(input.count) || input.count < 0 || input.count > required) {
		throw new HttpError(BAD_REQUEST, `The count must be between 0 and ${required}`);
	}

	const row = await prisma.groupPartRepetition.upsert({
		where: {
			groupId_userId_roundIndex_partNumber: { groupId, userId: normalizedUserId, roundIndex: round, partNumber }
		},
		create: { groupId, userId: normalizedUserId, roundIndex: round, partNumber, count: input.count },
		update: { count: input.count },
		select: { count: true }
	});

	return { count: row.count, required };
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
