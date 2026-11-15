import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { SymbolIcon } from '@/components/ui/Icon/SymbolIcon.component';
import { SearchBox } from '@/components/ui/SearchBox/SearchBox.component';
import { SearchInput } from '@/components/ui/SearchInput/SearchInput.component';
import {
	isSegmentedControlNative,
	SegmentedControl
} from '@/components/ui/SegmentedControl/SegmentedControl.component';
import { CaptionText, FieldLabelText, Typography } from '@/components/ui/Typography/Typography.component';
import { suraNameFor } from '@/lib/content/cuz';
import {
	cuzSections,
	firstVerseAt,
	matchSuras,
	pageNumberAt,
	pageTotalFor,
	parseGoQuery,
	placeOfPage,
	placeOfVerse,
	type SuraEntry,
	suraEntries
} from '@/lib/content/mushafPlaces';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { CuzPagination } from '@/lib/utils/cuzPagesRead';
import { CUZ_COUNT } from '@/lib/utils/units';
import { SliderTrack } from '@/screens/Reader/ReaderSizeSlider.component';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	FlatList,
	type ListRenderItemInfo,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	useWindowDimensions,
	View
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import type { GoHandler, MushafGoSheetProps } from './MushafGoSheet.types';

/** Tall enough for the page keypad; one height for all three tabs, so the sheet never resizes. */
const SHEET_HEIGHT_RATIO = 0.86;
const AYAH_COLUMNS = 9;
const CUZ_COLUMNS = 5;
const CUZ_GAP = 6;
/** The frame's 34pt square and 17pt glyph. */
const GO_BUTTON_SIZE = 34;
const GO_GLYPH_SIZE = 17;

type Tab = 'sura' | 'cuz' | 'page';
const isTab = (value: string): value is Tab => value === 'sura' || value === 'cuz' || value === 'page';

/**
 * Q5n / Q5j / Q5p — the Kur'an reader's "Git": to a sura and one of its ayahs, to a cüz and one
 * of its sections, or to a page by number. The free Mushaf's only — opened from `MushafGoButton` in
 * its header; the group reader stays on your share.
 *
 * **Counted in the reader's own pagination.** With the typeset text on, a page is the printed
 * Madinah one; with Hüsrev's pages on, it is that edition's — so "s. 428" in here is always the
 * page the reader will show.
 *
 * The body is a child of the sheet, which mounts it only while open, so every opening starts
 * from where the reader is rather than from wherever the last visit left the tabs.
 */
export const MushafGoSheet = ({ isVisible, onClose, ...body }: MushafGoSheetProps) => (
	<AppBottomSheet heightRatio={SHEET_HEIGHT_RATIO} isVisible={isVisible} onClose={onClose}>
		<GoBody {...body} />
	</AppBottomSheet>
);

/**
 * Q5's "Git" control: the square to the right of the sura's name in the free Mushaf's header. Its
 * glyph is the set's own `git-go-to`, a custom SF Symbol on iOS and `ui/Icon`'s drawing elsewhere.
 * A flat control, as the frame draws it — the header is not glass.
 */
export const MushafGoButton = ({ onPress }: { onPress: () => void }) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<Pressable
			accessibilityHint={t('goOpenHint')}
			accessibilityLabel={t('goTitle')}
			accessibilityRole='button'
			hitSlop={5}
			onPress={onPress}
			style={({ pressed }) => [
				styles.goButton,
				{
					backgroundColor: theme.colors.surface,
					borderColor: theme.colors.borderStrong,
					opacity: pressed ? 0.6 : 1
				}
			]}
		>
			{/* Not a touch target of its own: the SwiftUI host would take the tap from the button. */}
			<View pointerEvents='none'>
				<SymbolIcon
					assetName='git-go-to'
					color={theme.colors.text}
					icon='goTo'
					size={GO_GLYPH_SIZE}
					strokeWidth={1.8}
					weight='medium'
				/>
			</View>
		</Pressable>
	);
};

type GoBodyProps = Omit<MushafGoSheetProps, 'isVisible' | 'onClose'>;

