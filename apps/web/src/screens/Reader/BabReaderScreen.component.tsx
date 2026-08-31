import { BackLink } from '@/components/ui/BackLink/BackLink.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import type { CevsenInvocation } from '@/lib/content/cevsen';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
import { useGetBabs, useSetBabRead } from '@/lib/hooks/useBab';
import { useGetGroupById, useGetPoolSlots, useTakePoolSlot } from '@/lib/hooks/useGroup';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { BAB_COUNT } from '@/lib/utils/babs';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { TabStackParamList } from '@/navigation/types';
import { MealSheet } from '@/screens/Reader/MealSheet.component';
import { ReaderBabMap } from '@/screens/Reader/ReaderBabMap.component';
import { ReaderBody, readerFaces } from '@/screens/Reader/ReaderBody.component';
import { ReaderSettings } from '@/screens/Reader/ReaderSettings.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReaderSkeleton } from './ReaderSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'BabReader'>;

/**
 * Marking a bab read is the screen's one committing action, so it gets a tap back.
 *
 * `impactAsync`, not `notificationAsync`: the success notification is a three-beat pattern
 * meant for the end of something, and a share can run to forty babs. Undoing is deliberately
 * silent — a correction shouldn't feel like an achievement.
 *
 * Swallowed rather than awaited. Haptics are unavailable on web and on a device with the
 * system setting off, where this rejects; a reading screen must not care.
 */
const tapBack = () => {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
};

/**
 * How far across the page counts as turning it.
 *
 * `activeOffsetX`/`failOffsetY` are what keep this off the ScrollView's back: the pan only
 * takes over once the finger has committed horizontally, and gives up the moment it commits
 * vertically. Without both, every scroll would be a coin toss between reading and paging.
 */
const SWIPE_ACTIVATE_X = 24;
const SWIPE_FAIL_Y = 18;
const SWIPE_COMMIT_X = 60;
const SWIPE_COMMIT_VELOCITY = 450;

/**
 * A single empty array for every absent list, so a missing one keeps its identity between
 * renders. `?? []` mints a new array each time, which alone was enough to invalidate the
 * tick list's `memo` on every frame of a drag.
 */
const NO_BAB_NUMBERS: number[] = [];

