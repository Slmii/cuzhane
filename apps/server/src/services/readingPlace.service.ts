import { randomUUID } from 'node:crypto';
import { BAD_REQUEST } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import type { SaveReadingPlaceBody } from '@schemas/group.schema';
import { isPersonalPlan } from '@utils/groupKinds';
import { normalizeUserId } from '@utils/normalizeUserId';
import { unitCountFor } from '@utils/units';
import type { Group, ReadingPlace as ReadingPlaceModel } from '../generated/prisma/client';
import { requireMembership } from './groupAccess.service';
import { type ReadingPlace, type ReadingPlaces, toReadingPlace } from './groupSerializers';
import { ensureCurrentRoundFor } from './rounds.service';

/**
 * **Where a member is inside a unit of a board group's round** — the page of a cüz or of a Hizb
 * portion they left off on, and how many of a cüz's pages they have turned past — so the reader
 * opens there again on any of their devices.
 *
 * The viewer's own rows only, in and out: nobody else's place is ever read or written here. The
 * round is the server's — rolled first, as on every read and write path — so a place from a
 * round that has closed is never handed back. A personal-plan group keeps its place on the plan
 * reading's `bookmark` and is refused here.
 */
const loadPlaceGroup = async (
	userId: string,
	groupId: string
): Promise<Pick<Group, 'hizbPlan' | 'kind' | 'planDays' | 'roundIndex'>> => {
	await requireMembership(userId, groupId);
	await ensureCurrentRoundFor(groupId);

	const group = await prisma.group.findUniqueOrThrow({
		where: { id: groupId },
		select: { hizbPlan: true, kind: true, planDays: true, roundIndex: true }
	});

	if (isPersonalPlan(group)) {
		throw new HttpError(BAD_REQUEST, 'Open your personal reading assignment');
	}

	return group;
};

export const listReadingPlacesForUser = async (userId: string, groupId: string): Promise<ReadingPlaces> => {
	const normalizedUserId = normalizeUserId(userId);
	const group = await loadPlaceGroup(normalizedUserId, groupId);
	const places = await prisma.readingPlace.findMany({
		where: { groupId, roundIndex: group.roundIndex, userId: normalizedUserId },
		orderBy: { unitNumber: 'asc' }
	});

	return { places: places.map(toReadingPlace), roundIndex: group.roundIndex };
};

/**
 * Saves the place in one unit for the round the group is on. Page turns call this often, so it
 * is **one statement**: an insert that, on the member's existing row, keeps the place it is not
 * given and only ever raises the pages read — paging back takes nothing away, and two writes
 * landing out of order cannot lower the count.
 */
export const saveReadingPlaceForUser = async (
	userId: string,
	groupId: string,
	unitNumber: number,
	body: SaveReadingPlaceBody
): Promise<ReadingPlace> => {
	const normalizedUserId = normalizeUserId(userId);
	const group = await loadPlaceGroup(normalizedUserId, groupId);

	if (unitNumber > unitCountFor(group)) {
		throw new HttpError(BAD_REQUEST, 'Invalid unit number');
	}

	const [place] = await prisma.$queryRaw<
		Pick<ReadingPlaceModel, 'husrevPagesRead' | 'position' | 'textPagesRead' | 'unitNumber'>[]
	>`
		INSERT INTO "ReadingPlace"
			("id", "groupId", "userId", "roundIndex", "unitNumber", "position", "textPagesRead", "husrevPagesRead", "updatedAt")
		VALUES
			(${randomUUID()}, ${groupId}, ${normalizedUserId}, ${group.roundIndex}, ${unitNumber}, ${body.position ?? null}::int,
			 ${body.textPagesRead ?? 0}, ${body.husrevPagesRead ?? 0}, NOW())
		ON CONFLICT ("groupId", "userId", "roundIndex", "unitNumber") DO UPDATE SET
			"position" = COALESCE(EXCLUDED."position", "ReadingPlace"."position"),
			"textPagesRead" = GREATEST(EXCLUDED."textPagesRead", "ReadingPlace"."textPagesRead"),
			"husrevPagesRead" = GREATEST(EXCLUDED."husrevPagesRead", "ReadingPlace"."husrevPagesRead"),
			"updatedAt" = NOW()
		RETURNING "unitNumber", "position", "textPagesRead", "husrevPagesRead"
	`;

	if (!place) {
		throw new Error('Saving a reading place returned no row');
	}

	return toReadingPlace(place);
};
