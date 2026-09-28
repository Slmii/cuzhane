import { AppButton } from '@/components/ui/Button/Button.component';
import { CaptionText, EyebrowText, TitleText } from '@/components/ui/Typography/Typography.component';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
import { suraNameFor } from '@/lib/content/cuz';
import { mushafCuzPages, mushafPagePath, mushafPageSecde, mushafPageSpan } from '@/lib/content/mushaf';
import type { MushafVerse } from '@/lib/content/mushaf';
import type { MushafPlace } from '@/lib/content/mushafPlaces';
import { cuzPages } from '@/lib/content/quran';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { textFontFor } from '@/lib/types/domain';
import { tapLight } from '@/lib/utils/haptics';
import { CUZ_COUNT } from '@/lib/utils/units';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { TabStackParamList } from '@/navigation/types';
import {
	BODY_BOTTOM,
	CUZ_TURN_EASING,
	type CuzTurn,
	cuzReaderStyles,
	cuzTurnStyle,
	IMAGE_BODY_SIDE,
	IMAGE_BODY_TOP,
	SECDE_SCROLL_MARGIN,
	SEGMENT_TRANSITION_MS
} from '@/screens/Reader/cuzReaderShell';
import { MushafGoButton, MushafGoSheet } from '@/screens/Reader/MushafGoSheet.component';
import { MushafImagePage, mushafPaperGeometry } from '@/screens/Reader/MushafImagePage.component';
import { MushafPage } from '@/screens/Reader/MushafPage.component';
import { readerFaces } from '@/screens/Reader/ReaderBody.component';
import { SecdeOrnament } from '@/screens/Reader/SecdeOrnament.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { textSizeSheet } from '@/screens/Reader/textSizeSheet';
import { VerseMealSheet } from '@/screens/Reader/VerseMealSheet.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useContext, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<TabStackParamList, 'Mushaf'>;

/** Where a picked ayah's row comes to rest: this far below the header. */
const TARGET_SCROLL_MARGIN = 24;

/**
 * The free Mushaf — the Kur'an read for its own sake, as `AllBabs` (B7) is the Cevşen.
 *
 * **Q5's reader with everything about groups taken out.** No round gate, no holdings, no marking
 * and no bookmark: the arrows walk every page of every cüz, one to thirty, crossing from one cüz
 * into the next the way Q5 crosses into your next held one. Like B7, the place is screen state —
 * it opens on the first cüz (or the one it was sent to) and remembers nothing, because a free
 * read is a place you are rather than one you are returned to.
 *
 * The shell is Q5's, shared rather than copied where it can be — its styles, metrics and the cüz
 * crossing's motion come from `CuzReaderScreen` — and the page is the same page: `MushafPage`,
 * with its long-press meal, or the Hüsrev edition's `MushafImagePage` with the sajdah mark over
 * it. The footer is B7's: the note that nothing here counts, over Önceki and Sonraki.
 */