/** The design's "bölüm başı" size — the largest of its three, for the mark opening a bab. */
export const BabReaderScreen = ({ navigation, route }: Props) => {
	const { babNumber, groupId } = route.params;

	/*
	 * Hold the screen on while this one is up. Reading a bab takes minutes of looking without
	 * touching, which is exactly the shape of "idle" the OS dims for, and being dropped
	 * mid-invocation is the one interruption a reader can't shrug off.
	 *
	 * The hook releases on unmount, and a pushed screen unmounts when the tab resets on blur —
	 * so leaving the reader gives the display back without anything else having to remember to.
	 */
	useKeepAwake();
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const tabBarOffset = useContext(TabBarOffsetContext);

	const babsQuery = useGetBabs(groupId);
	const groupQuery = useGetGroupById(groupId);
	// The pool's own slot→babs mapping, which is the only thing that knows what a seat offers
	// this round. Deriving it from the bab number gets the rotation wrong.
	const poolQuery = useGetPoolSlots(groupId);
	const takePoolSlot = useTakePoolSlot();
	const settingsQuery = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	const setBabRead = useSetBabRead();
	const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
	/** The invocation whose meaning is open, or null. Held here so the sheet outlives the press. */
	const [mealInvocation, setMealInvocation] = useState<CevsenInvocation | null>(null);

	/**
	 * The rail is a scrubber: dragging it walks the hundred far faster than the arrows can,
	 * which are ninety-nine taps end to end.
	 *
	 * **The number moves under the finger; the Arabic lands once, on release.** The obvious
	 * build — `setParams` each time the finger crosses a bab — re-renders a screenful of
	 * Arabic and eleven rosettes up to a hundred times in one swipe, which is the same shape
	 * of stall the bab board hit with a hundred animated cells.
	 *
	 * The whole drag now costs a header re-render per bab crossed, and nothing more. It used
	 * to split: the old round head rode the finger on the UI thread via one `useAnimatedStyle`,
	 * while the number re-rendered. A tick strip has no equivalent shortcut — moving the
	 * position means restyling *two different views*, which is React's work either way — so
	 * the shared value went with the head. It stays affordable because the page below keeps
	 * rendering `babNumber`, the ticks are `memo`'d, and a bab is a hundredth of the strip
	 * wide, so most frames set a value React then bails out of.
	 *
	 * Width is **measured, not assumed** — the strip is full-width now, which varies by
	 * device, and a hardcoded width would land the finger several babs off.
	 */
	/**
	 * Every bab read this round, whoever read it — the strip's tallest-but-one state.
	 *
	 * Memoised **above the early returns**, which is the only place it can be: the strip
	 * `memo`s on this array's identity, so recomputing it per render would re-render a
	 * hundred ticks on every frame of a drag and undo the split entirely.
	 */
	const readBabNumbers = useMemo(
		() => babsQuery.data?.filter(bab => bab.readAt).map(bab => bab.number) ?? NO_BAB_NUMBERS,
		[babsQuery.data]
	);

	const [railWidth, setRailWidth] = useState(0);

	/*
	 * The drag's position, 0–1, or -1 at rest. The strip's indicator reads it on the UI
	 * thread; `lastScrubBab` is the worklet's memory of what JS has already been told, so a
	 * fast drag doesn't cross the bridge sixty times a second to re-send the same number.
	 */
	const scrubRatio = useSharedValue(-1);
	const lastScrubBab = useSharedValue(0);

	/**
	 * The number counts up under the finger; the Arabic does not follow until you let go.
	 *
	 * `scrubBab` is only ever read by the header — the page below keeps rendering `babNumber`
	 * — so a scrub costs a header re-render and nothing more. Setting it on every frame is
	 * safe: React bails out of a `useState` write that matches the current value, and a bab
	 * is a hundredth of the rail wide, so the overwhelming majority of frames are exactly
	 * that. No hand-rolled dedupe is needed, and none is wanted — one would have to live in a
	 * shared value, which the compiler then won't let a worklet write to.
	 */
	const [scrubBab, setScrubBab] = useState<number | null>(null);
	const displayBab = scrubBab ?? babNumber;

	// Both halves of landing, in one JS call so they batch into a single render — clearing
	// the scrub separately would blink the old bab number between the two.
	const commitScrub = useCallback(
		(next: number) => {
			setScrubBab(null);
			navigation.setParams({ babNumber: next });
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

		const bab = Math.round(ratio * (BAB_COUNT - 1)) + 1;

		// Only when it actually changes. The indicator has already moved by now; this is just
		// the number in the title catching up.
		if (bab !== lastScrubBab.value) {
			lastScrubBab.value = bab;
			runOnJS(setScrubBab)(bab);
		}
	};

	/**
	 * Rebuilt each render rather than memoised, which is safe **because** the body doesn't
	 * re-render mid-drag: only the header does, and a replaced gesture object with identical
	 * handlers is something `GestureDetector` absorbs. Memoising would mean naming
	 * `scrubRatio` as a dependency, and a value handed to a hook is one the compiler will not
	 * let a worklet write to.
	 */
	const railGesture = Gesture.Pan()
		// Fires on touch-down, so a tap anywhere along the rail jumps there rather than
		// needing a drag first.
		.minDistance(0)
		.hitSlop({ bottom: 10, top: 10 })
		.onBegin(event => trackScrub(event.x))
		.onUpdate(event => trackScrub(event.x))
		// `onFinalize`, not `onEnd`: a cancelled gesture still has to land on the bab the
		// finger left, or the strip and the page it is describing disagree.
		.onFinalize(() => {
			const ratio = scrubRatio.value;

			scrubRatio.value = -1;
			lastScrubBab.value = 0;

			if (ratio >= 0) {
				runOnJS(commitScrub)(Math.round(ratio * (BAB_COUNT - 1)) + 1);
			}
		});

	/**
	 * The reader's typography, from E2a. Defaulted here rather than trusted from the server,
	 * because the sheet reads these back to show what is currently selected and `undefined`
	 * would leave all three groups looking unset on a first paint.
	 *
	 * Derived **above the guards below** because `invocationRuns` memoises on it, and a hook
	 * cannot sit after an early return. Nothing here needs the queries to have settled.
	 */
	const readerSettings = {
		// Must match `ReaderArabicFont`'s Prisma default — this only stands in for the frame
		// before settings arrive, and a different guess would repaint the page underneath.
		readerArabicFont: settingsQuery.data?.readerArabicFont ?? 'naskh',
		readerFontSize: settingsQuery.data?.readerFontSize ?? READER_FONT_SIZE_DEFAULT,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;
	/*
	 * Only the meal sheet needs these here — the page itself derives its own inside
	 * `ReaderBody`. The sheet sets the same invocation on another surface and has to match it.
	 */
	const faces = readerFaces(readerSettings.readerArabicFont, readerSettings.readerFontSize);

	if (babsQuery.isPending || settingsQuery.isPending) {
		return (
			<SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
				<ReaderSkeleton />
			</SafeAreaView>
		);
	}

	if (babsQuery.isError || settingsQuery.isError) {
		return (
			<SafeAreaView style={[styles.safeArea, styles.centered, { backgroundColor: theme.colors.background }]}>
				<EmptyState
					actionLabel={t('retry')}
					onAction={() => {
						babsQuery.refetch();
						settingsQuery.refetch();
					}}
					title={t('genericError')}
				/>
			</SafeAreaView>
		);
	}

	const babs = babsQuery.data ?? [];
	// Today's share, per the server — under ROTATION it is a different seat's block each
	// day, so it can't be read off `assignedUserId`.
	const myBabNumbers = groupQuery.data?.myBabNumbers ?? NO_BAB_NUMBERS;
	// A bab from a seat nobody took. It can be read, but only after taking it.
	const isPoolBab = groupQuery.data?.poolBabNumbers.includes(babNumber) ?? false;
	/**
	 * Which pool slot offers this bab **this round** — read off the pool itself, never derived.
	 *
	 * It used to be `slotIndexForBab(babNumber, spots)`, which answers a different question:
	 * that returns the seat whose *standing* block the bab belongs to. Under ROTATION an empty
	 * seat `e` leaves uncovered the block it would have been *reading*, `(e + roundIndex) %
	 * spots` — not its own — so the two only agree when the rotation happens to be at zero.
	 * Every other round the reader asked the server to take somebody else's slot, which it
	 * refused, and "Üstlen ve okudum" did nothing at all.
	 *
	 * `PoolSlot.babNumbers` is the block that slot is actually offering, so matching against it
	 * cannot drift from what the pool board shows.
	 */
	const poolSlot =
		poolQuery.data?.find(slot => slot.takenByUserId === null && slot.babNumbers.includes(babNumber)) ?? null;
	const poolSlotIndex = poolSlot?.slotIndex ?? null;
	/**
	 * The block this bab's seat is offering, as "86–90" and a count — the hint and the button
	 * both name it, so a tap can't come as a surprise.
	 *
	 * Read off the slot rather than counted from `spots`: the split gives the first
	 * `100 % spots` seats one extra bab, so a group of seven has both fifteens and fourteens.
	 */
	const poolRangeLabel = poolSlot ? `${poolSlot.start}–${poolSlot.end}` : '';
	const currentBab = babs.find(bab => bab.number === babNumber);
	const isRead = Boolean(currentBab?.readAt);

	/**
	 * **The reader walks the whole cevşen.** All hundred babs are readable; only your own and
	 * the pool's are markable.
	 *
	 * It used to walk the member's share instead, so the arrows skipped from bab 17 to bab 34
	 * and the header read "Bab 3 / 5". That kept anyone from marking a bab that wasn't theirs,
	 * but it did so by making the other ninety-five unreachable — and the cevşen is a hundred
	 * babs whoever happens to be reciting them. The ownership chip and the gated button below
	 * are what replaced it: the guard now sits on the *marking*, which is the thing that
	 * actually belongs to somebody, rather than on the walking.
	 */
	const readableTotal = BAB_COUNT;
	const previousBabNumber = babNumber > 1 ? babNumber - 1 : undefined;
	const nextBabNumber = babNumber < BAB_COUNT ? babNumber + 1 : undefined;

	/**
	 * Who this bab belongs to *this round* — the one question the reader's chip, its hint line
	 * and its button all answer. Three states and no fourth: it is in your share, it is in the
	 * pool and nobody's yet, or it is another member's.
	 */
	const isMine = myBabNumbers.includes(babNumber);
	const canMark = isMine || isPoolBab;
	const ownership = (n: number) =>
		myBabNumbers.includes(n)
			? { background: theme.colors.accentSoft, foreground: theme.colors.accent, label: t('ownMine') }
			: groupQuery.data?.poolBabNumbers.includes(n) ?? false
			? { background: theme.colors.sand, foreground: theme.colors.sandText, label: t('ownPool') }
			: { background: theme.colors.secondary, foreground: theme.colors.subtext, label: t('ownOther') };

	const ownershipChip = ownership(displayBab);

	/*
	 * One line under the text. The ownership hint takes the slot when there is one to give —
	 * it explains the button right below it, which is the more urgent thing — and the
	 * long-press hint fills it otherwise. A bab already in your share has nothing to explain
	 * about marking it, which is exactly when there is room to mention the meal.
	 */
	/*
	 * A pool bab's hint is **two sentences**, per the design: what marking it does, and then
	 * what "it" actually is. The second is the one that stops a surprise — the tap takes the
	 * whole block the empty seat was offering, and only the range makes that concrete.
	 */
	const readHint = isMine
		? t('longPressHint')
		: isPoolBab && poolSlot
		? `${t('poolReadHint')} ${t('poolClaimRange', { count: poolSlot.babNumbers.length, range: poolRangeLabel })}`
		: isPoolBab
		? t('poolReadHint')
		: t('lockedHint');

	const goToBab = (nextNumber: number | undefined) => {
		if (nextNumber === undefined) {
			return;
		}

		navigation.setParams({ babNumber: Math.max(1, Math.min(BAB_COUNT, nextNumber)) });
	};

	/*
	 * Swipe the page across to turn it, matching the arrows below rather than the direction
	 * the text runs. The Arabic is right-to-left, so a printed cevşen turns the other way —
	 * but the footer already puts "previous" on the left and "next" on the right, and one
	 * screen may not hold two contradictory ideas of which way forward is.
	 *
	 * Rebuilt each render rather than memoised, like the rail's: `GestureDetector` absorbs an
	 * identical gesture, and memoising would mean naming the values the worklet reads as
	 * dependencies, which the compiler then won't let it close over.
	 */
	const swipe = Gesture.Pan()
		.activeOffsetX([-SWIPE_ACTIVATE_X, SWIPE_ACTIVATE_X])
		.failOffsetY([-SWIPE_FAIL_Y, SWIPE_FAIL_Y])
		.onEnd(event => {
			const far = Math.abs(event.translationX) > SWIPE_COMMIT_X;
			const fast = Math.abs(event.velocityX) > SWIPE_COMMIT_VELOCITY;

			if (!far && !fast) {
				return;
			}
			// Dragging left pulls the next bab in from the right, as the arrows are laid out.
			runOnJS(goToBab)(event.translationX < 0 ? nextBabNumber : previousBabNumber);
		});

	/**
	 * Marking one read carries you to the next, because that is what you were going to do
	 * anyway — the alternative is finishing a bab and then reaching for the arrow every time.
	 *
	 * **Only on the way in.** "Geri al" holds still: undoing is a correction, and being
	 * carried off the bab you were fixing is the opposite of what was asked for. Nor does it
	 * move on the hundredth, where there is no next.
	 */
	const toggleCurrentRead = () => {
		setBabRead.mutate({ babNumber, groupId, read: !isRead });

		if (!isRead) {
			tapBack();
			goToBab(nextBabNumber);
		}
	};

	// Taking the slot is what makes the bab readable — marking it read is only allowed
	// once it belongs to someone, so the two run in order rather than in parallel.
	const handleTakeAndRead = () => {
		if (poolSlotIndex === null) {
			return;
		}

		takePoolSlot.mutate(
			{ groupId, slotIndex: poolSlotIndex },
			{
				// Advancing waits for the take, unlike the plain read above. That one is
				// optimistic locally, but a pool slot is contested — someone else can have taken
				// it a moment earlier — and being carried to the next bab before finding that out
				// would hide the failure behind a page turn.
				onSuccess: () => {
					setBabRead.mutate({ babNumber, groupId, read: true });
					tapBack();
					goToBab(nextBabNumber);
				}
			}
		);
	};

	/*
	 * **The whole screen is inset by the tab bar's height.** No `bottom` safe-area edge —
	 * the bar already clears the home indicator, and insetting for both stacks two gaps —
	 * but the bar *overlays* the scene rather than sitting below it, so without this the
	 * reader's own action bar renders underneath the glass and its buttons show through it.
	 * Padding here rather than on the footer shortens the page above it too, so the last line
	 * of Arabic clears the bar as well.
	 *
	 * The **bare height**, with no gap added: the footer sets its own even 12 top and bottom,
	 * and adding `TAB_BAR_CONTENT_GAP` on top of that left 30pt under the buttons against 12
	 * above them.
	 */
	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.safeArea, { backgroundColor: theme.colors.background, paddingBottom: tabBarOffset }]}
		>
			<View style={[styles.header, { borderBottomColor: theme.colors.readerRule }]}>
				{/*
				 * The translucent surface alone — there was a `BlurView` under it, and it was
				 * doing almost nothing for a real cost. `readerSurface` is 94% opaque and laid
				 * over it edge to edge, so the blur could contribute at most six percent of the
				 * colour, while live blur re-samples and composites the Arabic scrolling beneath
				 * it every frame. Measured on the simulator: the reader's body scroll held a
				 * 20.0ms median gap against 16.7ms on Home, with the blur the only material
				 * difference between them.
				 */}
				<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
				<View style={styles.headerTopRow}>
					<View style={styles.headerSide}>
						<BackLink onPress={navigation.goBack} />
					</View>
					<View style={styles.headerCenter}>
						{/* Position in the cevşen, not in your share — "Bab 87 / 100". Which of
						    those hundred are yours is the chip's job, one line below. */}
						<EyebrowText>{`${t('bab')} ${displayBab} / ${readableTotal}`}</EyebrowText>
					</View>
					<View style={[styles.headerSide, styles.headerSideEnd]}>
						<Pressable
							accessibilityRole='button'
							onPress={() => setIsSettingsSheetOpen(true)}
							style={[
								styles.fsButton,
								{
									backgroundColor: isSettingsSheetOpen
										? theme.colors.accentSoft
										: theme.colors.surface,
									borderColor: isSettingsSheetOpen ? theme.colors.accent : theme.colors.border
								}
							]}
						>
							<Typography
								color={isSettingsSheetOpen ? theme.colors.accent : undefined}
								variant='bodyStrong'
							>
								Aa
							</Typography>
						</Pressable>
					</View>
				</View>
				<View style={styles.headerBottomRow}>
					<Typography variant='title' weight='regular'>
						{t('babOrdinal', { n: displayBab })}
					</Typography>
					{/*
					 * Whose bab this is, in one word. It sits against the bab's name rather than
					 * in the rail's row because it qualifies the name — "27. Bab, senin payın".
					 */}
					<View style={[styles.ownershipChip, { backgroundColor: ownershipChip.background }]}>
						<Typography color={ownershipChip.foreground} variant='caption' weight='semibold'>
							{ownershipChip.label}
						</Typography>
					</View>
				</View>
				{/*
				 * The mini-map gets a **row of its own**, full width, under the title. Squeezed into
				 * 148pt beside the bab name it could only ever show a fill and a dot; across the whole
				 * header it fits one tick per bab, and can say which are yours, which sit in the pool
				 * and which you have already read.
				 *
				 * Drag or tap anywhere along it to jump — the arrows step one bab, which is
				 * ninety-nine taps end to end.
				 */}
				<GestureDetector gesture={railGesture}>
					<View
						accessibilityRole='adjustable'
						accessibilityValue={{ max: BAB_COUNT, min: 1, now: babNumber }}
						onLayout={event => setRailWidth(event.nativeEvent.layout.width)}
						style={styles.babMapRow}
					>
						<ReaderBabMap
							currentBab={displayBab}
							scrubRatio={scrubRatio}
							myBabNumbers={myBabNumbers}
							poolBabNumbers={groupQuery.data?.poolBabNumbers ?? NO_BAB_NUMBERS}
							readBabNumbers={readBabNumbers}
							// What chunks the pool ticks into the blocks a seat actually offers.
							{...(groupQuery.data ? { spots: groupQuery.data.spots } : {})}
						/>
					</View>
				</GestureDetector>
			</View>

			<GestureDetector gesture={swipe}>
				<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
					{/*
					 * The page itself is `ReaderBody`, shared with the free reader on B7. Everything
					 * this screen adds is *around* it — the header's ownership chip, the strip, and a
					 * footer that can mark a bab read.
					 *
					 * No pool banner here any more. It was a card at the top of the page saying this
					 * bab wasn't in your range — which the header's chip now says in one word and the
					 * footer's hint says again right where it matters, next to the button it explains.
					 *
					 * No rosette opening the bab either: the header carries the number, the chip and
					 * the hundred ticks, so a mark whose whole job was announcing "a reading starts
					 * here" was saying something already said three times and pushing the text down a
					 * line to do it. (`ui/Ornament` is still very much in use — the verse marks in the
					 * text and the meal sheet's heading.)
					 */}
					<ReaderBody
						babNumber={babNumber}
						font={readerSettings.readerArabicFont}
						fontSize={readerSettings.readerFontSize}
						numerals={readerSettings.readerNumerals}
						onLongPressInvocation={setMealInvocation}
					/>
				</ScrollView>
			</GestureDetector>

			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				{/*
				 * The translucent surface alone — there was a `BlurView` under it, and it was
				 * doing almost nothing for a real cost. `readerSurface` is 94% opaque and laid
				 * over it edge to edge, so the blur could contribute at most six percent of the
				 * colour, while live blur re-samples and composites the Arabic scrolling beneath
				 * it every frame. Measured on the simulator: the reader's body scroll held a
				 * 20.0ms median gap against 16.7ms on Home, with the blur the only material
				 * difference between them.
				 */}
				<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
				{/*
				 * One line saying why the button below reads the way it does — and only when
				 * there is something to say. A bab already in your share gets no line at all.
				 */}
				{readHint ? (
					<Typography
						color={isPoolBab ? theme.colors.sandText : theme.colors.faintText}
						style={styles.readHint}
						variant='caption'
					>
						{readHint}
					</Typography>
				) : null}
				<View style={styles.footerRow}>
					<Pressable
						accessibilityRole='button'
						disabled={previousBabNumber === undefined}
						onPress={() => goToBab(previousBabNumber)}
						style={[
							styles.navButton,
							{
								backgroundColor: theme.colors.surface,
								borderColor: theme.colors.border,
								opacity: previousBabNumber === undefined ? 0.4 : 1
							}
						]}
					>
						<Icon name='back' size={17} />
					</Pressable>
					{/*
					 * Live for your own babs and for the pool's; muted otherwise.
					 *
					 * `disabled` as well as muted — the reader now walks all hundred, so most
					 * babs on most days are somebody else's, and a button that merely looked
					 * inert but still fired would let anyone mark anyone's work. The server
					 * refuses it too; this is so the screen never asks.
					 */}
					<Pressable
						accessibilityRole='button'
						disabled={!canMark}
						onPress={isPoolBab ? handleTakeAndRead : toggleCurrentRead}
						style={[
							styles.markButton,
							canMark
								? {
										backgroundColor: isRead ? theme.colors.surface : theme.colors.accent,
										borderColor: theme.colors.accent
								  }
								: { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }
						]}
					>
						<Typography
							color={
								!canMark ? theme.colors.faintText : isRead ? theme.colors.accent : theme.colors.onAccent
							}
							variant='bodyStrong'
						>
							{/*
							 * A pool bab says **"Üstlen ve oku"**, not "Okudum".
							 *
							 * The design binds pool to the plain mark-read label, but its model
							 * is simpler than ours: here the tap takes the whole slot — eight to
							 * thirteen babs, taken whole and held for the round — and only then
							 * marks this one. "Okudum" would name the smaller half of what the
							 * button actually does. Once the slot is taken the bab is yours, so
							 * the label falls back to Okudum · Geri al on the next render.
							 */}
							{!canMark
								? t('readLocked')
								: isPoolBab
								? // The range on the button too, not only in the hint above it:
								  // this is the label somebody reads on the way to tapping.
								  poolRangeLabel
									? `${t('takeAndRead')} · ${poolRangeLabel}`
									: t('takeAndRead')
								: isRead
								? t('markUnread')
								: t('markRead')}
						</Typography>
					</Pressable>
					<Pressable
						accessibilityRole='button'
						disabled={nextBabNumber === undefined}
						onPress={() => goToBab(nextBabNumber)}
						style={[
							styles.navButton,
							{
								backgroundColor: theme.colors.surface,
								borderColor: theme.colors.border,
								opacity: nextBabNumber === undefined ? 0.4 : 1
							}
						]}
					>
						<Icon name='chevron' size={17} />
					</Pressable>
				</View>
			</View>

			{/*
			 * E2a. It **stays open** as you pick — every control shows its result in the
			 * sheet's own preview, so closing on the first tap would take the comparison away
			 * at the moment it became useful. The old text-size sheet closed on pick because
			 * there was nothing to compare.
			 */}
			<AppBottomSheet
				description={t('readerSettingsHint')}
				isVisible={isSettingsSheetOpen}
				onClose={() => setIsSettingsSheetOpen(false)}
				title={t('readerSettings')}
			>
				<ReaderSettings onChange={patch => updateSettings.mutate(patch)} settings={readerSettings} />
			</AppBottomSheet>

			<MealSheet
				arabicFont={faces.arabicFont}
				arabicFontSize={faces.arabicFontSize}
				arabicText={mealInvocation?.text ?? ''}
				babNumber={babNumber}
				invocation={mealInvocation}
				numerals={readerSettings.readerNumerals}
				onClose={() => setMealInvocation(null)}
			/>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	// Its own full-width row under the title, at the design's 11pt gap.
	babMapRow: {
		marginTop: 11
	},
	body: {
		// Symmetric: the page opens and closes on the same gap.
		paddingBottom: 26,
		paddingHorizontal: 22,
		paddingTop: 26
	},
	centered: {
		alignItems: 'center',
		justifyContent: 'center'
	},
	// A column now, not a row: the hint line sits above the buttons it explains.
	// Even top and bottom. The 16 below was there to clear the home indicator when this bar
	// was the last thing on the screen; the tab bar handles that now, so it read as a gap.
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
	/*
	 * **Centred, over the design's left.** Called deliberately: the design sets this hint
	 * ragged-right, but on the phone it sits directly over a symmetrical bar — arrow, wide
	 * button, arrow — and left-aligned prose above that reads as having slipped sideways.
	 * Centred, the sentence and the button it explains share an axis.
	 */
	readHint: {
		lineHeight: 16,
		textAlign: 'center'
	},
	ownershipChip: {
		borderRadius: 7,
		paddingHorizontal: 8,
		paddingVertical: 3
	},
	fsButton: {
		alignItems: 'center',
		borderRadius: 9,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 9,
		paddingVertical: 5
	},
	header: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		gap: 10,
		overflow: 'hidden',
		paddingBottom: 12,
		paddingHorizontal: 20,
		paddingTop: 8
	},
	headerBottomRow: {
		alignItems: 'center',
		flexDirection: 'row',
		// The design's 10, and it needs all of it: the chip is a filled panel, so without a
		// real gap it reads as attached to the bab's name rather than as a note beside it.
		gap: 10,
		justifyContent: 'space-between'
	},
	headerCenter: {
		alignItems: 'center',
		flex: 1
	},
	headerSide: {
		alignItems: 'flex-start',
		flex: 1
	},
	headerSideEnd: {
		alignItems: 'flex-end'
	},
	headerTopRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	markButton: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: 1.5,
		flex: 1,
		paddingVertical: 14
	},
	navButton: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	safeArea: {
		flex: 1
	}
});
