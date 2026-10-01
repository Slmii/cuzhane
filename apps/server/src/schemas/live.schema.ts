import { z } from 'zod';

/**
 * The wire format of a live reading, both directions. Every client frame is parsed here before
 * anything acts on it: the upgraded socket never passes through Express, so `validateData` and
 * the body limit do not apply and this is the only gate.
 *
 * **A position is a place in the text, never pixels.** Font size and screen width differ between
 * phones, so each side converts between its own layout and these numbers. The Kur'an follower
 * switches to the leader's edition for the session, which is why `edition` travels with the page:
 * a page number means the same verses only within one edition.
 */
export const LIVE_SOCKET_PATH = '/api/live-socket';

/** The Cevşen: which bab, and how far through it the top of the reader's screen is. */
const CevsenPositionSchema = z.object({
	k: z.literal('CEVSEN'),
	bab: z.number().int().min(1).max(100),
	f: z.number().min(0).max(1)
});

/**
 * The Mushaf: the cüz, the page within it in the leader's edition (the reader numbers pages per
 * cüz, 1-based), how far down that page, and the verse at the top.
 */
const QuranPositionSchema = z.object({
	k: z.literal('QURAN'),
	edition: z.enum(['text', 'husrev']),
	cuz: z.number().int().min(1).max(30),
	page: z.number().int().min(1).max(60),
	verse: z
		.string()
		.regex(/^\d{1,3}:\d{1,3}$/)
		.optional(),
	f: z.number().min(0).max(1)
});

export const LivePositionSchema = z.discriminatedUnion('k', [CevsenPositionSchema, QuranPositionSchema]);

export type LivePosition = z.infer<typeof LivePositionSchema>;

/**
 * **The line the reader is reading** ("Göster") — like a position, a place in the text, so every
 * phone draws it over its own layout. The Cevşen names an invocation; the typeset Mushaf a verse;
 * a Hüsrev page, which is a picture with no verse positions, one of its fifteen lines.
 */
const CevsenMarkSchema = z.object({
	k: z.literal('CEVSEN'),
	bab: z.number().int().min(1).max(100),
	n: z.number().int().min(1).max(40)
});
const QuranPageSchema = {
	k: z.literal('QURAN'),
	cuz: z.number().int().min(1).max(30),
	page: z.number().int().min(1).max(60)
};
const QuranTextMarkSchema = z
	.object({ ...QuranPageSchema, edition: z.literal('text'), verse: z.string().regex(/^\d{1,3}:\d{1,3}$/) })
	.strict();
const QuranHusrevMarkSchema = z
	.object({ ...QuranPageSchema, edition: z.literal('husrev'), line: z.number().int().min(1).max(15) })
	.strict();

export const LiveMarkSchema = z.union([CevsenMarkSchema.strict(), QuranTextMarkSchema, QuranHusrevMarkSchema]);

export type LiveMark = z.infer<typeof LiveMarkSchema>;

/** A Clerk session token is a JWT; anything past a few kilobytes is not one. */
const TokenSchema = z.string().min(1).max(4096);

export const ClientFrameSchema = z.discriminatedUnion('t', [
	/** The first frame, within `AUTH_TIMEOUT_MS`. Nothing about any session is sent before it. */
	z.object({ t: z.literal('auth'), token: TokenSchema }),
	/** Clerk tokens are short-lived; the app sends a fresh one before `AUTH_LIFETIME_MS` runs out. */
	z.object({ t: z.literal('reauth'), token: TokenSchema }),
	/** Enter a session by its code — as its reader or as a follower, decided by who is asking. */
	z.object({ t: z.literal('join'), code: z.string().min(1).max(16) }),
	/** The reader's place. `seq` only orders this socket's own frames; the server numbers its own. */
	z.object({ t: z.literal('pos'), seq: z.number().int().min(0), pos: LivePositionSchema }),
	/**
	 * The reader's line, or null to clear it. `shown` is whether it is on the reader's own screen:
	 * once they scroll away from it, followers go back to following the page.
	 */
	z.object({
		t: z.literal('mark'),
		seq: z.number().int().min(0),
		mark: LiveMarkSchema.nullable(),
		shown: z.boolean()
	})
]);

export type ClientFrame = z.infer<typeof ClientFrameSchema>;

/** Who is in the session, as each person is shown to the others. `name` null means "Member". */
export type LivePerson = { name: string | null; isLeader: boolean; isYou: boolean };

export type LiveStatus = 'live' | 'away';

export type LiveEndReason = 'ended' | 'leader-left' | 'replaced' | 'expired' | 'idle';

export type ServerFrame =
	| { t: 'ready' }
	| {
			t: 'snapshot';
			session: { id: string; code: string; kind: 'CEVSEN' | 'QURAN'; startedAt: string };
			role: 'leader' | 'follower';
			status: LiveStatus;
			seq: number;
			pos: LivePosition | null;
			mark: LiveMark | null;
			markShown: boolean;
			people: LivePerson[];
	  }
	| { t: 'pos'; seq: number; pos: LivePosition }
	| { t: 'mark'; seq: number; mark: LiveMark | null; shown: boolean }
	| { t: 'status'; status: LiveStatus }
	| { t: 'people'; people: LivePerson[] }
	| { t: 'ended'; reason: LiveEndReason }
	| { t: 'error'; code: 'bad-frame' | 'not-found' | 'not-joined' | 'not-leader' | 'wrong-kind' };

/*
 * Close codes. 4xxx are the application's own (RFC 6455 leaves 4000–4999 to it); the app reads
 * them to decide whether reconnecting can help. 1012 is the standard "service restart", sent on
 * shutdown so every client reconnects at once instead of waiting for a ping to fail.
 */
export const CLOSE = {
	unauthorized: 4401,
	forbidden: 4403,
	notFound: 4404,
	ended: 4410,
	tooMany: 4429,
	restart: 1012
} as const;

/** Frames are small: a position is well under 200 bytes. */
export const MAX_FRAME_BYTES = 2048;
export const AUTH_TIMEOUT_MS = 5_000;
/** How long one successful `auth`/`reauth` keeps a socket signed in. */
export const AUTH_LIFETIME_MS = 10 * 60_000;
export const PING_INTERVAL_MS = 25_000;
/** How long followers wait for a reader who dropped out before the session ends. */
export const LEADER_GRACE_MS = 60_000;
/** How often a connected reader's row is stamped, and how old a stamp may get before the row is stale. */
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const STALE_AFTER_MS = 3 * 60_000;
/** The longest a session may run. */
export const MAX_SESSION_MS = 4 * 60 * 60_000;
/** How long the reader may stay on one place — no scroll, no turn — before the session ends. */
export const IDLE_AFTER_MS = 10 * 60_000;
export const MAX_SOCKETS_PER_USER = 4;
/** A token bucket per socket: this many frames a second, bursts up to the same. */
export const FRAMES_PER_SECOND = 12;
/** Dropped frames a socket may accumulate before it is closed. */
export const MAX_DROPPED_FRAMES = 100;

/** `POST /api/live`: which free reader the session is read in. */
export const StartLiveSessionBodySchema = z.object({ kind: z.enum(['CEVSEN', 'QURAN']) });

export type StartLiveSessionBody = z.infer<typeof StartLiveSessionBodySchema>;

export const LiveCodeParamsSchema = z.object({ code: z.string().trim().min(1).max(16) });

export const LiveSessionIdParamsSchema = z.object({ sessionId: z.string().trim().min(1).max(64) });
