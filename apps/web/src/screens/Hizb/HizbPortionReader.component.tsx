import { WrapperApiError } from '@/api/wrapper.api';
import { RepetitionCounter } from '@/components/RepetitionCounter/RepetitionCounter.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { PullToRefresh } from '@/components/ui/PullToRefresh/PullToRefresh.component';
import { CaptionText, EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
import { HIZB_PORTION_COUNT, portion, portionBlocks, workOf } from '@/lib/content/hizbPortions';
import { type HizbBlockRef, isCevsenSection, pageRangeOf } from '@/lib/content/hizbulhakaik';
import { groupQueryKeys } from '@/lib/hooks/queryKeys';
import { useGetBabs, useSetBabRead } from '@/lib/hooks/useBab';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetGroupById, useTakePoolPart } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useGetRepetitions, useSetRepetitions } from '@/lib/hooks/useRepetitions';
import { useCoverBabs, useGetRoundDetail } from '@/lib/hooks/useRounds';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { requiredRepetitions } from '@/lib/utils/groupKinds';
import { hizbPartsLabel } from '@/lib/utils/groups';
import {
	canMarkPortion,
	countsRepetitions,
	markFailureKind,
	openRoundShares,
	pastRoundShares,
	portionOwnership,
	stepHizbPage,
	type HizbPage,
	type PortionMarkStep
} from '@/lib/utils/hizbReader';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { TabStackParamList } from '@/navigation/types';
import { ReaderBabMap } from '@/screens/Reader/ReaderBabMap.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { textSizeSheet } from '@/screens/Reader/textSizeSheet';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HizbBody } from './HizbBody.component';

type PortionParams = Extract<TabStackParamList['HizbReader'], { groupId: string }>;

type Props = {
	navigation: NativeStackNavigationProp<TabStackParamList, 'HizbReader'>;
	params: PortionParams;
};

/** One identity for every absent list, so the strip's `memo` holds — see `BabReaderScreen`. */
const NO_NUMBERS: number[] = [];

/** The swipe's thresholds, the Cevşen reader's own — see `BabReaderScreen` for what each is for. */
const SWIPE_ACTIVATE_X = 24;
const SWIPE_FAIL_Y = 18;
const SWIPE_COMMIT_X = 60;
const SWIPE_COMMIT_VELOCITY = 450;

/** The chip's own height, reserved on its row so the chip arriving with the group moves nothing. */
const CHIP_ROW_HEIGHT = 23;

/**
 * A portion's blocks, sliced once. `portionBlocks` walks the whole text to cut one portion out,
 * which is cheap once and wasteful per frame of a page turn — and the cache also hands the page
 * the same array every time, so nothing downstream sees a new identity for the same text.
 */
const blocksByPart = new Map<number, HizbBlockRef[]>();

const blocksOf = (partNumber: number): HizbBlockRef[] => {
	const cached = blocksByPart.get(partNumber);

	if (cached) {
		return cached;
	}

	const blocks = portionBlocks(partNumber);

	blocksByPart.set(partNumber, blocks);

	return blocks;
};

const blockCountOf = (partNumber: number) => blocksOf(partNumber).length;

/** A tap back for the three committing actions — the Cevşen reader's, and swallowed for its reasons. */
const tapBack = () => {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
};

/** A failed write, pinned to the portion and the round it was about, so it never labels another. */
type MarkFailure = {
	partNumber: number;
	roundIndex: number | null;
	kind: ReturnType<typeof markFailureKind>;
};