const GoBody = ({ cuzNumber, currentVerse, onGo, pageIndex, pagination }: GoBodyProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const [tab, setTab] = useState<Tab>('sura');
	/*
	 * **A tab, once opened, stays mounted and is only hidden.** Remounting on every switch drew
	 * each tab from nothing — the cüz grid a frame empty, the sura list at its top and then at your
	 * sura — which read as a flicker, and lost the search and the chosen cüz on the way back.
	 */
	const [visited, setVisited] = useState<ReadonlySet<Tab>>(() => new Set(['sura']));
	const current = currentVerse ?? firstVerseAt(cuzNumber, pageIndex, pagination);
	const currentPage = pageNumberAt(cuzNumber, pageIndex, pagination);
	/*
	 * One identity for the sheet's lifetime, whatever the reader does behind it: the rows are
	 * memoised, and a new `onGo` from a re-rendered reader would redraw every one of them.
	 */
	const onGoRef = useRef(onGo);
	useEffect(() => {
		onGoRef.current = onGo;
	}, [onGo]);
	const go = useCallback<GoHandler>((place, verse) => onGoRef.current(place, verse), []);

	return (
		<View style={styles.fill}>
			<View style={styles.head}>
				<View style={styles.titleRow}>
					<Typography style={styles.title} variant='header3' weight='regular'>
						{t('goTitle')}
					</Typography>
					{current && currentPage !== undefined ? (
						<CaptionText color={theme.colors.faintText}>
							{t('goNow', { page: currentPage, verse: `${current.chapter}:${current.ayah}` })}
						</CaptionText>
					) : null}
				</View>
				<SegmentedControl
					onChange={value => {
						if (isTab(value)) {
							setTab(value);
							setVisited(previous => (previous.has(value) ? previous : new Set([...previous, value])));
						}
					}}
					options={[
						{ label: t('goTabSura'), value: 'sura' },
						{ label: t('goTabCuz'), value: 'cuz' },
						{ label: t('goTabPage'), value: 'page' }
					]}
					// Only the native control needs telling — see Profil's appearance row.
					{...(isSegmentedControlNative ? { style: styles.fullWidth } : {})}
					value={tab}
				/>
			</View>
			<View style={tab === 'sura' ? styles.fill : styles.hidden}>
				<SuraTab
					currentChapter={current?.chapter}
					currentAyah={current?.ayah}
					onGo={go}
					pagination={pagination}
				/>
			</View>
			{visited.has('cuz') ? (
				<View style={tab === 'cuz' ? styles.fill : styles.hidden}>
					<CuzTab currentCuz={cuzNumber} onGo={go} pagination={pagination} />
				</View>
			) : null}
			{visited.has('page') ? (
				<View style={tab === 'page' ? styles.fill : styles.hidden}>
					<PageTab
						currentPage={currentPage ?? 1}
						isActive={tab === 'page'}
						onGo={go}
						pagination={pagination}
					/>
				</View>
			) : null}
		</View>
	);
};

/*
 * **Every row's height is known before it is drawn**, which is what lets the list be virtualised
 * (`getItemLayout`) and still open scrolled to the sura you are in: only the dozen rows around it
 * are mounted, where drawing all 114 took most of a second on Android. The heights follow the
 * system text size, since the text in them does.
 */
const ROW_PADDING_Y = 11;
const BADGE_SIZE = 28;
const TITLE_LINE = 19;
const SUB_LINE = 14;
const TITLE_SUB_GAP = 2;
const AYAH_TOP = 2;
const AYAH_HEAD_LINE = 17;
const AYAH_HEAD_GAP = 9;
const AYAH_BOTTOM = 13;
const AYAH_GAP = 4;
const AYAH_CELL_MIN = 30;

type RowMetrics = { head: number; ayahHead: number; cell: number };

const rowMetrics = (fontScale: number): RowMetrics => ({
	ayahHead: Math.ceil(AYAH_HEAD_LINE * fontScale),
	cell: Math.max(AYAH_CELL_MIN, Math.ceil(15 * fontScale) + 8),
	head: ROW_PADDING_Y * 2 + Math.max(BADGE_SIZE, Math.ceil((TITLE_LINE + SUB_LINE) * fontScale) + TITLE_SUB_GAP)
});

const ayahRows = (count: number) => Math.ceil(count / AYAH_COLUMNS);

/** How far down its open panel an ayah's row of cells sits. */
const ayahOffset = (metrics: RowMetrics, ayah: number) =>
	AYAH_TOP + metrics.ayahHead + AYAH_HEAD_GAP + Math.floor((ayah - 1) / AYAH_COLUMNS) * (metrics.cell + AYAH_GAP);

