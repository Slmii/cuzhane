import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useRequireRoundCuz } from '@/lib/hooks/useHatimRoundGate';
import { useHizbAssignment, useUpdateHizbAssignment } from '@/lib/hooks/useHizbReading';
import { useGetReadingPlaces, useSaveReadingPlace } from '@/lib/hooks/useReadingPlaces';
import { placeIn } from '@/lib/utils/readingPlaces';
import { useGetBabs, useSetBabRead } from '@/lib/hooks/useBab';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { bookmarkToCuzPlace, cuzPlaceToBookmark, planUnitsOf } from '@/lib/utils/personalPlan';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CaptionText, EyebrowText, TitleText } from '@/components/ui/Typography/Typography.component';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
import { suraNameFor } from '@/lib/content/cuz';
import { mushafCuzPages, mushafPagePath, mushafPageSecde, mushafPageSpan } from '@/lib/content/mushaf';
import { cuzPages } from '@/lib/content/quran';
import { textFontFor } from '@/lib/types/domain';
import { MushafImagePage, mushafPaperGeometry } from '@/screens/Reader/MushafImagePage.component';
import { SecdeOrnament } from '@/screens/Reader/SecdeOrnament.component';
import {
	BODY_BOTTOM,
	CUZ_TURN_EASING,
	type CuzTurn,
	cuzReaderStyles as styles,
	cuzTurnStyle,
	IMAGE_BODY_SIDE,
	IMAGE_BODY_TOP,
	SECDE_SCROLL_MARGIN,
	SEGMENT_TRANSITION_MS
} from '@/screens/Reader/cuzReaderShell';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { readCuzBookmark, writeCuzBookmark } from '@/lib/utils/cuzBookmark';
import { type CuzPagination, recordCuzPagesRead } from '@/lib/utils/cuzPagesRead';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { TabStackParamList } from '@/navigation/types';
import { MushafPage } from '@/screens/Reader/MushafPage.component';
import { readerFaces } from '@/screens/Reader/ReaderBody.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { VerseMealSheet } from '@/screens/Reader/VerseMealSheet.component';
import { textSizeSheet } from '@/screens/Reader/textSizeSheet';
import { tapBack, tapLight } from '@/lib/utils/haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useContext, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<TabStackParamList, 'CuzReader'>;

/**
 * Q5 — a cüz, read page by page in the app. The Cevşen reader's shell — a fixed header,
 * scrolling page, footer with the arrows — around the mushaf's own pages.
 *
 * **Reading here marks nothing.** Q4 is where a cüz is marked read, and the frame's own
 * subtitle calls this reader optional: a mushaf or another app is just as good. What this
 * screen keeps for you is your *place* — "Kaldığım yeri işaretle" — on the server and on the
 * device, so opening the cüz again, on any device, lands on the page you left.
 *
 * The text is the Madinah mushaf's, bundled by `fetch-quran-text.ts` and never touched
 * here; the page itself — its lines, sura headers and ayah marks — is `MushafPage`. With
 * "Hüsrev hattı" chosen the same shell shows that edition's printed pages instead
 * (`MushafImagePage`), walking its own twenty pages a cüz.
 */
/**
 * A Şahsi Kur'an day opened by its reading alone (`assignmentId`, from the group screen, the
 * missed days or the history): its cüz are fetched first, then handed to the reader as its route,
 * opening on the first one not yet marked.
 */
const PlanDayLoader = ({ navigation, route }: Props) => {
	const { assignmentId = '', groupId } = route.params;
	const { theme } = useThemeContext();
	const query = useHizbAssignment(groupId, assignmentId);
	const reading = query.data;

	useEffect(() => {
		if (!reading) {
			return;
		}

		const cuzNumbers = reading.units ?? planUnitsOf('HATIM', reading.planDays, reading.portion);
		// The place marked in the day, else its first cüz not yet marked, from the top.
		const place = bookmarkToCuzPlace(reading.bookmark);
		const placeCuz = place ? cuzNumbers[place.cuzIndex] : undefined;

		navigation.setParams({
			cuzNumber:
				placeCuz ?? cuzNumbers.find(number => !reading.readPortions.includes(number)) ?? cuzNumbers[0] ?? 1,
			...(placeCuz !== undefined && place ? { page: place.page } : {}),
			plan: { cuzNumbers, day: reading.day }
		});
	}, [navigation, reading]);

	return query.isError ? (
		<ErrorState queries={[query]} />
	) : (
		<SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} />
	);
};

