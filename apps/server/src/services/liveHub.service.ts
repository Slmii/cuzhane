import {
	CLOSE,
	HEARTBEAT_INTERVAL_MS,
	IDLE_AFTER_MS,
	LEADER_GRACE_MS,
	MAX_PENDING_LISTENS,
	MAX_SESSION_MS,
	VOICE_LISTEN_ANSWER_MS,
	VOICE_SHUTDOWN_MS,
	type LiveEndReason,
	type LiveMark,
	type LivePerson,
	type LivePosition,
	type LiveStatus,
	type LiveVoice,
	type ServerFrame
} from '@schemas/live.schema';
import { expireLiveSession, touchLiveSession } from '@services/liveSession.service';
import { closeTrack } from '@services/liveVoice.service';
import { getMemberProfiles } from '@utils/memberProfiles';
import type { WebSocket } from 'ws';
import type { LiveSession } from '../generated/prisma/client';

/**
 * The running side of live reading: who is connected to which session, where its reader is, and
 * who gets told what. **In memory, on purpose** — there is one API process per environment, so a
 * map is the whole fan-out, and none of this is worth keeping across a restart: the reader's app
 * reconnects and sends its place again. The rows (`liveSession.service.ts`) are what outlive one.
 */

export type LiveClient = {
	ws: WebSocket;
	userId: string;
	sessionId: string | null;
	/** The highest `seq` this socket has sent; older frames arriving late are dropped. */
	lastSeq: number;
};

/** The reader's microphone track at Cloudflare: the session it was pushed into, and its `mid` there. */
export type VoiceTrack = { cloudflareSessionId: string; mid: string };

type Room = {
	session: LiveSession;
	leaders: Set<LiveClient>;
	followers: Set<LiveClient>;
	pos: LivePosition | null;
	/** The reader's line, and whether it is on the reader's own screen. */
	mark: LiveMark | null;
	markShown: boolean;
	seq: number;
	status: LiveStatus;
	awayTimer: NodeJS.Timeout | null;
	heartbeat: NodeJS.Timeout | null;
	expiry: NodeJS.Timeout;
	/** Restarted by every move of the reader's; when it runs out the session ends (`idle`). */
	idleTimer: NodeJS.Timeout | null;
	/** Everyone's name, looked up once as they join — never again for every change to the list. */
	names: Map<string, string | null>;
	/** When the list was last sent, and the one send waiting to follow it — see `schedulePeople`. */
	peopleSentAt: number;
	peopleTimer: NodeJS.Timeout | null;
	/** The reader's voice (`liveVoice.service.ts`), and their track at Cloudflare while it is not off. */
	voice: LiveVoice;
	voiceTrack: VoiceTrack | null;
	/**
	 * Each listener's Cloudflare session, against the person it was made for — so only they can
	 * answer or stop it — and whether they answered it: from then on they are shown as listening.
	 */
	listeners: Map<string, Listener>;
	/** Listen requests still waiting on Cloudflare, per person — they count against `MAX_PENDING_LISTENS`. */
	pendingListens: Map<string, number>;
	/**
	 * Which start of the voice may still go live. Each start takes the next number before asking
	 * Cloudflare; a later start, turning it off and the reader's socket leaving all move it on, so
	 * a start that was overtaken while Cloudflare answered can tell, and never goes live.
	 */
	voiceGeneration: number;
};

type Listener = { userId: string; answered: boolean; createdAt: number };

/** The list of who is here goes out at most this often, however many come and go in between. */
const PEOPLE_EVERY_MS = 1000;

const rooms = new Map<string, Room>();

/*
 * **Sessions this process has ended**, so a join already on its way cannot bring one back: it
 * read the row before the end deleted it, and without this `roomFor` would build a fresh room
 * from that stale row and a reconnecting reader could broadcast into a session that is over.
 * Bounded — the oldest are forgotten, by which time their rows are long gone.
 */
const endedSessions = new Set<string>();
const MAX_ENDED_REMEMBERED = 1000;

const rememberEnded = (sessionId: string) => {
	endedSessions.add(sessionId);

	if (endedSessions.size > MAX_ENDED_REMEMBERED) {
		const oldest = endedSessions.values().next().value;

		if (oldest !== undefined) {
			endedSessions.delete(oldest);
		}
	}
};