const panelHeight = (metrics: RowMetrics, count: number) => {
	const rows = ayahRows(count);

	return AYAH_TOP + metrics.ayahHead + AYAH_HEAD_GAP + rows * metrics.cell + (rows - 1) * AYAH_GAP + AYAH_BOTTOM;
};

/**
 * The hairline under every row of the one card the list sits in. The last row keeps its line too,
 * drawn clear, so every row is the same sum and `getItemLayout` stays exact.
 */
const DIVIDER = StyleSheet.hairlineWidth;

/** A row's whole length in the list: its head, its ayahs when open, and the line under it. */
const rowLength = (metrics: RowMetrics, entry: SuraEntry, isOpen: boolean) =>
	metrics.head + (isOpen ? panelHeight(metrics, entry.ayahCount) : 0) + DIVIDER;

/** How long a sura's ayahs take to open or close. */
const PANEL_TRANSITION_MS = 220;
/** An ayah cell's one screen-reader action: going there. */
const ACTIVATE = [{ name: 'activate' as const }];

type SuraTabProps = {
	currentChapter: number | undefined;
	currentAyah: number | undefined;
	pagination: CuzPagination;
	onGo: GoHandler;
};

/** Q5n: the search box over the 114, the current one opened on its ayahs. */
const SuraTab = ({ currentAyah, currentChapter, onGo, pagination }: SuraTabProps) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const { fontScale } = useWindowDimensions();
	const [query, setQuery] = useState('');
	const [openChapter, setOpenChapter] = useState(currentChapter);
	const listRef = useRef<FlatList<SuraEntry>>(null);
	const hasPlacedRef = useRef(false);
	const parsed = parseGoQuery(query);
	const metrics = useMemo(() => rowMetrics(fontScale), [fontScale]);

	const allEntries = suraEntries(language, pagination);
	const entries = useMemo(
		() =>
			parsed.kind === 'name'
				? matchSuras(parsed.text, language, pagination)
				: parsed.kind === 'none'
				? allEntries
				: [],
		// `parsed` is rebuilt every render; what it depends on is the query.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[allEntries, language, pagination, query]
	);

	// Each row's offset, for `getItemLayout` — rebuilt when the list or the open row changes.
	const offsets = useMemo(() => {
		const result: number[] = [];
		let offset = 0;

		for (const entry of entries) {
			result.push(offset);
			offset += rowLength(metrics, entry, entry.chapter === openChapter);
		}

		result.push(offset);

		return result;
	}, [entries, metrics, openChapter]);

	const getItemLayout = useCallback(
		(_data: ArrayLike<SuraEntry> | null | undefined, index: number) => ({
			index,
			length: (offsets[index + 1] ?? 0) - (offsets[index] ?? 0),
			offset: offsets[index] ?? 0
		}),
		[offsets]
	);

	const toggle = useCallback(
		(chapter: number) => setOpenChapter(open => (open === chapter ? undefined : chapter)),
		[]
	);
	const initialIndex = Math.max(
		0,
		allEntries.findIndex(entry => entry.chapter === currentChapter)
	);

	/*
	 * Opening scrolled to the sura is `initialScrollIndex`'s job; this brings its current ayah into
	 * view as well, for a sura longer than the sheet — Bakara's 286 run to thirty-two rows of cells.
	 */
	const placeCurrent = (viewport: number) => {
		if (hasPlacedRef.current || currentChapter === undefined || currentAyah === undefined) {
			return;
		}

		hasPlacedRef.current = true;

		const within = metrics.head + ayahOffset(metrics, currentAyah) - viewport * 0.4;

		if (within > 0) {
			listRef.current?.scrollToOffset({ animated: false, offset: (offsets[initialIndex] ?? 0) + within });
		}
	};

	const lastIndex = entries.length - 1;
	const renderItem = useCallback(
		({ index, item }: ListRenderItemInfo<SuraEntry>) => (
			<SuraRow
				currentAyah={item.chapter === currentChapter ? currentAyah : undefined}
				entry={item}
				isLast={index === lastIndex}
				isOpen={item.chapter === openChapter}
				metrics={metrics}
				onGo={onGo}
				onToggle={toggle}
				pagination={pagination}
			/>
		),
		[currentAyah, currentChapter, lastIndex, metrics, onGo, openChapter, pagination, toggle]
	);

	const verseResult = parsed.kind === 'verse' ? placeOfVerse(parsed.verse, pagination) : undefined;
	const pageResult = parsed.kind === 'page' ? placeOfPage(parsed.pageNumber, pagination) : undefined;
	const pageResultVerse = pageResult && firstVerseAt(pageResult.cuzNumber, pageResult.pageIndex, pagination);

	// What the box found when it was given an ayah or a page — or that it found nothing.
	const results =
		parsed.kind === 'verse' && verseResult ? (
			<ResultRow
				badge={parsed.verse.chapter}
				detail={t('goPageShort', { n: verseResult.pageNumber })}
				onPress={() => onGo(verseResult, parsed.verse)}
				title={`${suraNameFor(parsed.verse.chapter, language)} ${parsed.verse.ayah}`}
			/>
		) : parsed.kind === 'page' && pageResult ? (
			<ResultRow
				detail={
					pageResultVerse ? `${suraNameFor(pageResultVerse.chapter, language)} ${pageResultVerse.ayah}` : ''
				}
				onPress={() => onGo(pageResult)}
				title={`${t('qPage')} ${pageResult.pageNumber}`}
			/>
		) : (
			<CaptionText color={theme.colors.faintText} style={styles.empty}>
				{t('searchEmptyTitle')}
			</CaptionText>
		);

	return (
		<>
			{/* iOS: the glass pill every search box there is; Android keeps the frame's flat box. */}
			{Platform.OS === 'ios' ? (
				<SearchBox
					onChangeText={setQuery}
					onClear={() => setQuery('')}
					placeholder={t('goSearchHint')}
					submitLabel='go'
					value={query}
				/>
			) : (
				<View
					style={[
						styles.searchBox,
						{ backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }
					]}
				>
					<Icon color={theme.colors.subtext} name='search' size={15} strokeWidth={1.9} />
					<SearchInput
						fontSize={13}
						onChangeText={setQuery}
						placeholder={t('goSearchHint')}
						style={styles.searchInput}
						submitLabel='go'
						value={query}
					/>
				</View>
			)}
			{/* One card round the whole list; the rows scroll inside it. */}
			<CardSurface isFlush style={styles.suraCard}>
				<FlatList
					data={entries}
					getItemLayout={getItemLayout}
					initialNumToRender={10}
					initialScrollIndex={parsed.kind === 'none' ? initialIndex : undefined}
					keyboardDismissMode='on-drag'
					keyboardShouldPersistTaps='handled'
					keyExtractor={entry => String(entry.chapter)}
					ListEmptyComponent={results}
					maxToRenderPerBatch={8}
					onLayout={event => placeCurrent(event.nativeEvent.layout.height)}
					ref={listRef}
					renderItem={renderItem}
					showsVerticalScrollIndicator={false}
					style={styles.fill}
					windowSize={7}
				/>
			</CardSurface>
		</>
	);
};