export const CuzReaderScreen = (props: Props) => {
	const { assignmentId, cuzNumber, plan } = props.route.params;

	return assignmentId !== undefined && (plan === undefined || cuzNumber === undefined) ? (
		<PlanDayLoader {...props} />
	) : (
		<CuzReaderBody {...props} />
	);
};

const CuzReaderBody = ({ navigation, route }: Props) => {
	const { assignmentId, groupId, plan } = route.params;
	const cuzNumber = route.params.cuzNumber ?? 1;
	// Holding no cüz this round means QR1 comes first, however this screen was reached. A Şahsi
	// reading's day (`plan`) is never asked — the gate knows its group holds none.
	useRequireRoundCuz(groupId, navigation);
	// The same cached query the gate above reads — here for which cüz you hold, to page on into.
	const groupQuery = useGetGroupById(groupId);
	// A Şahsi day's reading, for "Okudum" at its end; nothing is asked for a group's cüz.
	const planReading = useHizbAssignment(groupId, assignmentId ?? '', assignmentId !== undefined);
	const planUpdate = useUpdateHizbAssignment(groupId, assignmentId ?? '');
	// A group's cüz, for "Okudum" on its last page: whether it is yours this round, and read yet.
	const babsQuery = useGetBabs(groupId, assignmentId === undefined);
	const setBabRead = useSetBabRead();
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const tabBarOffset = useContext(TabBarOffsetContext);
	const userId = useCurrentUserId();
	const settingsQuery = useGetUserSettings();
	const readerFace = settingsQuery.data?.readerArabicFont ?? 'uthman';
	const isHusrev = readerFace === 'husrev';
	const updateSettings = useUpdateUserSettings();
	const scrollRef = useRef<ScrollView>(null);
	// What the sajdah mark needs to scroll to its verse: where the page body starts in the
	// content, and how far the content can scroll at all.
	const layoutRef = useRef({ bodyY: 0, contentHeight: 0 });
	// The scroll view's height: the sajdah mark is fixed over it.
	const [viewportHeight, setViewportHeight] = useState(0);

	/*
	 * Two mushafs, two paginations: the typeset text is the Madinah mushaf's pages, cut to this
	 * cüz, and Hüsrev is its own edition's twenty whole pages. The bookmark is a page within the
	 * cüz in either, so switching can land it a page off — never outside the cüz.
	 */
	const textPages = cuzPages(cuzNumber);
	const imagePages = mushafCuzPages(cuzNumber);
	const pageCount = isHusrev ? imagePages.length : textPages.length;

	// Where the cüz opens: the page it was sent to, else page one until the bookmark is read.
	const [chosenPageIndex, setPageIndex] = useState(() =>
		Math.min(Math.max((route.params.page ?? 1) - 1, 0), pageCount - 1)
	);
	// Held inside the cüz when the pagination changes under it — Hüsrev has more pages than some.
	const pageIndex = Math.min(chosenPageIndex, pageCount - 1);
	const [bookmarkedPage, setBookmarkedPage] = useState<number | null>(null);
	/** Which way the last cüz crossing went — `null` until there has been one. */
	const [cuzTurn, setCuzTurn] = useState<CuzTurn | null>(null);
	/** The verse whose meal is open — set by a long press on the typeset page, `null` when closed. */
	const [mealVerse, setMealVerse] = useState<string | null>(null);
	const isReducedMotion = useReducedMotion();
	/** Set the moment the reader turns a page, so a bookmark arriving late cannot turn it back. */
	const hasTurnedRef = useRef(route.params.page !== undefined);

	// The round the bookmark belongs to — see `cuzBookmark`. Null until the group has answered. A
	// Şahsi day keeps it under the day's own number, which comes with it.
	const roundIndex = plan?.day ?? groupQuery.data?.roundIndex ?? null;

	/*
	 * A group's cüz keeps its place on the server too (`readingPlaces`), so it opens there on any
	 * device: a number, null when the server holds none, undefined until it has answered.
	 */
	const isGroupCuz = assignmentId === undefined;
	const placesQuery = useGetReadingPlaces(groupId, isGroupCuz);
	const saveServerPlace = useSaveReadingPlace();
	const serverPlace = isGroupCuz ? placeIn(placesQuery.data, roundIndex, cuzNumber) : undefined;
	const serverPage = serverPlace === undefined ? undefined : serverPlace?.position ?? null;
	// Which cüz and round the server's answer was applied to — once each, so this reader's own saves,
	// which update the same cache, do not mark the page as they turn it.
	const restoredRef = useRef<string | null>(null);

	useEffect(() => {
		if (!userId || roundIndex === null) {
			return;
		}

		const restore = (page: number) => {
			setBookmarkedPage(page);

			if (!hasTurnedRef.current) {
				setPageIndex(Math.min(page - 1, pageCount - 1));
			}
		};
		const opened = `${cuzNumber}:${roundIndex}`;

		if (serverPage !== undefined) {
			if (restoredRef.current === opened) {
				return;
			}

			restoredRef.current = opened;

			if (serverPage !== null) {
				restore(serverPage);

				return;
			}
		}

		// The device's place while the server has not answered, or when it holds none.
		let isCurrent = true;

		void readCuzBookmark(userId, groupId, cuzNumber, roundIndex).then(page => {
			if (isCurrent && page !== null) {
				restore(page);
			}
		});

		return () => {
			isCurrent = false;
		};
	}, [cuzNumber, groupId, pageCount, roundIndex, serverPage, userId]);

	/*
	 * Pages read, for Ana sayfa's "4/20 s" — **counted on a forward turn only**, as the page
	 * turned past. Recording whatever page was on screen counted the last page of the previous
	 * cüz as 19 of 20 read the moment ‹ stepped back into it. Kept as the furthest so far, so
	 * paging back takes nothing away; see `cuzPagesRead`.
	 */
	const pagination: CuzPagination = isHusrev ? 'husrev' : 'text';
	const recordPagesRead = (pages: number) => {
		if (userId && roundIndex !== null) {
			void recordCuzPagesRead(userId, groupId, cuzNumber, roundIndex, pagination, pages);

			if (isGroupCuz) {
				saveServerPlace(
					groupId,
					roundIndex,
					cuzNumber,
					pagination === 'husrev' ? { husrevPagesRead: pages } : { textPagesRead: pages }
				);
			}
		}
	};

	const readerSettings = {
		readerArabicFont: readerFace,
		readerFontSize: settingsQuery.data?.readerFontSize ?? READER_FONT_SIZE_DEFAULT,
		readerNumerals: settingsQuery.data?.readerNumerals ?? 'arabic'
	} as const;
	// The typeset page's face; with Hüsrev the images show and this is never drawn.
	const textFace = textFontFor(readerFace);
	const faces = readerFaces(textFace, readerSettings.readerFontSize);
	const textSize = textSizeSheet(navigation, route.params);

	const page = textPages[pageIndex];
	const imagePage = imagePages[pageIndex];
	const nextImagePage = imagePages[pageIndex + 1];
	const imageSpan = imagePage === undefined ? undefined : mushafPageSpan(imagePage);
	const imageSecde = imagePage === undefined ? undefined : mushafPageSecde(imagePage);
	// The Hüsrev body's width, which fixes where the page's paper and its green fall.
	const [imageBodyWidth, setImageBodyWidth] = useState(0);
	const paper = mushafPaperGeometry(Math.max(0, imageBodyWidth - IMAGE_BODY_SIDE * 2));
	// By number, across the whole mushaf: Hüsrev's cüz can open in a sura this cüz's list lacks.
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

	/*
	 * A turn goes back to the page's top — **in Hüsrev mode, once the new page has drawn**
	 * (`MushafImagePage`'s `onShown`), not on the tap. Scrolling at once moved the page being
	 * left before the next one was there, and from a scrolled page that read as a flicker.
	 */
	/**
	 * The place, kept as it is read — the cüz opens there again. Kept on the device, and on the
	 * server so it opens there on any device: a group's cüz in its reading places, a Şahsi day on the
	 * reading, where the group screen shows it.
	 */
	const savePlace = (onCuz: number, pageNumber: number) => {
		if (userId && roundIndex !== null) {
			void writeCuzBookmark(userId, groupId, onCuz, roundIndex, pageNumber);

			if (isGroupCuz) {
				saveServerPlace(groupId, roundIndex, onCuz, { position: pageNumber });
			}
		}

		const cuzIndex = plan?.cuzNumbers.indexOf(onCuz) ?? -1;

		if (assignmentId !== undefined && cuzIndex >= 0) {
			planUpdate.mutate({ bookmark: cuzPlaceToBookmark(cuzIndex, pageNumber) });
		}
	};

	const turnTo = (index: number) => {
		hasTurnedRef.current = true;
		setPageIndex(index);
		savePlace(cuzNumber, index + 1);

		if (!isHusrev) {
			scrollToTop();
		}
	};

	/*
	 * **The arrows carry on into your next cüz.** Past the last page › opens the next one you
	 * hold this round, at its first page; before the first ‹ opens the previous one, at its
	 * last. Cüz you don't hold are skipped — they are someone else's this round.
	 *
	 * **In place, by `setParams`** — not `replace`, which slid the whole screen in as a new one,
	 * header strip, footer and all. Only the sura title and the page move (`cuzTurn`); the rest
	 * of the reader stays where it is, and back still leaves the reader.
	 *
	 * A Şahsi day walks its own cüz instead: the day's, which its plan reads.
	 */
	const heldCuz = [...(plan?.cuzNumbers ?? groupQuery.data?.myBabNumbers ?? [])].sort((a, b) => a - b);
	const nextHeldCuz = heldCuz.find(number => number > cuzNumber);
	const previousHeldCuz = heldCuz.filter(number => number < cuzNumber).at(-1);
	const isFirstPage = pageIndex === 0;
	const isLastPage = pageIndex >= pageCount - 1;

	const crossInto = (targetCuz: number, targetPage: number, direction: CuzTurn) => {
		hasTurnedRef.current = true;

		// Carrying on past the last page means that one was read too — the cüz is read to its end.
		if (direction === 'next') {
			recordPagesRead(pageCount);
		}

		// The bookmark belongs to the cüz being left; the effect reads the new one's.
		setBookmarkedPage(null);
		setCuzTurn(direction);
		setPageIndex(targetPage - 1);
		navigation.setParams({ cuzNumber: targetCuz, page: targetPage });
		savePlace(targetCuz, targetPage);

		if (!isHusrev) {
			scrollToTop();
		}
	};

	/*
	 * A Şahsi Kur'an day: on the last page of each of its cüz, "Okudum" marks that cüz read and
	 * carries on into the next one still to read. Marking the last of them marks the day read and
	 * goes back to the group.
	 */
	const isPlanDayRead = planReading.data?.completedAt != null;
	const planMarked = isPlanDayRead ? heldCuz : planReading.data?.readPortions ?? [];
	// A group's cüz the same way, when it is yours this round: read, then on to the next you hold.
	const isGroupCuzMine = assignmentId === undefined && (groupQuery.data?.myBabNumbers.includes(cuzNumber) ?? false);
	const isGroupCuzRead = babsQuery.data?.find(bab => bab.number === cuzNumber)?.readAt != null;
	const isCuzEnd = isLastPage && (assignmentId !== undefined || isGroupCuzMine);
	const isCuzMarked = assignmentId !== undefined ? planMarked.includes(cuzNumber) : isGroupCuzRead;
	const isMarkingCuz = planUpdate.isPending || setBabRead.isPending;
	const markGroupCuz = () =>
		setBabRead.mutate(
			{ babNumber: cuzNumber, groupId, read: true },
			{
				onSuccess: () => (nextHeldCuz !== undefined ? crossInto(nextHeldCuz, 1, 'next') : navigation.goBack())
			}
		);
	const markPlanCuz = () => {
		const version = planReading.data?.version;
		const remaining = heldCuz.filter(number => number !== cuzNumber && !planMarked.includes(number));

		if (remaining.length === 0) {
			planUpdate.mutate({ read: true, version }, { onSuccess: () => navigation.goBack() });

			return;
		}

		const target = remaining.find(number => number > cuzNumber) ?? remaining[0];

		planUpdate.mutate(
			{ bookPortions: [...planMarked, cuzNumber].sort((a, b) => a - b), version },
			{
				onSuccess: () => {
					if (target !== undefined) {
						crossInto(target, 1, target > cuzNumber ? 'next' : 'previous');
					}
				}
			}
		);
	};

	/*
	 * The sajdah mark's tap: bring the verse's green up under the header, with a little
	 * room above it — or as near as the content allows, since a page that fits scrolls nowhere.
	 */
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

	const handlePrevious = () => {
		if (!isFirstPage) {
			turnTo(pageIndex - 1);

			return;
		}

		if (previousHeldCuz !== undefined) {
			const previousPageCount = isHusrev
				? mushafCuzPages(previousHeldCuz).length
				: cuzPages(previousHeldCuz).length;

			crossInto(previousHeldCuz, previousPageCount, 'previous');
		}
	};

	const handleNext = () => {
		if (!isLastPage) {
			recordPagesRead(pageIndex + 1);
			turnTo(pageIndex + 1);

			return;
		}

		if (nextHeldCuz !== undefined) {
			crossInto(nextHeldCuz, 1, 'next');
		}
	};

	// Nothing on first open, and nothing with Reduce Motion — the cüz simply changes.
	const cuzTurnAnimation = cuzTurn && !isReducedMotion ? cuzTurnStyle(cuzTurn) : null;

	const handleMarkPlace = () => {
		const pageNumber = pageIndex + 1;

		// Only when it marks something: pressing it on the page already marked changes nothing.
		if (bookmarkedPage !== pageNumber) {
			tapBack();
		}

		setBookmarkedPage(pageNumber);

		// Kept on screen either way; stored only once the round it belongs to is known.
		savePlace(cuzNumber, pageNumber);
	};

	const isPlaceMarked = bookmarkedPage === pageIndex + 1;

	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.safeArea, { backgroundColor: theme.colors.background, paddingBottom: tabBarOffset }]}
		>
			{/*
			 * The reader's header, **above the scroll view rather than stuck inside it.** It never
			 * scrolled anyway, and as a sticky header it was repositioned from scroll events: a page
			 * turn from a scrolled page jumps back to the top at once, and on Android the header ran a
			 * frame behind that jump — gone for a frame, the page at the top of the screen — which
			 * read as a flicker after the sajdah mark's scroll.
			 */}
			<View
				style={[
					styles.header,
					{ backgroundColor: theme.colors.readerSurface, borderBottomColor: theme.colors.readerRule }
				]}
			>
				<View style={styles.headerTopRow}>
					{/* Empty on purpose — the back control is the navigator's; the slot centres the eyebrow. */}
					<View style={styles.headerSide} />
					<View style={styles.headerCenter}>
						<EyebrowText color={theme.colors.faintText} numberOfLines={1}>
							{`${t('cuzOrdinal', { n: cuzNumber })} · ${t('qPage')} ${pageIndex + 1} / ${pageCount}`}
						</EyebrowText>
					</View>
					<View style={[styles.headerSide, styles.headerSideEnd]} />
				</View>
				{/* Keyed on the cüz, so crossing into another one remounts it and the slide plays. */}
				<Animated.View key={`title-${cuzNumber}`} style={[styles.headerBottomRow, cuzTurnAnimation]}>
					<TitleText numberOfLines={1} style={styles.suraTitle}>
						{pageSuraLabel}
					</TitleText>
					<CaptionText color={theme.colors.faintText}>{pageAyahLabel}</CaptionText>
				</Animated.View>
				{/* The frame's strip: one segment a page — read in accent, this one in ink, the rest bare. */}
				<View style={styles.strip}>
					{/*
					 * Each segment eases into its new colour as the page turns — a CSS transition on
					 * **one flat style object**, the way `CellGrid` does it; inside a style array
					 * Reanimated never sees the transition properties.
					 */}
					{Array.from({ length: pageCount }, (_, index) => (
						<Animated.View
							key={index}
							style={{
								...styles.segment,
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
			<View style={styles.viewport}>
				<ScrollView
					contentContainerStyle={styles.page}
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
							style={[styles.body, styles.imageBody, cuzTurnAnimation]}
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
						<Animated.View key={`page-${cuzNumber}`} style={[styles.body, cuzTurnAnimation]}>
							{/* Line for line as the mushaf prints it, each spread to the full measure. */}
							{page ? (
								<MushafPage
									faces={faces}
									font={textFace}
									numerals={readerSettings.readerNumerals}
									page={page}
									onLongPressVerse={setMealVerse}
									selectedVerseKey={mealVerse}
									suraName={suraName}
								/>
							) : null}
						</Animated.View>
					)}
				</ScrollView>

				{/*
				 * The sajdah mark, **fixed over the scroll view** rather than in it: scrolling leaves it
				 * where it is, and only a drag moves it. It rests where the paper's top edge sits before
				 * any scroll, and slides between there and the reading area's foot.
				 */}
				{isHusrev && viewportHeight > 0 ? (
					<View
						pointerEvents='box-none'
						style={[styles.secdeTrack, { height: secdeTrackHeight, top: IMAGE_BODY_TOP }]}
					>
						<SecdeOrnament
							blockHeight={secdeTrackHeight}
							onPress={handleSecdePress}
							secdePage={imageSecde ? imagePage : undefined}
						/>
					</View>
				) : null}
			</View>

			<View style={[styles.footer, { borderTopColor: theme.colors.readerRule }]}>
				<AppButton
					accessibilityLabel={t('previousPage')}
					disabled={isFirstPage && previousHeldCuz === undefined}
					fullWidth={false}
					icon='chevronLeft'
					onPress={handlePrevious}
					variant='surface'
				/>
				{/* Marking the place, and saying so once it is marked — one control, two readings,
				    so the row never twitches under the thumb. */}
				{isCuzEnd ? (
					<AppButton
						disabled={isCuzMarked || isMarkingCuz}
						icon='check'
						onPress={assignmentId !== undefined ? markPlanCuz : markGroupCuz}
						style={styles.markButtonSlot}
						title={t(isCuzMarked ? 'qCuzDone' : 'markRead')}
						variant={isCuzMarked ? 'surface' : 'primary'}
					/>
				) : (
					<AppButton
						disabled={isPlaceMarked}
						// The set's own bookmark, converted to an SF Symbol (`kaldigin-yer-bookmark`) so the
						// glass button can draw it on iOS, and drawn by `ui/Icon` on Android — one glyph on both.
						icon={isPlaceMarked ? 'check' : 'bookmark'}
						onPress={handleMarkPlace}
						style={styles.markButtonSlot}
						title={t(isPlaceMarked ? 'qPlaceMarked' : 'qMarkPlace')}
						variant={isPlaceMarked ? 'surface' : 'accent'}
					/>
				)}
				<AppButton
					accessibilityLabel={t('nextPage')}
					disabled={isLastPage && nextHeldCuz === undefined}
					fullWidth={false}
					icon='chevronRight'
					onPress={handleNext}
					variant='surface'
				/>
			</View>

			{/* The typeset page only: the Hüsrev pages are images and have no verse to press. */}
			<VerseMealSheet
				arabicFont={faces.arabicFont}
				arabicFontSize={faces.arabicFontSize}
				numerals={readerSettings.readerNumerals}
				onClose={() => setMealVerse(null)}
				verseKey={mealVerse}
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
