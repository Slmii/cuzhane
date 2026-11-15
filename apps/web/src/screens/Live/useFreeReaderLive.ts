import { useLiveSessionState } from '@/lib/hooks/useLiveSession';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { liveSession, type LiveHandle, type LiveReadingState } from '@/lib/live/liveSession';
import type { LiveMark, LivePosition, LiveReadingKind } from '@/lib/types/domain';
import { confirmDestructive } from '@/lib/utils/confirmDestructive';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';

type LiveParams = { shouldOpenLive?: boolean; liveNotFoundCode?: string } | undefined;

type LiveNavigation = {
	setParams: (params: { shouldOpenLive?: boolean; liveNotFoundCode?: string }) => void;
};

/** A screen on its own: no session, or another kind's. */
const ALONE: LiveReadingState = {
	awaySince: null,
	gone: null,
	isDetached: false,
	people: [],
	readerPlace: null,
	role: null,
	sessionId: null,
	status: 'connecting',
	voice: 'off'
};

/**
 * What a free reader (the free Cevşen, the free Mushaf) needs to take part in the app's live
 * reading (`lib/live/liveSession`) — which no longer lives in the screen. The screen **attaches**
 * while it is focused and the session is of its kind, and lets go when it is not: leaving the
 * reader leaves the reading running, and coming back picks it up where it is.
 *
 * - `onPosition` is where a follower's screen is moved — applied straight to its scroll view, never
 *   through state. `getPosition` is where this screen is, for a session that has just gone live.
 * - `isExplicitPlace`: the route sent this screen somewhere of its own (search) — a follower arrives
 *   let go, with "Takip et" a tap away. Only the first attach of a screen counts as arriving.
 * - A code that found nothing (`liveNotFoundCode`, from the join screen) shows as "not found" on
 *   this screen alone, and never touches a session that is running.
 *
 * **Free readers write nothing**, which is why they can be driven at all — following someone
 * moves your screen and cannot touch a share, a bookmark or a count.
 */
export const useFreeReaderLive = ({
	getPosition,
	isExplicitPlace = false,
	kind,
	navigation,
	onPosition,
	params
}: {
	kind: LiveReadingKind;
	navigation: LiveNavigation;
	onPosition: (pos: LivePosition) => void;
	getPosition: () => LivePosition | null;
	isExplicitPlace?: boolean;
	params: LiveParams;
}) => {
	const { t } = useTranslation();
	const session = useLiveSessionState();
	const isFocused = useIsFocused();
	const [isStarting, setIsStarting] = useState(false);
	const [hasStartFailed, setHasStartFailed] = useState(false);
	const handleRef = useRef<LiveHandle | null>(null);
	const onPositionRef = useRef(onPosition);
	const getPositionRef = useRef(getPosition);
	const hasArrivedRef = useRef(false);

	useEffect(() => {
		onPositionRef.current = onPosition;
		getPositionRef.current = getPosition;
	}, [getPosition, onPosition]);

	const isOwnKind = session !== null && session.kind === kind;
	const sessionCode = isOwnKind ? session.code : null;
	const isAttached = isFocused && isOwnKind;

	// Attached while focused and of this kind — for a session started or joined while here, too.
	useEffect(() => {
		if (!isAttached) {
			return undefined;
		}

		const handle = liveSession.attach({
			getPosition: () => getPositionRef.current(),
			isExplicitPlace: isExplicitPlace && !hasArrivedRef.current,
			kind,
			onPosition: pos => onPositionRef.current(pos)
		});

		hasArrivedRef.current = true;
		handleRef.current = handle;

		return () => {
			handle.release();

			if (handleRef.current === handle) {
				handleRef.current = null;
			}
		};
	}, [isAttached, isExplicitPlace, kind, sessionCode]);

	const closeSheet = useCallback(() => navigation.setParams({ shouldOpenLive: undefined }), [navigation]);

	const notFoundCode = params?.liveNotFoundCode ?? null;
	const showsNotFound = notFoundCode !== null && !isOwnKind;
	const code = sessionCode ?? (showsNotFound ? notFoundCode : null);
	const state: LiveReadingState = isOwnKind ? session : showsNotFound ? { ...ALONE, gone: 'not-found' } : ALONE;

	const start = useCallback(async () => {
		const begin = async () => {
			setIsStarting(true);
			setHasStartFailed(false);
			navigation.setParams({ liveNotFoundCode: undefined });

			try {
				await liveSession.start(kind);
			} catch {
				setHasStartFailed(true);
			} finally {
				setIsStarting(false);
			}
		};

		const current = liveSession.getSnapshot();

		// Starting ends a reading this person leads — for everyone, so they are asked first.
		if (current && current.role === 'leader' && current.gone === null) {
			confirmDestructive({
				cancelLabel: t('cancel'),
				confirmLabel: t('liveReplaceConfirm'),
				message: t('liveReplaceBody'),
				onConfirm: () => void begin(),
				title: t('liveReplaceTitle')
			});

			return;
		}

		await begin();
	}, [kind, navigation, t]);

	/** The reader ends it for everyone; the socket's `ended` frame tells the followers. */
	const end = useCallback(async () => {
		navigation.setParams({ shouldOpenLive: undefined });
		await liveSession.end();
	}, [navigation]);

	/** A follower goes back to reading alone, where they are; also how a finished session is put away. */
	const leave = useCallback(() => {
		navigation.setParams({ liveNotFoundCode: undefined, shouldOpenLive: undefined });

		if (isOwnKind) {
			liveSession.leave();
		}
	}, [isOwnKind, navigation]);

	const publish = useCallback(
		(pos: LivePosition, options?: { isImmediate?: boolean }) => handleRef.current?.publish(pos, options),
		[]
	);
	const publishMark = useCallback(
		(mark: LiveMark | null, shown: boolean, options?: { isTap?: boolean }) =>
			handleRef.current?.publishMark(mark, shown, options),
		[]
	);
	const detach = useCallback(() => handleRef.current?.detach(), []);
	const follow = useCallback(() => handleRef.current?.follow(), []);

	return {
		code,
		detach,
		end,
		follow,
		hasStartFailed,
		// Only the screen attached to the session leads or follows — not a copy of it in another tab.
		isFollower: isAttached && state.role === 'follower' && state.gone === null,
		isLeader: isAttached && state.role === 'leader',
		isStarting,
		leave,
		markStore: liveSession.markStore,
		publish,
		publishMark,
		sheet: { close: closeSheet, isVisible: isFocused && params?.shouldOpenLive === true },
		start,
		state
	};
};
