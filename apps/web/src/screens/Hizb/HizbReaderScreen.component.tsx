import { useDelailSession } from '@/lib/hooks/useDelailSession';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CaptionText, EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
import {
	firstBlockOfSection,
	HIZB_BLOCKS,
	HIZB_SECTIONS,
	isCevsenSection,
	pageRangeOf
} from '@/lib/content/hizbulhakaik';
import { useIstighfarSession } from '@/lib/hooks/useIstighfarSession';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { TabStackParamList } from '@/navigation/types';
import { ReaderBabMap } from '@/screens/Reader/ReaderBabMap.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { textSizeSheet } from '@/screens/Reader/textSizeSheet';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HizbBody } from './HizbBody.component';
import { HizbPortionReader } from './HizbPortionReader.component';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbReader'>;

type FreeReaderProps = {
	navigation: NativeStackNavigationProp<TabStackParamList, 'HizbReader'>;
	params: Extract<TabStackParamList['HizbReader'], { sectionIndex: number }>;
};

/** One identity, so the strip's `memo` holds — see `AllBabsScreen`. */
const NOTHING: number[] = [];

/**
 * The Hizb-ül Hakaik's reader, in whichever of its two shapes the route names: a section read
 * freely from the list on Profil, or a Hizb group's portion — `HizbPortionReader`, which marks it.
 *
 * Two components rather than one with a mode, because they share the page and nothing else:
 * the group's reader runs the group's queries, its gates and its counter, and none of that may
 * reach a free read, which counts nothing. A route's params never change shape under it, so the
 * choice is made once and each keeps its own hooks.
 */
export const HizbReaderScreen = ({ navigation, route }: Props) =>
	'sectionIndex' in route.params ? (
		<HizbFreeReader navigation={navigation} params={route.params} />
	) : (
		<HizbPortionReader navigation={navigation} params={route.params} />
	);

/**
 * The Hizb-ül Hakaik, read the way `AllBabsScreen` reads the Cevşen: one block to a page, a
 * strip across the header to move within the section, Önceki / Sonraki underneath.
 *
 * **The cursor walks `HIZB_BLOCKS`, the whole text in order**, so the buttons carry the reader
 * from the last du'a of one section into the first of the next; the strip and the eyebrow
 * are what say which section that is. The route only names where to *start* — the section
 * chosen in the list — and the cursor is the screen's own from there, as the free reader's is.
 *
 * Everything else is the Cevşen reader's: the same faces from the same settings, the same
 * text-size sheet from the same bar control, the same footer note in the same place.
 */
