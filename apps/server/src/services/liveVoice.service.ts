import { env } from '@config/env';
import {
	BAD_GATEWAY,
	CONFLICT,
	FORBIDDEN,
	GONE,
	NOT_FOUND,
	SERVICE_UNAVAILABLE,
	TOO_MANY_REQUESTS
} from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { MAX_SESSION_MS, VOICE_CLOSE_RETRY_MS } from '@schemas/live.schema';
import {
	addVoiceListener,
	beginVoicePublish,
	markVoiceListening,
	reserveListen,
	startVoice,
	stopVoice,
	stopVoiceListener,
	voiceListenerOwner,
	type VoiceTrack
} from '@services/liveHub.service';
import { normalizeUserId } from '@utils/normalizeUserId';

/**
 * The reader's voice in a live reading. **Cloudflare Realtime carries the audio; this only lets
 * people in.** The reader's app pushes its microphone track to Cloudflare through here, a
 * follower's app pulls that track through here, and the app never holds Cloudflare's token. What
 * the room knows about the voice — on, paused, which track, whose listener session is whose —
 * lives in the hub (`liveHub.service.ts`), in memory like the rest of a running session.
 *
 * Nothing is recorded: none of Cloudflare's recording features are used.
 */

const REALTIME_API = 'https://rtc.live.cloudflare.com/v1';
/** One track per reader session, so the name never has to be told apart from another. */
const TRACK_NAME = 'voice';
/** A Cloudflare call that has not answered by now will not; the app retries. */
const CLOUDFLARE_TIMEOUT_MS = 10_000;
/** TURN credentials last as long as a session can, so a listener's relay never runs out mid-session. */
const TURN_TTL_SECONDS = MAX_SESSION_MS / 1000;

type SessionDescription = { type: 'offer' | 'answer'; sdp: string };

type TracksResult = {
	requiresImmediateRenegotiation?: boolean;
	sessionDescription?: SessionDescription;
	tracks?: { mid?: string; trackName?: string; error?: { errorCode?: string; errorDescription?: string } }[];
};

/** Cloudflare's `generate-ice-servers` answer, passed to the app as it came. */
type IceServers = unknown[];

const voiceConfig = () => {
	const {
		CLOUDFLARE_REALTIME_APP_ID: appId,
		CLOUDFLARE_REALTIME_APP_TOKEN: appToken,
		CLOUDFLARE_TURN_KEY_ID: turnKeyId,
		CLOUDFLARE_TURN_KEY_TOKEN: turnKeyToken
	} = env;

	if (!appId || !appToken || !turnKeyId || !turnKeyToken) {
		throw new HttpError(SERVICE_UNAVAILABLE, 'Voice is not configured on this server');
	}

	return { appId, appToken, turnKeyId, turnKeyToken };
};

/**
 * One call to Cloudflare. Unreachable, refused or an error in the answer: all a 502 to the app.
 * `body` undefined sends none at all — opening a session refuses even `{}` (400, `decoding_error`).
 */
const cloudflare = async <T>(method: 'POST' | 'PUT', path: string, token: string, body?: unknown): Promise<T> => {
	let response: Response;

	try {
		response = await fetch(`${REALTIME_API}${path}`, {
			method,
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: AbortSignal.timeout(CLOUDFLARE_TIMEOUT_MS)
		});
	} catch {
		throw new HttpError(BAD_GATEWAY, 'Voice could not reach Cloudflare');
	}

	const payload = (await response.json().catch(() => null)) as (T & { errorCode?: string }) | null;

	// Cloudflare reports some failures with a 200 and an `errorCode`.
	if (!response.ok || payload === null || payload.errorCode) {
		throw new HttpError(BAD_GATEWAY, 'Cloudflare refused the voice request', {
			errorCode: payload?.errorCode,
			status: response.status
		});
	}

	return payload;
};

const newCloudflareSession = async (appId: string, appToken: string) => {
	const { sessionId } = await cloudflare<{ sessionId?: string }>('POST', `/apps/${appId}/sessions/new`, appToken);

	if (!sessionId) {
		throw new HttpError(BAD_GATEWAY, 'Cloudflare opened no session');
	}

	return sessionId;
};

const addTracks = async (appId: string, appToken: string, sessionId: string, body: unknown) => {
	const result = await cloudflare<TracksResult>(
		'POST',
		`/apps/${appId}/sessions/${sessionId}/tracks/new`,
		appToken,
		body
	);

	if (result.tracks?.some(track => track.error)) {
		throw new HttpError(BAD_GATEWAY, 'Cloudflare refused the voice track');
	}

	return result;
};

