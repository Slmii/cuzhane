import { BAD_REQUEST, CONFLICT, FORBIDDEN } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { normalizeUserId } from '@utils/normalizeUserId';
import { CUZ_COUNT } from '@utils/units';
import type { Group, Prisma } from '../generated/prisma/client';
import { lockGroup } from './babs.service';
import { requireMembership } from './groupAccess.service';
import { ensureCurrentRound } from './rounds.service';

/**
 * **The round-start screen's two answers (QR1): pick cüz, or sit the round out.**
 *
 * A member of a running hatim must hold a cüz to open the group — under "Yeniden seçilir"
 * everyone starts each round with nothing, and under "Cüzler korunur" a member whose cüz were
 * all loans does too. These are the two ways past that screen. Neither is the havuz: a cüz
 * taken there is a *loan* for the rest of the round, while a pick is the member's own, and
 * is what "Cüzler korunur" carries into the next round.
 */

/** Locked, rolled forward, and checked to be a running hatim — what both answers need first. */
const loadRunningHatim = async (tx: Prisma.TransactionClient, groupId: string, userId: string): Promise<Group> => {
	// Group lock first, then holdings — the order every mutating path uses, so this can't
	// deadlock against a rollover running at the same moment.
	await lockGroup(tx, groupId);

	// Membership again, now under the lock: the check before the transaction can be overtaken by
	// a removal, and a pick that lands after one would hold cüz for somebody no longer here.
	const member = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });

	if (!member) {
		throw new HttpError(FORBIDDEN, 'You are not a member of this group');
	}

	await ensureCurrentRound(tx, groupId);

	const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });

	if (group.kind !== 'HATIM') {
		throw new HttpError(BAD_REQUEST, 'This group does not read cüz');
	}

	if (group.status !== 'RUNNING') {
		throw new HttpError(BAD_REQUEST, 'This hatim has not started yet');
	}

	return group;
};

/**
 * Takes cüz for the round the group is on, as the member's own.
 *
 * The same rules as joining with a pick: at least one, free, and within the per-person cap —
 * counting what the member already holds this round, loans included, since the cap is what one
 * person may hold. All or nothing: a pick of two where one has just been taken takes neither,
 * rather than leaving the member with half of what they chose.
 *
 * Picking after skipping takes the skip back: holding a cüz is the answer the skip stood in for.
 */
export const pickRoundCuzForUser = async (
	userId: string,
	groupId: string,
	cuzNumbers: number[]
): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	const chosen = [...new Set(cuzNumbers)];

	if (chosen.length === 0) {
		throw new HttpError(BAD_REQUEST, 'Pick at least one cüz');
	}

	if (chosen.some(cuzNumber => !Number.isInteger(cuzNumber) || cuzNumber < 1 || cuzNumber > CUZ_COUNT)) {
		throw new HttpError(BAD_REQUEST, 'Invalid cüz number');
	}

	await prisma
		.$transaction(async tx => {
			const group = await loadRunningHatim(tx, groupId, normalizedUserId);
			const held = await tx.cuzHolding.findMany({
				select: { cuzNumber: true, userId: true },
				where: { groupId, roundIndex: group.roundIndex }
			});

			const clash = chosen.find(cuzNumber => held.some(holding => holding.cuzNumber === cuzNumber));

			if (clash !== undefined) {
				throw new HttpError(CONFLICT, `Cüz ${clash} has already been taken`);
			}

			const alreadyMine = held.filter(holding => holding.userId === normalizedUserId).length;

			if (group.maxPerMember !== null && alreadyMine + chosen.length > group.maxPerMember) {
				throw new HttpError(BAD_REQUEST, `You may hold at most ${group.maxPerMember} cüz in this group`);
			}

			// No `skipDuplicates`: the unique key on `(groupId, roundIndex, cuzNumber)` is the last
			// word on two members reaching for one cüz at once, and the loser's whole pick fails.
			await tx.cuzHolding.createMany({
				data: chosen.map(cuzNumber => ({
					cuzNumber,
					groupId,
					isLoan: false,
					roundIndex: group.roundIndex,
					userId: normalizedUserId
				}))
			});

			await tx.cuzRoundSkip.deleteMany({
				where: { groupId, roundIndex: group.roundIndex, userId: normalizedUserId }
			});
		})
		.catch((error: unknown) => {
			// The unique key settled a race the check above could not see: somebody took one of
			// these cüz in the same instant. The same answer the check gives, not a 500.
			if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
				throw new HttpError(CONFLICT, 'One of these cüz has just been taken');
			}

			throw error;
		});

	return { success: true };
};

/**
 * "Bu turu atla" — the member's cüz go back to the havuz for everyone else, the group opens for
 * them with nothing to read, and the next round asks again.
 *
 * **Refused once they have read a cüz this round.** Skipping after a read would hand back a cüz
 * the board shows as read — the havuz would offer something finished. A read the member undid
 * ("Geri al") is no longer one, so it does not stand in the way. Sitting the round out is a
 * choice for its start.
 */
export const skipRoundForUser = async (userId: string, groupId: string): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);
	await requireMembership(normalizedUserId, groupId);

	await prisma.$transaction(async tx => {
		const group = await loadRunningHatim(tx, groupId, normalizedUserId);
		const readThisRound = await tx.babRead.count({
			where: { groupId, roundIndex: group.roundIndex, userId: normalizedUserId }
		});

		if (readThisRound > 0) {
			throw new HttpError(CONFLICT, 'You have already read this round and cannot skip it');
		}

		await tx.cuzHolding.deleteMany({ where: { groupId, roundIndex: group.roundIndex, userId: normalizedUserId } });
		await tx.cuzRoundSkip.createMany({
			data: [{ groupId, roundIndex: group.roundIndex, userId: normalizedUserId }],
			skipDuplicates: true
		});
	});

	return { success: true };
};
