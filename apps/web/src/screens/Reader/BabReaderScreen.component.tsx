import { BackLink } from '@/components/ui/BackLink/BackLink.component';
import { ReaderSkeleton } from './ReaderSkeleton.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { Ornament } from '@/components/ui/Ornament/Ornament.component';
import { EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { BISMILLAH, CEVSEN_AFTER_HUNDREDTH, getBab, readerFontSize, toOrnamentDigits } from '@/lib/content/cevsen';
import { useGetBabs, useSetBabRead } from '@/lib/hooks/useBab';
import { useGetGroupById, useTakePoolSlot } from '@/lib/hooks/useGroup';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { BAB_COUNT, babRuns, slotIndexForBab } from '@/lib/utils/babs';
import { arabicReaderFonts } from '@/lib/theme/fonts';
import type { ReaderNumerals } from '@/lib/types/domain';
import type { TabStackParamList } from '@/navigation/types';
import { ReaderSettings } from '@/screens/Reader/ReaderSettings.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { Fragment, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<TabStackParamList, 'BabReader'>;

/**
 * The verse ornament that closes an invocation: **U+06DD, ARABIC END OF AYAH**, followed by
 * the number it encloses.
 *
 * It is a character, not a picture, and that is the whole point. `ui/Ornament` draws the
 * design's rosette beautifully, but React Native could not place it *inside* right-to-left
 * text: the advance the line reserved and the frame the view was painted at disagreed, so
 * rosettes landed on top of words with gaps where their boxes had been. It looked
 * font-specific and wasn't — measured across three faces, every one of them broke on some
 * babs and not others, depending only on how that line's runs happened to reorder. The
 * system fallback face never did, which is why this only appeared once the reader was given
 * a real Arabic font to set.
 *
 * U+06DD is what a printed mushaf uses and what every Arabic face draws for itself, so it
 * shapes and wraps with the words around it and cannot be misplaced. The one cost is that
 * the mark now belongs to the chosen typeface rather than to the design system, so it looks
 * a little different in each of the three.
 *
 * It costs **nothing else**, which was the surprise: all three faces enclose the following
 * digits, and all three do it for Latin `1` as readily as for Arabic-Indic `١`, so the
 * numerals setting survived intact. Verified on bab 66 — the bab the drawn rosette broke on
 * in every font — across Nesih, Amiri and Şehrizad, and in both numeral systems.
 *
 * The rosette is **not gone**: it still opens each bab and heads the settings preview, both
 * of which sit in a `View` rather than in a line of text, where it places correctly.
 */
const END_OF_AYAH = '\u06DD';

const ayahMark = (n: number, numerals: ReaderNumerals) => `${END_OF_AYAH}${toOrnamentDigits(n, numerals)}`;

/** The design's "bölüm başı" size — the largest of its three, for the mark opening a bab. */
const ORNAMENT_SECTION_SIZE = 40;

/** Where a run of babs sits along the rail, as a fraction of the whole cevşen. */
const railRunBounds = (run: { end: number; start: number }) => ({
	left: `${((run.start - 1) / BAB_COUNT) * 100}%` as const,
	width: `${((run.end - run.start + 1) / BAB_COUNT) * 100}%` as const
});

/** The header's progress rail — 148×5 with an 11pt head inside a 3pt ring. */
const RAIL_HEIGHT = 5;
const RAIL_DOT_SIZE = 11;
const RAIL_HEAD_SIZE = RAIL_DOT_SIZE + 6;
const RAIL_HEAD_RING_ALPHA = 0.17;

export const BabReaderScreen = ({ navigation, route }: Props) => {
	const { babNumber, groupId } = route.params;
	const { mode, theme } = useThemeContext();
	const { t } = useTranslation();

	const babsQuery = useGetBabs(groupId);
	const groupQuery = useGetGroupById(groupId);
	const takePoolSlot = useTakePoolSlot();
	const settingsQuery = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	const setBabRead = useSetBabRead();
	const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);

	/**
	 * The rail is a scrubber: dragging it walks the hundred far faster than the arrows can,
	 * which are ninety-nine taps end to end.
	 *
	 * **The number moves under the finger; the Arabic lands once, on release.** The obvious
	 * build — `setParams` each time the finger crosses a bab — re-renders a screenful of
	 * Arabic and eleven rosettes up to a hundred times in one swipe, which is the same shape
	 * of stall the bab board hit with a hundred animated cells.
	 *
	 * So the drag is split across the two things it moves. The head is pure UI thread, one
	 * `useAnimatedStyle` and no React at all — the same easing budget `CellGrid` refuses to
	 * spend per-cell, which is exactly what that rule leaves room for. The bab *number* costs
	 * a header re-render per bab crossed, which is affordable because the page below is still
	 * rendering `babNumber` and the rosettes are `memo`'d. Only `setParams` waits for release.
	 *
	 * `scrubRatio` is `-1` when nobody is dragging, which is how the head knows to sit at the
	 * open bab instead. Width is **measured, not assumed** — the rail is `flex: 1` up to the
	 * design's 148, so a long bab name squeezes it and a hardcoded 148 would land the finger
	 * several babs off.
	 */
	const [railWidth, setRailWidth] = useState(0);
	const scrubRatio = useSharedValue(-1);

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

	/**
	 * Where the head sits when nobody is dragging. Half a slice in, so it lands on the bab
	 * rather than on the boundary before it.
	 *
	 * Derived from `displayBab`, **not** `babNumber`, and that is the whole trick. Releasing
	 * the drag clears `scrubRatio` on the UI thread immediately, but `setParams` needs a JS
	 * round trip to land — so against `babNumber` the head snapped back to where the drag
	 * started for a frame and then jumped forward to where it was let go. `displayBab` is
	 * already the scrubbed bab at that moment, so the fallback it computes is the position
	 * the head is *already* at, and the handover is invisible.
	 */
	const restingRatio = (displayBab - 0.5) / BAB_COUNT;

	const railHeadStyle = useAnimatedStyle(() => ({
		left: `${(scrubRatio.value < 0 ? restingRatio : scrubRatio.value) * 100}%`
	}));

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
		runOnJS(setScrubBab)(Math.round(ratio * (BAB_COUNT - 1)) + 1);
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
		// The rail is 5pt tall. Without this it is a real but nearly unhittable target.
		.hitSlop({ bottom: 18, top: 18 })
		.onBegin(event => trackScrub(event.x))
		.onUpdate(event => trackScrub(event.x))
		// `onFinalize`, not `onEnd`: a cancelled gesture has to release the head too, or it
		// would stay parked wherever the finger was lost.
		.onFinalize(() => {
			const ratio = scrubRatio.value;

			scrubRatio.value = -1;

			if (ratio >= 0) {
				runOnJS(commitScrub)(Math.round(ratio * (BAB_COUNT - 1)) + 1);
			}
		});

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
	const myBabNumbers = groupQuery.data?.myBabNumbers ?? [];
	// A bab from a seat nobody took. It can be read, but only after taking it.
	const isPoolBab = groupQuery.data?.poolBabNumbers.includes(babNumber) ?? false;
	const poolSlotIndex = isPoolBab && groupQuery.data ? slotIndexForBab(babNumber, groupQuery.data.spots) : null;
	const currentBab = babs.find(bab => bab.number === babNumber);
	const isRead = Boolean(currentBab?.readAt);
	/**
	 * The reader's typography, from E2a. Defaulted here rather than trusted from the server,
	 * because the sheet reads these back to show what is currently selected and `undefined`
	 * would leave all three groups looking unset on a first paint.
	 */
	const readerSettings = {
		// Must match `ReaderArabicFont`'s Prisma default — this only stands in for the frame
		// before settings arrive, and a different guess would repaint the page underneath.
		readerArabicFont: settingsQuery.data?.readerArabicFont ?? 'scheherazade',
		readerFontScale: settingsQuery.data?.readerFontScale ?? 0,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;
	const fontSize = readerFontSize(readerSettings.readerFontScale);
	const arabicFont = arabicReaderFonts[readerSettings.readerArabicFont];
	const cevsenBab = getBab(babNumber);
	const blurTint = mode === 'dark' ? 'dark' : 'light';

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
	/**
	 * What the rail is coloured with, in the **pool board's own vocabulary** — solid accent
	 * for your babs, hatched `poolFree` for the pool's, bare track for everyone else's. The
	 * hatch means "a seat nobody took" on the hundred-bab board, on the Havuz screen and in
	 * their legends, so it has to mean the same thing here rather than inventing a second
	 * colour language for the same three states.
	 *
	 * Runs rather than a flat list of numbers: a share of forty draws two or three segments
	 * instead of forty abutting slivers.
	 */
	const shareRuns = babRuns(myBabNumbers);
	const poolRuns = babRuns(groupQuery.data?.poolBabNumbers ?? []);
	const ownershipLabel = isMine ? t('ownMine') : isPoolBab ? t('ownPool') : t('ownOther');
	const ownershipChip = isMine
		? { background: theme.colors.accentSoft, foreground: theme.colors.accent }
		: isPoolBab
		? { background: theme.colors.sand, foreground: theme.colors.sandText }
		: { background: theme.colors.secondary, foreground: theme.colors.subtext };
	// Nothing to say when the bab is already yours — the chip has said it.
	const readHint = isMine ? null : isPoolBab ? t('poolReadHint') : t('lockedHint');

	const goToBab = (nextNumber: number | undefined) => {
		if (nextNumber === undefined) {
			return;
		}

		navigation.setParams({ babNumber: Math.max(1, Math.min(BAB_COUNT, nextNumber)) });
	};

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
					goToBab(nextBabNumber);
				}
			}
		);
	};

	/*
	 * No `bottom` edge: the tab bar is a sibling below this screen and already clears the
	 * home indicator, so insetting here too stacked two gaps between the reader's action bar
	 * and the tab bar. Restore `'bottom'` if the bar is ever hidden on this screen again.
	 */
	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
		>
			<View style={[styles.header, { borderBottomColor: theme.colors.readerRule }]}>
				<BlurView intensity={30} style={StyleSheet.absoluteFill} tint={blurTint} />
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
							{ownershipLabel}
						</Typography>
					</View>
					{/*
					 * One rail, not one dash per bab — a hundred dashes stopped reading as
					 * anything. It spans the whole cevşen, and the dot is where you are in it.
					 *
					 * Drag it to scrub. The arrows step one bab at a time, which is ninety-nine
					 * taps end to end; the rail already showed where you were in the hundred, so
					 * letting it *set* that costs no new furniture.
					 *
					 * **The green marks where your babs are, not how far the group has read.**
					 * It was a progress bar filling from the left, which said something true and
					 * useless: the rail's whole job now is getting you somewhere, and what you
					 * want to get to is your own share. A share can be several runs — a
					 * volunteered pool block is a second, unconnected range — so this is one
					 * segment per run rather than one bar.
					 */}
					<GestureDetector gesture={railGesture}>
						<View
							accessibilityRole='adjustable'
							accessibilityValue={{ max: BAB_COUNT, min: 1, now: babNumber }}
							onLayout={event => setRailWidth(event.nativeEvent.layout.width)}
							style={[styles.rail, { backgroundColor: theme.colors.switchTrackOff }]}
						>
							{/* Pool first, yours over it: taking a pool block puts it in your share,
							    and for the frame before the board catches up your green should win. */}
							{poolRuns.map(run => (
								<View
									key={`pool-${run.start}`}
									style={[
										styles.railRun,
										{ backgroundColor: theme.colors.poolFree },
										railRunBounds(run)
									]}
								>
									<Hatch radius={RAIL_HEIGHT / 2} />
								</View>
							))}
							{shareRuns.map(run => (
								<View
									key={`mine-${run.start}`}
									style={[
										styles.railRun,
										{ backgroundColor: theme.colors.accent },
										railRunBounds(run)
									]}
								/>
							))}
							<Animated.View
								style={[
									styles.railHead,
									{ backgroundColor: toAlphaColor(theme.colors.accent, RAIL_HEAD_RING_ALPHA) },
									railHeadStyle
								]}
							>
								<View style={[styles.railDot, { backgroundColor: theme.colors.accent }]} />
							</Animated.View>
						</View>
					</GestureDetector>
				</View>
			</View>

			<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
				{/*
				 * No pool banner here any more. It was a card at the top of the page saying
				 * this bab wasn't in your range — which the header's chip now says in one word
				 * and the footer's hint says again right where it matters, next to the button
				 * it explains. Three of them would have been two too many.
				 */}
				{/*
				 * The mark that opens the bab: the same rosette the verses end on, drawn at the
				 * design's section-head size and left **empty** — it starts a reading rather
				 * than closing a numbered verse, so it has nothing to count.
				 *
				 * It was a green `۞` glyph, which was the one place in the reader still using a
				 * typographic character where the page has an ornament.
				 */}
				<View style={styles.glyph}>
					<Ornament color={theme.colors.accent} size={ORNAMENT_SECTION_SIZE} />
				</View>
				{BISMILLAH ? (
					<Typography style={styles.bismillah} textAlign='right'>
						{BISMILLAH}
					</Typography>
				) : null}
				{cevsenBab && cevsenBab.invocations.length > 0 ? (
					<>
						{/*
						 * The whole bab as **one flowing paragraph**, the invocations run together
						 * and punctuated by their ornaments, wrapping to the column like prose.
						 *
						 * Not a line per invocation. Two earlier attempts tried to hold a fixed
						 * shape — the printed page's two-to-a-line, then one centred line each —
						 * and both fought the column: the page's type is narrower against its
						 * measure than ours, so its pairs overran, and centring left every line
						 * ragged at both ends with the ornaments scattered down the middle.
						 * Flowed, the text fills the measure at any of the three reading sizes and
						 * the ornaments fall wherever the words put them, which is what a printed
						 * Cevşen actually does.
						 *
						 * The words stay breakable. Bound with non-breaking spaces they couldn't
						 * wrap at all, so anything wider than the column fell back to character
						 * wrapping and split a word down the middle — the thing that binding
						 * existed to prevent. Ordinary spaces break between words only.
						 */}
						<Typography
							style={[
								styles.arabic,
								{ fontFamily: arabicFont, fontSize, lineHeight: fontSize * 2, writingDirection: 'rtl' }
							]}
							textAlign='center'
						>
							{cevsenBab.invocations.map(invocation => (
								// A Fragment, not a nested Typography: that would apply its own
								// variant's `fontSize` and shrink the Arabic back to body size.
								<Fragment key={invocation.n}>
									{invocation.text}
									{/*
									 * Real spaces around the ornament, not just its margin — the
									 * invocations are concatenated with no separator of their own.
									 *
									 * The leading one is **non-breaking**, so the ornament can never
									 * wrap away from the invocation it closes and start the next
									 * line on its own. The trailing one is ordinary, which is where
									 * the line is meant to break.
									 */}
									{' '}
									<Typography
										color={theme.colors.accent}
										style={{ fontFamily: arabicFont, fontSize }}
									>
										{ayahMark(invocation.n, readerSettings.readerNumerals)}
									</Typography>{' '}
								</Fragment>
							))}
						</Typography>
						{/*
						 * The refrain starts its own line and is set in the page's red. Run on from
						 * the last name it reads as one more of them, where it is actually the
						 * formula that ends every bab.
						 *
						 * **Its ornament is the only red one.** The verses' are the page's green,
						 * so the crimson marks the sübhâneke and nothing else — which is what
						 * separates the closing formula from the hundred names above it at a
						 * glance, without reading a word.
						 */}
						<Typography
							color={theme.colors.danger}
							style={[
								styles.arabic,
								styles.closing,
								{ fontFamily: arabicFont, fontSize, lineHeight: fontSize * 2, writingDirection: 'rtl' }
							]}
							textAlign='center'
						>
							{cevsenBab.closing.text}
							{ayahMark(cevsenBab.closing.n, readerSettings.readerNumerals)}
						</Typography>

						{/*
						 * The supplication the edition prints after the hundredth bab. **Shown
						 * whenever bab 100 is open, to everyone**, with no ownership test.
						 *
						 * It was gated twice and wrong both times — first on `myBabNumbers`, then
						 * on `canMark` — and each gate hid it from someone sitting on the page it
						 * belongs to. The reader walks all hundred now, so whose *turn* bab 100
						 * is has nothing to do with whether the du'a printed after it should be
						 * legible: it is part of the text, like the refrain, not a reward for
						 * having marked something.
						 */}
						{babNumber === BAB_COUNT ? (
							<View style={styles.afterHundredth}>
								<EyebrowText color={theme.colors.faintText} textAlign='center'>
									{t('afterHundredth')}
								</EyebrowText>
								{CEVSEN_AFTER_HUNDREDTH.map(line => (
									<Typography
										key={line}
										style={[
											styles.arabic,
											styles.afterHundredthLine,
											{
												fontFamily: arabicFont,
												fontSize,
												lineHeight: fontSize * 2,
												writingDirection: 'rtl'
											}
										]}
										textAlign='center'
									>
										{line}
									</Typography>
								))}
							</View>
						) : null}
					</>
				) : (
					<Typography color={theme.colors.faintText} style={styles.missing} textAlign='center'>
						{t('readerMissing')}
					</Typography>
				)}
			</ScrollView>

			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				<BlurView intensity={30} style={StyleSheet.absoluteFill} tint={blurTint} />
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
								? t('takeAndRead')
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
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	arabic: {
		marginBottom: 22
	},
	// Set apart from the refrain above it — this one really is a separate reading, so it gets
	// more air than the refrain does from the names.
	afterHundredth: {
		gap: 14,
		marginTop: 26
	},
	afterHundredthLine: {
		marginBottom: 0
	},
	// Set apart from the names above it, without a rule: the refrain is part of the bab, not
	// a separate section.
	closing: {
		marginTop: 4
	},
	bismillah: {
		marginBottom: 20
	},
	body: {
		paddingHorizontal: 22,
		paddingTop: 26,
		paddingBottom: 20
	},
	centered: {
		alignItems: 'center',
		justifyContent: 'center'
	},
	rail: {
		borderRadius: 3,
		flex: 1,
		height: RAIL_HEIGHT,
		// The head's ring overflows the rail's own height; letting it show is the point.
		marginLeft: 'auto',
		maxWidth: 148,
		position: 'relative'
	},
	railDot: {
		borderRadius: RAIL_DOT_SIZE / 2,
		height: RAIL_DOT_SIZE,
		width: RAIL_DOT_SIZE
	},
	// One stretch of your share, laid over the rail at the babs it covers.
	railRun: {
		borderRadius: 3,
		bottom: 0,
		position: 'absolute',
		top: 0
	},
	// The design's `box-shadow: 0 0 0 3px` — RN has no spread shadow, so the ring is a
	// wrapper three points larger on every side, tinted with the accent at low alpha.
	railHead: {
		alignItems: 'center',
		borderRadius: RAIL_HEAD_SIZE / 2,
		height: RAIL_HEAD_SIZE,
		justifyContent: 'center',
		marginLeft: -RAIL_HEAD_SIZE / 2,
		position: 'absolute',
		top: (RAIL_HEIGHT - RAIL_HEAD_SIZE) / 2,
		width: RAIL_HEAD_SIZE
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
	// Centred over the bar it explains, rather than hanging off the left of a row whose
	// middle is the button the sentence is about.
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
	glyph: {
		alignItems: 'center',
		marginBottom: 22
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
	missing: {
		paddingVertical: 20
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