/*
 * **Every database write from a timer is caught.** A rejection nobody handles ends the Node
 * process — one database blip during a heartbeat would take the API down with it.
 */
const quietly = (work: Promise<unknown>) => work.catch(() => undefined);

/** Removes the row, then ends the room — whether or not the delete succeeded. */
const expireAndEnd = (sessionId: string, reason: LiveEndReason) =>
	void quietly(expireLiveSession(sessionId)).then(() => endRoom(sessionId, reason));

/** Past this much unsent data a socket is too slow to keep up; it catches up on the next frame. */
const MAX_BUFFERED_BYTES = 64 * 1024;

/** A frame already serialised — for one built in pieces, like the list of people. */
const sendRaw = (client: LiveClient, json: string) => {
	if (client.ws.readyState === client.ws.OPEN && client.ws.bufferedAmount < MAX_BUFFERED_BYTES) {
		client.ws.send(json);
	}
};

export const send = (client: LiveClient, frame: ServerFrame) => sendRaw(client, JSON.stringify(frame));

const everyone = (room: Room) => [...room.leaders, ...room.followers];

const broadcast = (room: Room, frame: ServerFrame, except?: LiveClient) => {
	for (const client of everyone(room)) {
		if (client !== except) {
			send(client, frame);
		}
	}
};

/**
 * Who is here, as each person sees it: the reader first, then followers in the order they came,
 * one entry per person however many phones they joined from. Names are the same for everyone —
 * a free-reading session has no group, so there is no `hideMemberNames` to apply; everyone came
 * through a code somebody chose to share — only `isYou` differs.
 */
const peopleOrder = (room: Room) => [
	...new Set([room.session.leaderUserId, ...[...room.followers].map(client => client.userId)])
];

/** Who hears the reader now: answered for the current track, on any of their phones. */
const listeningUsers = (room: Room) =>
	new Set([...room.listeners.values()].filter(listener => listener.answered).map(listener => listener.userId));

const personOf = (room: Room, userId: string, viewerUserId: string, listening: Set<string>): LivePerson => ({
	isLeader: userId === room.session.leaderUserId,
	isListening: listening.has(userId),
	isYou: userId === viewerUserId,
	name: room.names.get(userId) ?? null
});

/** Looks up the names the room does not have yet — only those, and once. */
const learnNames = async (room: Room, userIds: string[]) => {
	const missing = userIds.filter(userId => !room.names.has(userId));

	if (missing.length === 0) {
		return;
	}

	const profiles = await getMemberProfiles(missing);

	for (const userId of missing) {
		room.names.set(userId, profiles.get(userId)?.displayName ?? null);
	}
};

/*
 * **Built once, not once per person.** Each entry is serialised a single time, and a viewer's copy
 * only swaps in their own entry with `isYou` set. Building every list from scratch made a session's
 * cost grow with the square of its size: 500 people meant 500 lists of 500 for every arrival.
 */
const announcePeople = (room: Room) => {
	room.peopleSentAt = Date.now();

	const order = peopleOrder(room);
	const listening = listeningUsers(room);
	const entries = order.map(userId => JSON.stringify(personOf(room, userId, '', listening)));
	const indexOf = new Map(order.map((userId, index) => [userId, index]));

	for (const client of everyone(room)) {
		const own = indexOf.get(client.userId);
		const people =
			own === undefined
				? entries
				: entries.map((entry, index) =>
						index === own ? JSON.stringify(personOf(room, client.userId, client.userId, listening)) : entry
				  );

		sendRaw(client, `{"t":"people","people":[${people.join(',')}]}`);
	}
};

/*
 * **At most one list a second.** Sent at once when the last one is older than that, so a small
 * session still updates the moment someone arrives; otherwise one send follows, carrying every
 * arrival and departure in between. Without this, 500 people arriving together were 500 lists.
 */
const schedulePeople = (room: Room) => {
	if (room.peopleTimer) {
		return;
	}

	const wait = Math.max(0, room.peopleSentAt + PEOPLE_EVERY_MS - Date.now());

	if (wait === 0) {
		announcePeople(room);
		return;
	}

	room.peopleTimer = setTimeout(() => {
		room.peopleTimer = null;

		if (rooms.get(room.session.id) === room) {
			announcePeople(room);
		}
	}, wait);
	room.peopleTimer.unref();
};

const stopHeartbeat = (room: Room) => {
	if (room.heartbeat) {
		clearInterval(room.heartbeat);
		room.heartbeat = null;
	}
};

