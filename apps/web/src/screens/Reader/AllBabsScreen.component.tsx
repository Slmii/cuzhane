import { BackLink } from '@/components/ui/BackLink/BackLink.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import type { CevsenInvocation } from '@/lib/content/cevsen';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
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
import { useKeepAwake } from 'expo-keep-awake';
import { useContext, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
export const AllBabsScreen = ({ navigation }: Props) => {
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
	const [babNumber, setBabNumber] = useState(1);
	const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
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
		readerArabicFont: settingsQuery.data?.readerArabicFont ?? 'naskh',
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
					<View style={styles.headerSide}>
						<BackLink onPress={navigation.goBack} />
					</View>
					<View style={styles.headerCenter}>
						{/* Where E2 puts "Bab 87 / 100". There is no position to be at here —
						    the eyebrow says what kind of reading this is instead. */}
						<EyebrowText>{t('abFree')}</EyebrowText>
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

			<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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
					<Pressable
						accessibilityRole='button'
						disabled={previousBabNumber === undefined}
						onPress={() => previousBabNumber !== undefined && setBabNumber(previousBabNumber)}
						style={[
							styles.navButton,
							{
								backgroundColor: theme.colors.surface,
								borderColor: theme.colors.border,
								opacity: previousBabNumber === undefined ? 0.4 : 1
							}
						]}
					>
						<Icon name='back' size={16} />
						<Typography color={theme.colors.subtext} variant='bodyStrong'>
							{t('abPrev')}
						</Typography>
					</Pressable>
					{/*
					 * Filled, where "Önceki" is outlined — reading forward is the direction this
					 * screen is for, and the pair would otherwise read as one control split in two.
					 */}
					<Pressable
						accessibilityRole='button'
						disabled={nextBabNumber === undefined}
						onPress={() => nextBabNumber !== undefined && setBabNumber(nextBabNumber)}
						style={[
							styles.navButton,
							styles.navButtonPrimary,
							{
								backgroundColor: theme.colors.text,
								opacity: nextBabNumber === undefined ? 0.4 : 1
							}
						]}
					>
						<Typography color={theme.colors.background} variant='bodyStrong'>
							{t('abNext')}
						</Typography>
						<Icon color={theme.colors.background} name='chevron' size={16} />
					</Pressable>
				</View>
			</View>

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
		flexDirection: 'row'
	},
	navButton: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: StyleSheet.hairlineWidth,
		flex: 1,
		flexDirection: 'row',
		gap: 7,
		justifyContent: 'center',
		paddingVertical: 14
	},
	navButtonPrimary: {
		borderWidth: 0
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
