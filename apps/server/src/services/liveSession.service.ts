import { CONFLICT, NOT_FOUND } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import type { LiveReadingKind, LiveSession } from '../generated/prisma/client';
import { endRoom, followerCount, roomPosition } from '@services/liveHub.service';
import { MAX_SESSION_MS, STALE_AFTER_MS, type LivePosition } from '@schemas/live.schema';
import { generateInviteCode, normalizeInviteCode } from '@utils/inviteCode';
import { getMemberProfiles } from '@utils/memberProfiles';
import { normalizeUserId } from '@utils/normalizeUserId';

/**
 * Live reading sessions — the rows. What happens inside a running session lives in
 * `liveHub.service.ts`; this is its existence: starting one, finding one by its code, ending it.
 */

/** The fields a unique-index violation names (Prisma's P2002), or null for any other error. */
const uniqueViolation = (error: unknown): string | null => {
	const { code, meta } = error as { code?: string; meta?: { target?: unknown } };

	return code === 'P2002' ? String(meta?.target ?? '') : null;
};

/** A row is over when its reader has been gone past the grace window, or it has run too long. */
const isOver = (session: LiveSession, now = Date.now()) =>
	now - session.heartbeatAt.getTime() > STALE_AFTER_MS || now - session.startedAt.getTime() > MAX_SESSION_MS;

export type LiveSessionPreview = {
	id: string;
	code: string;
	kind: LiveReadingKind;
	startedAt: string;
	/** The reader's name, or null for "Member" (the app says it in the reader's language). */
	leaderName: string | null;
	isLeader: boolean;
	followerCount: number;
	/** Where the reader is now — null before they have opened a page, or while this process has not seen them. */
	position: LivePosition | null;
};

export const serializeLiveSession = async (session: LiveSession, viewerUserId: string): Promise<LiveSessionPreview> => {
	const profiles = await getMemberProfiles([session.leaderUserId]);

	return {
		code: session.code,
		followerCount: followerCount(session.id),
		id: session.id,
		isLeader: session.leaderUserId === viewerUserId,
		kind: session.kind,
		leaderName: profiles.get(session.leaderUserId)?.displayName ?? null,
		position: roomPosition(session.id),
		startedAt: session.startedAt.toISOString()
	};
};

/**
 * Starts a session for this reader. **One per person**: a session they already lead ends first,
 * and its followers are told why — starting the Mushaf while the Cevşen is live means moving to
 * the Mushaf, not running two.
 */
export const startLiveSession = async (userId: string, kind: LiveReadingKind): Promise<LiveSession> => {
	const leaderUserId = normalizeUserId(userId);
	const previous = await prisma.liveSession.findUnique({ where: { leaderUserId } });

	if (previous) {
		await prisma.liveSession.deleteMany({ where: { id: previous.id } });
		endRoom(previous.id, 'replaced');
	}

	/*
	 * A fresh code, retried on the rare collision rather than checked first: the unique index is
	 * the only check that cannot race. Two starts from the same person racing each other land on
	 * `leaderUserId`'s index instead, and the loser is told so.
	 */
	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			return await prisma.liveSession.create({ data: { code: generateInviteCode(), kind, leaderUserId } });
		} catch (error) {
			const violated = uniqueViolation(error);

			if (violated === null) {
				throw error;
			}

			if (violated.includes('leaderUserId')) {
				throw new HttpError(CONFLICT, 'A live session is already starting');
			}
		}
	}

	throw new HttpError(CONFLICT, 'Could not allocate a code');
};

/** The live session behind a code, or null — ended, stale or never existed look the same. */
export const findLiveSessionByCode = async (rawCode: string): Promise<LiveSession | null> => {
	const code = normalizeInviteCode(rawCode);

	if (code.length === 0) {
		return null;
	}

	const session = await prisma.liveSession.findUnique({ where: { code } });

	if (!session) {
		return null;
	}

	if (isOver(session)) {
		await prisma.liveSession.deleteMany({ where: { id: session.id } });
		endRoom(session.id, 'expired');

		return null;
	}

	return session;
};

export const getLiveSessionPreview = async (rawCode: string, viewerUserId: string): Promise<LiveSessionPreview> => {
	const session = await findLiveSessionByCode(rawCode);

	if (!session) {
		throw new HttpError(NOT_FOUND, 'Live session not found');
	}

	return serializeLiveSession(session, normalizeUserId(viewerUserId));
};

/** Only the reader can end their session; for anyone else it does not exist. */
export const endLiveSession = async (userId: string, sessionId: string): Promise<void> => {
	const { count } = await prisma.liveSession.deleteMany({
		where: { id: sessionId, leaderUserId: normalizeUserId(userId) }
	});

	if (count === 0) {
		throw new HttpError(NOT_FOUND, 'Live session not found');
	}

	endRoom(sessionId, 'ended');
};

/** The hub's side: the reader dropped out and did not come back, or the session ran out. */
export const expireLiveSession = async (sessionId: string): Promise<void> => {
	await prisma.liveSession.deleteMany({ where: { id: sessionId } });
};

export const touchLiveSession = async (sessionId: string): Promise<void> => {
	await prisma.liveSession.updateMany({ where: { id: sessionId }, data: { heartbeatAt: new Date() } });
};

/** Account deletion: the person's session goes with them. Runs after the deletion commits. */
export const endLiveSessionsOf = async (userId: string): Promise<void> => {
	const leaderUserId = normalizeUserId(userId);
	const session = await prisma.liveSession.findUnique({ where: { leaderUserId } });

	if (!session) {
		return;
	}

	await prisma.liveSession.deleteMany({ where: { id: session.id } });
	endRoom(session.id, 'ended');
};