type ResultRowProps = { badge?: number; title: string; detail: string; onPress: () => void };

/**
 * What the search box found when it was given an ayah or a page: one row, straight there. A row of
 * the list's own card, in the accent, rather than a card inside it.
 */
const ResultRow = ({ badge, detail, onPress, title }: ResultRowProps) => {
	const { theme } = useThemeContext();

	return (
		<Pressable accessibilityRole='button' onPress={onPress} style={styles.rowHead}>
			{badge === undefined ? null : (
				<View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
					<Typography color={theme.colors.onAccent} style={styles.badgeLabel} weight='semibold'>
						{badge}
					</Typography>
				</View>
			)}
			<Typography style={[styles.rowTitle, styles.rowText]} variant='title'>
				{title}
			</Typography>
			<CaptionText color={theme.colors.accent} style={styles.rowDetail}>
				{detail}
			</CaptionText>
			<Icon color={theme.colors.accent} name='chevronRight' size={14} strokeWidth={2} />
		</Pressable>
	);
};

type SuraRowProps = {
	entry: SuraEntry;
	isOpen: boolean;
	/** Its line drawn clear: the card's own edge closes the list. */
	isLast: boolean;
	currentAyah: number | undefined;
	metrics: RowMetrics;
	pagination: CuzPagination;
	onToggle: (chapter: number) => void;
	onGo: GoHandler;
};