/**
 * A Hizb group's reader: one portion, a block to a page, and the one button that marks it.
 *
 * **The Cevşen reader's E2, portion by portion.** The strip across the header is the whole
 * book's thirty-three and walks all of them; only the *marking* is gated — the chip beside the
 * portion says whose it is, one line above the button says why the button reads as it does, and
 * another member's portion gets a disabled "Bu bölüm sana ait değil" rather than no way in. A
 * pool portion stays live and is claimed before it is marked. Everything that decides this is
 * `canMarkPortion`, tested as a table; this screen only draws the answer.
 *
 * **The arrows turn pages, the strip jumps portions.** A portion runs from one block to thirty,
 * so its blocks are paged the way the free reader pages a section — and a page turn off either
 * end carries on into the neighbouring portion, as a book does (`stepHizbPage`). The route holds
 * the portion, so the strip, a page turn across a boundary and a deep link all set the same
 * param; the block within it is this screen's own, and starts over at 0 when the portion changes
 * any other way.
 *
 * **Marking does not carry you on**, unlike the Cevşen reader, which steps to the next bab. A
 * bab is a page and a share is several of them in a row; a portion is many pages and a share is
 * often one portion, so the next one is usually somebody else's. The button turning into "Geri
 * al" under the text is the confirmation, and the arrow is one tap away when there is more.
 *
 * **Cover mode**: a `roundIndex` older than the group's is a closed round's gap, filled
 * append-only through the cover endpoint for that round. Everything the screen shows then —
 * whose it was, what was read, the count — is that round's, from its own record; walking the
 * strip keeps the round, since it is a param beside the portion. The open round's index is
 * treated exactly as no index, so a caller may pass either.
 *
 * **Sekine** (`requiredRepetitions > 1`) carries a counter above the action row, and the button
 * stays disabled until the viewer's own count for the round shown reaches the requirement. The
 * server is still the authority: a 409 rolls the read back (the hooks do that) and the line
 * above the button says the count was short.
 *
 * **The text never waits.** It is bundled, so it renders on the first frame with the reader's
 * saved typography once it arrives; only the chip and the button wait for the group, and a
 * failure to load it turns the button into "Tekrar dene" under text that is still there to read.
 */
