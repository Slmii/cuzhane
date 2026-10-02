import { useLiveHintAutoStart } from '@/components/Tour/useLiveHintAutoStart';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, EyebrowText, TitleText } from '@/components/ui/Typography/Typography.component';
import { READER_FONT_SIZE_DEFAULT } from '@/lib/content/cevsen';
import { suraNameFor } from '@/lib/content/cuz';
import {
	MUSHAF_PAGE_ASPECT,
	mushafCuzPages,
	mushafPagePath,
	mushafPageSecde,
	mushafPageSpan
} from '@/lib/content/mushaf';
import type { MushafVerse } from '@/lib/content/mushaf';
import type { MushafPlace } from '@/lib/content/mushafPlaces';
import { cuzPages } from '@/lib/content/quran';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { textFontFor } from '@/lib/types/domain';
import { tapLight } from '@/lib/utils/haptics';
import { CUZ_COUNT } from '@/lib/utils/units';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import type { LiveMark, LivePosition } from '@/lib/types/domain';
import type { TabStackParamList } from '@/navigation/types';
import type { BandRect } from '@/screens/Live/LiveBand.component';
import { LiveBar } from '@/screens/Live/LiveBar.component';
import { LiveSheet } from '@/screens/Live/LiveSheet.component';
import { useFreeReaderLive } from '@/screens/Live/useFreeReaderLive';
import { useLiveSessionState } from '@/lib/hooks/useLiveSession';
import { liveSession } from '@/lib/live/liveSession';
import { LiveBandLayer, type ScrollMetrics, useLiveBandFollow, useLiveBandLead } from '@/screens/Live/useLiveBand';
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
import { MushafPage, type MushafPageGeometry } from '@/screens/Reader/MushafPage.component';
import { husrevGrid, husrevLineAt, husrevLineSlot } from '@/screens/Reader/mushafLayout';
import { readerFaces } from '@/screens/Reader/ReaderBody.component';
import { READ_TOGETHER_BAR_OVERHANG } from '@/screens/Reader/ReaderToolbar.component';
import { SecdeOrnament } from '@/screens/Reader/SecdeOrnament.component';
import { TextSizeSheet } from '@/screens/Reader/TextSizeSheet.component';
import { textSizeSheet } from '@/screens/Reader/textSizeSheet';
import { VerseMealSheet } from '@/screens/Reader/VerseMealSheet.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
	Pressable,
	ScrollView,
	StyleSheet,
	View,
	type GestureResponderEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<TabStackParamList, 'Mushaf'>;

/** Where a picked ayah's row comes to rest: this far below the header. */
const TARGET_SCROLL_MARGIN = 24;