const HizbFreeReader = ({ navigation, params }: FreeReaderProps) => {
	const delailProgress = useDelailSession('free');
	const istighfarProgress = useIstighfarSession('free');
	useKeepAwake();
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const tabBarOffset = useContext(TabBarOffsetContext);
	const settingsQuery = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	const textSize = textSizeSheet(navigation, params);

	const [cursor, setCursor] = useState(() => firstBlockOfSection(params.sectionIndex));
	const current = HIZB_BLOCKS[cursor] ?? HIZB_BLOCKS[0];
	const section = HIZB_SECTIONS[current.sectionIndex];
	const sectionStart = firstBlockOfSection(current.sectionIndex);
	const blockCount = section.blocks.length;

	// The strip scrubs within the section: the number under the finger moves, the text lands
	// on release — the split `AllBabsScreen` explains.
	const [railWidth, setRailWidth] = useState(0);
	const scrubRatio = useSharedValue(-1);
	const lastScrubIndex = useSharedValue(-1);
	const [scrubIndex, setScrubIndex] = useState<number | null>(null);
	const displayIndex = scrubIndex ?? current.blockIndex;
	const displayBlock = section.blocks[displayIndex] ?? current.block;

	const scrollRef = useRef<ScrollView | null>(null);
	const isAwaitingTop = useRef(true);

	const scrollToTop = useCallback(() => {
		scrollRef.current?.scrollTo({ animated: false, y: 0 });
	}, []);

	useEffect(() => {
		isAwaitingTop.current = true;
		scrollToTop();
	}, [cursor, scrollToTop]);

	const handleContentSizeChange = useCallback(() => {
		if (!isAwaitingTop.current) {
			return;
		}

		isAwaitingTop.current = false;
		scrollToTop();
	}, [scrollToTop]);

	const commitScrub = (index: number) => {
		setScrubIndex(null);
		setCursor(sectionStart + index);
	};

	const trackScrub = (x: number) => {
		'worklet';

		if (railWidth <= 0) {
			return;
		}

		const ratio = Math.min(1, Math.max(0, x / railWidth));

		scrubRatio.value = ratio;

		const index = Math.round(ratio * (blockCount - 1));

		if (index !== lastScrubIndex.value) {
			lastScrubIndex.value = index;
			runOnJS(setScrubIndex)(index);
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
			lastScrubIndex.value = -1;

			if (ratio >= 0) {
				runOnJS(commitScrub)(Math.round(ratio * (blockCount - 1)));
			}
		});

	const readerSettings = {
		readerArabicFont: settingsQuery.data?.readerArabicFont ?? 'uthman',
		readerFontSize: settingsQuery.data?.readerFontSize ?? READER_FONT_SIZE_DEFAULT,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;

	const previousCursor = cursor > 0 ? cursor - 1 : undefined;
	const nextCursor = cursor < HIZB_BLOCKS.length - 1 ? cursor + 1 : undefined;

	const pages = pageRangeOf(displayBlock.lines);
	const pageLabel =
		pages.from === pages.to
			? t('hizbPage', { page: pages.from })
			: t('hizbPages', { from: pages.from, to: pages.to });

	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.safeArea, { backgroundColor: theme.colors.background, paddingBottom: tabBarOffset }]}
		>
			<View style={[styles.header, { borderBottomColor: theme.colors.readerRule }]}>
				<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
				<View style={styles.headerTopRow}>
					{/* Both slots empty for the reasons `AllBabsScreen` gives: the back control
					    and the text-size control are the navigator's, and the slots centre the
					    eyebrow between them. */}
					<View style={styles.headerSide} />
					<View style={styles.headerCenter}>
						<EyebrowText numberOfLines={1}>{t('abFree')}</EyebrowText>
					</View>
					<View style={[styles.headerSide, styles.headerSideEnd]} />
				</View>
				{/* Long section names belong below the native toolbar, at the Cevşen title's size. */}
				<View style={styles.heading}>
					<Typography variant='title' weight='regular'>
						{section.title}
					</Typography>
					<CaptionText color={theme.colors.subtext}>{pageLabel}</CaptionText>
				</View>
				{/* A single block has nowhere to scrub and would fill the rail with one black tick. */}
				{blockCount > 1 ? (
					<GestureDetector gesture={railGesture}>
						<View
							accessibilityRole='adjustable'
							accessibilityValue={{ max: blockCount, min: 1, now: current.blockIndex + 1 }}
							onLayout={event => setRailWidth(event.nativeEvent.layout.width)}
							style={styles.babMapRow}
						>
							<ReaderBabMap
								count={blockCount}
								currentBab={displayIndex + 1}
								hasLegend={false}
								myBabNumbers={NOTHING}
								poolBabNumbers={NOTHING}
								readBabNumbers={NOTHING}
								scrubRatio={scrubRatio}
							/>
						</View>
					</GestureDetector>
				) : null}
			</View>

			<ScrollView
				contentContainerStyle={styles.body}
				style={styles.scroll}
				onContentSizeChange={handleContentSizeChange}
				ref={scrollRef}
				showsVerticalScrollIndicator={false}
			>
				<HizbBody
					istighfarProgress={istighfarProgress}
					delailProgress={delailProgress}
					block={current.block}
					font={readerSettings.readerArabicFont}
					fontSize={readerSettings.readerFontSize}
					isCevsenBab={isCevsenSection(current.sectionIndex)}
					numerals={readerSettings.readerNumerals}
				/>
			</ScrollView>

			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
				<CaptionText color={theme.colors.faintText} style={styles.note}>
					{t('hizbNote')}
				</CaptionText>
				<View style={styles.footerRow}>
					<AppButton
						disabled={previousCursor === undefined}
						icon='chevronLeft'
						onPress={() => previousCursor !== undefined && setCursor(previousCursor)}
						style={styles.navButtonSlot}
						title={t('abPrev')}
						variant='surface'
					/>
					<AppButton
						disabled={nextCursor === undefined}
						icon='chevronRight'
						iconPosition='trailing'
						onPress={() => nextCursor !== undefined && setCursor(nextCursor)}
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
		</SafeAreaView>
	);
};

// The Cevşen reader's own measurements, so the two screens are the same page.
const styles = StyleSheet.create({
	babMapRow: {
		marginTop: 11
	},
	body: {
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
		flex: 1,
		minWidth: 0
	},
	heading: {
		gap: 4
	},
	headerSide: {
		width: 64
	},
	headerSideEnd: {
		alignItems: 'flex-end'
	},
	headerTopRow: {
		alignItems: 'center',
		flexDirection: 'row',
		minHeight: 44
	},
	navButtonSlot: {
		flex: 1
	},
	note: {
		fontSize: 10.5,
		lineHeight: 17,
		textAlign: 'center'
	},
	safeArea: {
		flex: 1
	},
	scroll: {
		flex: 1
	}
});
