import { BAD_REQUEST, CONFLICT } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { isPersonalPlan } from '@utils/groupKinds';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { Group } from '../generated/prisma/client';
import { requireMembership } from './groupAccess.service';
import { ensureCurrentRound, ensureCurrentRoundFor, lockGroup } from './rounds.service';

/**
 * One reader's Delâil and istighfar counts in a seat-divided Hizb group, for one round — the two
 * counters the reader draws besides Sekine's.
 *
 * **Kept, not gating.** The reader holds its next page until a count on that page is done; these
 * rows only mean a reader who closes the app finds the count where they left it. Marking a portion
 * read is still gated by Sekine alone (`assertRepetitionsMet`).
 *
 * **The reader's own and the round's own**, as Sekine's count is: a new round has no row yet, so
 * nothing is ever reset. A personal-plan reading keeps its counts on its own day instead
 * (`HizbAssignment`).
 */
export type RoundCounters = {
	delailCount: number;
	istighfarCount: number;
	istighfarTarget: number;
	roundIndex: number;
};

/** The Delâil salavat is read three times; the istighfar count and its target are the plan reader's bounds. */
const DELAIL_MAX = 3;
const ISTIGHFAR_MAX = 100;
const ISTIGHFAR_TARGET_DEFAULT = 11;

/** Only a seat-divided Hizb group has these counters, and only for a round it has reached. */
const resolveRound = (group: Pick<Group, 'kind' | 'roundIndex' | 'hizbPlan' | 'planDays'>, roundIndex?: number) => {
	if (group.kind !== 'HIZB' || isPersonalPlan(group)) {
		throw new HttpError(BAD_REQUEST, 'This group has no round counters');
	}

	const round = roundIndex ?? group.roundIndex;

	if (round > group.roundIndex) {
		throw new HttpError(BAD_REQUEST, 'That round has not started');
	}

	return round;
};

const countersOf = (
	row: { delailCount: number; istighfarCount: number; istighfarTarget: number } | null,
	roundIndex: number
): RoundCounters => ({
	delailCount: row?.delailCount ?? 0,
	istighfarCount: row?.istighfarCount ?? 0,
	istighfarTarget: row?.istighfarTarget ?? ISTIGHFAR_TARGET_DEFAULT,
	roundIndex
});

/** Rolls first, like every read path. No row is a round nobody has started counting in. */
export const getRoundCountersForUser = async (
	userId: string,
	groupId: string,
	roundIndex?: number
): Promise<RoundCounters> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);
	await ensureCurrentRoundFor(groupId);

	const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
	const round = resolveRound(group, roundIndex);
	const row = await prisma.groupRoundCounter.findUnique({
		where: { groupId_userId_roundIndex: { groupId, userId: normalizedUserId, roundIndex: round } },
		select: { delailCount: true, istighfarCount: true, istighfarTarget: true }
	});

	return countersOf(row, round);
};

/**
 * Sets the caller's counts, absolutely — a value, never an increment, so a retried request writes
 * the same number twice rather than counting one recitation as two. Only the fields sent change.
 *
 * One transaction, group lock first, as Sekine's count is written; `isOpenRound` makes the named
 * round a precondition (409 once it has closed) for the same reason it does there.
 */
export const setRoundCountersForUser = async (
	userId: string,
	groupId: string,
	input: {
		delailCount?: number | undefined;
		istighfarCount?: number | undefined;
		istighfarTarget?: number | undefined;
		roundIndex?: number | undefined;
		isOpenRound?: boolean | undefined;
	}
): Promise<RoundCounters> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	return prisma.$transaction(async tx => {
		await lockGroup(tx, groupId);
		await ensureCurrentRound(tx, groupId);

		const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
		const round = resolveRound(group, input.roundIndex);

		if (group.status !== 'RUNNING') {
			throw new HttpError(BAD_REQUEST, 'This group has not started yet');
		}

		if (input.isOpenRound && round !== group.roundIndex) {
			throw new HttpError(CONFLICT, 'That round has closed');
		}

		if (input.delailCount !== undefined && input.delailCount > DELAIL_MAX) {
			throw new HttpError(BAD_REQUEST, `The Delâil count must be between 0 and ${DELAIL_MAX}`);
		}

		if (input.istighfarCount !== undefined && input.istighfarCount > ISTIGHFAR_MAX) {
			throw new HttpError(BAD_REQUEST, `The istighfar count must be between 0 and ${ISTIGHFAR_MAX}`);
		}

		if (input.istighfarTarget !== undefined && input.istighfarTarget > ISTIGHFAR_MAX) {
			throw new HttpError(BAD_REQUEST, `Choose between 1 and ${ISTIGHFAR_MAX} istighfar repetitions`);
		}

		const changes = {
			...(input.delailCount === undefined ? {} : { delailCount: input.delailCount }),
			...(input.istighfarCount === undefined ? {} : { istighfarCount: input.istighfarCount }),
			...(input.istighfarTarget === undefined ? {} : { istighfarTarget: input.istighfarTarget })
		};
		const row = await tx.groupRoundCounter.upsert({
			where: { groupId_userId_roundIndex: { groupId, userId: normalizedUserId, roundIndex: round } },
			create: { groupId, userId: normalizedUserId, roundIndex: round, ...changes },
			update: changes,
			select: { delailCount: true, istighfarCount: true, istighfarTarget: true }
		});

		return countersOf(row, round);
	});
};