const startHeartbeat = (room: Room) => {
	if (room.heartbeat) {
		return;
	}

	void quietly(touchLiveSession(room.session.id));
	room.heartbeat = setInterval(() => void quietly(touchLiveSession(room.session.id)), HEARTBEAT_INTERVAL_MS);
	room.heartbeat.unref();
};

/*
 * **A session nobody is reading in ends on its own.** A reader who has put the phone down with
 * the app still open stays connected, so neither the grace window nor the stale sweep would ever
 * catch it, and followers would watch a still page until the four-hour cap.
 */
const restartIdle = (room: Room) => {
	if (room.idleTimer) {
		clearTimeout(room.idleTimer);
	}

	room.idleTimer = setTimeout(() => expireAndEnd(room.session.id, 'idle'), IDLE_AFTER_MS);
	room.idleTimer.unref();
};

const stopTimers = (room: Room) => {
	stopHeartbeat(room);
	clearTimeout(room.expiry);

	if (room.awayTimer) {
		clearTimeout(room.awayTimer);
	}

	if (room.idleTimer) {
		clearTimeout(room.idleTimer);
	}

	if (room.peopleTimer) {
		clearTimeout(room.peopleTimer);
	}
};

/** The session is over: tell everyone why, close their sockets and forget the room. */
export const endRoom = (sessionId: string, reason: LiveEndReason) => {
	rememberEnded(sessionId);

	const room = rooms.get(sessionId);

	if (!room) {
		return;
	}

	rooms.delete(sessionId);
	stopTimers(room);

	// Whatever ended it, the reader's voice stops reaching anyone. Followers learn it from `ended`.
	if (room.voiceTrack) {
		void closeTrack(room.voiceTrack);
	}

	for (const client of everyone(room)) {
		send(client, { reason, t: 'ended' });
		client.sessionId = null;
		client.ws.close(CLOSE.ended, reason);
	}
};

/** The reader is gone: followers wait, and after the grace window the session ends. */
const markAway = (room: Room) => {
	room.status = 'away';
	stopHeartbeat(room);
	broadcast(room, { status: 'away', t: 'status' });

	// Their voice is not reaching anyone either. Back on only when their app says so.
	if (room.voice === 'on') {
		room.voice = 'paused';
		broadcast(room, { t: 'voice', voice: 'paused' });
	}

	room.awayTimer = setTimeout(() => expireAndEnd(room.session.id, 'leader-left'), LEADER_GRACE_MS);
	room.awayTimer.unref();
};

const roomFor = (session: LiveSession): Room => {
	const existing = rooms.get(session.id);

	if (existing) {
		return existing;
	}

	const expiry = setTimeout(
		() => expireAndEnd(session.id, 'expired'),
		Math.max(0, session.startedAt.getTime() + MAX_SESSION_MS - Date.now())
	);
	expiry.unref();

	const room: Room = {
		awayTimer: null,
		expiry,
		followers: new Set(),
		heartbeat: null,
		idleTimer: null,
		names: new Map(),
		peopleSentAt: 0,
		peopleTimer: null,
		leaders: new Set(),
		listeners: new Map(),
		pendingListens: new Map(),
		voiceGeneration: 0,
		mark: null,
		markShown: false,
		pos: null,
		seq: 0,
		session,
		status: 'away',
		voice: 'off',
		voiceTrack: null
	};

	rooms.set(session.id, room);
	restartIdle(room);

	return room;
};

/**
 * A signed-in socket enters a session — as its reader if it is theirs, as a follower otherwise.
 * A room created by a follower (after a deploy, say, before the reader's app has reconnected)
 * starts out waiting for the reader, with the same grace window as a reader who dropped out.
 */
