import { BAD_REQUEST } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { LEGACY_TOUR_HINT_IDS } from '@utils/legacyTourHints';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { Prisma } from '../generated/prisma/client';

/** A wall against a loop inventing ids, far above the app's own hints. */
export const MAX_SEEN_HINTS = 200;

const WELCOME_HINT_ID = 'welcome';

export type HintsState = {
	seenIds: string[];
	enabled: boolean;
};

type Db = Prisma.TransactionClient | typeof prisma;

/** What the app needs: the hints already seen — the old tour's too, for a tour account — and the switch. */
const hintsStateFor = async (db: Db, userId: string): Promise<HintsState> => {
	// One after the other: inside a transaction both share a single connection.
	const settings = await db.userSettings.findUnique({
		where: { userId },
		select: { hasSeenTour: true, hintsEnabled: true }
	});
	const rows = await db.hintSeen.findMany({
		where: { userId },
		select: { hintId: true },
		orderBy: { seenAt: 'asc' }
	});
	const seenIds = new Set(rows.map(row => row.hintId));

	if (settings?.hasSeenTour) {
		LEGACY_TOUR_HINT_IDS.forEach(id => seenIds.add(id));
	}

	return { seenIds: [...seenIds], enabled: settings?.hintsEnabled ?? true };
};

export const getHintsForUser = async (userId: string): Promise<HintsState> =>
	hintsStateFor(prisma, normalizeUserId(userId));

export const markHintsSeenForUser = async (userId: string, ids: string[]): Promise<HintsState> => {
	const normalizedUserId = normalizeUserId(userId);
	const hintIds = [...new Set(ids)];

	return prisma.$transaction(async tx => {
		// First, so the settings row is locked: two marks from one account count against the cap in turn.
		await tx.userSettings.upsert({
			where: { userId: normalizedUserId },
			update: { hasUsedHints: true },
			create: { userId: normalizedUserId, hasUsedHints: true }
		});

		const existing = await tx.hintSeen.count({ where: { userId: normalizedUserId } });
		const known = await tx.hintSeen.count({ where: { userId: normalizedUserId, hintId: { in: hintIds } } });

		if (existing + hintIds.length - known > MAX_SEEN_HINTS) {
			throw new HttpError(BAD_REQUEST, 'Too many hints marked as seen');
		}

		await tx.hintSeen.createMany({
			data: hintIds.map(hintId => ({ userId: normalizedUserId, hintId })),
			skipDuplicates: true
		});

		return hintsStateFor(tx, normalizedUserId);
	});
};

/**
 * "Show the tips again": every hint but `welcome` is unseen once more. `hasUsedHints` stays, so
 * an old build still does not start the demo tour. A tour account had `welcome` only through
 * `hasSeenTour`, so it is written down as a row before that flag is cleared.
 */
export const resetHintsForUser = async (userId: string): Promise<HintsState> => {
	const normalizedUserId = normalizeUserId(userId);

	return prisma.$transaction(async tx => {
		const settings = await tx.userSettings.findUnique({
			where: { userId: normalizedUserId },
			select: { hasSeenTour: true }
		});

		if (settings?.hasSeenTour) {
			await tx.hintSeen.createMany({
				data: [{ userId: normalizedUserId, hintId: WELCOME_HINT_ID }],
				skipDuplicates: true
			});
			// `hasUsedHints` with it: an account that never had a hint marked seen would otherwise read as
			// tour-unseen to an old build, which would start its demo tour again.
			await tx.userSettings.update({
				where: { userId: normalizedUserId },
				data: { hasSeenTour: false, hasUsedHints: true }
			});
		}

		await tx.hintSeen.deleteMany({ where: { userId: normalizedUserId, hintId: { not: WELCOME_HINT_ID } } });

		return hintsStateFor(tx, normalizedUserId);
	});
};
