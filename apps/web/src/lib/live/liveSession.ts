import { endLiveSession, startLiveSession } from '@/api/live.api';
import type {
	LiveEndReason,
	LiveMark,
	LivePerson,
	LivePosition,
	LiveReadingKind,
	LiveServerFrame,
	LiveStatus
} from '@/lib/types/domain';
import { openLiveConnection } from '@/lib/utils/liveConnection';

/**
 * **The live reading, for the whole app** — one session at a time, as the server allows one
 * per reader. It outlives the screen it was started or joined on: the reader can look at their
 * groups and come back, a follower can wander off and return to the reader's place, and nobody
 * else notices. Only ending it, leaving it, the idle rule or the app going to the background
 * (`liveConnection`) interrupt it.
 *
 * - **Readers attach, they do not own.** The free reader of the session's kind attaches while it
 *   is focused (`attach`) and lets go when it is not; with two of them mounted in two tabs, the
 *   last to attach is the one that moves and the only one that publishes.
 * - **Positions and the line never become React state.** They reach the attached screen through
 *   its own callback and the mark store; `getSnapshot` changes only when something the screens show
 *   as words changes (who is here, the status, the bab or page, whether a follower follows).
 * - **The last place is kept** (`placeFor`), so a reader opened later starts where the reading is
 *   — the reader's own place for the reader, the reader's for a follower.
 *
 * Plain module state rather than a context: the join screen and the sign-out guard reach it from
 * outside any reader, and nothing above the readers re-renders for it.
 */

/** A scroll sends at most this often, plus a last frame when it settles. */
const PUBLISH_INTERVAL_MS = 250;
/** How long a returning reader screen has to reach the reading's place before it may send its own. */
const RESTORE_MS = 2000;
/** How close to the reading's place a returning screen has to be to count as arrived. */
const RESTORE_FRACTION_SLACK = 0.02;
/** A follower's line outlives the reader's three seconds by this much, then goes on its own. */
const FOLLOWER_MARK_GRACE_MS = 1000;
/** How long the reader's line stays after their last tap — a pointer, not a bookmark. */
export const LINE_SHOWN_MS = 3000;

export type LiveReadingState = {
	/** Null until the first snapshot: the reader cannot tell yet whether it leads or follows. */
	role: 'leader' | 'follower' | null;
	status: LiveStatus | 'connecting';
	people: LivePerson[];
	sessionId: string | null;
	/** Set once the session is over — ended, gone while away, or never found. */
	gone: LiveEndReason | 'not-found' | 'refused' | null;
	/** A follower who scrolled or turned a page themselves; the leader's place no longer moves them. */
	isDetached: boolean;
	/**
	 * The bab or page the reader is on — changed only when that changes, never per scroll, so the
	 * row can say "Cevşen · 14. Bab" without re-rendering the reader on every frame.
	 */
	readerPlace: LivePlace | null;
	/** When the reader went away, for the row's countdown; null while they are here. */
	awaySince: number | null;
};

/** The session as the app shows it: what it is, and the words-level state above. */
export type LiveSessionState = LiveReadingState & { code: string; kind: LiveReadingKind };

/** A position without its scroll: the unit the reader is in. */
export type LivePlace = { k: 'CEVSEN'; bab: number } | { k: 'QURAN'; cuz: number; page: number };

/**
 * The reader's line ("Göster"), as the band draws it: where, whether the reader still has it on
 * their own screen, and — on the reader's side — whether it was just set, for the flash to full tone.
 */
export type LiveMarkState = { mark: LiveMark | null; shown: boolean; isFresh: boolean };

export type LiveMarkStore = {
	get: () => LiveMarkState;
	subscribe: (listener: () => void) => () => void;
};

/** What a reader screen gives the session while it is attached. */
export type LiveAttachment = {
	kind: LiveReadingKind;
	/** A position for the screen to go to — a follower's reader moving, or a replay on return. */
	onPosition: (pos: LivePosition) => void;
	/** Where the screen is now, for a reader's session that has just gone live with no place yet. */
	getPosition: () => LivePosition | null;
	/** The route sent the screen somewhere of its own (search): a follower arrives let go. */
	isExplicitPlace?: boolean;
};

/** A screen's hold on the session — inert unless it is the one attached last. */
export type LiveHandle = {
	publish: (pos: LivePosition, options?: { isImmediate?: boolean }) => void;
	publishMark: (mark: LiveMark | null, shown: boolean, options?: { isTap?: boolean }) => void;
	detach: () => void;
	follow: () => void;
	release: () => void;
};

type Connection = ReturnType<typeof openLiveConnection>;

type Deps = {
	open: typeof openLiveConnection;
	start: (kind: LiveReadingKind) => Promise<{ code: string; kind: LiveReadingKind }>;
	end: (sessionId: string) => Promise<unknown>;
	now: () => number;
};