export const joinRoom = async (client: LiveClient, session: LiveSession): Promise<boolean> => {
	if (endedSessions.has(session.id)) {
		return false;
	}

	const room = roomFor(session);
	const isLeader = client.userId === session.leaderUserId;

	// Names first, so no list ever goes out with this person in it and their name missing.
	await learnNames(room, [session.leaderUserId, client.userId]);

	// While the names were looked up the session may have ended, or this socket closed.
	if (rooms.get(session.id) !== room) {
		return false;
	}

	if (client.ws.readyState !== client.ws.OPEN) {
		return true;
	}

	client.sessionId = session.id;
	client.lastSeq = -1;

	if (isLeader) {
		room.leaders.add(client);

		if (room.awayTimer) {
			clearTimeout(room.awayTimer);
			room.awayTimer = null;
		}

		startHeartbeat(room);

		if (room.status !== 'live') {
			room.status = 'live';
			broadcast(room, { status: 'live', t: 'status' }, client);
		}
	} else {
		room.followers.add(client);

		if (room.leaders.size === 0 && room.awayTimer === null) {
			markAway(room);
		}
	}

	const listening = listeningUsers(room);

	send(client, {
		people: peopleOrder(room).map(userId => personOf(room, userId, client.userId, listening)),
		mark: room.mark,
		markShown: room.markShown,
		pos: room.pos,
		role: isLeader ? 'leader' : 'follower',
		seq: room.seq,
		session: { code: session.code, id: session.id, kind: session.kind, startedAt: session.startedAt.toISOString() },
		status: room.status,
		t: 'snapshot',
		voice: room.voice
	});

	schedulePeople(room);

	return true;
};

/** A socket closed or moved to another session. */
export const leaveRoom = (client: LiveClient) => {
	const room = client.sessionId ? rooms.get(client.sessionId) : undefined;

	client.sessionId = null;

	if (!room) {
		return;
	}

	// A reader's socket leaving overtakes any start of the voice still waiting on Cloudflare.
	if (room.leaders.delete(client)) {
		room.voiceGeneration += 1;
	}

	room.followers.delete(client);

	// Gone from the room on every phone: no longer listening, and their listener sessions cannot be answered.
	if (room.listeners.size > 0 && !everyone(room).some(other => other.userId === client.userId)) {
		for (const [listenerSessionId, { userId }] of room.listeners) {
			if (userId === client.userId) {
				room.listeners.delete(listenerSessionId);
			}
		}
	}

	if (room.leaders.size === 0 && room.status === 'live') {
		markAway(room);
	}

	schedulePeople(room);
};

/** The reader's new place: kept as the room's latest and passed to everyone else in the room. */
export const publishPosition = (client: LiveClient, clientSeq: number, pos: LivePosition) => {
	const room = client.sessionId ? rooms.get(client.sessionId) : undefined;

	if (!room) {
		send(client, { code: 'not-joined', t: 'error' });
		return;
	}

	if (!room.leaders.has(client)) {
		send(client, { code: 'not-leader', t: 'error' });
		return;
	}

	if (pos.k !== room.session.kind) {
		send(client, { code: 'wrong-kind', t: 'error' });
		return;
	}

	if (clientSeq <= client.lastSeq) {
		return;
	}

	client.lastSeq = clientSeq;
	room.seq += 1;
	room.pos = pos;

	// Another bab or page leaves the line behind, whether or not the reader's app says so.
	if (room.mark && !isSameUnit(room.mark, pos)) {
		room.mark = null;
		room.markShown = false;
	}

	restartIdle(room);
	broadcast(room, { pos, seq: room.seq, t: 'pos' }, client);
};

const isSameUnit = (mark: LiveMark, pos: LivePosition) =>
	mark.k === 'CEVSEN'
		? pos.k === 'CEVSEN' && pos.bab === mark.bab
		: pos.k === 'QURAN' && pos.edition === mark.edition && pos.cuz === mark.cuz && pos.page === mark.page;

/** The reader's line: kept for late joiners and passed to everyone else, ordered with the places. */
export const publishMark = (client: LiveClient, clientSeq: number, mark: LiveMark | null, shown: boolean) => {
	const room = client.sessionId ? rooms.get(client.sessionId) : undefined;

	if (!room) {
		send(client, { code: 'not-joined', t: 'error' });
		return;
	}

	if (!room.leaders.has(client)) {
		send(client, { code: 'not-leader', t: 'error' });
		return;
	}

	if (mark && mark.k !== room.session.kind) {
		send(client, { code: 'wrong-kind', t: 'error' });
		return;
	}

	if (clientSeq <= client.lastSeq) {
		return;
	}

	client.lastSeq = clientSeq;
	room.seq += 1;
	room.mark = mark;
	room.markShown = mark !== null && shown;
	// Pointing at a line is reading as much as scrolling is.
	restartIdle(room);
	broadcast(room, { mark, seq: room.seq, shown: room.markShown, t: 'mark' }, client);
};