export const HizbPortionReader = ({ navigation, params }: Props) => {
	const { groupId, partNumber, roundIndex } = params;

	// Held on for the screen's life, as the Cevşen reader is — a portion is minutes of reading.
	useKeepAwake();
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
	const tabBarOffset = useContext(TabBarOffsetContext);
	const queryClient = useQueryClient();
	const viewerUserId = useCurrentUserId();

	const groupQuery = useGetGroupById(groupId);
	const babsQuery = useGetBabs(groupId);
	const settingsQuery = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	const setBabRead = useSetBabRead();
	const takePoolPart = useTakePoolPart();
	const coverBabs = useCoverBabs();
	const setRepetitions = useSetRepetitions();
	const textSize = textSizeSheet(navigation, params);

	const group = groupQuery.data;
	const openRoundIndex = group?.roundIndex ?? null;
	// A number rather than a flag, as on the Cevşen reader, so the index is narrowed where it is used.
	const coveredRoundIndex =
		roundIndex !== undefined && openRoundIndex !== null && roundIndex < openRoundIndex ? roundIndex : null;
	const isCovering = coveredRoundIndex !== null;
	/*
	 * The closed round's record is asked for **alongside** the group rather than after it, while
	 * the group cannot yet say whether the index is old — the round screen that pushed here has
	 * usually cached the group anyway. Once it answers that the index is the open round's, the
	 * query stands down: a disabled query at `-1`, as the Cevşen reader keeps its own.
	 */
	const roundQuery = useGetRoundDetail(
		groupId,
		roundIndex !== undefined && (group === undefined || isCovering) ? roundIndex : -1
	);
	const round = isCovering ? roundQuery.data : undefined;
	// The round every count and cover here is about. Null only until the group says, or while it gathers.
	const shownRoundIndex = coveredRoundIndex ?? openRoundIndex;

	const required = requiredRepetitions('HIZB', partNumber);
	const isRepeated = required > 1;
	const isRepetitionsEnabled = isRepeated && shownRoundIndex !== null && group?.status === 'RUNNING';
	const repetitionsQuery = useGetRepetitions(groupId, partNumber, shownRoundIndex ?? 0, isRepetitionsEnabled);

	// The state the pull refreshes: the group, and the board or the closed round it is reading.
	const pullToRefresh = usePullToRefresh(
		groupQuery,
		isCovering ? roundQuery : babsQuery,
		...(isRepetitionsEnabled ? [repetitionsQuery] : [])
	);

	/** Mine, pool and read, for the round shown — null until both halves of that round are in. */
	const shares = useMemo(() => {
		if (!group) {
			return null;
		}

		if (isCovering) {
			return round ? pastRoundShares(round, viewerUserId) : null;
		}

		return babsQuery.data ? openRoundShares(group, babsQuery.data) : null;
	}, [babsQuery.data, group, isCovering, round, viewerUserId]);

	// The page: the route's portion, and the block of it this screen is on.
	const blocks = blocksOf(partNumber);
	const [page, setPage] = useState<HizbPage>({ blockIndex: 0, partNumber });
	const blockIndex = page.partNumber === partNumber ? Math.min(page.blockIndex, blocks.length - 1) : 0;
	const current = blocks[blockIndex] ?? blocks[0];

	/*
	 * A new page starts at its top, twice over, for the reasons `BabReaderScreen` gives: once now,
	 * and again when the new page has been measured and the old offset would be clamped into it.
	 */
	const scrollRef = useRef<ScrollView | null>(null);
	const isAwaitingTop = useRef(true);

	const scrollToTop = useCallback(() => {
		scrollRef.current?.scrollTo({ animated: false, y: 0 });
	}, []);

	useEffect(() => {
		isAwaitingTop.current = true;
		scrollToTop();
	}, [blockIndex, partNumber, scrollToTop]);

	const handleContentSizeChange = useCallback(() => {
		if (!isAwaitingTop.current) {
			return;
		}

		isAwaitingTop.current = false;
		scrollToTop();
	}, [scrollToTop]);

	/*
	 * The strip scrubs the thirty-three: the portion under the finger moves the header, the text
	 * lands once on release — the split `BabReaderScreen` explains at length.
	 */
	const [railWidth, setRailWidth] = useState(0);
	const scrubRatio = useSharedValue(-1);
	const lastScrubPart = useSharedValue(0);
	const [scrubPart, setScrubPart] = useState<number | null>(null);
	const displayPart = scrubPart ?? partNumber;

	// A jump opens the portion at its first page, even one visited — and left mid-way — before.
	const commitScrub = useCallback(
		(next: number) => {
			setScrubPart(null);
			setPage({ blockIndex: 0, partNumber: next });
			navigation.setParams({ partNumber: next });
		},
		[navigation]
	);

	const trackScrub = (x: number) => {
		'worklet';

		if (railWidth <= 0) {
			return;
		}

		const ratio = Math.min(1, Math.max(0, x / railWidth));

		scrubRatio.value = ratio;

		const part = Math.round(ratio * (HIZB_PORTION_COUNT - 1)) + 1;

		if (part !== lastScrubPart.value) {
			lastScrubPart.value = part;
			runOnJS(setScrubPart)(part);
		}
	};

	const railGesture = Gesture.Pan()
		.minDistance(0)
		.hitSlop({ bottom: 10, top: 10 })
		.onBegin(event => trackScrub(event.x))
		.onUpdate(event => trackScrub(event.x))
		.onFinalize(() => {
			const ratio = scrubRatio.value;

			scrubRatio.value = -1;
			lastScrubPart.value = 0;

			if (ratio >= 0) {
				runOnJS(commitScrub)(Math.round(ratio * (HIZB_PORTION_COUNT - 1)) + 1);
			}
		});

	const turnPage = (direction: 1 | -1) => {
		const next = stepHizbPage({ blockIndex, partNumber }, direction, HIZB_PORTION_COUNT, blockCountOf);

		if (!next) {
			return;
		}

		setPage(next);

		if (next.partNumber !== partNumber) {
			navigation.setParams({ partNumber: next.partNumber });
		}
	};

	const hasPreviousPage = blockIndex > 0 || partNumber > 1;
	const hasNextPage = blockIndex < blocks.length - 1 || partNumber < HIZB_PORTION_COUNT;

	// Across to turn the page, as the arrows are laid out — the Cevşen reader's reasoning.
	const swipe = Gesture.Pan()
		.activeOffsetX([-SWIPE_ACTIVATE_X, SWIPE_ACTIVATE_X])
		.failOffsetY([-SWIPE_FAIL_Y, SWIPE_FAIL_Y])
		.onEnd(event => {
			const far = Math.abs(event.translationX) > SWIPE_COMMIT_X;
			const fast = Math.abs(event.velocityX) > SWIPE_COMMIT_VELOCITY;

			if (!far && !fast) {
				return;
			}

			runOnJS(turnPage)(event.translationX < 0 ? 1 : -1);
		});

	// The free reader's typography from the first frame, so the text needn't wait on settings.
	const readerSettings = {
		readerArabicFont: settingsQuery.data?.readerArabicFont ?? 'uthman',
		readerFontSize: settingsQuery.data?.readerFontSize ?? READER_FONT_SIZE_DEFAULT,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;

	/*
	 * **What the button may do, decided once.** Before the round shown has fully arrived there is
	 * no decision, and the button waits disabled in its usual place, so nothing reflows when it
	 * wakes.
	 */
	const ownership = shares ? portionOwnership(partNumber, shares) : null;
	const currentBab = babsQuery.data?.find(bab => bab.number === partNumber);
	const roundBab = round?.babs.find(bab => bab.number === partNumber);
	const count = isRepetitionsEnabled ? repetitionsQuery.data?.count : undefined;
	const decision =
		ownership === null
			? null
			: canMarkPortion({
					count: count ?? 0,
					isMissedInRound: isCovering ? roundBab?.readByUserId === null : !currentBab?.readAt,
					isPastRound: isCovering,
					isReadByViewer: viewerUserId !== null && currentBab?.readByUserId === viewerUserId,
					ownership,
					required
			  });
	const isReady =
		decision !== null &&
		group?.status === 'RUNNING' &&
		// The count is needed only where it gates something.
		(!isRepeated || count !== undefined || decision.action === 'none');

	/*
	 * **A query that never answered keeps the text and loses only the button.** `ErrorState` is a
	 * whole screen, and replacing a page someone is reading with it would take away the one thing
	 * that still works. A query holding data from before is not failed — a background refetch
	 * that misses leaves the last answer standing, and the poll will try again.
	 */
	const failedQueries = [
		groupQuery,
		isCovering ? roundQuery : babsQuery,
		...(isRepetitionsEnabled ? [repetitionsQuery] : [])
	].filter(query => query.isError && query.data === undefined);
	const isRetrying = failedQueries.some(query => query.isFetching);

	const retry = () => {
		for (const query of failedQueries) {
			void query.refetch();
		}
	};

	const [failure, setFailure] = useState<MarkFailure | null>(null);

	/** Files a failed write against the portion and round it was made for, which may no longer be on screen. */
	const failWith = (step: PortionMarkStep, forPart: number) => (error: Error) => {
		const kind = markFailureKind(error instanceof WrapperApiError ? error.status : null, {
			isRepeated: requiredRepetitions('HIZB', forPart) > 1,
			step
		});

		setFailure({ kind, partNumber: forPart, roundIndex: shownRoundIndex });

		// The server's count disagreed with the screen's; ask for it rather than trust either.
		if (kind === 'repetitions') {
			void queryClient.invalidateQueries({ queryKey: groupQueryKeys.repetitions(groupId) });
		}
	};

	const clearFailureFor = (forPart: number) => () =>
		setFailure(existing => (existing?.partNumber === forPart ? null : existing));

	/*
	 * Shown under the portion it is about, in the round it was about. A failure that the refetch
	 * has since settled as read says nothing useful any more — except that somebody else got
	 * there first, which is worth knowing even after the button has turned into "Okundu".
	 */
	const visibleFailure =
		failure !== null &&
		failure.partNumber === partNumber &&
		failure.roundIndex === shownRoundIndex &&
		(failure.kind === 'taken' || decision?.reason !== 'alreadyRead')
			? failure
			: null;

	const markRead = () => {
		const forPart = partNumber;

		setBabRead.mutate(
			{ babNumber: forPart, groupId, read: true },
			{ onError: failWith('read', forPart), onSuccess: clearFailureFor(forPart) }
		);
		tapBack();
	};

	// Silent, as the Cevşen reader's undo is: a correction shouldn't feel like an achievement.
	const markUnread = () => {
		const forPart = partNumber;

		setBabRead.mutate(
			{ babNumber: forPart, groupId, read: false },
			{ onError: failWith('read', forPart), onSuccess: clearFailureFor(forPart) }
		);
	};

	/*
	 * Claimed first, marked once the claim holds — the server refuses to mark a portion nobody
	 * holds, and a pool portion is contested, so the read waits for the claim to be answered.
	 */
	const takeAndRead = () => {
		const forPart = partNumber;

		takePoolPart.mutate(
			{ babNumber: forPart, groupId },
			{
				onError: failWith('take', forPart),
				onSuccess: () => {
					setBabRead.mutate(
						{ babNumber: forPart, groupId, read: true },
						{ onError: failWith('read', forPart), onSuccess: clearFailureFor(forPart) }
					);
					tapBack();
				}
			}
		);
	};

	const cover = () => {
		if (coveredRoundIndex === null) {
			return;
		}

		const forPart = partNumber;

		coverBabs.mutate(
			{ babNumbers: [forPart], groupId, roundIndex: coveredRoundIndex },
			{ onError: failWith('cover', forPart), onSuccess: clearFailureFor(forPart) }
		);
		tapBack();
	};

	// Absolute, and against the round shown — a closed round's Sekine is counted in that round.
	const setCount = (next: number) => {
		if (shownRoundIndex === null) {
			return;
		}

		const forPart = partNumber;

		setRepetitions.mutate(
			{ babNumber: forPart, count: next, groupId, roundIndex: shownRoundIndex },
			{ onError: failWith('count', forPart), onSuccess: clearFailureFor(forPart) }
		);
	};

	const actionFor = { cover, none: () => undefined, read: markRead, takeAndRead, unread: markUnread };

	const actionTitle = () => {
		switch (decision?.action) {
			case 'unread':
				return t('markUnread');
			case 'takeAndRead':
				// Names the bigger half of what the tap does, as the Cevşen reader's pool label does.
				return t('takeAndRead');
			case 'cover':
				// Your own gap is read late, not taken over — `HizbRoundDetail` splits it the same way.
				return ownership === 'mine' ? t('markAsRead') : t('takeOver');
			case 'none':
				return decision.reason === 'notYours' ? t('readLockedHizb') : t('coverDone');
			default:
				return t('markRead');
		}
	};

	const isActionDisabled =
		!isReady ||
		decision.isDisabled ||
		takePoolPart.isPending ||
		// The count is still on its way, and the read would race it to the server and lose.
		(isRepeated && setRepetitions.isPending && decision.action !== 'unread');

	const portionLabel = hizbPartsLabel(String(partNumber), t);

	/** The one line above the button, and what colour it speaks in — or nothing to say. */
	const hint = (() => {
		if (failedQueries.length > 0) {
			return { color: theme.colors.missed, text: t('genericError') };
		}

		if (visibleFailure) {
			return {
				color: theme.colors.missed,
				text:
					visibleFailure.kind === 'taken'
						? t('coverTakenAt', { bab: portionLabel })
						: visibleFailure.kind === 'repetitions'
						? t('hizbRepetitionsShort', { required })
						: t('coverFailedAt', { bab: portionLabel })
			};
		}

		if (!isReady) {
			return null;
		}

		if (decision.reason === 'repetitions') {
			return { color: theme.colors.faintText, text: t('hizbRepetitionsHint', { required }) };
		}

		if (decision.reason === 'notYours') {
			return { color: theme.colors.faintText, text: t('lockedHintHizb') };
		}

		// In your share, and read by whoever held it before the rotation handed it over.
		if (decision.reason === 'alreadyRead' && !isCovering && ownership === 'mine') {
			return {
				color: theme.colors.faintText,
				text: currentBab?.readByDisplayName
					? t('readBeforeYoursBy', { name: currentBab.readByDisplayName })
					: t('readBeforeYours')
			};
		}

		if (decision.action === 'takeAndRead') {
			return { color: theme.colors.sandText, text: t('poolReadHintHizb') };
		}

		if (decision.action === 'cover' && ownership !== 'mine') {
			return {
				color: ownership === 'pool' ? theme.colors.sandText : theme.colors.faintText,
				text: t('coverHintHizb')
			};
		}

		return null;
	})();

	// The chip follows the finger along the strip, as the header does; absent until the round is in.
	const displayOwnership = shares ? portionOwnership(displayPart, shares) : null;
	const chip =
		displayOwnership === 'mine'
			? { background: theme.colors.accentSoft, foreground: theme.colors.accent, label: t('ownMine') }
			: displayOwnership === 'pool'
			? { background: theme.colors.sand, foreground: theme.colors.sandText, label: t('ownPool') }
			: displayOwnership === 'other'
			? { background: theme.colors.secondary, foreground: theme.colors.subtext, label: t('ownOther') }
			: null;

	/*
	 * The printed pages on screen, and where in the portion this page is. While the finger is on
	 * another portion, that portion's whole span instead — the header is describing it by then.
	 */
	const pages =
		displayPart === partNumber
			? pageRangeOf(current.block.lines)
			: pageRangeOf(blocksOf(displayPart).flatMap(ref => ref.block.lines));
	const pageLabel =
		pages.from === pages.to
			? t('hizbPage', { page: pages.from })
			: t('hizbPages', { from: pages.from, to: pages.to });
	const pageCaption =
		displayPart === partNumber && blocks.length > 1
			? `${pageLabel} · ${blockIndex + 1} / ${blocks.length}`
			: pageLabel;

	/** "12 Eylül Cuma" in the reader's language and the group's zone — the day a gap is from. */
	const coveredRoundDate = useMemo(() => {
		if (!round || !group) {
			return null;
		}

		return new Intl.DateTimeFormat(language, {
			day: 'numeric',
			month: 'long',
			timeZone: group.timezone,
			weekday: 'long'
		}).format(new Date(round.startedAt));
	}, [group, language, round]);

	const showsCounter = isRepeated && (decision === null || countsRepetitions(decision, required));

	return (
		<SafeAreaView
			// No bottom edge — the tab bar clears the home indicator; inset by its height instead.
			edges={['top', 'left', 'right']}
			style={[styles.safeArea, { backgroundColor: theme.colors.background, paddingBottom: tabBarOffset }]}
		>
			{/* The pull refreshes the group and the round it is reading; the text is bundled and never stale. */}
			<PullToRefresh {...pullToRefresh}>
				<ScrollView
					contentContainerStyle={styles.page}
					onContentSizeChange={handleContentSizeChange}
					ref={scrollRef}
					showsVerticalScrollIndicator={false}
					stickyHeaderIndices={[0]}
				>
					<View style={[styles.header, { borderBottomColor: theme.colors.readerRule }]}>
						<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
						{/*
						 * The band the navigator's back control and "Aa" are drawn over, so it holds
						 * only what is short enough to sit between them: which closed round this is,
						 * and its day. The open round needs no label — it is simply today's.
						 */}
						<View style={styles.headerTopRow}>
							<View style={styles.headerSide} />
							<View style={styles.headerCenter}>
								{coveredRoundIndex !== null ? (
									<EyebrowText numberOfLines={1}>{`${t('roundN')} ${
										coveredRoundIndex + 1
									}`}</EyebrowText>
								) : null}
								{coveredRoundDate ? (
									<Typography color={theme.colors.faintText} style={styles.roundDate} variant='mono'>
										{coveredRoundDate}
									</Typography>
								) : null}
							</View>
							<View style={styles.headerSide} />
						</View>
						<View style={styles.heading}>
							<View style={styles.eyebrowRow}>
								{/* Its place in the book, not in the share — which are yours is the chip's job. */}
								<EyebrowText numberOfLines={1} style={styles.eyebrow}>
									{t('hizbReaderEyebrow', {
										count: HIZB_PORTION_COUNT,
										n: displayPart,
										work: t(workOf(displayPart).titleKey)
									})}
								</EyebrowText>
								{chip ? (
									<View style={[styles.ownershipChip, { backgroundColor: chip.background }]}>
										<Typography color={chip.foreground} variant='caption' weight='semibold'>
											{chip.label}
										</Typography>
									</View>
								) : null}
							</View>
							<Typography variant='title' weight='regular'>
								{t(portion(displayPart).descriptionKey)}
							</Typography>
							<CaptionText color={theme.colors.subtext}>{pageCaption}</CaptionText>
						</View>
						{/*
						 * The thirty-three, one tick each, in the Cevşen reader's colours. No `spots`:
						 * a Hizb seat's leftovers are claimed portion by portion, so there are no blocks
						 * in the pool to bracket.
						 */}
						<GestureDetector gesture={railGesture}>
							<View
								accessibilityRole='adjustable'
								accessibilityValue={{ max: HIZB_PORTION_COUNT, min: 1, now: partNumber }}
								onLayout={event => setRailWidth(event.nativeEvent.layout.width)}
								style={styles.babMapRow}
							>
								<ReaderBabMap
									count={HIZB_PORTION_COUNT}
									currentBab={displayPart}
									myBabNumbers={shares?.myBabNumbers ?? NO_NUMBERS}
									poolBabNumbers={shares?.poolBabNumbers ?? NO_NUMBERS}
									readBabNumbers={shares?.readBabNumbers ?? NO_NUMBERS}
									scrubRatio={scrubRatio}
								/>
							</View>
						</GestureDetector>
					</View>

					<GestureDetector gesture={swipe}>
						<View style={styles.body}>
							{/*
							 * The page exactly as the portion slices it: a portion that begins or ends
							 * inside a line opens and closes on its own words, with no mark added at the
							 * cut. Keyed on the portion too — consecutive portions are cut from one block.
							 */}
							<HizbBody
								block={current.block}
								font={readerSettings.readerArabicFont}
								fontSize={readerSettings.readerFontSize}
								isCevsenBab={isCevsenSection(current.sectionIndex)}
								key={`${partNumber}-${current.sectionIndex}-${current.blockIndex}`}
								numerals={readerSettings.readerNumerals}
							/>
						</View>
					</GestureDetector>
				</ScrollView>
			</PullToRefresh>

			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
				{/* Drawn inert while the round loads, so it is already in place when it wakes. */}
				{showsCounter ? (
					<RepetitionCounter count={count} isDisabled={!isReady} onChange={setCount} required={required} />
				) : null}
				{hint ? (
					<Typography color={hint.color} style={styles.readHint} variant='caption'>
						{hint.text}
					</Typography>
				) : null}
				<View style={styles.footerRow}>
					<AppButton
						accessibilityLabel={t('abPrev')}
						disabled={!hasPreviousPage}
						fullWidth={false}
						icon='chevronLeft'
						onPress={() => turnPage(-1)}
						variant='surface'
					/>
					{failedQueries.length > 0 ? (
						<AppButton
							disabled={isRetrying}
							icon='refresh'
							isLoading={isRetrying}
							onPress={retry}
							style={styles.markButtonSlot}
							title={t('retry')}
							variant='surface'
						/>
					) : (
						<AppButton
							disabled={isActionDisabled}
							onPress={isReady ? actionFor[decision.action] : () => undefined}
							style={styles.markButtonSlot}
							title={actionTitle()}
							variant={
								decision?.action === 'unread' || decision?.reason === 'alreadyRead'
									? 'accentOutline'
									: 'accent'
							}
						/>
					)}
					<AppButton
						accessibilityLabel={t('abNext')}
						disabled={!hasNextPage}
						fullWidth={false}
						icon='chevronRight'
						onPress={() => turnPage(1)}
						variant='surface'
					/>
				</View>
			</View>

			<TextSizeSheet
				isVisible={textSize.isVisible}
				onChange={patch => updateSettings.mutate(patch)}
				onClose={textSize.close}
				settings={readerSettings}
			/>
		</SafeAreaView>
	);
};

// The Cevşen reader's measurements, so the group's two readers are the same page.
const styles = StyleSheet.create({
	babMapRow: {
		marginTop: 11
	},
	body: {
		paddingBottom: 26,
		paddingHorizontal: 22,
		paddingTop: 26
	},
	eyebrow: {
		flex: 1,
		minWidth: 0
	},
	eyebrowRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		minHeight: CHIP_ROW_HEIGHT
	},
	footer: {
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: 9,
		overflow: 'hidden',
		paddingBottom: 12,
		paddingHorizontal: 20,
		paddingTop: 12
	},
	footerRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8
	},
	header: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		gap: 10,
		overflow: 'hidden',
		paddingBottom: 12,
		paddingHorizontal: 20,
		paddingTop: 8
	},
	headerCenter: {
		alignItems: 'center',
		flex: 1,
		minWidth: 0
	},
	headerSide: {
		width: 64
	},
	headerTopRow: {
		alignItems: 'center',
		flexDirection: 'row',
		minHeight: 44
	},
	heading: {
		gap: 4
	},
	markButtonSlot: {
		flex: 1
	},
	ownershipChip: {
		borderRadius: 7,
		paddingHorizontal: 8,
		paddingVertical: 3
	},
	page: {
		flexGrow: 1
	},
	readHint: {
		lineHeight: 16,
		textAlign: 'center'
	},
	roundDate: {
		fontSize: 9.5,
		lineHeight: 13,
		marginTop: 3
	},
	safeArea: {
		flex: 1
	}
});