/** Short-lived TURN credentials, for phones on networks that block a direct connection. */
const iceServers = async (): Promise<IceServers> => {
	const { turnKeyId, turnKeyToken } = voiceConfig();
	const result = await cloudflare<{ iceServers?: IceServers }>(
		'POST',
		`/turn/keys/${turnKeyId}/credentials/generate-ice-servers`,
		turnKeyToken,
		{ ttl: TURN_TTL_SECONDS }
	);

	return result.iceServers ?? [];
};

const closeOnce = async (track: VoiceTrack) => {
	const { appId, appToken } = voiceConfig();

	await cloudflare('PUT', `/apps/${appId}/sessions/${track.cloudflareSessionId}/tracks/close`, appToken, {
		force: true,
		tracks: [{ mid: track.mid }]
	});
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms).unref());

/**
 * Stops a track at Cloudflare — the reader's when voice goes off for any reason, or one a failed
 * setup made. **Retried, and never throws**: the caller has already let go of the track, so this
 * is the only thing left that knows it exists. It runs on its own, whatever happens to the room
 * meanwhile; after the last attempt the failure is logged — the ids and Cloudflare's code, never
 * a token — and Cloudflare ends the session itself once nothing is connected to it.
 */
export const closeTrack = async (track: VoiceTrack): Promise<void> => {
	for (let attempt = 0; ; attempt++) {
		try {
			await closeOnce(track);
			return;
		} catch (error) {
			// 410: Cloudflare already ended the session — the phone hung up first. Nothing is left to close.
			if (error instanceof HttpError && (error.details as { status?: number } | undefined)?.status === GONE) {
				return;
			}

			const delay = VOICE_CLOSE_RETRY_MS[attempt];

			if (delay === undefined) {
				console.error({
					cloudflareSessionId: track.cloudflareSessionId,
					details: error instanceof HttpError ? error.details : undefined,
					message: 'Could not close a voice track at Cloudflare',
					mid: track.mid,
					reason: error instanceof Error ? error.message : 'unknown'
				});
				return;
			}

			await wait(delay);
		}
	}
};

/**
 * Runs a Cloudflare setup beside the TURN request, and settles both before deciding. If either
 * failed, the track the setup made is closed — also when it finished after TURN had already
 * failed, which `Promise.all` would have left behind.
 */
const withIceServers = async <T extends { track: VoiceTrack }>(setup: Promise<T>) => {
	const [made, servers] = await Promise.allSettled([setup, iceServers()]);

	if (made.status === 'rejected') {
		throw made.reason;
	}

	if (servers.status === 'rejected') {
		void closeTrack(made.value.track);
		throw servers.reason;
	}

	return { ...made.value, servers: servers.value };
};

/** The session's row, or 404 — ended, replaced or never existed look the same. */
const leaderOf = async (sessionId: string) => {
	const session = await prisma.liveSession.findUnique({ select: { leaderUserId: true }, where: { id: sessionId } });

	if (!session) {
		throw new HttpError(NOT_FOUND, 'Live session not found');
	}

	return session.leaderUserId;
};

export type StartedVoice = { answer: SessionDescription; iceServers: IceServers };

/**
 * The reader turns their voice on: their offer goes to Cloudflare with the microphone track, and
 * Cloudflare's answer comes back. Only the reader, **connected on the socket** — the room has to
 * be there to announce it in. A second start (the reader's app reconnecting) replaces the first.
 */
export const startLiveVoice = async (
	rawUserId: string,
	sessionId: string,
	offer: { sdp: string; mid: string }
): Promise<StartedVoice> => {
	const userId = normalizeUserId(rawUserId);
	const { appId, appToken } = voiceConfig();
	const isLeader = (await leaderOf(sessionId)) === userId;
	// Taken before Cloudflare is asked: anything that happens to the voice meanwhile supersedes it.
	const generation = isLeader ? beginVoicePublish(sessionId, userId) : null;

	if (generation === null) {
		throw new HttpError(FORBIDDEN, 'Only the connected reader can turn voice on');
	}

	const push = async () => {
		const cloudflareSessionId = await newCloudflareSession(appId, appToken);
		const result = await addTracks(appId, appToken, cloudflareSessionId, {
			sessionDescription: { sdp: offer.sdp, type: 'offer' },
			tracks: [{ location: 'local', mid: offer.mid, trackName: TRACK_NAME }]
		});
		const track = { cloudflareSessionId, mid: offer.mid };

		if (result.sessionDescription?.type !== 'answer') {
			void closeTrack(track);
			throw new HttpError(BAD_GATEWAY, 'Cloudflare gave no answer');
		}

		return { answer: result.sessionDescription.sdp, track };
	};
	const { answer, servers, track } = await withIceServers(push());

	/*
	 * Superseded while Cloudflare answered — voice turned off, a newer start, the reader's socket
	 * gone (even if back since), the session over. This track never goes live.
	 */
	if (!startVoice(sessionId, generation, track)) {
		void closeTrack(track);
		throw new HttpError(CONFLICT, 'Voice changed while it was being turned on');
	}

	return { answer: { sdp: answer, type: 'answer' }, iceServers: servers };
};