const NO_MARK: LiveMarkState = { isFresh: false, mark: null, shown: false };

export const placeOf = (pos: LivePosition): LivePlace =>
	pos.k === 'CEVSEN' ? { bab: pos.bab, k: 'CEVSEN' } : { cuz: pos.cuz, k: 'QURAN', page: pos.page };

const isSamePlace = (a: LivePlace | null, b: LivePlace) =>
	a !== null &&
	(a.k === 'CEVSEN' && b.k === 'CEVSEN'
		? a.bab === b.bab
		: a.k === 'QURAN' && b.k === 'QURAN' && a.cuz === b.cuz && a.page === b.page);

/** Whether a line belongs to the bab or page a position is on — the server's rule, mirrored. */
const isMarkOnPlace = (mark: LiveMark, pos: LivePosition) =>
	mark.k === 'CEVSEN'
		? pos.k === 'CEVSEN' && pos.bab === mark.bab
		: pos.k === 'QURAN' && pos.edition === mark.edition && pos.cuz === mark.cuz && pos.page === mark.page;

const isSameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const INITIAL: LiveReadingState = {
	awaySince: null,
	gone: null,
	isDetached: false,
	people: [],
	readerPlace: null,
	role: null,
	sessionId: null,
	status: 'connecting'
};

/** A throttle that always lets the last value through. */
const createThrottle = <T>(send: (value: T) => void, now: () => number) => {
	let pending: { value: T } | null = null;
	let sentAt = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const flush = () => {
		timer = null;

		if (pending) {
			const { value } = pending;

			pending = null;
			sentAt = now();
			send(value);
		}
	};

	return {
		cancel: () => {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}

			pending = null;
		},
		push: (value: T, isImmediate = false) => {
			pending = { value };

			const elapsed = now() - sentAt;

			if (isImmediate || elapsed >= PUBLISH_INTERVAL_MS) {
				if (timer) {
					clearTimeout(timer);
					timer = null;
				}

				flush();
				return;
			}

			timer ??= setTimeout(flush, PUBLISH_INTERVAL_MS - elapsed);
		}
	};
};