/** One sura: its number, name, length and cüz, and the page it opens on — its ayahs when open. */
const SuraRow = memo(function SuraRow({
	currentAyah,
	entry,
	isLast,
	isOpen,
	metrics,
	onGo,
	onToggle,
	pagination
}: SuraRowProps) {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	// Set during render, as `AppBottomSheet` mounts itself, so the grid is there on the opening frame.
	const [hasOpened, setHasOpened] = useState(isOpen);

	if (isOpen && !hasOpened) {
		setHasOpened(true);
	}
	const cuzLabel =
		entry.cuzFirst === entry.cuzLast
			? t('goCuzOne', { n: entry.cuzFirst })
			: t('goCuzSpan', { a: entry.cuzFirst, b: entry.cuzLast });

	return (
		<View
			style={[
				styles.suraRow,
				{ borderBottomColor: isLast ? 'transparent' : theme.colors.divider, borderBottomWidth: DIVIDER }
			]}
		>
			<Pressable
				accessibilityRole='button'
				accessibilityState={{ expanded: isOpen }}
				onPress={() => onToggle(entry.chapter)}
				style={[styles.rowHead, { height: metrics.head }]}
			>
				<View
					style={[
						styles.badge,
						{ backgroundColor: isOpen ? theme.colors.accent : theme.colors.segmentTrack }
					]}
				>
					<Typography
						color={isOpen ? theme.colors.onAccent : theme.colors.subtext}
						style={styles.badgeLabel}
						weight='semibold'
					>
						{entry.chapter}
					</Typography>
				</View>
				<View style={styles.rowText}>
					<Typography numberOfLines={1} style={styles.rowTitle} variant='title'>
						{entry.name}
					</Typography>
					<CaptionText color={theme.colors.faintText} numberOfLines={1} style={styles.rowSub}>
						{`${t('goAyahCount', { n: entry.ayahCount })} · ${cuzLabel}`}
					</CaptionText>
				</View>
				<CaptionText color={theme.colors.faintText} style={styles.rowDetail}>
					{t('goPageShort', { n: entry.startPage })}
				</CaptionText>
			</Pressable>
			{/*
			 * The ayahs open and close by height — known exactly (`panelHeight`), so nothing is
			 * measured and the list's own sums stay true. Mounted from the first opening on, so a
			 * close has something to fold away.
			 */}
			{hasOpened ? (
				<Animated.View
					style={{
						height: isOpen ? panelHeight(metrics, entry.ayahCount) : 0,
						opacity: isOpen ? 1 : 0,
						overflow: 'hidden',
						transitionDuration: isReducedMotion ? 0 : PANEL_TRANSITION_MS,
						transitionProperty: ['height', 'opacity'],
						transitionTimingFunction: 'ease-in-out'
					}}
				>
					<AyahGrid
						chapter={entry.chapter}
						count={entry.ayahCount}
						currentAyah={currentAyah}
						metrics={metrics}
						onGo={onGo}
						pagination={pagination}
					/>
				</Animated.View>
			) : null}
		</View>
	);
});

type AyahGridProps = {
	chapter: number;
	count: number;
	currentAyah: number | undefined;
	metrics: RowMetrics;
	pagination: CuzPagination;
	onGo: GoHandler;
};

/**
 * "Ayete git": one cell an ayah, the one you are on in ink.
 *
 * **One touch target a row, not a cell.** Bakara is 286 cells, and a `Pressable` each was most of
 * what opening on it cost; a row of nine takes the tap and works out the cell from where it
 * landed. Each cell is still its own labelled element, so a screen reader reads and activates
 * them one by one — activating one taps its centre, which the row resolves the same way.
 */
