import { AppButton } from '@/components/ui/Button/Button.component';
import { CaptionText, EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import type { CevsenInvocation } from '@/lib/content/cevsen';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { textFontFor } from '@/lib/types/domain';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { BAB_COUNT } from '@/lib/utils/babs';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { LivePosition } from '@/lib/types/domain';
import type { TabStackParamList } from '@/navigation/types';
import { LiveBar } from '@/screens/Live/LiveBar.component';
import { LiveBandLayer, useLiveBandFollow, useLiveBandLead, type ScrollMetrics } from '@/screens/Live/useLiveBand';
import { LiveSheet } from '@/screens/Live/LiveSheet.component';
import { useFreeReaderLive } from '@/screens/Live/useFreeReaderLive';
import { liveSession } from '@/lib/live/liveSession';
import { MealSheet } from '@/screens/Reader/MealSheet.component';
import { ReaderBabMap } from '@/screens/Reader/ReaderBabMap.component';
import { ReaderBody, readerFaces } from '@/screens/Reader/ReaderBody.component';
import { READ_TOGETHER_BAR_OVERHANG } from '@/screens/Reader/ReaderToolbar.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { useCevsenBandGeometry } from '@/screens/Reader/useCevsenBandGeometry';
import { textSizeSheet } from '@/screens/Reader/textSizeSheet';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
	ScrollView,
	StyleSheet,
	View,
	type GestureResponderEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<TabStackParamList, 'AllBabs'>;

/**
 * A single empty array, so the strip's `memo` sees the same identity every render. `[]` in
 * the JSX would mint a new one per frame of a drag and re-render a hundred ticks.
 */
const NOTHING: number[] = [];

/**
 * B7 — the whole cevşen, read for its own sake.
 *
 * **This is the reader with everything about groups taken out**, and that subtraction is the
 * feature. No ownership chip, no pool bracket, no legend, no Okudum, no progress, nothing
 * written anywhere: the ticks are all one colour because here they all mean the same thing.
 * `ReaderBabMap` needs no special mode for that — handed no share and no pool, it already
 * paints the hundred in `babMapOther` and only the current bab stands taller, which is
 * exactly the picture B7 draws.
 *
 * The footer says so in words before you can wonder, because the rest of the app has spent
 * every screen counting: a reader who has learned that marking a bab matters needs telling,
 * once, that this one doesn't count.
 *
 * The text, its faces and the long-press meal are `ReaderBody`, shared with E2 — the page is
 * the same page.
 */
// No `navigation`: going back is the navigator's own header button now, so this screen has
// nothing left to navigate.
export const AllBabsScreen = ({ navigation, route }: Props) => {
	/*
	 * Same reason as the group reader: minutes of looking without touching is exactly the
	 * shape of "idle" the OS dims for. Released on unmount.
	 */
	useKeepAwake();
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const tabBarOffset = useContext(TabBarOffsetContext);
	const settingsQuery = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();

	/**
	 * **The cursor lives here, not in the route.** E2 keeps its bab in the params because a
	 * group's bab is linkable and a notification can open one; a free read is a place you are
	 * rather than a thing you arrive at, so `linking.ts` registers this screen with no params
	 * and there is nothing to deep-link to.
	 */
	// Search may hand over a starting bab; from there the cursor is this screen's own.
	/*
	 * **A live reading picks up where it is.** Opened while a Cevşen reading is on, the screen starts
	 * at the reading's place — the reader's own, or the reader's for a follower — rather than at bab
	 * 1, which a reader's screen would otherwise send to everyone as it mounts. Search's bab wins.
	 */
	const isExplicitPlace = route.params?.babNumber !== undefined;
	const [livePlace] = useState(() => {
		const place = isExplicitPlace ? null : liveSession.placeFor('CEVSEN');

		return place?.k === 'CEVSEN' ? place : null;
	});
	const [babNumber, setBabNumber] = useState(route.params?.babNumber ?? livePlace?.bab ?? 1);
	// Opened from the navigator's bar, which is outside this screen — see `textSizeSheet`.
	const textSize = textSizeSheet(navigation, route.params);
	const [mealInvocation, setMealInvocation] = useState<CevsenInvocation | null>(null);

	const [railWidth, setRailWidth] = useState(0);
	const scrubRatio = useSharedValue(-1);
	const lastScrubBab = useSharedValue(0);
	/**
	 * The number moves under the finger; the Arabic lands on release. Same split as E2, and
	 * for the same reason — committing per bab crossed re-renders a screenful of Arabic and
	 * eleven rosettes up to a hundred times in one swipe.
	 */
	const [scrubBab, setScrubBab] = useState<number | null>(null);
	const displayBab = scrubBab ?? babNumber;

	/*
	 * **A new bab starts at its top.** The page swaps under a scroll position that belonged to
	 * the bab before it, so stepping from a long bab to a short one landed mid-text — or past
	 * the end of it, on a blank stretch. Unanimated deliberately: the content has already been
	 * replaced by the time this runs, so a smooth scroll would be travelling through the *new*
	 * bab rather than showing the old one leaving.
	 */
	const scrollRef = useRef<ScrollView | null>(null);
	const isReducedMotion = useReducedMotion();
	// Twice, for the reason `BabReaderScreen` records: the effect fires before the new bab has
	// a height, so the scroll view re-applies its own offset a frame later on a device.
	const isAwaitingTop = useRef(true);

	const scrollToTop = useCallback(() => {
		scrollRef.current?.scrollTo({ animated: false, y: 0 });
	}, []);

	/*
	 * **Live reading.** What the page's own scroll needs to turn a place in the bab into a scroll
	 * offset and back: how tall the bab is and how much of it the screen shows. Refs, not state —
	 * a follower's screen is moved several times a second and must not re-render the Arabic.
	 */
	const metricsRef = useRef<ScrollMetrics>({ content: 0, scrollY: 0, viewport: 0 });
	const babNumberRef = useRef(babNumber);
	// The reader's place to land on once a bab it moved to has laid out, instead of its top.
	const pendingFractionRef = useRef<number | null>(livePlace?.f ?? null);
	// How far down the bab the reader is, for a (re)joining socket to send — not always the top.
	const fractionRef = useRef(livePlace?.f ?? 0);

	/*
	 * A place is where the top of the screen is, as a share of the whole bab — not of the scroll
	 * range, which depends on how tall each phone's screen is. Clamped here, on the follower's
	 * side, where a short screen can scroll further than a tall one.
	 */
	const scrollToFraction = useCallback((fraction: number, isAnimated = false) => {
		const { content, viewport } = metricsRef.current;

		scrollRef.current?.scrollTo({
			animated: isAnimated,
			y: Math.min(fraction * content, Math.max(0, content - viewport))
		});
	}, []);

	/*
	 * "Göster": the follower's side of the band, reached from `handleLivePosition` before the hook
	 * that provides it exists (the hook needs the live reading, which needs the handler).
	 */
	const bandFollowRef = useRef<{ bringIntoView: () => boolean } | null>(null);

	// A follower's screen goes where the reader is: another bab first, then how far down it.
	const handleLivePosition = useCallback(
		(pos: LivePosition) => {
			if (pos.k !== 'CEVSEN') {
				return;
			}

			if (pos.bab !== babNumberRef.current) {
				pendingFractionRef.current = pos.f;
				setBabNumber(pos.bab);

				return;
			}

			// While the reader's line is on their screen, the band decides where this one is.
			if (bandFollowRef.current?.bringIntoView()) {
				return;
			}

			/*
			 * Glided, not jumped: places arrive a few times a second, and landing on each one
			 * moved the page in visible steps. Each glide takes about as long as the gap to the
			 * next place, and a new one picks up from wherever the last has got to.
			 */
			scrollToFraction(pos.f, !isReducedMotion);
		},
		[isReducedMotion, scrollToFraction]
	);

	const getLivePosition = useCallback(
		(): LivePosition => ({ bab: babNumberRef.current, f: fractionRef.current, k: 'CEVSEN' }),
		[]
	);

	const live = useFreeReaderLive({
		getPosition: getLivePosition,
		isExplicitPlace,
		kind: 'CEVSEN',
		navigation,
		onPosition: handleLivePosition,
		params: route.params
	});
	const { detach, isLeader, publish } = live;
	const isJoined = live.state.role !== null && live.state.gone === null;

	const readerSettings = {
		// Hüsrev is the Kuran's page images; the Cevşen sets text, so it falls back to a font.
		readerArabicFont: textFontFor(settingsQuery.data?.readerArabicFont ?? 'uthman'),
		readerFontSize: settingsQuery.data?.readerFontSize ?? READER_FONT_SIZE_DEFAULT,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;
	const faces = readerFaces(readerSettings.readerArabicFont, readerSettings.readerFontSize);

	/*
	 * **"Göster"** — the band behind the invocation the reader is on. Its geometry lives in refs
	 * (`useCevsenBandGeometry`); a tap or a follower's update reaches the band layer alone.
	 */
	const band = useCevsenBandGeometry({ babNumber, faces, numerals: readerSettings.readerNumerals });
	const { rectsFor } = band;
	const scrollBandTo = useCallback((y: number) => scrollRef.current?.scrollTo({ animated: false, y }), []);
	const bandFollow = useLiveBandFollow({ isReducedMotion, live, metricsRef, rectsFor, scrollTo: scrollBandTo });
	const bandLead = useLiveBandLead({ live, metricsRef, rectsFor });
	const { bringIntoView } = bandFollow;
	const { isFollower } = live;
	const isDetached = live.state.isDetached;
	const { onReadyRef } = band;

	useEffect(() => {
		bandFollowRef.current = { bringIntoView };
		// A bab laid out and measured after the reader's line arrived: bring the band into view now.
		onReadyRef.current = () => {
			if (isFollower && !isDetached) {
				bringIntoView();
			}
		};
	}, [bringIntoView, isDetached, isFollower, onReadyRef]);

	/*
	 * The reader's tap: the invocation is found by where it landed on the paragraph, from the same
	 * geometry the band is drawn with — a span per invocation would need the words nested, and on
	 * Android that took the verse mark's long press for the meal away.
	 */
	const { point } = bandLead;
	const { invocationInParagraph } = band;
	const handlePressMark = useCallback((n: number) => point({ bab: babNumberRef.current, k: 'CEVSEN', n }), [point]);
	const handlePressParagraph = useCallback(
		(event: GestureResponderEvent) => {
			const n = invocationInParagraph(event.nativeEvent.locationX, event.nativeEvent.locationY);

			if (n !== null) {
				handlePressMark(n);
			}
		},
		[handlePressMark, invocationInParagraph]
	);

	useEffect(() => {
		babNumberRef.current = babNumber;
		// A bab landing on a place it was sent to starts there, not at its top — or it would send the top.
		fractionRef.current = pendingFractionRef.current ?? 0;
		isAwaitingTop.current = true;

		if (pendingFractionRef.current === null) {
			scrollToTop();

			return;
		}

		// A bab the same height as the last reports no size change; the next frame lands the place anyway.
		const frame = requestAnimationFrame(() => {
			if (pendingFractionRef.current !== null) {
				scrollToFraction(pendingFractionRef.current);
				pendingFractionRef.current = null;
				isAwaitingTop.current = false;
				bandFollowRef.current?.bringIntoView();
			}
		});

		return () => cancelAnimationFrame(frame);
	}, [babNumber, scrollToFraction, scrollToTop]);

	const handleContentSizeChange = useCallback(
		(_width: number, height: number) => {
			metricsRef.current.content = height;

			if (!isAwaitingTop.current) {
				return;
			}

			isAwaitingTop.current = false;

			if (pendingFractionRef.current !== null) {
				scrollToFraction(pendingFractionRef.current);
				pendingFractionRef.current = null;
				bandFollowRef.current?.bringIntoView();

				return;
			}

			scrollToTop();
		},
		[scrollToFraction, scrollToTop]
	);

	/*
	 * The reader's side: a new bab is sent at once. A (re)joining socket needs nothing from here —
	 * the session sends the reader's place itself, and only when the server's differs.
	 */
	useEffect(() => {
		if (isLeader) {
			publish({ bab: babNumber, f: fractionRef.current, k: 'CEVSEN' }, { isImmediate: true });
		}
	}, [babNumber, isLeader, publish]);

	const { onScroll: onBandLeadScroll } = bandLead;
	const { onDragStart: onBandDragStart, onScroll: onBandFollowScroll } = bandFollow;

	// A scroll through the bab, at the hook's pace.
	const handleScroll = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			const { content } = metricsRef.current;
			const { y } = event.nativeEvent.contentOffset;
			const fraction = content > 0 ? Math.min(1, Math.max(0, y / content)) : 0;

			metricsRef.current.scrollY = y;
			fractionRef.current = Math.round(fraction * 1000) / 1000;

			if (isLeader) {
				publish({ bab: babNumberRef.current, f: fractionRef.current, k: 'CEVSEN' });
			}

			// The reader's line going off (or back onto) their screen; a detached follower's arrow.
			onBandLeadScroll();
			onBandFollowScroll();
		},
		[isLeader, onBandFollowScroll, onBandLeadScroll, publish]
	);

	const handleScrollBeginDrag = useCallback(() => {
		detach();
		onBandDragStart();
	}, [detach, onBandDragStart]);

	// Anything a follower does to the page themselves lets go of the reader's place.
	// The reader turning the bab puts their band out ("Bab ya da sayfa değişince vurgu söner").
	const goToBab = (next: number) => {
		detach();
		bandLead.clear();
		setBabNumber(next);
	};

	const commitScrub = (next: number) => {
		setScrubBab(null);
		goToBab(next);
	};

	const trackScrub = (x: number) => {
		'worklet';

		if (railWidth <= 0) {
			return;
		}

		const ratio = Math.min(1, Math.max(0, x / railWidth));

		scrubRatio.value = ratio;

		const bab = Math.round(ratio * (BAB_COUNT - 1)) + 1;

		if (bab !== lastScrubBab.value) {
			lastScrubBab.value = bab;
			runOnJS(setScrubBab)(bab);
		}
	};

	const railGesture = Gesture.Pan()
		// Touch-down, so a tap anywhere along the strip jumps there without a drag first.
		.minDistance(0)
		.hitSlop({ bottom: 10, top: 10 })
		.onBegin(event => trackScrub(event.x))
		.onUpdate(event => trackScrub(event.x))
		// `onFinalize`, not `onEnd`: a cancelled gesture still has to land where the finger
		// left, or the strip and the page disagree.
		.onFinalize(() => {
			const ratio = scrubRatio.value;

			scrubRatio.value = -1;
			lastScrubBab.value = 0;

			if (ratio >= 0) {
				runOnJS(commitScrub)(Math.round(ratio * (BAB_COUNT - 1)) + 1);
			}
		});

	/**
	 * Defaulted rather than trusted from the server: the settings sheet reads these back to
	 * show what is selected, and `undefined` would leave every group looking unset.
	 *
	 * **No skeleton while they load.** The design draws one (B7l), and it would be honest on a
	 * screen waiting for a group — but nothing here is fetched. The hundred babs are bundled
	 * JSON, so the page is complete on the first frame and only the *face* it is set in
	 * arrives late. A skeleton would be hiding a finished page to wait for a preference.
	 */
	const previousBabNumber = babNumber > 1 ? babNumber - 1 : undefined;
	const nextBabNumber = babNumber < BAB_COUNT ? babNumber + 1 : undefined;

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
				<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
				<View style={styles.headerTopRow}>
					{/*
					 * **Empty on purpose — the back control is the navigator's.** This screen is
					 * registered with a transparent native header, so iOS and Android each draw
					 * their own back button over this corner, and iOS 26 draws it in glass. The
					 * slot stays because it is what centres the eyebrow between two equal sides;
					 * dropping it would shift "Serbest okuma" off the header's middle.
					 */}
					<View style={styles.headerSide} />
					<View style={styles.headerCenter}>
						{/* Where E2 puts "Bab 87 / 100". There is no position to be at here —
						    the eyebrow says what kind of reading this is instead. */}
						<EyebrowText>{t('abFree')}</EyebrowText>
					</View>
					{/*
					 * **Empty for the same reason as the slot opposite — the text-size control is
					 * the navigator's now.** It was an "Aa" chip here and it had stopped
					 * responding: this row occupies the band the transparent native header draws
					 * in, and that header is a view above the scene, so the taps never reached it.
					 * See `ReaderToolbar`. The slot stays to centre the eyebrow — widened by the
					 * bar's overhang, so it centres between the back button and the capsule.
					 */}
					<View style={[styles.headerSide, styles.headerSideEnd]} />
				</View>
				<Typography variant='title' weight='regular'>
					{t('babOrdinal', { n: displayBab })}
				</Typography>
				<GestureDetector gesture={railGesture}>
					<View
						accessibilityRole='adjustable'
						accessibilityValue={{ max: BAB_COUNT, min: 1, now: babNumber }}
						onLayout={event => setRailWidth(event.nativeEvent.layout.width)}
						style={styles.babMapRow}
					>
						<ReaderBabMap
							count={BAB_COUNT}
							currentBab={displayBab}
							hasLegend={false}
							myBabNumbers={NOTHING}
							poolBabNumbers={NOTHING}
							readBabNumbers={NOTHING}
							scrubRatio={scrubRatio}
						/>
					</View>
				</GestureDetector>
			</View>

			<LiveBar
				followDirection={bandFollow.direction}
				live={live}
				onOpenSheet={() => navigation.setParams({ shouldOpenLive: true })}
			/>

			<ScrollView
				contentContainerStyle={styles.body}
				onContentSizeChange={handleContentSizeChange}
				onLayout={event => {
					metricsRef.current.viewport = event.nativeEvent.layout.height;
				}}
				onScroll={handleScroll}
				onScrollBeginDrag={handleScrollBeginDrag}
				ref={scrollRef}
				scrollEventThrottle={64}
				showsVerticalScrollIndicator={false}
			>
				{/* Before the text, so the band sits behind it. */}
				{isJoined ? (
					<LiveBandLayer
						layoutVersion={band.layoutVersion}
						rectsFor={rectsFor}
						store={live.markStore}
						tone={isLeader ? 'own' : 'follower'}
					/>
				) : null}
				<ReaderBody
					babNumber={babNumber}
					font={readerSettings.readerArabicFont}
					fontSize={readerSettings.readerFontSize}
					numerals={readerSettings.readerNumerals}
					onLongPressInvocation={setMealInvocation}
					onParagraphLayout={band.onParagraphLayout}
					onParagraphTextLayout={band.onParagraphTextLayout}
					onPressMark={isLeader ? handlePressMark : undefined}
					onPressParagraph={isLeader ? handlePressParagraph : undefined}
				/>
			</ScrollView>

			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
				{/*
				 * Above the buttons, not under the header: it is about what pressing these does
				 * — or rather what it doesn't do — so it belongs next to them.
				 */}
				<CaptionText color={theme.colors.faintText} style={styles.note}>
					{t('abNote')}
				</CaptionText>
				<View style={styles.footerRow}>
					{/*
					 * **Both are `AppButton`, and both lost their chevron doing it.** The pair used
					 * to lead and trail with an arrow; the icon set is traced SVG and a native
					 * button takes an SF Symbol, so there is no crossing — and `AppButton` puts an
					 * icon *before* the label in any case, which "Sonraki →" was never going to
					 * survive. The direction is still legible from the words and from which of the
					 * two is filled.
					 *
					 * Filled where "Önceki" is outlined — reading forward is the direction this
					 * screen is for, and the pair would otherwise read as one control split in two.
					 * `primary` is that fill: the same near-black this button drew with `text`.
					 */}
					<AppButton
						disabled={previousBabNumber === undefined}
						onPress={() => previousBabNumber !== undefined && goToBab(previousBabNumber)}
						style={styles.navButtonSlot}
						title={t('abPrev')}
						variant='surface'
						icon='chevronLeft'
					/>
					{/* The chevron trails the word here where "Önceki" leads with one, so the two
					    arrows point away from each other — back on the left, forward on the right.
					    Leading on both, it read as "‹ Önceki" and "› Sonraki", pointing the same way. */}
					<AppButton
						disabled={nextBabNumber === undefined}
						icon='chevronRight'
						iconPosition='trailing'
						onPress={() => nextBabNumber !== undefined && goToBab(nextBabNumber)}
						style={styles.navButtonSlot}
						title={t('abNext')}
						variant='primary'
					/>
				</View>
			</View>

			<TextSizeSheet
				isVisible={textSize.isVisible}
				onChange={patch => updateSettings.mutate(patch)}
				onClose={textSize.close}
				settings={readerSettings}
			/>

			<LiveSheet live={live} />

			{/* The band's hidden measuring copy of the paragraph — only while there is a band to place. */}
			{isJoined ? band.measurer : null}

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
		flex: 1
	},
	headerSide: {
		// Fixed, so the eyebrow is placed by the controls over them rather than by whatever is left
		// over; the end one is wider by the bar's overhang (`headerSideEnd`).
		width: 64
	},
	headerSideEnd: {
		alignItems: 'flex-end',
		width: 64 + READ_TOGETHER_BAR_OVERHANG
	},
	headerTopRow: {
		alignItems: 'center',
		flexDirection: 'row',
		/*
		 * **A navigation bar's height, because the back button is the navigator's.** This row
		 * shares its band with a control this screen does not draw — a ~44pt disc on iOS 26,
		 * where the row's own contents (an eyebrow and the Aa button) are shorter. Left to size
		 * itself the row ended above the disc's bottom edge and "1. Bab" ran into it.
		 *
		 * 44 is the standard bar height, so the row now ends exactly where the control does and
		 * the title clears it on every platform rather than by a margin tuned to one.
		 */
		minHeight: 44
	},
	// An equal share of the row and nothing else — `AppButton` owns its radius, border and
	// padding, and `md` carries the 13 these were drawn with.
	navButtonSlot: {
		flex: 1
	},
	/*
	 * Centred, unlike E2's hint beside it in the same file — and deliberately so. E2's is a
	 * running explanation of what the button under it will do; this one is a standing note
	 * about the whole screen, sitting over a symmetrical pair of buttons with nothing to
	 * hang off the left of.
	 */
	note: {
		fontSize: 10.5,
		lineHeight: 17,
		textAlign: 'center'
	},
	safeArea: {
		flex: 1
	}
});