/* A Hüsrev band's measures (Birlikte oku v2, Q3): the page's width less 9pt a side, corners of 3. */
const HUSREV_BAND_SIDE = 9;
const HUSREV_BAND_RADIUS = 3;

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
	// The first time this phone opens a free reader, a card at "Birlikte oku" — see the hook.
	useLiveHintAutoStart('QURAN');
	/*
	 * **A follower reads the reader's edition for the session**, without saving it: a page number
	 * means the same verses only within one edition, and on Hüsrev's fixed-shape pages the reader's
	 * place lands on the same line. Font size stays the follower's own.
	 */
	/*
	 * **A live reading picks up where it is.** Opened while a Kur'an reading is on, the screen starts
	 * at the reading's cüz, page and place — and a follower in the reader's edition — rather than at
	 * the first page, which a reader's screen would otherwise send to everyone as it mounts. A place
	 * the route sends it to (search) wins.
	 */
	const isExplicitPlace =
		route.params?.cuzNumber !== undefined ||
		route.params?.page !== undefined ||
		route.params?.verseKey !== undefined;
	const [livePlace] = useState(() => {
		const place = isExplicitPlace ? null : liveSession.placeFor('QURAN');

		return place?.k === 'QURAN' ? place : null;
	});
	const liveSessionState = useLiveSessionState();
	// Kept with the session's code, so leaving it (the code goes) returns to the saved edition.
	const [liveEditionFor, setLiveEditionFor] = useState<{ code: string; edition: 'text' | 'husrev' } | null>(() => {
		const current = liveSession.getSnapshot();

		return livePlace && current?.role === 'follower' ? { code: current.code, edition: livePlace.edition } : null;
	});
	const liveEdition =
		liveEditionFor !== null && liveEditionFor.code === liveSessionState?.code ? liveEditionFor.edition : null;
	const savedFace = settingsQuery.data?.readerArabicFont ?? 'uthman';
	const readerFace =
		liveEdition === 'husrev' ? 'husrev' : liveEdition === 'text' && savedFace === 'husrev' ? 'uthman' : savedFace;
	const isHusrev = readerFace === 'husrev';
	const updateSettings = useUpdateUserSettings();
	const scrollRef = useRef<ScrollView>(null);
	// What the sajdah mark needs to scroll to its verse: where the page body starts in the
	// content, and how far the content can scroll at all.
	const layoutRef = useRef({ bodyY: 0, contentHeight: 0, textLeft: 0, textTop: 0 });
	// The scroll view's height: the sajdah mark is fixed over it.
	const [viewportHeight, setViewportHeight] = useState(0);

	// The cüz is screen state, seeded once from the route — see the doc comment.
	const [cuzNumber, setCuzNumber] = useState(() =>
		Math.min(Math.max(route.params?.cuzNumber ?? livePlace?.cuz ?? 1, 1), CUZ_COUNT)
	);
	const textPages = cuzPages(cuzNumber);
	const imagePages = mushafCuzPages(cuzNumber);
	const pageCount = isHusrev ? imagePages.length : textPages.length;
	// The page it was sent to — search opens a sura, an ayah or a page here (1-based, within the cüz).
	const [chosenPageIndex, setPageIndex] = useState(() =>
		Math.max((route.params?.page ?? livePlace?.page ?? 1) - 1, 0)
	);
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

	/*
	 * **Live reading** — see `AllBabsScreen`, which does the same for a bab. A place is the cüz,
	 * the page within it and where the top of the screen is as a share of the page. Refs, so a
	 * follower's screen moves without re-rendering the page.
	 */
	const placeRef = useRef({ cuzNumber, isHusrev, pageIndex });
	/*
	 * The reader's place waiting for its page: set when the page, the cüz or the edition changes,
	 * applied once that page has laid out (typeset) or drawn (Hüsrev) — never to the page before it.
	 */
	const pendingFractionRef = useRef<number | null>(livePlace?.f ?? null);
	// How far down the page the reader is, for a (re)joining socket to send — not always the top.
	const fractionRef = useRef(livePlace?.f ?? 0);
	/*
	 * **"Göster"** — the reader's line, as a band. The scroll view's state for the band's maths, the
	 * typeset page's verse geometry, and a number bumped when that geometry moves.
	 */
	const metricsRef = useRef<ScrollMetrics>({ content: 0, scrollY: 0, viewport: 0 });
	const pageGeometryRef = useRef<MushafPageGeometry | null>(null);
	const [layoutVersion, setLayoutVersion] = useState(0);
	// The follower's band, for the position handler above it — set once the hooks below exist.
	const bandFollowRef = useRef<{ drivesScroll: () => boolean; bringIntoView: () => boolean } | null>(null);

	const scrollToFraction = useCallback(
		(fraction: number, isAnimated = false) => {
			const { contentHeight } = layoutRef.current;

			scrollRef.current?.scrollTo({
				animated: isAnimated,
				y: Math.min(fraction * contentHeight, Math.max(0, contentHeight - viewportHeight))
			});
		},
		[viewportHeight]
	);

	// Where the new page has laid out (typeset) or drawn (Hüsrev): the reader's place, or the top.
	const landOnPage = () => {
		if (pendingFractionRef.current !== null) {
			scrollToFraction(pendingFractionRef.current);
			pendingFractionRef.current = null;
			// The reader's line, if they have one on this page, then takes over from the fraction.
			bandFollowRef.current?.bringIntoView();

			return;
		}

		scrollToTop();
	};

	useEffect(() => {
		placeRef.current = { cuzNumber, isHusrev, pageIndex };
		// A page landing on a place it was sent to starts there, not at its top — or it would send the top.
		fractionRef.current = pendingFractionRef.current ?? 0;

		/*
		 * A typeset page whose height happens to match the last one reports no size change, so the
		 * reader's place would wait for it forever; the frame after the page changes lands it too.
		 * Hüsrev waits for the image (`onShown`).
		 */
		if (isHusrev || pendingFractionRef.current === null) {
			return;
		}

		const frame = requestAnimationFrame(() => {
			if (pendingFractionRef.current !== null) {
				landOnPage();
			}
		});

		return () => cancelAnimationFrame(frame);
		// `landOnPage` reads refs and the scroll view; only the page changing should run this.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cuzNumber, isHusrev, pageIndex]);

	const handleLivePosition = useCallback(
		(pos: LivePosition) => {
			if (pos.k !== 'QURAN') {
				return;
			}

			// A follower reads in the reader's edition; the reader's own is theirs already.
			const session = liveSession.getSnapshot();

			if (session?.role === 'follower') {
				setLiveEditionFor({ code: session.code, edition: pos.edition });
			}

			const current = placeRef.current;
			const targetIndex = pos.page - 1;
			const isSamePage =
				pos.cuz === current.cuzNumber &&
				targetIndex === current.pageIndex &&
				(pos.edition === 'husrev') === current.isHusrev;

			if (isSamePage) {
				// The page is still drawing: a newer place replaces the one waiting for it.
				if (pendingFractionRef.current !== null) {
					pendingFractionRef.current = pos.f;

					return;
				}

				// While the reader's line is on their screen, the band leads, not their scroll.
				if (bandFollowRef.current?.drivesScroll()) {
					bandFollowRef.current.bringIntoView();

					return;
				}

				// Glided on the same page, as in `AllBabsScreen`; a new page still lands at once.
				scrollToFraction(pos.f, !isReducedMotion);

				return;
			}

			pendingFractionRef.current = pos.f;

			if (pos.cuz !== current.cuzNumber) {
				setCuzTurn(pos.cuz > current.cuzNumber ? 'next' : 'previous');
				setCuzNumber(pos.cuz);
			}

			setGoVerse(null);
			setPageIndex(targetIndex);
		},
		[isReducedMotion, scrollToFraction]
	);

	// Where this screen is, for a reading that has just gone live — read when asked, from refs.
	const getLivePosition = useCallback((): LivePosition => {
		const place = placeRef.current;

		return {
			cuz: place.cuzNumber,
			edition: place.isHusrev ? 'husrev' : 'text',
			f: fractionRef.current,
			k: 'QURAN',
			page: place.pageIndex + 1
		};
	}, []);

	const live = useFreeReaderLive({
		getPosition: getLivePosition,
		isExplicitPlace,
		kind: 'QURAN',
		navigation,
		onPosition: handleLivePosition,
		params: route.params
	});
	const { detach, isLeader, publish } = live;
	const isInSession = live.code !== null;

	/*
	 * A line as band pieces in the scroll content, or null when it is not on the page showing: a
	 * typeset verse from the page's own rows; a Hüsrev line from the pages' fifteen-line grid on
	 * the paper (`husrevLineSlot`), reaching 9pt in from the paper's sides with corners of 3, as
	 * the design hangs it.
	 */
	const paperWidth = Math.max(0, imageBodyWidth - IMAGE_BODY_SIDE * 2);
	// The page's own line grid — the two framed opening pages have one of their own.
	const pageGrid = imagePage === undefined ? null : husrevGrid(imagePage);
	// Memoised by the compiler, not by hand: the page's grid comes out of an array it cannot prove unchanged.
	const rectsFor = (mark: LiveMark): BandRect[] | null => {
		if (mark.k !== 'QURAN' || mark.cuz !== cuzNumber || mark.page !== pageIndex + 1) {
			return null;
		}

		if (mark.edition === 'text') {
			const rects = isHusrev ? [] : pageGeometryRef.current?.rectsFor(mark.verse) ?? [];
			const { textLeft, textTop } = layoutRef.current;

			return rects.length > 0
				? rects.map(rect => ({ ...rect, x: rect.x + textLeft, y: rect.y + textTop }))
				: null;
		}

		if (!isHusrev || pageGrid === null || paper.frameHeight <= 0) {
			return null;
		}

		const grid = pageGrid;
		const slot = husrevLineSlot(mark.line, grid);
		// The page image inside the paper; a framed opening page's lines sit in its white block.
		const frameWidth = paper.frameHeight * MUSHAF_PAGE_ASPECT;
		const frameX = IMAGE_BODY_SIDE + (paperWidth - frameWidth) / 2;
		const isFramed = grid.left > 0 || grid.right < 1;

		return [
			{
				h: slot.height * paper.frameHeight,
				r: HUSREV_BAND_RADIUS,
				w: isFramed ? (grid.right - grid.left) * frameWidth : paperWidth - HUSREV_BAND_SIDE * 2,
				x: isFramed ? frameX + grid.left * frameWidth : IMAGE_BODY_SIDE + HUSREV_BAND_SIDE,
				y: layoutRef.current.bodyY + IMAGE_BODY_TOP + paper.frameY + slot.top * paper.frameHeight
			}
		];
	};

	const scrollToY = useCallback((y: number) => scrollRef.current?.scrollTo({ animated: false, y }), []);
	const bandFollow = useLiveBandFollow({ isReducedMotion, live, metricsRef, rectsFor, scrollTo: scrollToY });
	const bandLead = useLiveBandLead({ live, metricsRef, rectsFor });

	useEffect(() => {
		// Kept while detached: "Takip et" calls the position handler before this effect could run again.
		bandFollowRef.current = live.isFollower ? bandFollow : null;
	}, [bandFollow, live.isFollower]);

	// A new page, cüz or edition leaves the reader's line behind — for them and for everyone.
	const { clear: clearMark } = bandLead;

	useEffect(() => {
		clearMark();
	}, [clearMark, cuzNumber, isHusrev, pageIndex]);

	const handlePressVerse = useCallback(
		(verse: string) => bandLead.point({ cuz: cuzNumber, edition: 'text', k: 'QURAN', page: pageIndex + 1, verse }),
		[bandLead, cuzNumber, pageIndex]
	);

	const handlePressHusrev = (event: GestureResponderEvent) => {
		if (paper.frameHeight <= 0 || pageGrid === null) {
			return;
		}

		const line = husrevLineAt((event.nativeEvent.locationY - paper.frameY) / paper.frameHeight, pageGrid);

		bandLead.point({ cuz: cuzNumber, edition: 'husrev', k: 'QURAN', line, page: pageIndex + 1 });
	};

	// The page's rows moved: redraw the band, and bring it back into a follower's view.
	const handleGeometryChange = useCallback(() => {
		setLayoutVersion(version => version + 1);
		bandFollowRef.current?.bringIntoView();
	}, []);

	const pageTopVerse = isHusrev ? imageSpan?.first : page?.verses.at(0);
	const pageTopVerseKey = pageTopVerse ? `${pageTopVerse.chapter}:${pageTopVerse.ayah}` : undefined;
	const livePlaceAt = (fraction: number): LivePosition => ({
		cuz: cuzNumber,
		edition: isHusrev ? 'husrev' : 'text',
		f: fraction,
		k: 'QURAN',
		page: pageIndex + 1,
		...(pageTopVerseKey ? { verse: pageTopVerseKey } : {})
	});

	/*
	 * The reader's side: a new page goes out at once. A (re)joining socket needs nothing from here —
	 * the session sends the reader's place itself, and only when the server's differs.
	 */
	useEffect(() => {
		if (isLeader) {
			publish(livePlaceAt(fractionRef.current), { isImmediate: true });
		}
		// `livePlaceAt` is rebuilt every render from the values listed.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cuzNumber, pageIndex, isHusrev, isLeader, publish]);

	const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		metricsRef.current.scrollY = event.nativeEvent.contentOffset.y;
		bandLead.onScroll();
		bandFollow.onScroll();

		const { contentHeight } = layoutRef.current;
		const fraction =
			contentHeight > 0 ? Math.min(1, Math.max(0, event.nativeEvent.contentOffset.y / contentHeight)) : 0;

		fractionRef.current = Math.round(fraction * 1000) / 1000;

		if (isLeader) {
			publish(livePlaceAt(fractionRef.current));
		}
	};

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
		detach();
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
		detach();
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
		detach();
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
					{/* Padded by the bar's overhang: the eyebrow centres between the back button and the capsule. */}
					<View
						style={[
							cuzReaderStyles.headerSide,
							cuzReaderStyles.headerSideEnd,
							{ paddingLeft: READ_TOGETHER_BAR_OVERHANG }
						]}
					/>
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
			<LiveBar
				followDirection={bandFollow.direction}
				live={live}
				onOpenSheet={() => navigation.setParams({ shouldOpenLive: true })}
			/>
			{/* D4: why a follower's Mushaf may look different — it is the reader's edition, for the session. */}
			{live.isFollower ? (
				<View style={[styles.liveNote, { borderBottomColor: theme.colors.divider }]}>
					<Icon color={toAlphaColor(theme.colors.text, 0.6)} name='info' size={14} />
					<CaptionText color={toAlphaColor(theme.colors.text, 0.6)} style={styles.liveNoteText}>
						{t('liveMushafNote')}
					</CaptionText>
				</View>
			) : null}
			<View style={cuzReaderStyles.viewport}>
				<ScrollView
					contentContainerStyle={cuzReaderStyles.page}
					onContentSizeChange={(_width, height) => {
						layoutRef.current.contentHeight = height;
						metricsRef.current.content = height;

						// A follower's typeset page lands on the reader's place once it has a height.
						if (!isHusrev && pendingFractionRef.current !== null) {
							landOnPage();
						}
					}}
					onLayout={event => {
						setViewportHeight(event.nativeEvent.layout.height);
						metricsRef.current.viewport = event.nativeEvent.layout.height;
					}}
					onScroll={handleScroll}
					onScrollBeginDrag={() => {
						detach();
						bandFollow.onDragStart();
					}}
					ref={scrollRef}
					scrollEventThrottle={64}
					showsVerticalScrollIndicator={false}
				>
					{/* The reader's line behind a typeset page's words — drawn first, so it is behind them. */}
					{isInSession && !isHusrev ? (
						<LiveBandLayer
							layoutVersion={layoutVersion}
							rectsFor={rectsFor}
							store={live.markStore}
							tone={isLeader ? 'own' : 'follower'}
						/>
					) : null}
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
								// The reader points at a line by tapping it; nobody else's page takes a tap.
								<Pressable disabled={!(isInSession && isLeader)} onPress={handlePressHusrev}>
									<MushafImagePage
										accessibilityLabel={`${t('qPage')} ${pageIndex + 1} / ${pageCount}`}
										nextPath={
											nextImagePage === undefined ? undefined : mushafPagePath(nextImagePage)
										}
										onShown={landOnPage}
										path={mushafPagePath(imagePage)}
									/>
								</Pressable>
							)}
						</Animated.View>
					) : (
						<Animated.View key={`page-${cuzNumber}`} style={[cuzReaderStyles.body, cuzTurnAnimation]}>
							{page ? (
								// Where the page starts in the scroll content, for the scroll to a picked ayah.
								<View
									onLayout={event => {
										layoutRef.current.textTop = event.nativeEvent.layout.y;
										layoutRef.current.textLeft = event.nativeEvent.layout.x;
									}}
								>
									<MushafPage
										faces={faces}
										{...(isInSession
											? { geometryRef: pageGeometryRef, onGeometryChange: handleGeometryChange }
											: {})}
										{...(isInSession && isLeader ? { onPressVerse: handlePressVerse } : {})}
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
					{/* On a Hüsrev page the band lies over the picture and multiplies into it: the ink stays black. */}
					{isInSession && isHusrev ? (
						<LiveBandLayer
							isOverImage
							layoutVersion={layoutVersion}
							rectsFor={rectsFor}
							store={live.markStore}
							tone={isLeader ? 'own' : 'follower'}
						/>
					) : null}
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

			<LiveSheet live={live} />

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
	liveNote: {
		alignItems: 'flex-start',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 18,
		paddingVertical: 9
	},
	liveNoteText: {
		flex: 1,
		fontSize: 11.5,
		lineHeight: 17
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
	navButtonSlot: {
		flex: 1
	},
	note: {
		fontSize: 10.5,
		lineHeight: 17,
		textAlign: 'center'
	}
});