/**
 * The reader's app on its own voice: it cannot send (`paused`) or can again (`on`). Only says
 * whether a voice that is on reaches anyone — turning it on and off are requests
 * (`liveVoice.service.ts`), so while it is off this is ignored.
 */
export const publishVoice = (client: LiveClient, clientSeq: number, state: 'on' | 'paused') => {
	const room = client.sessionId ? rooms.get(client.sessionId) : undefined;

	if (!room) {
		send(client, { code: 'not-joined', t: 'error' });
		return;
	}

	if (!room.leaders.has(client)) {
		send(client, { code: 'not-leader', t: 'error' });
		return;
	}

	if (clientSeq <= client.lastSeq) {
		return;
	}

	client.lastSeq = clientSeq;

	if (room.voice === 'off' || room.voice === state) {
		return;
	}

	room.voice = state;
	broadcast(room, { t: 'voice', voice: state });
};

/** Is this person the session's reader, connected on the socket now? */
const isReaderHere = (room: Room, userId: string) => [...room.leaders].some(client => client.userId === userId);

/** Is this person following the session on the socket now? The reader's own sockets are never followers. */
const isFollowerHere = (room: Room, userId: string) => [...room.followers].some(client => client.userId === userId);

/** A listener session still waiting for its answer past `VOICE_LISTEN_ANSWER_MS` was abandoned. */
const isAbandoned = (listener: Listener, now = Date.now()) =>
	!listener.answered && now - listener.createdAt > VOICE_LISTEN_ANSWER_MS;

/** Who a listener session was made for, if it was made in this room for the current track and is not abandoned. */
export const voiceListenerOwner = (sessionId: string, listenerSessionId: string): string | undefined => {
	const listener = rooms.get(sessionId)?.listeners.get(listenerSessionId);

	return listener && !isAbandoned(listener) ? listener.userId : undefined;
};

/**
 * A follower may start listening: they are in the room, voice is not off, and they have fewer than
 * `MAX_PENDING_LISTENS` listener sessions waiting for an answer or being made. **The slot is taken
 * here, before Cloudflare is asked**, and given back with `release` once the request is done —
 * counted only when made, requests sent together could all pass. Abandoned listener sessions are
 * forgotten on the way.
 */
export const reserveListen = (
	sessionId: string,
	userId: string
): { track: VoiceTrack; release: () => void } | 'not-here' | 'off' | 'full' => {
	const room = rooms.get(sessionId);

	if (!room || !isFollowerHere(room, userId)) {
		return 'not-here';
	}

	if (!room.voiceTrack) {
		return 'off';
	}

	const now = Date.now();
	let waiting = room.pendingListens.get(userId) ?? 0;

	for (const [listenerSessionId, listener] of room.listeners) {
		if (isAbandoned(listener, now)) {
			room.listeners.delete(listenerSessionId);
		} else if (listener.userId === userId && !listener.answered) {
			waiting += 1;
		}
	}

	if (waiting >= MAX_PENDING_LISTENS) {
		return 'full';
	}

	room.pendingListens.set(userId, (room.pendingListens.get(userId) ?? 0) + 1);

	let released = false;
	const release = () => {
		if (released) {
			return;
		}

		released = true;

		const pending = room.pendingListens.get(userId) ?? 0;

		if (pending <= 1) {
			room.pendingListens.delete(userId);
		} else {
			room.pendingListens.set(userId, pending - 1);
		}
	};

	return { release, track: room.voiceTrack };
};

/** The track is gone, so nobody hears it: every listener session is forgotten, and the list says so. */
const forgetListeners = (room: Room) => {
	const anyListening = listeningUsers(room).size > 0;

	room.listeners.clear();

	if (anyListening) {
		schedulePeople(room);
	}
};

/** The listener answered Cloudflare's offer: from now on they are shown as listening. */
export const markVoiceListening = (sessionId: string, listenerSessionId: string) => {
	const room = rooms.get(sessionId);
	// Forgotten while Cloudflare answered — voice off, a new track, or they left: nothing to show.
	const listener = room?.listeners.get(listenerSessionId);

	if (!room || !listener || listener.answered) {
		return;
	}

	const wasListening = listeningUsers(room).has(listener.userId);

	listener.answered = true;

	if (!wasListening) {
		schedulePeople(room);
	}
};