export const MushafScreen = ({ navigation, route }: Props) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const tabBarOffset = useContext(TabBarOffsetContext);
	const settingsQuery = useGetUserSettings();
	const readerFace = settingsQuery.data?.readerArabicFont ?? 'uthman';
	const isHusrev = readerFace === 'husrev';
	const updateSettings = useUpdateUserSettings();
	const scrollRef = useRef<ScrollView>(null);
	// What the sajdah mark needs to scroll to its verse: where the page body starts in the
	// content, and how far the content can scroll at all.
	const layoutRef = useRef({ bodyY: 0, contentHeight: 0, textTop: 0 });
	// The scroll view's height: the sajdah mark is fixed over it.
	const [viewportHeight, setViewportHeight] = useState(0);

	// The cüz is screen state, seeded once from the route — see the doc comment.
	const [cuzNumber, setCuzNumber] = useState(() => Math.min(Math.max(route.params?.cuzNumber ?? 1, 1), CUZ_COUNT));
	const textPages = cuzPages(cuzNumber);
	const imagePages = mushafCuzPages(cuzNumber);
	const pageCount = isHusrev ? imagePages.length : textPages.length;
	// The page it was sent to — search opens a sura, an ayah or a page here (1-based, within the cüz).
	const [chosenPageIndex, setPageIndex] = useState(() => Math.max((route.params?.page ?? 1) - 1, 0));
	// Held inside the cüz when the pagination changes under it — Hüsrev has more pages than some.
	const pageIndex = Math.min(chosenPageIndex, pageCount - 1);
	/** Which way the last cüz crossing went — `null` until there has been one. */
	const [cuzTurn, setCuzTurn] = useState<CuzTurn | null>(null);
	/** The verse whose meal is open — set by a long press on the typeset page, `null` when closed. */
	const [mealVerse, setMealVerse] = useState<string | null>(null);
	/** Whether the Git sheet (Q5n) is open — from the button beside the sura name. */
	const [isGoOpen, setIsGoOpen] = useState(false);
	/**
	 * The ayah Git last sent the reader to, and where: banded and scrolled to while its page shows,
	 * and what the sheet calls "Şu an" — not the page's first ayah, which is what a jump to 2:58
	 * otherwise reported (2:49). A new object per pick, so picking it again scrolls again.
	 */
	const [goVerse, setGoVerse] = useState<{ verse: MushafVerse; cuzNumber: number; pageIndex: number } | null>(() => {
		// An ayah search sent the reader to is marked and scrolled to, as a Git pick is.
		const [chapter, ayah] = (route.params?.verseKey ?? '').split(':').map(Number);

		return chapter && ayah
			? {
					cuzNumber: Math.min(Math.max(route.params?.cuzNumber ?? 1, 1), CUZ_COUNT),
					pageIndex: Math.max((route.params?.page ?? 1) - 1, 0),
					verse: { ayah, chapter }
			  }
			: null;
	});
	const isReducedMotion = useReducedMotion();

	const readerSettings = {
		readerArabicFont: readerFace,
		readerFontSize: settingsQuery.data?.readerFontSize ?? READER_FONT_SIZE_DEFAULT,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;
	// The typeset page's face; with Hüsrev the images show and this is never drawn.
	const textFace = textFontFor(readerFace);
	const faces = readerFaces(textFace, readerSettings.readerFontSize);
	// Opened from the navigator's bar, which is outside this screen — see `textSizeSheet`.
	const textSize = textSizeSheet(navigation, route.params);

	const page = textPages[pageIndex];
	const imagePage = imagePages[pageIndex];
	const nextImagePage = imagePages[pageIndex + 1];
	const imageSpan = imagePage === undefined ? undefined : mushafPageSpan(imagePage);
	const imageSecde = imagePage === undefined ? undefined : mushafPageSecde(imagePage);
	// The Hüsrev body's width, which fixes where the page's paper and its green fall.
	const [imageBodyWidth, setImageBodyWidth] = useState(0);
	const paper = mushafPaperGeometry(Math.max(0, imageBodyWidth - IMAGE_BODY_SIDE * 2));
	const suraName = (chapter: number) => suraNameFor(chapter, language);

	// "Sebe’ · Ayet 10 – 24", or across two suras where the page turns from one to the next.
	const first = isHusrev ? imageSpan?.first : page?.verses.at(0);
	const last = isHusrev ? imageSpan?.last : page?.verses.at(-1);
	const pageSuraLabel =
		first && last
			? first.chapter === last.chapter
				? suraName(first.chapter)
				: `${suraName(first.chapter)} – ${suraName(last.chapter)}`
			: '';
	const pageAyahLabel =
		first && last
			? first.chapter === last.chapter
				? `${t('qAyah')} ${first.ayah} – ${last.ayah}`
				: `${t('qAyah')} ${first.ayah} – ${suraName(last.chapter)} ${last.ayah}`
			: '';

	const scrollToTop = () => scrollRef.current?.scrollTo({ animated: false, y: 0 });

	// As Q5: in Hüsrev mode the page goes back to its top once the new one has drawn (`onShown`).
	const turnTo = (index: number) => {
		setPageIndex(index);

		if (!isHusrev) {
			scrollToTop();
		}
	};

	const crossInto = (targetCuz: number, targetPageIndex: number, direction: CuzTurn) => {
		setCuzTurn(direction);
		setCuzNumber(targetCuz);
		setPageIndex(targetPageIndex);

		if (!isHusrev) {
			scrollToTop();
		}
	};

	// The Git sheet's pick: any page of any cüz, in place — a cüz crossing slides as the arrows' does.
	const goTo = (place: MushafPlace, verse?: MushafVerse) => {
		setIsGoOpen(false);
		setGoVerse(verse ? { cuzNumber: place.cuzNumber, pageIndex: place.pageIndex, verse } : null);

		if (place.cuzNumber === cuzNumber) {
			turnTo(place.pageIndex);

			return;
		}

		crossInto(place.cuzNumber, place.pageIndex, place.cuzNumber > cuzNumber ? 'next' : 'previous');
	};

	const targetVerse =
		goVerse && goVerse.cuzNumber === cuzNumber && goVerse.pageIndex === pageIndex ? goVerse.verse : undefined;

	/*
	 * The picked ayah's row, brought up under the header once the page has laid it out — after the
	 * turn's own jump to the top. Typeset only: Hüsrev's pages are images, and nothing records
	 * where on one an ayah is.
	 */
	const scrollToTarget = useCallback(
		(y: number) => {
			if (goVerse) {
				scrollRef.current?.scrollTo({
					animated: !isReducedMotion,
					y: Math.max(0, layoutRef.current.textTop + y - TARGET_SCROLL_MARGIN)
				});
			}
		},
		[goVerse, isReducedMotion]
	);

	const isFirstPage = pageIndex === 0;
	const isLastPage = pageIndex >= pageCount - 1;
	// Every cüz is the reader's here, so the neighbours are simply the next and previous numbers.
	const previousCuz = cuzNumber > 1 ? cuzNumber - 1 : undefined;
	const nextCuz = cuzNumber < CUZ_COUNT ? cuzNumber + 1 : undefined;

	const handlePrevious = () => {
		setGoVerse(null);

		if (!isFirstPage) {
			turnTo(pageIndex - 1);

			return;
		}

		if (previousCuz !== undefined) {
			const previousPageCount = isHusrev ? mushafCuzPages(previousCuz).length : cuzPages(previousCuz).length;

			crossInto(previousCuz, previousPageCount - 1, 'previous');
		}
	};

	const handleNext = () => {
		setGoVerse(null);

		if (!isLastPage) {
			turnTo(pageIndex + 1);

			return;
		}

		if (nextCuz !== undefined) {
			crossInto(nextCuz, 0, 'next');
		}
	};

	// The sajdah mark's tap — as Q5 — brings the verse's green up under the header.
	const secdeTrackHeight = Math.max(0, viewportHeight - IMAGE_BODY_TOP - BODY_BOTTOM);
	const handleSecdePress = () => {
		if (!imageSecde) {
			return;
		}

		tapLight();

		const { bodyY, contentHeight } = layoutRef.current;
		const yInPage = paper.frameY + imageSecde.y * paper.frameHeight;
		const target = bodyY + IMAGE_BODY_TOP + yInPage - SECDE_SCROLL_MARGIN;
		const maxScroll = Math.max(0, contentHeight - viewportHeight);

		scrollRef.current?.scrollTo({ animated: !isReducedMotion, y: Math.min(maxScroll, Math.max(0, target)) });
	};

	// Nothing on first open, and nothing with Reduce Motion — the cüz simply changes.
	const cuzTurnAnimation = cuzTurn && !isReducedMotion ? cuzTurnStyle(cuzTurn) : null;

	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[
				cuzReaderStyles.safeArea,
				{ backgroundColor: theme.colors.background, paddingBottom: tabBarOffset }
			]}
		>
			{/* Q5's header, above the scroll view: the place, the sura on the page, the page strip. */}
			<View
				style={[
					cuzReaderStyles.header,
					{ backgroundColor: theme.colors.readerSurface, borderBottomColor: theme.colors.readerRule }
				]}
			>
				<View style={cuzReaderStyles.headerTopRow}>
					{/* Empty on purpose — the back control and the Aa are the navigator's; the slots centre the eyebrow. */}
					<View style={cuzReaderStyles.headerSide} />
					<View style={cuzReaderStyles.headerCenter}>
						<EyebrowText color={theme.colors.faintText} numberOfLines={1}>
							{`${t('cuzOrdinal', { n: cuzNumber })} · ${t('qPage')} ${pageIndex + 1} / ${pageCount}`}
						</EyebrowText>
					</View>
					<View style={[cuzReaderStyles.headerSide, cuzReaderStyles.headerSideEnd]} />
				</View>
				{/* Keyed on the cüz, so crossing into another one remounts it and the slide plays. */}
				<View style={cuzReaderStyles.headerBottomRow}>
					<Animated.View key={`title-${cuzNumber}`} style={[cuzReaderStyles.titleGroup, cuzTurnAnimation]}>
						<TitleText numberOfLines={1} style={cuzReaderStyles.suraTitle}>
							{pageSuraLabel}
						</TitleText>
						<CaptionText color={theme.colors.faintText}>{pageAyahLabel}</CaptionText>
					</Animated.View>
					{/* Q5's Git — to a sura, an ayah, a cüz or a page. Outside the keyed title, so a cüz turn leaves it still. */}
					<MushafGoButton onPress={() => setIsGoOpen(true)} />
				</View>
				{/* One segment a page: the pages behind in accent, this one in ink, the rest bare. */}
				<View style={cuzReaderStyles.strip}>
					{Array.from({ length: pageCount }, (_, index) => (
						<Animated.View
							key={index}
							style={{
								...cuzReaderStyles.segment,
								backgroundColor:
									index < pageIndex
										? theme.colors.accent
										: index === pageIndex
										? theme.colors.text
										: theme.colors.segmentTrack,
								transitionDuration: isReducedMotion ? 0 : SEGMENT_TRANSITION_MS,
								transitionProperty: 'backgroundColor',
								transitionTimingFunction: CUZ_TURN_EASING
							}}
						/>
					))}
				</View>
			</View>
			<View style={cuzReaderStyles.viewport}>
				<ScrollView
					contentContainerStyle={cuzReaderStyles.page}
					onContentSizeChange={(_width, height) => {
						layoutRef.current.contentHeight = height;
					}}
					onLayout={event => {
						setViewportHeight(event.nativeEvent.layout.height);
					}}
					ref={scrollRef}
					showsVerticalScrollIndicator={false}
				>
					{isHusrev ? (
						<Animated.View
							key={`page-${cuzNumber}`}
							onLayout={event => {
								layoutRef.current.bodyY = event.nativeEvent.layout.y;
								setImageBodyWidth(event.nativeEvent.layout.width);
							}}
							style={[cuzReaderStyles.body, cuzReaderStyles.imageBody, cuzTurnAnimation]}
						>
							{imagePage === undefined ? null : (
								<MushafImagePage
									accessibilityLabel={`${t('qPage')} ${pageIndex + 1} / ${pageCount}`}
									nextPath={nextImagePage === undefined ? undefined : mushafPagePath(nextImagePage)}
									onShown={scrollToTop}
									path={mushafPagePath(imagePage)}
								/>
							)}
						</Animated.View>
					) : (
						<Animated.View key={`page-${cuzNumber}`} style={[cuzReaderStyles.body, cuzTurnAnimation]}>
							{page ? (
								// Where the page starts in the scroll content, for the scroll to a picked ayah.
								<View
									onLayout={event => {
										layoutRef.current.textTop = event.nativeEvent.layout.y;
									}}
								>
									<MushafPage
										faces={faces}
										font={textFace}
										numerals={readerSettings.readerNumerals}
										onLongPressVerse={setMealVerse}
										onTargetLayout={scrollToTarget}
										page={page}
										selectedVerseKey={mealVerse}
										suraName={suraName}
										targetVerseKey={
											targetVerse ? `${targetVerse.chapter}:${targetVerse.ayah}` : null
										}
									/>
								</View>
							) : null}
						</Animated.View>
					)}
				</ScrollView>

				{/* The sajdah mark, fixed over the scroll view — as Q5 hangs it. */}
				{isHusrev && viewportHeight > 0 ? (
					<View
						pointerEvents='box-none'
						style={[cuzReaderStyles.secdeTrack, { height: secdeTrackHeight, top: IMAGE_BODY_TOP }]}
					>
						<SecdeOrnament
							blockHeight={secdeTrackHeight}
							onPress={handleSecdePress}
							secdePage={imageSecde ? imagePage : undefined}
						/>
					</View>
				) : null}
			</View>

			{/* B7's footer: what reading here does not do, over the pair that walks the pages. */}
			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				<View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.readerSurface }]} />
				<CaptionText color={theme.colors.faintText} style={styles.note}>
					{t('mfNote')}
				</CaptionText>
				<View style={styles.footerRow}>
					<AppButton
						disabled={isFirstPage && previousCuz === undefined}
						icon='chevronLeft'
						onPress={handlePrevious}
						style={styles.navButtonSlot}
						title={t('abPrev')}
						variant='surface'
					/>
					<AppButton
						disabled={isLastPage && nextCuz === undefined}
						icon='chevronRight'
						iconPosition='trailing'
						onPress={handleNext}
						style={styles.navButtonSlot}
						title={t('abNext')}
						variant='primary'
					/>
				</View>
			</View>

			{/* The typeset page only: the Hüsrev pages are images and have no verse to press. */}
			<VerseMealSheet
				arabicFont={faces.arabicFont}
				arabicFontSize={faces.arabicFontSize}
				numerals={readerSettings.readerNumerals}
				onClose={() => setMealVerse(null)}
				verseKey={mealVerse}
			/>
			<MushafGoSheet
				cuzNumber={cuzNumber}
				{...(targetVerse ? { currentVerse: targetVerse } : {})}
				isVisible={isGoOpen}
				onClose={() => setIsGoOpen(false)}
				onGo={goTo}
				pageIndex={pageIndex}
				pagination={isHusrev ? 'husrev' : 'text'}
			/>
			<TextSizeSheet
				hasMushafPages
				isVisible={textSize.isVisible}
				onChange={patch => updateSettings.mutate(patch)}
				onClose={textSize.close}
				settings={readerSettings}
			/>
		</SafeAreaView>
	);
};

// B7's footer, as `AllBabsScreen` sets it.
const styles = StyleSheet.create({
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
	navButtonSlot: {
		flex: 1
	},
	note: {
		fontSize: 10.5,
		lineHeight: 17,
		textAlign: 'center'
	}
});