/** The reader turns their voice off. Already off is not an error: the app may ask twice. */
export const stopLiveVoice = async (rawUserId: string, sessionId: string): Promise<void> => {
	if ((await leaderOf(sessionId)) !== normalizeUserId(rawUserId)) {
		throw new HttpError(FORBIDDEN, 'Only the reader can turn voice off');
	}

	stopVoice(sessionId);
};

export type ListeningVoice = { listenerSessionId: string; offer: SessionDescription; iceServers: IceServers };

/**
 * A follower starts listening: a Cloudflare session of their own pulls the reader's track, and
 * Cloudflare's offer goes back for the app to answer (`answerLiveVoice`). **Only someone in the
 * room on the socket** — a session id alone is not enough to hear it.
 */
export const listenLiveVoice = async (rawUserId: string, sessionId: string): Promise<ListeningVoice> => {
	const userId = normalizeUserId(rawUserId);
	const { appId, appToken } = voiceConfig();

	await leaderOf(sessionId);

	// The slot is taken before Cloudflare is asked, so requests sent together cannot all get one.
	const reservation = reserveListen(sessionId, userId);

	if (reservation === 'not-here') {
		throw new HttpError(FORBIDDEN, 'Only someone following this session can listen');
	}

	if (reservation === 'off') {
		throw new HttpError(CONFLICT, 'Voice is off');
	}

	if (reservation === 'full') {
		throw new HttpError(TOO_MANY_REQUESTS, 'Too many listener sessions waiting for an answer');
	}

	const { release, track: readerTrack } = reservation;

	try {
		const pull = async () => {
			const listenerSessionId = await newCloudflareSession(appId, appToken);
			const result = await addTracks(appId, appToken, listenerSessionId, {
				tracks: [{ location: 'remote', sessionId: readerTrack.cloudflareSessionId, trackName: TRACK_NAME }]
			});
			const mid = result.tracks?.[0]?.mid;

			if (result.sessionDescription?.type !== 'offer' || !mid) {
				if (mid) {
					void closeTrack({ cloudflareSessionId: listenerSessionId, mid });
				}

				throw new HttpError(BAD_GATEWAY, 'Cloudflare gave no offer');
			}

			return { offer: result.sessionDescription.sdp, track: { cloudflareSessionId: listenerSessionId, mid } };
		};
		const { offer, servers, track } = await withIceServers(pull());

		// Voice went off, the reader started again, or the listener left, while Cloudflare answered.
		if (!addVoiceListener(sessionId, userId, track.cloudflareSessionId, readerTrack)) {
			void closeTrack(track);
			throw new HttpError(CONFLICT, 'Voice changed while connecting');
		}

		return {
			iceServers: servers,
			listenerSessionId: track.cloudflareSessionId,
			offer: { sdp: offer, type: 'offer' }
		};
	} finally {
		release();
	}
};

/** The listener's answer to Cloudflare's offer. Only from the person the listener session was made for. */
export const answerLiveVoice = async (
	rawUserId: string,
	sessionId: string,
	answer: { listenerSessionId: string; sdp: string }
): Promise<void> => {
	await leaderOf(sessionId);

	if (voiceListenerOwner(sessionId, answer.listenerSessionId) !== normalizeUserId(rawUserId)) {
		throw new HttpError(FORBIDDEN, 'Not your listener session');
	}

	const { appId, appToken } = voiceConfig();

	await cloudflare('PUT', `/apps/${appId}/sessions/${answer.listenerSessionId}/renegotiate`, appToken, {
		sessionDescription: { sdp: answer.sdp, type: 'answer' }
	});
	markVoiceListening(sessionId, answer.listenerSessionId);
};

/**
 * A listener stops. Nothing is closed at Cloudflare — the app closes its own connection, and
 * that ends the pull — this only stops showing them as listening. An unknown or already
 * forgotten listener session (voice went off, the session ended) is stopped already.
 */
export const stopListeningLiveVoice = (rawUserId: string, sessionId: string, listenerSessionId: string) => {
	if (!stopVoiceListener(sessionId, normalizeUserId(rawUserId), listenerSessionId)) {
		throw new HttpError(FORBIDDEN, 'Not your listener session');
	}
};