const AyahGrid = memo(function AyahGrid({ chapter, count, currentAyah, metrics, onGo, pagination }: AyahGridProps) {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const [rowWidth, setRowWidth] = useState(0);

	const goToAyah = (ayah: number) => {
		const place = ayah <= count ? placeOfVerse({ ayah, chapter }, pagination) : undefined;

		if (place) {
			onGo(place, { ayah, chapter });
		}
	};

	const pressRow = (firstAyah: number, locationX: number) => {
		if (rowWidth > 0) {
			goToAyah(
				firstAyah + Math.min(AYAH_COLUMNS - 1, Math.max(0, Math.floor(locationX / (rowWidth / AYAH_COLUMNS))))
			);
		}
	};

	return (
		<View style={styles.ayahs}>
			<View style={[styles.ayahsHead, { height: metrics.ayahHead }]}>
				<FieldLabelText color={theme.colors.subtext}>{t('goToAyah')}</FieldLabelText>
			</View>
			<View style={styles.ayahRows}>
				{Array.from({ length: ayahRows(count) }, (_, row) => {
					const firstAyah = row * AYAH_COLUMNS + 1;

					return (
						<Pressable
							// Not an element of its own: a screen reader would stop at the row and never
							// reach its ayahs, which carry their own label and activation below.
							accessible={false}
							key={row}
							onLayout={row === 0 ? event => setRowWidth(event.nativeEvent.layout.width) : undefined}
							onPress={event => pressRow(firstAyah, event.nativeEvent.locationX)}
							style={[styles.ayahRow, { height: metrics.cell }]}
						>
							{Array.from({ length: AYAH_COLUMNS }, (_, column) => {
								const ayah = firstAyah + column;

								if (ayah > count) {
									return <View key={column} pointerEvents='none' style={styles.ayahCell} />;
								}

								const isCurrent = ayah === currentAyah;

								return (
									<View
										accessibilityActions={ACTIVATE}
										accessibilityLabel={`${t('qAyah')} ${ayah}`}
										accessibilityRole='button'
										accessible
										key={column}
										onAccessibilityAction={() => goToAyah(ayah)}
										// The row takes the touch, so `locationX` is measured from the row, not
										// from the cell the finger landed on — which put every tap in column one.
										pointerEvents='none'
										style={[
											styles.ayahCell,
											styles.ayahCellFace,
											{
												backgroundColor: isCurrent ? theme.colors.accent : theme.colors.surface,
												borderColor: isCurrent ? 'transparent' : theme.colors.border
											}
										]}
									>
										<Typography
											color={isCurrent ? theme.colors.onAccent : theme.colors.subtext}
											style={styles.ayahLabel}
											weight={isCurrent ? 'bold' : 'medium'}
										>
											{ayah}
										</Typography>
									</View>
								);
							})}
						</Pressable>
					);
				})}
			</View>
		</View>
	);
});

type CuzTabProps = { currentCuz: number; pagination: CuzPagination; onGo: GoHandler };

/** Q5j: the thirty, each with the page it opens on, and the chosen one's sections under them. */
const CuzTab = ({ currentCuz, onGo, pagination }: CuzTabProps) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const [chosen, setChosen] = useState(currentCuz);
	const sections = cuzSections(chosen, pagination);

	return (
		<ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} style={styles.fill}>
			{/* Rows of five squares that size themselves — nothing is measured, so nothing is late. */}
			<CardSurface style={styles.cuzGrid}>
				{Array.from({ length: CUZ_COUNT / CUZ_COLUMNS }, (_, row) => (
					<View key={row} style={styles.cuzRow}>
						{Array.from({ length: CUZ_COLUMNS }, (_, column) => {
							const number = row * CUZ_COLUMNS + column + 1;
							const isChosen = number === chosen;

							return (
								<Pressable
									accessibilityLabel={t('goCuzOne', { n: number })}
									accessibilityRole='button'
									accessibilityState={{ selected: isChosen }}
									key={number}
									onPress={() => setChosen(number)}
									style={[
										styles.cuzCell,
										{
											backgroundColor: isChosen ? theme.colors.accent : theme.colors.surface,
											borderColor: isChosen ? 'transparent' : theme.colors.border
										}
									]}
								>
									<Typography
										color={isChosen ? theme.colors.onAccent : theme.colors.text}
										style={styles.cuzNumber}
										variant='title'
									>
										{number}
									</Typography>
									<Typography
										color={isChosen ? theme.colors.onAccent : theme.colors.faintText}
										style={styles.cuzPage}
									>
										{t('goPageShort', { n: pageNumberAt(number, 0, pagination) ?? '' })}
									</Typography>
								</Pressable>
							);
						})}
					</View>
				))}
			</CardSurface>
			<FieldLabelText color={theme.colors.subtext} style={styles.sectionsLabel}>
				{t('goCuzSections', { n: chosen })}
			</FieldLabelText>
			{/* The chosen cüz's sections: one card, a line between rows. */}
			<CardSurface isFlush>
				{sections.map((section, index) => (
					<Pressable
						accessibilityRole='button'
						key={`${section.verse.chapter}:${section.verse.ayah}`}
						onPress={() => onGo(section.place, section.verse)}
						style={[
							styles.rowHead,
							index > 0
								? { borderTopColor: theme.colors.divider, borderTopWidth: StyleSheet.hairlineWidth }
								: null
						]}
					>
						<Typography style={[styles.rowTitle, styles.rowText]} variant='title'>
							{`${suraNameFor(section.verse.chapter, language)} ${section.verse.ayah}`}
						</Typography>
						<CaptionText color={theme.colors.faintText}>
							{t(section.isCuzStart ? 'goCuzStart' : 'goSuraStart')}
						</CaptionText>
						<Typography color={theme.colors.accent} style={styles.sectionPage} weight='semibold'>
							{t('goPageShort', { n: section.place.pageNumber })}
						</Typography>
					</Pressable>
				))}
			</CardSurface>
		</ScrollView>
	);
};

