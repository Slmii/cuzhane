import { BackLink } from '@/components/ui/BackLink/BackLink.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { Ornament } from '@/components/ui/Ornament/Ornament.component';
import { EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import type { CevsenInvocation } from '@/lib/content/cevsen';
import {
	ayahMark,
	BISMILLAH,
	CEVSEN_AFTER_HUNDREDTH,
	clampReaderFontSize,
	getBab,
	READER_FONT_SIZE_DEFAULT
} from '@/lib/content/cevsen';
import { useGetBabs, useSetBabRead } from '@/lib/hooks/useBab';
import { useGetGroupById, useTakePoolSlot } from '@/lib/hooks/useGroup';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { arabicReaderFonts, arabicReaderFontScale } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { ReaderArabicFont } from '@/lib/types/domain';
import { BAB_COUNT, slotIndexForBab } from '@/lib/utils/babs';
import type { TabStackParamList } from '@/navigation/types';
import { MealSheet } from '@/screens/Reader/MealSheet.component';
import { ReaderBabMap } from '@/screens/Reader/ReaderBabMap.component';
import { ReaderSettings } from '@/screens/Reader/ReaderSettings.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Fragment, type ReactNode, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReaderSkeleton } from './ReaderSkeleton.component';

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
 *
 * **A new face has to be checked for this glyph, and coverage is not the test.** Enclosing
 * the digits is a shaping decision the font makes across the mark *and* the digits, so a
 * face that merely has `U+06DD` in its cmap can still draw a hollow ring with the number
 * stranded beside it — Hüsrev Hattı did exactly that, and a face missing the glyph entirely
 * is worse, because iOS substitutes it from a system font and the two can never combine.
 * Look at it on a real bab before adding one.
 */
/**
 * Faces whose `U+06DD` does not enclose the digits that follow it. Their marks are set in a
 * face that does, while the words stay in the face that was chosen.
 *
 * **Having the glyph is not the same as enclosing with it.** Enclosing is a shaping decision
 * the font makes across the mark *and* the digits, and these two decline it in different
 * ways: KFGQPC draws a wide standalone rosette that the number then sits beside, so you get
 * two marks; Hüsrev drew a hollow ring with the number stranded outside it. A face missing
 * the glyph altogether is worse again — iOS substitutes it from a system font, and glyphs
 * from two different fonts can never combine. Look at a real bab before adding a face.
 */
const FACES_WITHOUT_ENCLOSING_MARK = new Set<ReaderArabicFont>(['madinah']);

const ornamentFaceFor = (font: ReaderArabicFont) =>
	FACES_WITHOUT_ENCLOSING_MARK.has(font) ? ('naskh' as const) : font;

/**
 * `U+06EA`, the mark under the `\u0640\u0647\u0650` of a `-h\u00EE` suffix, which the Turkish editions set to show
 * the vowel is long. It appears 65 times across the hundred and is genuinely in the text.
 *
 * Two of the three faces treat it as what it is \u2014 a combining mark, zero advance, a small
 * shape below the baseline (Amiri 0.12 em, Kitab 0.14 em). **KFGQPC gives it a 1442-unit
 * advance and a 0.61 em body sitting on the baseline**, so instead of a hint under the h\u00E2 you
 * get a filled black disc standing between the words, at almost the size of a verse ornament
 * and easily mistaken for one. Measured by shaping `\u0644\u0650\u0639\u064E\u0638\u064E\u0645\u064E\u062A\u0650\u0647\u06EA` through HarfBuzz against all
 * three faces, so this is the font's own drawing and not a missing-glyph placeholder.
 *
 * Dropping it costs that face a pronunciation hint. Keeping it costs that face a mark the
 * edition never printed, in the middle of the line \u2014 so it comes off, for that face only.
 */
const LOW_STOP = '\u06EA';

const FACES_SPACING_THE_LOW_STOP = new Set<ReaderArabicFont>(['madinah']);

const arabicFor = (text: string, font: ReaderArabicFont) =>
	FACES_SPACING_THE_LOW_STOP.has(font) ? text.replaceAll(LOW_STOP, '') : text;

/**
 * The divine name, set in the page's red the way the printed edition does.
 *
 * **The whole token must be the name.** Matching anything merely *containing* it is wrong
 * in both directions here: `\u0627\u064E\u0644\u0644\u0651\u0670\u0647\u064F\u0645\u064E\u0651` and `\u0644\u0650\u0644\u0651\u0670\u0647\u0650` contain it but are other words, and the
 * refrain's `\u0627\u0650\u0644\u0670\u0647\u064E` \u2014 106 of them, one per bab \u2014 is the same letters without the shadda, so
 * a loose test would paint "il\u00E2h" red in every closing line. Anchoring the pattern and
 * letting marks fall where they like matches the three case forms the text actually sets
 * (`\u0627\u0644\u0644\u0651\u0670\u0647\u064F`, `\u0627\u0644\u0644\u0651\u0670\u0647\u0650`, `\u0627\u064E\u0644\u0644\u0651\u0670\u0647\u064F`) and nothing else: 16 occurrences, counted across the data.
 *
 * The mark class is spelled out rather than `\p{M}`, which needs Unicode property escapes.
 */
const ARABIC_MARKS = '[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]';
const DIVINE_NAME = new RegExp(
	`^\u0627${ARABIC_MARKS}*\u0644${ARABIC_MARKS}*\u0644${ARABIC_MARKS}*\u0647${ARABIC_MARKS}*$`,
	'u'
);

/**
 * Arabic split into runs so the divine name can carry its own colour.
 *
 * **Tokenised on whitespace and tested whole**, rather than matched inside the string. A
 * pattern hunting the name within the text finds it inside `\u0627\u064e\u0644\u0644\u0651\u0670\u0647\u064f\u0645\u064e\u0651`, whose first eight
 * characters *are* the name \u2014 so the word came out split down the middle with the front
 * half red. Only a token that is the name entirely counts.
 *
 * Neighbouring plain tokens are glued back into one run, so a paragraph costs a couple of
 * nodes rather than one per word: the du'a alone is some four hundred tokens and holds
 * fifteen names.
 *
 * The spans re-declare the face and size because a nested `Typography` otherwise applies
 * its own variant's `fontSize` and drops the Arabic back to body size \u2014 the same reason
 * the verse ornaments below set theirs explicitly.
 */
const withDivineName = (text: string, style: { color: string; fontFamily: string; fontSize: number }) => {
	const runs: ReactNode[] = [];
	let plain = '';

	text.split(/(\s+)/u).forEach((token, index) => {
		if (!DIVINE_NAME.test(token)) {
			plain += token;

			return;
		}

		if (plain) {
			runs.push(<Fragment key={`txt-${index}`}>{plain}</Fragment>);
			plain = '';
		}
		runs.push(
			<Typography
				color={style.color}
				key={`name-${index}`}
				style={{ fontFamily: style.fontFamily, fontSize: style.fontSize }}
			>
				{token}
			</Typography>
		);
	});
	if (plain) {
		runs.push(<Fragment key='txt-tail'>{plain}</Fragment>);
	}

	return runs;
};

/** The du'a's phrase separator, which needs the same treatment as the verse mark. */
const RUB_EL_HIZB = '\u06DE';

const splitOnOrnament = (text: string) => text.split(new RegExp(`(${RUB_EL_HIZB})`, 'u')).filter(Boolean);

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

/** The design's "bölüm başı" size — the largest of its three, for the mark opening a bab. */
const ORNAMENT_SECTION_SIZE = 40;

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
	const { mode, theme } = useThemeContext();
	const { t } = useTranslation();

	const babsQuery = useGetBabs(groupId);
	const groupQuery = useGetGroupById(groupId);
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
	const [railWidth, setRailWidth] = useState(0);

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

	const babAt = (x: number) => {
		'worklet';

		const ratio = Math.min(1, Math.max(0, x / railWidth));

		return Math.round(ratio * (BAB_COUNT - 1)) + 1;
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
		.onBegin(event => runOnJS(setScrubBab)(babAt(event.x)))
		.onUpdate(event => runOnJS(setScrubBab)(babAt(event.x)))
		// `onFinalize`, not `onEnd`: a cancelled gesture still has to land on the bab the
		// finger left, or the strip and the page it is describing disagree.
		.onFinalize(event => runOnJS(commitScrub)(babAt(event.x)));

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
	 * Every bab read this round, whoever read it — the strip's tallest-but-one state.
	 *
	 * Deliberately not `useMemo`: `babs` is only in scope past the early returns above, so a
	 * hook here would be a conditional one. Rebuilding a hundred-item array per bab crossed
	 * costs nothing beside the render it happens inside, and the ticks are `memo`'d.
	 */
	const readBabNumbers = babs.filter(bab => bab.readAt).map(bab => bab.number);
	/**
	 * The reader's typography, from E2a. Defaulted here rather than trusted from the server,
	 * because the sheet reads these back to show what is currently selected and `undefined`
	 * would leave all three groups looking unset on a first paint.
	 */
	const readerSettings = {
		// Must match `ReaderArabicFont`'s Prisma default — this only stands in for the frame
		// before settings arrive, and a different guess would repaint the page underneath.
		readerArabicFont: settingsQuery.data?.readerArabicFont ?? 'naskh',
		readerFontSize: settingsQuery.data?.readerFontSize ?? READER_FONT_SIZE_DEFAULT,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;
	/*
	 * The chosen size, corrected for how large this particular face draws — see
	 * `arabicReaderFontScale`. The ornament is sized separately because it may be borrowed
	 * from another face, and that face has its own scale.
	 */
	const baseFontSize = clampReaderFontSize(readerSettings.readerFontSize);
	const fontSize = Math.round(baseFontSize * arabicReaderFontScale[readerSettings.readerArabicFont]);
	const ornamentFace = ornamentFaceFor(readerSettings.readerArabicFont);
	const ornamentFont = arabicReaderFonts[ornamentFace];
	const ornamentFontSize = Math.round(baseFontSize * arabicReaderFontScale[ornamentFace]);
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
	const readHint = isMine ? t('longPressHint') : isPoolBab ? t('poolReadHint') : t('lockedHint');

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
							myBabNumbers={myBabNumbers}
							poolBabNumbers={groupQuery.data?.poolBabNumbers ?? []}
							readBabNumbers={readBabNumbers}
						/>
					</View>
				</GestureDetector>
			</View>

			<GestureDetector gesture={swipe}>
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
					{/*
					 * The besmele opens the work, not each bab — the source sets it once, as bab 1's
					 * second line — so it appears on bab 1 and nowhere else. Set in the chosen face
					 * at the reading size, like the bab it heads.
					 *
					 * **Red in full**, like the refrain, rather than red only on the name inside it.
					 * The same reasoning applies to both: the line is a formula rather than one of
					 * the names, and colouring it whole is what sets it apart from the hundred. That
					 * also makes `withDivineName` redundant here — a red word inside a red line.
					 */}
					{babNumber === 1 && BISMILLAH ? (
						<Typography
							color={theme.colors.danger}
							style={[
								styles.bismillah,
								{
									fontFamily: arabicFont,
									fontSize,
									lineHeight: baseFontSize * 2,
									writingDirection: 'rtl'
								}
							]}
							textAlign='center'
						>
							{arabicFor(BISMILLAH, readerSettings.readerArabicFont)}
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
									{
										fontFamily: arabicFont,
										fontSize,
										lineHeight: baseFontSize * 2,
										writingDirection: 'rtl'
									}
								]}
								textAlign='center'
							>
								{cevsenBab.invocations.map(invocation => (
									// A Fragment, not a nested Typography: that would apply its own
									// variant's `fontSize` and shrink the Arabic back to body size.
									<Fragment key={invocation.n}>
										{withDivineName(arabicFor(invocation.text, readerSettings.readerArabicFont), {
											color: theme.colors.danger,
											fontFamily: arabicFont,
											fontSize
										})}
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
										{/*
										 * **The mark is what you long-press for the meaning**, not the words.
										 *
										 * The design asks for the ayah itself, and that cannot be done here: a
										 * nested `Typography` around a whole invocation stops the paragraph
										 * breaking inside it, so bab 9's long opening ran off both edges of the
										 * column and took two invocations off the screen with it. The mark
										 * survives the same nesting only because two characters never need to
										 * break. (A `Pressable` is out for the older reason — a view inside
										 * right-to-left text is painted where the line reserved nothing.)
										 *
										 * It reads well enough as its own idea: the mark *is* the ayah's
										 * number, so pressing ٤ to be told what the fourth one means needs no
										 * explaining beyond the hint under the text.
										 */}
										<Typography
											color={theme.colors.accent}
											onLongPress={() => setMealInvocation(invocation)}
											style={{ fontFamily: ornamentFont, fontSize: ornamentFontSize }}
											suppressHighlighting
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
									{
										fontFamily: arabicFont,
										fontSize,
										lineHeight: baseFontSize * 2,
										writingDirection: 'rtl'
									}
								]}
								textAlign='center'
							>
								{arabicFor(cevsenBab.closing.text, readerSettings.readerArabicFont)}
								{/*
								 * The colour has to be repeated here. A nested `Typography` applies
								 * its own default rather than inheriting the refrain's red, so
								 * without this the sübhâneke's own mark came out black against it.
								 */}
								<Typography
									color={theme.colors.danger}
									style={{ fontFamily: ornamentFont, fontSize: ornamentFontSize }}
								>
									{ayahMark(cevsenBab.closing.n, readerSettings.readerNumerals)}
								</Typography>
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
									{/*
									 * One flowing paragraph, not a block per stored line. Those lines
									 * are where the *printed page* broke, at its width and its type
									 * size; reproducing them here stranded a short tail on a line of
									 * its own — `وَعَافِنَا` sitting alone under a full-width line —
									 * while the column still had room. The du'a is continuous prose,
									 * so let it wrap to this screen the way a bab's invocations do.
									 * The array keeps the print's own breaks, which is provenance
									 * worth keeping even though the reader doesn't lay them out.
									 */}
									<Typography
										style={[
											styles.arabic,
											styles.afterHundredthLine,
											{
												fontFamily: arabicFont,
												fontSize,
												lineHeight: baseFontSize * 2,
												writingDirection: 'rtl'
											}
										]}
										textAlign='center'
									>
										{splitOnOrnament(
											arabicFor(CEVSEN_AFTER_HUNDREDTH.join(' '), readerSettings.readerArabicFont)
										).map((part, index) =>
											part === RUB_EL_HIZB ? (
												<Typography
													key={`orn-${index}`}
													style={{ fontFamily: ornamentFont, fontSize: ornamentFontSize }}
												>
													{part}
												</Typography>
											) : (
												<Fragment key={`txt-${index}`}>
													{withDivineName(part, {
														color: theme.colors.danger,
														fontFamily: arabicFont,
														fontSize
													})}
												</Fragment>
											)
										)}
									</Typography>
								</View>
							) : null}
						</>
					) : (
						<Typography color={theme.colors.faintText} style={styles.missing} textAlign='center'>
							{t('readerMissing')}
						</Typography>
					)}
				</ScrollView>
			</GestureDetector>

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

			<MealSheet
				arabicFont={arabicFont}
				arabicFontSize={fontSize}
				arabicText={mealInvocation ? arabicFor(mealInvocation.text, readerSettings.readerArabicFont) : ''}
				babNumber={babNumber}
				invocation={mealInvocation}
				numerals={readerSettings.readerNumerals}
				onClose={() => setMealInvocation(null)}
			/>
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
	// Its own full-width row under the title, at the design's 11pt gap.
	babMapRow: {
		marginTop: 11
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