export const createLiveSession = (deps: Deps) => {
	let state: LiveSessionState | null = null;
	let connection: Connection | null = null;
	// The reading's last known place: the reader's own as they read, a follower's from the reader.
	let lastPosition: LivePosition | null = null;
	let attachments: { id: number; attachment: LiveAttachment }[] = [];
	let nextAttachmentId = 1;
	let positionThrottle: ReturnType<typeof createThrottle<LivePosition>> | null = null;
	let markThrottle: ReturnType<typeof createThrottle<{ mark: LiveMark | null; shown: boolean }>> | null = null;
	let markExpiry: ReturnType<typeof setTimeout> | null = null;
	/*
	 * A reader screen brought back to the reading's place: until it has got there, what it sends
	 * from where it was is dropped — or it would rewind everyone to the screen's old bab or page.
	 */
	let restoringTo: { pos: LivePosition; until: number } | null = null;
	// Each session a number of its own, so a callback from an older one acts on nothing.
	let generation = 0;
	/*
	 * Each thing the person asks for — start, join, leave, end, sign-out — a number of its own, so a
	 * start still waiting on the server stands down if anything was asked for after it.
	 */
	let intent = 0;
	const listeners = new Set<() => void>();
	let mark = NO_MARK;
	const markListeners = new Set<() => void>();

	const emit = () => listeners.forEach(listener => listener());

	const setMark = (next: LiveMarkState) => {
		mark = next;
		markListeners.forEach(listener => listener());
	};

	const markStore: LiveMarkStore = {
		get: () => mark,
		subscribe: listener => {
			markListeners.add(listener);

			return () => markListeners.delete(listener);
		}
	};

	/** Only a change of something shown as words reaches React. */
	const update = (change: (current: LiveSessionState) => LiveSessionState) => {
		if (!state) {
			return;
		}

		const next = change(state);

		if (next !== state) {
			state = next;
			emit();
		}
	};

	const active = () => attachments.at(-1)?.attachment ?? null;

	const stopExpiry = () => {
		if (markExpiry) {
			clearTimeout(markExpiry);
			markExpiry = null;
		}
	};

	const close = () => {
		generation += 1;
		connection?.close();
		connection = null;
		positionThrottle?.cancel();
		markThrottle?.cancel();
		positionThrottle = null;
		markThrottle = null;
		stopExpiry();
		lastPosition = null;
		state = null;
		setMark(NO_MARK);
		emit();
	};

	/** A position the reader moved to, given to the screen that is following — if it is following. */
	const deliver = (pos: LivePosition) => {
		const screen = active();

		if (screen && state && !state.isDetached && screen.kind === state.kind) {
			screen.onPosition(pos);
		}
	};

	/** The reading's place — the reader's own as they read, or the reader's for a follower. */
	const keepPosition = (pos: LivePosition) => {
		lastPosition = pos;

		const place = placeOf(pos);

		update(current => (isSamePlace(current.readerPlace, place) ? current : { ...current, readerPlace: place }));
	};

	const receivePosition = (pos: LivePosition | null) => {
		if (!pos) {
			return;
		}

		keepPosition(pos);
		deliver(pos);
	};

	const open = (code: string, kind: LiveReadingKind) => {
		close();

		const ownGeneration = generation;
		const isCurrent = () => ownGeneration === generation;

		state = { ...INITIAL, code, kind };
		emit();

		const conn = deps.open(code, {
			onFrame: (frame: LiveServerFrame) => {
				if (!isCurrent() || !state) {
					return;
				}

				switch (frame.t) {
					case 'snapshot': {
						// The server's kind is the truth, whatever the join guessed.
						update(current => ({
							...current,
							awaySince: frame.status === 'away' ? deps.now() : null,
							kind: frame.session.kind,
							people: frame.people,
							role: frame.role,
							sessionId: frame.session.id,
							status: frame.status
						}));

						if (frame.role === 'follower') {
							receivePosition(frame.pos);
							setMark({ isFresh: false, mark: frame.mark, shown: frame.markShown });
							expireFollowerMark(frame.mark);

							return;
						}

						/*
						 * **The reader's own place and line are the truth** after a (re)connect. A room
						 * lost to a restart, or a clear sent while the socket was down, would otherwise
						 * leave everyone on something stale. Only what differs is sent, so an ordinary
						 * trip to the background does not count as reading for the idle rule.
						 */
						const own = lastPosition ?? active()?.getPosition() ?? null;

						if (own) {
							keepPosition(own);
						}

						if (own && !isSameValue(own, frame.pos)) {
							conn.sendPosition(own);
						}

						if (!isSameValue(mark.mark, frame.mark) || mark.shown !== frame.markShown) {
							conn.sendMark(mark.mark, mark.shown);
						}

						return;
					}
					case 'pos': {
						// Another bab or page leaves the line behind — as the server already has.
						if (mark.mark && !isMarkOnPlace(mark.mark, frame.pos)) {
							setMark(NO_MARK);
						}

						receivePosition(frame.pos);
						return;
					}
					case 'mark':
						setMark({ isFresh: false, mark: frame.mark, shown: frame.shown });
						expireFollowerMark(frame.mark);
						return;
					case 'status':
						update(current => ({
							...current,
							awaySince: frame.status === 'away' ? current.awaySince ?? deps.now() : null,
							status: frame.status
						}));
						return;
					case 'people':
						update(current => ({ ...current, people: frame.people }));
						return;
					case 'ended':
						stopExpiry();
						setMark(NO_MARK);
						update(current => ({ ...current, gone: frame.reason }));
						return;
					default:
				}
			},
			onGone: reason => {
				if (!isCurrent()) {
					return;
				}

				stopExpiry();
				setMark(NO_MARK);
				update(current => ({ ...current, gone: current.gone ?? reason }));
			},
			onState: next => {
				if (isCurrent() && next === 'connecting') {
					update(current =>
						current.status === 'connecting' ? current : { ...current, status: 'connecting' }
					);
				}
			}
		});

		connection = conn;
		positionThrottle = createThrottle<LivePosition>(pos => conn.sendPosition(pos), deps.now);
		markThrottle = createThrottle<{ mark: LiveMark | null; shown: boolean }>(
			next => conn.sendMark(next.mark, next.shown),
			deps.now
		);
	};

	const isLeading = () => state !== null && state.role === 'leader' && state.gone === null;

	/*
	 * **A follower's line goes on its own too**, a little after the reader's three seconds. The
	 * reader's clear may never come — their phone went offline the moment after the tap — and the
	 * line must not stay on everyone's page until they are back.
	 */
	const expireFollowerMark = (shownMark: LiveMark | null) => {
		stopExpiry();

		if (!shownMark || state?.role !== 'follower') {
			return;
		}

		const ownGeneration = generation;

		markExpiry = setTimeout(() => {
			markExpiry = null;

			if (ownGeneration === generation && mark.mark === shownMark) {
				setMark(NO_MARK);
			}
		}, LINE_SHOWN_MS + FOLLOWER_MARK_GRACE_MS);
	};

	const sendMark = (next: LiveMark | null, shown: boolean, isTap: boolean) => {
		setMark({ isFresh: isTap, mark: next, shown });
		markThrottle?.push({ mark: next, shown });
	};

	const endCurrent = async () => {
		const sessionId = state?.role === 'leader' ? state.sessionId : null;

		close();

		if (sessionId) {
			await deps.end(sessionId).catch(() => undefined);
		}
	};

	return {
		getSnapshot: (): LiveSessionState | null => state,
		subscribe: (listener: () => void) => {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
		markStore,

		/** The reading's last place, for a reader of this kind opened now; null for any other. */
		placeFor: (kind: LiveReadingKind): LivePosition | null =>
			state &&
			state.kind === kind &&
			state.gone === null &&
			lastPosition?.k === (kind === 'CEVSEN' ? 'CEVSEN' : 'QURAN')
				? lastPosition
				: null,

		/** Starts a session as its reader — ending the reader's own, or leaving one they follow. */
		start: async (kind: LiveReadingKind) => {
			intent += 1;

			const ownIntent = intent;

			await endCurrent();

			const session = await deps.start(kind);

			// Signed out, joined elsewhere or ended while the server answered: no longer wanted.
			if (ownIntent !== intent) {
				return;
			}

			open(session.code, session.kind);
		},

		/** Follows a session by its code. The same code again changes nothing. */
		join: (code: string, kind: LiveReadingKind) => {
			if (state && state.code === code && state.gone === null) {
				return;
			}

			intent += 1;
			void endCurrent();
			open(code, kind);
		},

		/** A follower goes back to reading alone; also how a finished session is put away. */
		leave: () => {
			intent += 1;
			close();
		},

		/** The reader ends it for everyone; the socket's `ended` frame tells the followers. */
		end: () => {
			intent += 1;

			return endCurrent();
		},

		/** Signed out, or another account: let go of everything, asking the server for nothing. */
		reset: () => {
			intent += 1;
			close();
		},

		attach: (attachment: LiveAttachment): LiveHandle => {
			const id = nextAttachmentId++;
			const isActive = () => attachments.at(-1)?.id === id;

			attachments.push({ attachment, id });

			// The reader back on a screen of theirs: to their own place, before it can send its old one.
			if (state && state.kind === attachment.kind && state.role === 'leader' && lastPosition) {
				restoringTo = { pos: lastPosition, until: deps.now() + RESTORE_MS };
				attachment.onPosition(lastPosition);
			}

			if (state && state.kind === attachment.kind && state.role === 'follower') {
				/*
				 * Back on the reader's screen: following again, at the reader's place — unless the
				 * route sent this screen somewhere of its own, where "Takip et" is a tap away.
				 */
				const isDetached = attachment.isExplicitPlace === true;

				update(current => (current.isDetached === isDetached ? current : { ...current, isDetached }));

				if (!isDetached && lastPosition) {
					attachment.onPosition(lastPosition);
				}
			}

			return {
				publish: (pos, { isImmediate = false } = {}) => {
					if (!isActive() || !isLeading() || state?.kind !== attachment.kind) {
						return;
					}

					if (restoringTo) {
						// There means the bab or page *and* the place on it — a screen still on its old
						// scroll on the same bab would otherwise count as arrived and send it.
						const isThere =
							isSamePlace(placeOf(restoringTo.pos), placeOf(pos)) &&
							Math.abs(restoringTo.pos.f - pos.f) <= RESTORE_FRACTION_SLACK;

						if (!isThere && deps.now() < restoringTo.until) {
							return;
						}

						// Arrived: its place stands for the reading's from here on.
						restoringTo = null;
					}

					keepPosition(pos);
					positionThrottle?.push(pos, isImmediate);
				},
				publishMark: (next, shown, { isTap = false } = {}) => {
					if (!isActive() || !isLeading() || state?.kind !== attachment.kind) {
						return;
					}

					sendMark(next, shown, isTap);

					if (!isTap) {
						return;
					}

					// Three seconds after the last tap the line goes, wherever the reader has gone since.
					stopExpiry();
					const ownGeneration = generation;

					markExpiry = setTimeout(() => {
						markExpiry = null;

						if (ownGeneration === generation && isLeading() && mark.mark === next) {
							sendMark(null, false, false);
						}
					}, LINE_SHOWN_MS);
				},
				detach: () => {
					if (!isActive() || state?.role !== 'follower') {
						return;
					}

					update(current => (current.isDetached ? current : { ...current, isDetached: true }));
				},
				follow: () => {
					if (!isActive() || !state) {
						return;
					}

					update(current => (current.isDetached ? { ...current, isDetached: false } : current));

					if (lastPosition) {
						deliver(lastPosition);
					}
				},
				release: () => {
					attachments = attachments.filter(entry => entry.id !== id);
				}
			};
		}
	};
};

export type LiveSessionStore = ReturnType<typeof createLiveSession>;

export const liveSession = createLiveSession({
	end: endLiveSession,
	now: () => Date.now(),
	open: openLiveConnection,
	start: startLiveSession
});