/** The slider's own commit, which the page tab has no use for — see its `onDraft`. */
const ignoreCommit = () => undefined;

type PageTabProps = { currentPage: number; isActive: boolean; pagination: CuzPagination; onGo: GoHandler };

/**
 * Q5p: a page by number — typed on the phone's own number pad, or dragged to on the slider.
 *
 * **The number is the field.** It takes focus as the tab shows and selects itself, so the first
 * digit replaces the page you are on rather than extending it — "4" would otherwise make 4284.
 * A digit that would run past the last page is refused, and the keyboard's own key goes there.
 */
const PageTab = ({ currentPage, isActive, onGo, pagination }: PageTabProps) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const total = pageTotalFor(pagination);
	const [digits, setDigits] = useState(String(currentPage));
	const pageNumber = Number(digits);
	const place = digits === '' ? undefined : placeOfPage(pageNumber, pagination);
	const verse = place && firstVerseAt(place.cuzNumber, place.pageIndex, pagination);
	const inputRef = useRef<TextInput>(null);

	// The number pad comes up with the tab and goes with it, the tab staying mounted either way.
	useEffect(() => {
		if (isActive) {
			inputRef.current?.focus();
		} else {
			inputRef.current?.blur();
		}
	}, [isActive]);

	const handleChange = (text: string) => {
		const next = text.replace(/\D/g, '');

		if (next !== '' && (Number(next) === 0 || Number(next) > total)) {
			return;
		}

		setDigits(next);
	};

	const go = () => {
		if (place) {
			onGo(place);
		}
	};

	return (
		<ScrollView
			contentContainerStyle={styles.list}
			keyboardShouldPersistTaps='handled'
			showsVerticalScrollIndicator={false}
			style={styles.fill}
		>
			<View style={styles.pageReadout}>
				<View style={styles.pageNumberRow}>
					<TextInput
						accessibilityLabel={t('qPage')}
						keyboardType='number-pad'
						maxLength={String(total).length}
						onChangeText={handleChange}
						onSubmitEditing={go}
						ref={inputRef}
						returnKeyType='go'
						selectTextOnFocus
						style={[
							styles.pageNumber,
							{
								borderBottomColor: theme.colors.accent,
								color: theme.colors.text,
								fontFamily: appFonts.headingRegular
							}
						]}
						value={digits}
					/>
					<CaptionText color={theme.colors.faintText} style={styles.pageTotal}>
						{`/ ${total}`}
					</CaptionText>
				</View>
				<CaptionText color={theme.colors.accent} style={styles.pagePlace}>
					{place && verse
						? `${suraNameFor(verse.chapter, language)} ${verse.ayah} · ${t('goCuzOne', {
								n: place.cuzNumber
						  })}`
						: ' '}
				</CaptionText>
			</View>
			<View style={styles.sliderRow}>
				<CaptionText color={theme.colors.faintText}>1</CaptionText>
				<View style={styles.fill}>
					<SliderTrack
						max={total}
						min={1}
						// Only the live value: the native slider commits 400 ms late, which could land
						// after typing and put back the page the field had just replaced.
						onChange={ignoreCommit}
						onDraft={value => setDigits(String(value))}
						value={Math.min(Math.max(pageNumber || 1, 1), total)}
					/>
				</View>
				<CaptionText color={theme.colors.faintText}>{total}</CaptionText>
			</View>
			<AppButton
				disabled={!place}
				onPress={go}
				title={t('goPageButton', { n: digits || '–' })}
				variant='primary'
			/>
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	ayahCell: {
		flex: 1
	},
	ayahCellFace: {
		alignItems: 'center',
		borderRadius: 8,
		borderWidth: 1,
		justifyContent: 'center'
	},
	ayahLabel: {
		fontSize: 11,
		lineHeight: 15
	},
	ayahRow: {
		flexDirection: 'row',
		gap: AYAH_GAP
	},
	ayahRows: {
		gap: AYAH_GAP
	},
	ayahs: {
		gap: AYAH_HEAD_GAP,
		paddingBottom: AYAH_BOTTOM,
		paddingHorizontal: 13,
		paddingTop: AYAH_TOP
	},
	ayahsHead: {
		alignItems: 'center',
		flexDirection: 'row'
	},
	badge: {
		alignItems: 'center',
		borderRadius: 8,
		height: 28,
		justifyContent: 'center',
		width: 28
	},
	badgeLabel: {
		fontSize: 11,
		lineHeight: 14
	},
	cuzCell: {
		alignItems: 'center',
		aspectRatio: 1,
		flex: 1,
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth,
		gap: 2,
		justifyContent: 'center'
	},
	cuzGrid: {
		gap: CUZ_GAP
	},
	cuzRow: {
		flexDirection: 'row',
		gap: CUZ_GAP
	},
	cuzNumber: {
		fontSize: 17,
		lineHeight: 21
	},
	cuzPage: {
		fontSize: 9,
		lineHeight: 12
	},
	empty: {
		paddingVertical: 24,
		textAlign: 'center'
	},
	fill: {
		flex: 1
	},
	goButton: {
		alignItems: 'center',
		borderRadius: 10,
		borderWidth: StyleSheet.hairlineWidth,
		height: GO_BUTTON_SIZE,
		justifyContent: 'center',
		width: GO_BUTTON_SIZE
	},
	fullWidth: {
		width: '100%'
	},
	// A tab not showing: laid out as nothing, still mounted.
	hidden: {
		display: 'none'
	},
	head: {
		gap: 12,
		paddingBottom: 12
	},
	list: {
		gap: 6,
		paddingBottom: 22,
		paddingTop: 12
	},
	// The card the sura list scrolls inside. The gap above sits outside it, so a list opened on your
	// sura still stands clear of the box; the one below keeps the card off the sheet's edge.
	suraCard: {
		flex: 1,
		marginBottom: 22,
		marginTop: 12
	},
	// One sura in the card: its line under it is counted in `rowLength`.
	suraRow: {
		overflow: 'hidden'
	},
	pageNumber: {
		borderBottomWidth: 2,
		fontSize: 52,
		lineHeight: 58,
		minWidth: 60,
		paddingBottom: 4,
		paddingHorizontal: 6,
		// A text field's own inset on Android, which the readout has no room for.
		paddingTop: 0,
		textAlign: 'center'
	},
	pageNumberRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 8
	},
	pagePlace: {
		marginTop: 6
	},
	pageReadout: {
		alignItems: 'center',
		gap: 6,
		paddingBottom: 4,
		paddingTop: 10
	},
	pageTotal: {
		fontSize: 15
	},
	rowDetail: {
		flexShrink: 0
	},
	rowHead: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 13,
		paddingVertical: 11
	},
	rowSub: {
		fontSize: 10.5,
		lineHeight: 14
	},
	rowText: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	rowTitle: {
		fontSize: 15,
		lineHeight: 19
	},
	searchBox: {
		alignItems: 'center',
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 13,
		paddingVertical: 11
	},
	searchInput: {
		flex: 1,
		minWidth: 0
	},
	sectionPage: {
		fontSize: 11,
		lineHeight: 15
	},
	sectionsLabel: {
		marginTop: 10
	},
	sliderRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		paddingBottom: 8,
		paddingHorizontal: 2,
		paddingTop: 4
	},
	title: {
		fontSize: 20,
		lineHeight: 25
	},
	titleRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	}
});
