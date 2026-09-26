import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import {
	isSegmentedControlNative,
	SegmentedControl
} from '@/components/ui/SegmentedControl/SegmentedControl.component';
import {
	BodyStrongText,
	BodyText,
	CaptionText,
	EyebrowText,
	Header2
} from '@/components/ui/Typography/Typography.component';
import { getBab } from '@/lib/content/cevsen';
import { suraNameFor } from '@/lib/content/cuz';
import type { MushafVerse } from '@/lib/content/mushaf';
import { type MushafPlace, searchQuran } from '@/lib/content/mushafPlaces';
import { useDiscoverGroups, useGetGroups } from '@/lib/hooks/useGroup';
import { useGetUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { GroupSummary } from '@/lib/types/domain';
import type { CuzPagination } from '@/lib/utils/cuzPagesRead';
import { addRecentSearch, useRecentSearches } from '@/lib/utils/recentSearches';
import { highlightMatch, searchCevsen, searchGroups } from '@/lib/utils/search';
import { forceTabBarHidden } from '@/navigation/tabBarVisibility';
import type { TabStackParamList } from '@/navigation/types';
import { useUser } from '@clerk/expo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SearchInputHandle } from '@/components/ui/SearchInput/SearchInput.types';
import { SearchField } from './SearchField.component';

type SearchNavigationProp = NativeStackNavigationProp<TabStackParamList, 'Search'>;

/** K2's scope bar, in its order. `all` is the union; the rest are the four corpora. */
type Scope = 'all' | 'mine' | 'open' | 'babs' | 'text' | 'quran';
const SCOPES: readonly Scope[] = ['all', 'mine', 'open', 'babs', 'text', 'quran'];
const SCOPE_LABEL_KEYS: Record<Scope, StringKey> = {
	all: 'searchScopeAll',
	babs: 'searchScopeBabs',
	mine: 'searchScopeMine',
	open: 'discover',
	quran: 'qHatim',
	text: 'searchScopeText'
};
const SECTION_LABEL_KEYS: Record<Exclude<Scope, 'all'>, StringKey> = {
	babs: 'searchSectionBabs',
	mine: 'searchSectionMine',
	open: 'discover',
	quran: 'qHatim',
	text: 'searchSectionText'
};
const TIP_KEYS: readonly StringKey[] = ['searchTipGroups', 'searchTipBab', 'searchTipText', 'searchTipQuran'];

const isScope = (value: string): value is Scope => (SCOPES as readonly string[]).includes(value);

const BADGE_SIZE = 36;
const ROW_MIN_HEIGHT = 56;
/** The hairline starts past the badge, as K2 insets it — 16 padding + 36 badge + 12 gap. */
const SEPARATOR_INSET = 64;
const SERVER_QUERY_DEBOUNCE_MS = 300;
/** After the immediate attempt: once the tab switch has landed, and once more for good measure. */
const FOCUS_RETRY_DELAYS_MS = [150, 450];
/** iOS gives this tab root a bar with the account in it; the title sits in that row. */
const isTitleInBar = Platform.OS === 'ios';

interface ResultRow {
	key: string;
	badge: string;
	title: string;
	sub: string;
	tag?: string;
	onPress: () => void;
}

interface ResultSection {
	scope: Exclude<Scope, 'all'>;
	rows: ResultRow[];
}

/**
 * K2 — one live screen: the search field where the tab bar was, the keyboard up, and the
 * results filtering as you type across four corpora — your groups, open groups, the hundred
 * babs by number, and the text inside them (the Turkish meal, and the Arabic with its marks
 * folded away). A segmented scope narrows it; an empty field shows what you searched before
 * and what you can search; no match gets the empty state.
 *
 * **The title and the scope stay put; only the results scroll.** They sit above the scroll
 * view rather than in it, so narrowing a long list never means scrolling back up to do it.
 *
 * The tab bar is hidden while this screen is focused (`TAB_BAR_HIDDEN_ROUTES`), which is what
 * makes the bottom row *replace* it rather than stack on it. A result pushes inside this tab's
 * own stack, so back returns here with the query and its results as they were — the query is
 * only cleared by the ×, which also goes back to the tab you came from (the navigator's
 * `backBehavior='history'` is what makes "back" mean that on a tab).
 *
 * K2 is drawn in Apple's system face and iOS blue; this keeps the app's own type and accent,
 * per the theme rule, and takes K2's structure. Recent searches are kept on the device per
 * account — see `recentSearches.ts`.
 */
export const SearchScreen = () => {
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
	// Page numbers are counted in the reader's pagination, as the Mushaf they open will show them.
	const pagination: CuzPagination = useGetUserSettings().data?.readerArabicFont === 'husrev' ? 'husrev' : 'text';
	const insets = useSafeAreaInsets();
	const navigation = useNavigation<SearchNavigationProp>();
	const inputRef = useRef<SearchInputHandle | null>(null);
	const [query, setQuery] = useState('');
	const [scope, setScope] = useState<Scope>('all');
	const { user } = useUser();
	// Per account, on the device — see `recentSearches.ts`.
	const recents = useRecentSearches(user?.id ?? null);
	const { data: myGroups } = useGetGroups();
	/*
	 * Keşfet answers at most fifty groups, so the open corpus has to be asked *for the query*,
	 * not fetched whole and filtered here — a matching group past the newest fifty would never
	 * appear. Debounced so a request isn't sent per keystroke; the local match still runs on
	 * what comes back, for the highlight and the Turkish fold the server doesn't do.
	 */
	const [serverQuery, setServerQuery] = useState('');
	// Off while idle: the tab is mounted at launch (`lazy: false`), and an empty field has no
	// business fetching the catalogue on every focus and reconnect.
	const { data: openGroups } = useDiscoverGroups(
		{ search: serverQuery || undefined },
		{ isEnabled: serverQuery !== '' }
	);

	useEffect(() => {
		const handle = setTimeout(() => setServerQuery(query.trim()), SERVER_QUERY_DEBOUNCE_MS);

		return () => clearTimeout(handle);
	}, [query]);

	// Set when a result is opened, so the next focus knows it is a return rather than an arrival.
	const isReturningFromResultRef = useRef(false);

	/*
	 * Coming back from a result, the bar must be gone before this screen is on view. The
	 * navigator hides it from the focused route, which only becomes this screen once the pop
	 * has committed — after the page is already visible, so the bar was seen sliding out of
	 * it. The native stack tells a screen when it *starts* reappearing; that is when to ask.
	 * The request is withdrawn on blur, so a result pushed over this screen gets its bar back.
	 */
	useEffect(() => {
		const unsubscribeTransition = navigation.addListener('transitionStart', event => {
			if (!event.data.closing) {
				forceTabBarHidden(true);
			}
		});
		const unsubscribeBlur = navigation.addListener('blur', () => forceTabBarHidden(false));
		/*
		 * Leaving the *tab* while a result is open pops this stack to its root without ever
		 * focusing this screen, so the "returning from a result" note would still be waiting
		 * for the next arrival — which is then a fresh visit that wants the keyboard.
		 */
		const unsubscribeTabBlur = navigation.getParent()?.addListener('blur', () => {
			isReturningFromResultRef.current = false;
		});

		return () => {
			unsubscribeTransition();
			unsubscribeBlur();
			unsubscribeTabBlur?.();
			forceTabBarHidden(false);
		};
	}, [navigation]);

	/*
	 * Search mode means the keyboard is up: focus on arrival, let go on the way out. Arrival
	 * *back* from a result is the exception — the query and its results are still here, and
	 * the keyboard would only cover the list you were reading.
	 *
	 * Asked more than once: the focus fires while the native tab switch is still in flight, and
	 * the first request can be lost to it — the field then sat idle until tapped. Each retry is
	 * a no-op once the field holds focus.
	 */
	useFocusEffect(
		useCallback(() => {
			const isReturning = isReturningFromResultRef.current;
			isReturningFromResultRef.current = false;

			if (isReturning) {
				return () => inputRef.current?.blur();
			}

			const focus = () => {
				if (!inputRef.current?.isFocused()) {
					inputRef.current?.focus();
				}
			};

			focus();
			const handles = FOCUS_RETRY_DELAYS_MS.map(delay => setTimeout(focus, delay));

			return () => {
				handles.forEach(clearTimeout);
				inputRef.current?.blur();
			};
		}, [])
	);

	const leave = useCallback(() => {
		setQuery('');
		setScope('all');
		inputRef.current?.blur();

		if (navigation.canGoBack()) {
			navigation.goBack();
		} else {
			navigation.navigate('Home');
		}
	}, [navigation]);

	const userId = user?.id ?? null;
	const open = useCallback(
		(go: () => void) => {
			addRecentSearch(userId, query);
			isReturningFromResultRef.current = true;
			go();
		},
		[query, userId]
	);

	const sections = useMemo<ResultSection[]>(() => {
		if (query.trim() === '') {
			return [];
		}

		const mineHits = searchGroups(myGroups, query);
		const openHits = searchGroups(openGroups, query).filter(group => !mineHits.some(mine => mine.id === group.id));
		const cevsen = searchCevsen(query);

		const groupSub = (group: GroupSummary) =>
			group.status === 'GATHERING'
				? t('searchMineGathering', { people: group.memberCount })
				: t('searchMineSub', {
						day: (group.roundIndex ?? 0) + 1,
						people: group.memberCount,
						pct: group.percent
				  });

		// Every destination pushes inside this tab — see the note on the screen.
		const goToGroup = (group: GroupSummary) => () =>
			open(() =>
				group.status === 'GATHERING'
					? navigation.navigate('Lobby', { groupId: group.id })
					: navigation.navigate('GroupDetail', { groupId: group.id })
			);
		const goToBab = (babNumber: number) => () => open(() => navigation.navigate('AllBabs', { babNumber }));
		// The free Mushaf at a place — and, for an ayah, marked and scrolled to there.
		const goToPlace = (place: MushafPlace, verse?: MushafVerse) => () =>
			open(() =>
				navigation.navigate('Mushaf', {
					cuzNumber: place.cuzNumber,
					page: place.pageIndex + 1,
					...(verse ? { verseKey: `${verse.chapter}:${verse.ayah}` } : {})
				})
			);
		const cuzLabel = (first: number, last: number) =>
			first === last ? t('goCuzOne', { n: first }) : t('goCuzSpan', { a: first, b: last });

		// The Kur'an by reference — see `searchQuran`; its text is not searched here.
		const quranRows: ResultRow[] = searchQuran(query, language, pagination).map(hit =>
			hit.kind === 'sura'
				? {
						badge: String(hit.entry.chapter),
						key: `sura-${hit.entry.chapter}`,
						onPress: goToPlace(hit.place, { ayah: 1, chapter: hit.entry.chapter }),
						sub: `${t('goAyahCount', { n: hit.entry.ayahCount })} · ${cuzLabel(
							hit.entry.cuzFirst,
							hit.entry.cuzLast
						)} · ${t('goPageShort', { n: hit.entry.startPage })}`,
						title: hit.entry.name
				  }
				: hit.kind === 'ayah'
				? {
						badge: String(hit.verse.chapter),
						key: `ayah-${hit.verse.chapter}-${hit.verse.ayah}`,
						onPress: goToPlace(hit.place, hit.verse),
						sub: `${cuzLabel(hit.place.cuzNumber, hit.place.cuzNumber)} · ${t('goPageShort', {
							n: hit.place.pageNumber
						})}`,
						title: `${suraNameFor(hit.verse.chapter, language)} ${hit.verse.ayah}`
				  }
				: {
						badge: String(hit.place.pageNumber),
						key: `page-${hit.place.pageNumber}`,
						onPress: goToPlace(hit.place),
						sub: `${suraNameFor(hit.first.chapter, language)} ${hit.first.ayah} · ${cuzLabel(
							hit.place.cuzNumber,
							hit.place.cuzNumber
						)}`,
						title: `${t('qPage')} ${hit.place.pageNumber}`
				  }
		);

		const built: ResultSection[] = [
			{
				rows: mineHits.map(group => ({
					badge: group.name.slice(0, 1),
					key: `mine-${group.id}`,
					onPress: goToGroup(group),
					sub: groupSub(group),
					tag: t(group.isOwner ? 'creator' : 'searchTagMember'),
					title: group.name
				})),
				scope: 'mine'
			},
			{
				rows: openHits.map(group => ({
					badge: group.name.slice(0, 1),
					key: `open-${group.id}`,
					onPress: () => open(() => navigation.navigate('InvitePreview', { groupId: group.id })),
					sub: t('searchOpenSub', { people: group.memberCount }),
					tag: t('join'),
					title: group.name
				})),
				scope: 'open'
			},
			{
				rows: cevsen.babs.map(({ babNumber }) => {
					const first = getBab(babNumber)?.invocations[0];

					return {
						badge: String(babNumber),
						key: `bab-${babNumber}`,
						onPress: goToBab(babNumber),
						sub: first?.tr ?? first?.text ?? '',
						title: t('searchBabTitle', { bab: babNumber })
					};
				}),
				scope: 'babs'
			},
			{
				rows: cevsen.text.map(hit => ({
					badge: String(hit.babNumber),
					key: `text-${hit.babNumber}-${hit.part}-${hit.invocationNumber}-${hit.source}`,
					onPress: goToBab(hit.babNumber),
					sub: t('searchTextSub', { bab: hit.babNumber }),
					title: hit.line
				})),
				scope: 'text'
			},
			{ rows: quranRows, scope: 'quran' }
		];

		return built.filter(section => section.rows.length > 0);
	}, [language, myGroups, navigation, open, openGroups, pagination, query, t]);

	const isSearching = query.trim() !== '';
	const visibleSections = scope === 'all' ? sections : sections.filter(section => section.scope === scope);
	const markColor = toAlphaColor(theme.colors.accent, 0.3);

	const renderTitle = (text: string) => {
		const { mid, post, pre } = highlightMatch(text, query);

		return (
			<BodyText numberOfLines={1}>
				{pre}
				{mid === '' ? null : <BodyText style={{ backgroundColor: markColor }}>{mid}</BodyText>}
				{post}
			</BodyText>
		);
	};

	return (
		<View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
			{/* In the bar, the title starts at the safe area like the bar does; below it, it keeps its own breath. */}
			<View style={[styles.header, { paddingTop: insets.top + (isTitleInBar ? 0 : theme.spacing.sm) }]}>
				{/*
				 * On iOS the tab root carries the bar with the account in it, and the title shares
				 * that row rather than taking one of its own under it — the results are what this
				 * screen is for, and the row above the keyboard is short. Without the reserved
				 * eyebrow line the label's box centres on the bar's 44pt band. Android's pushed
				 * search has no bar, so the title keeps its ordinary block.
				 */}
				<ScreenTitle hasReservedSecondaryLabel={!isTitleInBar} label={t('search')} />
				{isSearching ? (
					/*
					 * The platform's segmented control — SwiftUI's on iOS 26, the drawn one
					 * elsewhere — in place of K2's chips. The per-scope counts K2 wrote into the
					 * chips don't fit five native segments; each section still heads with its own.
					 */
					<SegmentedControl
						onChange={value => {
							if (isScope(value)) {
								setScope(value);
							}
						}}
						options={SCOPES.map(id => ({ label: t(SCOPE_LABEL_KEYS[id]), value: id }))}
						// Only the native control needs telling — see Profil's appearance row.
						{...(isSegmentedControlNative ? { style: styles.scopeControl } : {})}
						value={scope}
					/>
				) : null}
			</View>
			<KeyboardAwareScrollView
				contentContainerStyle={styles.content}
				keyboardDismissMode='on-drag'
				keyboardShouldPersistTaps='handled'
				showsVerticalScrollIndicator={false}
			>
				{isSearching ? (
					visibleSections.length === 0 ? (
						<View style={styles.empty}>
							<Header2 textAlign='center'>{t('searchEmptyTitle')}</Header2>
							<BodyText color={theme.colors.subtext} style={styles.emptyBody} textAlign='center'>
								{t('searchEmptyBody')}
							</BodyText>
						</View>
					) : (
						<CardSurface isFlush>
							{visibleSections.map(section => (
								<View key={section.scope}>
									<View style={styles.sectionHead}>
										<EyebrowText color={theme.colors.faintText}>
											{t(SECTION_LABEL_KEYS[section.scope])}
										</EyebrowText>
										<EyebrowText color={theme.colors.faintText} style={styles.sectionCount}>
											{String(section.rows.length)}
										</EyebrowText>
									</View>
									{section.rows.map((row, index) => (
										<View key={row.key}>
											{index > 0 ? (
												<View
													style={[styles.separator, { backgroundColor: theme.colors.border }]}
												/>
											) : null}
											<Pressable
												accessibilityRole='button'
												onPress={row.onPress}
												style={({ pressed }) => [
													styles.row,
													{
														backgroundColor: pressed
															? theme.colors.surfaceGlassWash
															: theme.colors.transparent
													}
												]}
											>
												<View
													style={[styles.badge, { backgroundColor: theme.colors.accentSoft }]}
												>
													<BodyStrongText color={theme.colors.accent} numberOfLines={1}>
														{row.badge}
													</BodyStrongText>
												</View>
												<View style={styles.rowText}>
													{renderTitle(row.title)}
													<CaptionText color={theme.colors.subtext} numberOfLines={1}>
														{row.sub}
													</CaptionText>
												</View>
												{row.tag === undefined ? null : (
													<CaptionText color={theme.colors.accent} weight='semibold'>
														{row.tag}
													</CaptionText>
												)}
												<Icon
													color={theme.colors.faintText}
													name='chevronRight'
													size={15}
													strokeWidth={2}
												/>
											</Pressable>
										</View>
									))}
								</View>
							))}
						</CardSurface>
					)
				) : (
					<>
						{recents.length === 0 ? null : (
							<>
								<EyebrowText color={theme.colors.faintText} style={styles.blockHead}>
									{t('searchRecent')}
								</EyebrowText>
								<CardSurface isFlush style={styles.block}>
									{recents.map((recent, index) => (
										<View key={recent}>
											{index > 0 ? (
												<View
													style={[styles.separator, { backgroundColor: theme.colors.border }]}
												/>
											) : null}
											<Pressable
												accessibilityRole='button'
												onPress={() => setQuery(recent)}
												style={({ pressed }) => [
													styles.recentRow,
													{
														backgroundColor: pressed
															? theme.colors.surfaceGlassWash
															: theme.colors.transparent
													}
												]}
											>
												<Icon
													color={theme.colors.subtext}
													name='clock'
													size={17}
													strokeWidth={2}
												/>
												<BodyText style={styles.recentLabel}>{recent}</BodyText>
												<Icon
													color={theme.colors.faintText}
													name='chevronRight'
													size={15}
													strokeWidth={2}
												/>
											</Pressable>
										</View>
									))}
								</CardSurface>
							</>
						)}
						<EyebrowText color={theme.colors.faintText} style={styles.blockHead}>
							{t('searchTips')}
						</EyebrowText>
						<CardSurface isFlush>
							{TIP_KEYS.map(key => (
								<View key={key} style={styles.tipRow}>
									<View style={[styles.tipDot, { backgroundColor: theme.colors.accent }]} />
									<BodyText color={theme.colors.subtext} style={styles.tipText}>
										{t(key)}
									</BodyText>
								</View>
							))}
						</CardSurface>
					</>
				)}
			</KeyboardAwareScrollView>
			<SearchField
				inputRef={inputRef}
				onChange={setQuery}
				onClear={() => {
					setQuery('');
					setScope('all');
				}}
				onClose={leave}
				query={query}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	badge: {
		alignItems: 'center',
		borderRadius: 12,
		height: BADGE_SIZE,
		justifyContent: 'center',
		width: BADGE_SIZE
	},
	block: {
		marginBottom: 22
	},
	blockHead: {
		marginBottom: 9,
		paddingHorizontal: 8
	},
	content: {
		gap: 0,
		paddingBottom: 96,
		paddingHorizontal: 14,
		paddingTop: 4
	},
	empty: {
		alignItems: 'center',
		paddingHorizontal: 30,
		paddingTop: 70
	},
	emptyBody: {
		marginTop: 6,
		maxWidth: 260
	},
	header: {
		gap: 4,
		paddingBottom: 8,
		paddingHorizontal: 14
	},
	recentLabel: {
		flex: 1
	},
	recentRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		minHeight: 52,
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		minHeight: ROW_MIN_HEIGHT,
		paddingHorizontal: 16,
		paddingVertical: 9
	},
	rowText: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	scopeControl: {
		width: '100%'
	},
	screen: {
		flex: 1
	},
	sectionCount: {
		opacity: 0.7
	},
	sectionHead: {
		flexDirection: 'row',
		gap: 6,
		paddingBottom: 6,
		paddingHorizontal: 18,
		paddingTop: 13
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: SEPARATOR_INSET
	},
	tipDot: {
		borderRadius: 2.5,
		height: 5,
		marginTop: 7,
		width: 5
	},
	tipRow: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	tipText: {
		flex: 1
	}
});
