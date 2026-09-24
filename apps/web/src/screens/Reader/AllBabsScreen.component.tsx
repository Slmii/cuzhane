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
import type { TabStackParamList } from '@/navigation/types';
import { MealSheet } from '@/screens/Reader/MealSheet.component';
import { ReaderBabMap } from '@/screens/Reader/ReaderBabMap.component';
import { ReaderBody, readerFaces } from '@/screens/Reader/ReaderBody.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { textSizeSheet } from '@/screens/Reader/textSizeSheet';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
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
	const [babNumber, setBabNumber] = useState(route.params?.babNumber ?? 1);
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
	// Twice, for the reason `BabReaderScreen` records: the effect fires before the new bab has
	// a height, so the scroll view re-applies its own offset a frame later on a device.
	const isAwaitingTop = useRef(true);

	const scrollToTop = useCallback(() => {
		scrollRef.current?.scrollTo({ animated: false, y: 0 });
	}, []);

	useEffect(() => {
		isAwaitingTop.current = true;
		scrollToTop();
	}, [babNumber, scrollToTop]);

	const handleContentSizeChange = useCallback(() => {
		if (!isAwaitingTop.current) {
			return;
		}

		isAwaitingTop.current = false;
		scrollToTop();
	}, [scrollToTop]);

	const commitScrub = (next: number) => {
		setScrubBab(null);
		setBabNumber(next);
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
	const readerSettings = {
		// Hüsrev is the Kuran's page images; the Cevşen sets text, so it falls back to a font.
		readerArabicFont: textFontFor(settingsQuery.data?.readerArabicFont ?? 'uthman'),
		readerFontSize: settingsQuery.data?.readerFontSize ?? READER_FONT_SIZE_DEFAULT,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;
	const faces = readerFaces(readerSettings.readerArabicFont, readerSettings.readerFontSize);

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
					 * See `ReaderToolbar`. The slot stays to centre the eyebrow.
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

			<ScrollView
				contentContainerStyle={styles.body}
				onContentSizeChange={handleContentSizeChange}
				ref={scrollRef}
				showsVerticalScrollIndicator={false}
			>
				<ReaderBody
					babNumber={babNumber}
					font={readerSettings.readerArabicFont}
					fontSize={readerSettings.readerFontSize}
					numerals={readerSettings.readerNumerals}
					onLongPressInvocation={setMealInvocation}
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
						onPress={() => previousBabNumber !== undefined && setBabNumber(previousBabNumber)}
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
						onPress={() => nextBabNumber !== undefined && setBabNumber(nextBabNumber)}
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
		// Equal and fixed, so the eyebrow between them is centred on the header rather than on
		// whatever is left over — "Geri" and the Aa button are different widths.
		width: 64
	},
	headerSideEnd: {
		alignItems: 'flex-end'
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