/**
 * A listener stopped. False if the listener session is someone else's; one that is unknown or
 * already forgotten is stopped already.
 */
export const stopVoiceListener = (sessionId: string, userId: string, listenerSessionId: string): boolean => {
	const room = rooms.get(sessionId);
	const listener = room?.listeners.get(listenerSessionId);

	if (!room || !listener) {
		return true;
	}

	if (listener.userId !== userId) {
		return false;
	}

	room.listeners.delete(listenerSessionId);

	// Another phone of theirs may still be listening; the list changes only if none is.
	if (listener.answered && !listeningUsers(room).has(userId)) {
		schedulePeople(room);
	}

	return true;
};

/**
 * The reader is about to start their voice: the generation this start may go live under, taken
 * now — before Cloudflare is asked — so anything that happens meanwhile overtakes it. Null if
 * they are not connected as the reader.
 */
export const beginVoicePublish = (sessionId: string, userId: string): number | null => {
	const room = rooms.get(sessionId);

	if (!room || !isReaderHere(room, userId)) {
		return null;
	}

	room.voiceGeneration += 1;

	return room.voiceGeneration;
};

/**
 * Voice is on, with this track — only if nothing overtook the start since `beginVoicePublish`.
 * A track already there is the reader's earlier start — their app reconnecting — so it is closed,
 * its listeners forgotten, and everyone told `on` again: the followers listening re-listen to the
 * new track. False if overtaken; the caller closes the track it made.
 */
export const startVoice = (sessionId: string, generation: number, track: VoiceTrack): boolean => {
	const room = rooms.get(sessionId);

	if (!room || room.voiceGeneration !== generation) {
		return false;
	}

	const previous = room.voiceTrack;

	room.voice = 'on';
	room.voiceTrack = track;
	forgetListeners(room);

	if (previous) {
		void closeTrack(previous);
	}

	broadcast(room, { t: 'voice', voice: 'on' });

	return true;
};

/**
 * Voice is off: the track is closed at Cloudflare and everyone is told. A start still waiting on
 * Cloudflare is overtaken even when voice is already off — otherwise it would turn voice back on.
 */
export const stopVoice = (sessionId: string) => {
	const room = rooms.get(sessionId);

	if (!room) {
		return;
	}

	room.voiceGeneration += 1;

	if (room.voice === 'off') {
		return;
	}

	if (room.voiceTrack) {
		void closeTrack(room.voiceTrack);
	}

	room.voice = 'off';
	room.voiceTrack = null;
	forgetListeners(room);
	broadcast(room, { t: 'voice', voice: 'off' });
};

/**
 * Remembers a listener's Cloudflare session against its person, so `PUT …/voice/listen` can check
 * whose it is. False if, while it was made, voice went off, the reader started again (the session
 * pulls a track that is gone) or the listener left the room.
 */
export const addVoiceListener = (
	sessionId: string,
	userId: string,
	listenerSessionId: string,
	track: VoiceTrack
): boolean => {
	const room = rooms.get(sessionId);

	if (!room || room.voiceTrack !== track || !isFollowerHere(room, userId)) {
		return false;
	}

	room.listeners.set(listenerSessionId, { answered: false, createdAt: Date.now(), userId });

	return true;
};

/** Where the reader is now, for the preview a joiner sees before the socket opens. */
export const roomPosition = (sessionId: string): LivePosition | null => rooms.get(sessionId)?.pos ?? null;

export const followerCount = (sessionId: string) => {
	const room = rooms.get(sessionId);

	return room ? new Set([...room.followers].map(client => client.userId)).size : 0;
};

/**
 * Shutdown: the sockets are closed by the socket server; this stops the timers and closes every
 * reader's track at Cloudflare — best effort, for at most `VOICE_SHUTDOWN_MS`, so a slow
 * Cloudflare cannot hold the exit. Starts still waiting on Cloudflare find no room and close their own.
 */
export const stopAllRooms = async (): Promise<void> => {
	const closing: Promise<void>[] = [];

	for (const room of rooms.values()) {
		stopTimers(room);

		if (room.voiceTrack) {
			closing.push(closeTrack(room.voiceTrack));
		}
	}

	rooms.clear();

	if (closing.length > 0) {
		await Promise.race([
			Promise.all(closing),
			new Promise(resolve => setTimeout(resolve, VOICE_SHUTDOWN_MS).unref())
		]);
	}
};
