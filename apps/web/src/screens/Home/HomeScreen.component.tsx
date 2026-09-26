import { ShelfEmptyState } from '@/components/ShelfEmptyState/ShelfEmptyState.component';
import { useTourAutoStart } from '@/components/Tour/useTourAutoStart';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { mushafCuzPages } from '@/lib/content/mushaf';
import { cuzPages } from '@/lib/content/quran';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { cuzProgressId, useCuzPagesRead } from '@/lib/hooks/useCuzPagesRead';
import { useGetGroups } from '@/lib/hooks/useGroup';
import { useNotificationPermissionPrompt } from '@/lib/hooks/useNotificationPermissionPrompt';
import { useGetProfileStats } from '@/lib/hooks/useProfileStats';
import { useGetUserSettings } from '@/lib/hooks/useUserSettings';
import { useWhatsNew } from '@/lib/hooks/useWhatsNew';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import {
	buildHomeTasks,
	homeStateFor,
	isDueToday,
	nextBoundaryAfter,
	timeLeftUntil,
	tomorrowTask,
	turkishAblativeSuffix,
	type HomeTask,
	type TimeLeft,
	type TurkishAblativeSuffix
} from '@/lib/utils/homeTasks';
import { weekStrip } from '@/lib/utils/weekStrip';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { TabStackParamList } from '@/navigation/types';
import { JoinByCodeSheet } from '@/screens/Join/JoinByCodeSheet.component';
import { WhatsNewSheet } from '@/screens/WhatsNew/WhatsNewSheet.component';
import { useUser } from '@clerk/expo';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HomeAllReadCard } from './HomeAllReadCard.component';
import { HomeDoneCard } from './HomeDoneCard.component';
import { HomeFirstStepCard } from './HomeFirstStepCard.component';
import { HomeFooterLinks } from './HomeFooterLinks.component';
import { HomeGroupRow } from './HomeGroupRow.component';
import { HomeHeader } from './HomeHeader.component';
import { HomeNextCard } from './HomeNextCard.component';
import { HomeReadRow } from './HomeReadRow.component';
import { HomeSkeleton } from './HomeSkeleton.component';

type HomeNavigationProp = NativeStackNavigationProp<TabStackParamList, 'Home'>;

/** The paper layer's corner. */
const SHEET_RADIUS = 32;
/** How far the green runs on above the page, for iOS's bounce at the top. */
const BAND_OVERSCROLL = 1000;
const MINUTE_MS = 60_000;
/** The discover row's 30pt tile and the 17pt compass in it. */
const DISCOVER_TILE_SIZE = 30;
/** "Bab 22’den devam" — a key per Turkish ablative ending; see `homeContinueFromDen`. */
const CONTINUE_FROM_KEY: Record<TurkishAblativeSuffix, StringKey> = {
	dan: 'homeContinueFromDan',
	den: 'homeContinueFromDen',
	tan: 'homeContinueFromTan',
	ten: 'homeContinueFromTen'
};

/**
 * **B8 — the day as tasks.** A coloured band with the greeting, the day's state ("3 görev
 * kaldı") and the streak compact beside the account; on it, one card for the share to read now;
 * under it, a paper sheet with what comes after and what is already read, and the ways to read
 * outside a group at its foot — the only ones, so no card repeats them.
 *
 * - **Sıradaki** is the owed share with the soonest deadline. The rest follow under "Sonra" in
 *   the same order — "teslim sırasına göre" — in one row style for Cevşen and Kur'an.
 * - **Mid-day (B8c)** — the card picks the share up where it was left, and what is finished today
 *   gathers under "Bugün okunanlar", below "Sonra" — always as that section, however few.
 * - **Done (B8b)** — "Bugünün payı" full, and what tomorrow opens with.
 * - **All read (B9b)** — nothing owed and nothing read today, but every share this round done:
 *   "Bu turdaki payların tamam", with a new group as the way on.
 * - **No group (B9)** — "İlk adım" in the card's place, and Keşfet on the sheet.
 *
 * **Nothing here marks anything read.** Every way in opens the reading, where a read is a read.
 * The account (and search, on Android) is the navigator's bar item, over the band's right.
 */
export const HomeScreen = () => {
	const navigation = useNavigation<HomeNavigationProp>();
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
	const { user } = useUser();
	const userId = useCurrentUserId();
	const tabBarHeight = useContext(TabBarOffsetContext);
	// Asked here rather than at launch or in onboarding: this is the screen the reminder is
	// about, so the dialog arrives next to the thing it is for. Fires once, and only when
	// iOS would actually show it.
	useNotificationPermissionPrompt();

	const groupsQuery = useGetGroups();
	const statsQuery = useGetProfileStats();
	const settingsQuery = useGetUserSettings();
	const { data: groups, dataUpdatedAt, isFetching, refetch } = groupsQuery;
	/*
	 * **An error only when there is nothing to show instead.** The list keeps the last answer it
	 * had, so a background poll that fails — a phone waking without a network, a token refreshed
	 * a moment late — leaves the day on screen rather than trading it for "Bir şeyler ters gitti".
	 * And a query that failed once stays `isError` through its next attempt: shown on that alone,
	 * Ana sayfa opened on the error and only then drew the data the retry brought. So: the error
	 * when there is no list and no attempt in flight, the skeleton while one is.
	 */
	const isFailed = groups === undefined && groupsQuery.isError && !isFetching;

	const [isJoinSheetOpen, setIsJoinSheetOpen] = useState(false);

	/*
	 * "Now" for the day's arithmetic, **ticking once a minute while Ana sayfa is in view.** A
	 * refetch that brings nothing new keeps the same data and renders nothing, so without the tick
	 * the "2 sa 30 dk kaldı" badge froze, and a share finished yesterday stayed under "Bugün
	 * okunanlar" past midnight. Coming back to the tab renders anew anyway, on the focus change.
	 */
	const isFocused = useIsFocused();
	const [, setTick] = useState(0);

	useEffect(() => {
		if (!isFocused) {
			return;
		}

		const timer = setInterval(() => setTick(tick => tick + 1), MINUTE_MS);

		return () => clearInterval(timer);
	}, [isFocused]);

	const now = new Date();
	// The memos below follow the minute rather than the render, so the arrays keep their identity
	// between ticks — `tourSubject` and the bookmark keys hang off them.
	const minute = Math.floor(now.getTime() / MINUTE_MS);
	const tasks = useMemo(() => buildHomeTasks(groups ?? [], new Date(minute * MINUTE_MS)), [groups, minute]);
	const { finishedCount, pending, readToday } = tasks;
	const tomorrow = useMemo(() => tomorrowTask(groups ?? [], new Date(minute * MINUTE_MS)), [groups, minute]);

	/*
	 * **Past a round boundary, fetch the list again.** The server rolls a group over lazily, on
	 * the first request after its boundary, and the list only polls every thirty seconds while in
	 * view — so at midnight Ana sayfa held last round's shares until something asked. The minute
	 * after the earliest boundary since the last fetch, it asks — **once per boundary, and only in
	 * view.** The boundary moves only on a successful fetch, so asking again whenever the last
	 * attempt ended looped offline, on every tab; the poll carries the retrying.
	 */
	const nextBoundary = useMemo(() => nextBoundaryAfter(groups ?? [], dataUpdatedAt), [dataUpdatedAt, groups]);
	const askedBoundaryRef = useRef<number | null>(null);

	useEffect(() => {
		if (
			isFocused &&
			nextBoundary !== null &&
			nextBoundary !== askedBoundaryRef.current &&
			minute * MINUTE_MS >= nextBoundary
		) {
			askedBoundaryRef.current = nextBoundary;
			void refetch();
		}
	}, [isFocused, minute, nextBoundary, refetch]);

	// Pages read in the cüz each hatim share is on, for "4/20 s" — see `cuzPagesRead`.
	const isHusrev = settingsQuery.data?.readerArabicFont === 'husrev';
	const cuzKeys = useMemo(
		() =>
			pending
				.filter(task => task.kind === 'HATIM' && task.nextNumber !== null && task.roundIndex !== null)
				.map(task => ({
					cuzNumber: task.nextNumber ?? 0,
					groupId: task.groupId,
					roundIndex: task.roundIndex ?? 0
				})),
		[pending]
	);
	const pagesRead = useCuzPagesRead(userId, cuzKeys, isHusrev ? 'husrev' : 'text');

	/*
	 * The group the first-use tour walks through, and the unit it opens: "Sıradaki", whose card and
	 * button the tour points at. Null while there is nothing owed, which keeps the later stops on
	 * their centred cards.
	 */
	const tourSubject = useMemo(() => {
		const first = pending[0];

		return first?.nextNumber === undefined || first.nextNumber === null
			? null
			: { babNumber: first.nextNumber, groupId: first.groupId };
	}, [pending]);

	// Opens the tour on a first launch, and tells it which group to walk through.
	useTourAutoStart({ subject: tourSubject });
	const whatsNew = useWhatsNew();

	const clock = useMemo(
		() => new Intl.DateTimeFormat(language, { hour: '2-digit', hourCycle: 'h23', minute: '2-digit' }),
		[language]
	);

	// Nothing to draw yet and nothing wrong yet: the first load, or a retry after a failed one.
	if (groups === undefined && !isFailed) {
		return <HomeSkeleton />;
	}

	// Only a list that arrived empty — a failed first load has no list, and is not B9.
	const hasNoGroups = groups !== undefined && groups.length === 0;
	const state = homeStateFor(!hasNoGroups, tasks);
	const stats = statsQuery.data;
	const next = pending[0];
	const later = pending.slice(1);

	const openTask = (task: HomeTask) => {
		/*
		 * Holding no cüz yet: **through the group's front door**, not straight to the pick. The
		 * group screen's gate (`useHatimRoundGate`) sends it on to the pick — after the late
		 * celebration when the last round finished, which opened straight on the pick came after it.
		 */
		if (task.mustPick) {
			navigation.navigate('GroupDetail', { groupId: task.groupId });

			return;
		}

		const unit = task.nextNumber ?? task.unitNumbers[0] ?? 1;

		// A hatim's cüz opens its own page (Q4): the reader is the Cevşen's, and on a cüz number
		// it would show a bab of the wrong text.
		if (task.kind === 'HATIM') {
			navigation.navigate('CuzDetail', { cuzNumber: unit, groupId: task.groupId });

			return;
		}

		navigation.navigate('BabReader', { babNumber: unit, groupId: task.groupId });
	};

	const timeLeftLabel = (left: TimeLeft) =>
		'days' in left
			? t(pluralKey(language, left.days, 'countDaysOne', 'countDaysOther'), { count: left.days })
			: t('hoursLeft', { hours: left.hours, minutes: left.minutes });

	const headingOf = (task: HomeTask) =>
		t(task.kind === 'HATIM' ? 'homeCuzRange' : 'homeBabRange', { range: task.range });

	/** The cüz's pages in the saved face's pagination, and how many of them have been read. */
	const pagesOf = (task: HomeTask) => {
		const cuzNumber = task.nextNumber ?? 0;
		const total = (isHusrev ? mushafCuzPages(cuzNumber) : cuzPages(cuzNumber)).length;
		const read =
			task.roundIndex === null
				? 0
				: pagesRead[cuzProgressId({ cuzNumber, groupId: task.groupId, roundIndex: task.roundIndex })] ?? 0;

		return { page: Math.min(read, total), total };
	};

	const isBegun = (task: HomeTask) => (task.kind === 'HATIM' ? pagesOf(task).page > 0 : task.done > 0);

	const nextCard = next
		? (() => {
				const left = timeLeftUntil(next.roundEndsAt, now);
				const deadline = left ? t('homeTimeLeft', { time: timeLeftLabel(left) }) : null;
				const isUrgent = isDueToday(next.roundEndsAt, now);

				// A hatim waiting for its cüz: nothing read or to count yet, and the way in is the pick.
				if (next.mustPick) {
					return (
						<HomeNextCard
							actionLabel={t('homePickCuzAction')}
							caption={`${next.groupName} · ${t('homePickCuzSub')}`}
							deadline={deadline}
							fraction={0}
							heading={t('homePickCuz')}
							isDueToday={isUrgent}
							kind={next.kind}
							moreCount={0}
							onPress={() => openTask(next)}
						/>
					);
				}

				const pages = next.kind === 'HATIM' ? pagesOf(next) : null;
				const place =
					next.kind === 'HATIM'
						? t('homeCuzRange', { range: next.nextNumber ?? '' })
						: t('homeBabRange', { range: next.nextNumber ?? '' });

				return (
					<HomeNextCard
						actionLabel={
							isBegun(next)
								? t(CONTINUE_FROM_KEY[turkishAblativeSuffix(next.nextNumber ?? 0)], { place })
								: t('startReading')
						}
						caption={[
							next.groupName,
							pages
								? t('homePagesOf', pages)
								: next.done > 0
								? t('homeReadOf', { done: next.done, total: next.total })
								: t(pluralKey(language, next.total, 'countBabsOne', 'countBabsOther'), {
										count: next.total
								  })
						].join(' · ')}
						deadline={deadline}
						heading={headingOf(next)}
						isDueToday={isUrgent}
						kind={next.kind}
						moreCount={next.moreCount}
						onPress={() => openTask(next)}
						{...(pages
							? { fraction: pages.total === 0 ? 0 : pages.page / pages.total }
							: { segments: { filled: next.done, total: next.total } })}
					/>
				);
		  })()
		: null;

	const readRow = (task: HomeTask) => (
		<HomeReadRow
			key={task.groupId}
			moreCount={task.moreCount}
			time={task.doneAt ? clock.format(new Date(task.doneAt)) : ''}
			title={`${task.groupName} · ${headingOf(task)}`}
		/>
	);

	const sectionHead = (title: string, caption: string | null, isSpaced = false) => (
		<View style={[styles.sectionHead, isSpaced && styles.sectionHeadSpaced]}>
			<Typography style={styles.sectionTitle} weight='medium'>
				{title}
			</Typography>
			{caption === null ? null : (
				<Typography color={theme.colors.faintText} style={styles.sectionCaption}>
					{caption}
				</Typography>
			)}
		</View>
	);

	// None while there is no list at all: a failed first load has no day to describe.
	const title = isFailed
		? null
		: {
				allRead: t('homeAllRead'),
				dayDone: t('homeDayDone'),
				next: t('homeTasksLeft', { count: pending.length }),
				noGroups: t('homeNoTasks'),
				waiting: t('homeNoTasks')
		  }[state];

	const topCard = isFailed ? null : state === 'noGroups' ? (
		<HomeFirstStepCard
			onCreate={() => navigation.navigate('CreateGroup')}
			onJoin={() => setIsJoinSheetOpen(true)}
		/>
	) : state === 'next' ? (
		nextCard
	) : state === 'dayDone' ? (
		<HomeDoneCard count={readToday.length} tomorrow={tomorrow} />
	) : state === 'allRead' ? (
		<HomeAllReadCard count={finishedCount} onNewGroup={() => navigation.navigate('CreateGroup')} />
	) : null;

	const sheetContent =
		state === 'noGroups' ? (
			<>
				{sectionHead(t('homeEmptyOr'), null)}
				<CardSurface onPress={() => navigation.navigate('Discover')} style={styles.discoverRow}>
					<View style={[styles.discoverTile, { backgroundColor: theme.colors.sand }]}>
						<Icon color={theme.colors.sandText} name='tabDiscover' size={17} strokeWidth={1.8} />
					</View>
					<View style={styles.discoverCopy}>
						<Typography style={styles.discoverTitle} weight='semibold'>
							{t('homeEmptyDiscoverTitle')}
						</Typography>
						<CaptionText color={theme.colors.subtext} style={styles.discoverSub}>
							{t('homeEmptyDiscoverSub')}
						</CaptionText>
					</View>
					<Icon color={theme.colors.faintText} name='chevronRight' size={15} strokeWidth={1.8} />
				</CardSurface>
			</>
		) : state === 'waiting' ? (
			/*
			 * In groups, with nothing to count: every group still gathering, a round sat out, or a
			 * one-off that ran out unfinished. The reader is already in groups, so the way on is to them
			 * — not the invitation to join one that a reader with no group gets.
			 */
			<ShelfEmptyState
				actions={
					<AppButton onPress={() => navigation.navigate('Groups')} title={t('myGroups')} variant='surface' />
				}
				description={t('homeWaitingBody')}
				title={t('homeWaitingTitle')}
			/>
		) : (
			<>
				{later.length > 0 ? (
					<>
						{sectionHead(t('homeLater'), t('homeByDeadline'))}
						{later.map(task => {
							const deadline = timeLeftUntil(task.roundEndsAt, now);

							if (task.mustPick) {
								return (
									<HomeGroupRow
										actionLabel={t('homePick')}
										fraction={0}
										heading={t('homePickCuz')}
										key={task.groupId}
										kind={task.kind}
										meta={deadline ? timeLeftLabel(deadline) : ''}
										moreCount={0}
										name={task.groupName}
										onPress={() => openTask(task)}
									/>
								);
							}

							const pages = task.kind === 'HATIM' ? pagesOf(task) : null;

							return (
								<HomeGroupRow
									actionLabel={isBegun(task) ? t('homeContinue') : t('read')}
									heading={task.kind === 'HATIM' ? headingOf(task) : task.range}
									key={task.groupId}
									kind={task.kind}
									meta={
										pages
											? [t('homePagesOf', pages), deadline ? timeLeftLabel(deadline) : null]
													.filter(Boolean)
													.join(' · ')
											: `${task.done}/${task.total}`
									}
									moreCount={task.moreCount}
									name={task.groupName}
									onPress={() => openTask(task)}
									{...(pages
										? { fraction: pages.total === 0 ? 0 : pages.page / pages.total }
										: { segments: { filled: task.done, total: task.total } })}
								/>
							);
						})}
					</>
				) : null}

				{/* What is already read, under what is still to come (B8c). */}
				{readToday.length > 0 ? (
					<>
						{sectionHead(t('homeReadToday'), String(readToday.length), later.length > 0)}
						{readToday.map(task => readRow(task))}
					</>
				) : null}
			</>
		);

	return (
		<View style={[styles.screen, { backgroundColor: theme.colors.headerSurface }]}>
			<JoinByCodeSheet isVisible={isJoinSheetOpen} onClose={() => setIsJoinSheetOpen(false)} />
			{/*
			 * P1, and it opens from Ana sayfa for the same reason the tour does: this is the screen
			 * the app lands on, so it is the only place a notice can reliably catch an update. It
			 * never collides with the tour — `useWhatsNew` says nothing on an install that has no
			 * stored version, which is every install the tour opens for.
			 */}
			<WhatsNewSheet
				isVisible={whatsNew.isVisible}
				onClose={whatsNew.dismiss}
				onShowAll={() => {
					whatsNew.dismiss();
					navigation.navigate('ReleaseNotes');
				}}
			/>

			{/*
			 * **The greeting band stays put; the card and the paper scroll together under it.** The
			 * band sits under the navigator's transparent bar, and iOS 26 fades whatever scrolls there
			 * — a scroll view reaching up behind the bar veiled the greeting, and `scrollEdgeEffects`
			 * did not reach this one to hide it. So the scroll starts below the band. No pull to
			 * refresh: the list polls while in view and refetches at each round boundary.
			 */}
			<HomeHeader
				greeting={
					hasNoGroups
						? t('homeEmptyGreet')
						: // Without a first name — an Apple relay, an email sign-up — "Selâm" on its own, not "Selâm, ".
						user?.firstName?.trim()
						? t('greet', { name: user.firstName.trim() })
						: t('greetNoName')
				}
				title={title}
				// B9 has no streak — a run of days is a record of shares taken — and it is absent
				// rather than zeroed while the stats are coming or have failed.
				{...(stats && !hasNoGroups
					? {
							streak: {
								days: stats.streakDays,
								week: weekStrip(stats.last30Days, todayOf(stats.last30Days))
							}
					  }
					: {})}
			/>

			{/*
			 * **Paper behind the scroll, green in it.** iOS 26 fades the content above the tab bar
			 * into whatever is behind the scroll view — green, from the screen, tinted the list's
			 * foot. So the scroll view is paper (which also covers the bounce at the bottom), and the
			 * green the card sits on is the content's own, carried on above it for the top bounce.
			 */}
			<ScrollView
				contentContainerStyle={[styles.page, { backgroundColor: theme.colors.headerSurface }]}
				showsVerticalScrollIndicator={false}
				style={{ backgroundColor: theme.colors.background }}
			>
				<View style={[styles.bandOverscroll, { backgroundColor: theme.colors.headerSurface }]} />
				{topCard ? <View style={styles.topCard}>{topCard}</View> : null}

				{/* The paper layer. The error state lives *in* here rather than replacing the screen, so
			    the coloured layer stays — `AppStatusBar` reads the route, and a light bar over
			    `ErrorState`'s pale page would be unreadable. */}
				<View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
					{isFailed ? (
						<ErrorState queries={[groupsQuery, statsQuery]} />
					) : (
						<View
							style={[
								styles.sheetContent,
								state === 'dayDone' && styles.sheetContentTight,
								{ paddingBottom: tabBarHeight + 22 }
							]}
						>
							{sheetContent}
							<HomeFooterLinks />
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
};

/*
 * **Today is the payload's last day, not the device clock**: the server bucketed `last30Days`
 * in the zone the client asked for, and reading the clock instead lets the strip and the streak
 * disagree about which day is today.
 */
const todayOf = (last30Days: readonly { date: string }[]) => {
	const last = last30Days[last30Days.length - 1];

	if (last === undefined) {
		return new Date();
	}

	const [year, month, day] = last.date.split('-').map(Number);

	// Local midnight of that day: `new Date('YYYY-MM-DD')` would parse as UTC and slide.
	return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

const styles = StyleSheet.create({
	bandOverscroll: {
		bottom: '100%',
		height: BAND_OVERSCROLL,
		left: 0,
		position: 'absolute',
		right: 0
	},
	discoverCopy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	discoverRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 14,
		paddingVertical: 12
	},
	discoverSub: {
		fontSize: 11,
		lineHeight: 14
	},
	discoverTile: {
		alignItems: 'center',
		borderRadius: 9,
		height: DISCOVER_TILE_SIZE,
		justifyContent: 'center',
		width: DISCOVER_TILE_SIZE
	},
	discoverTitle: {
		fontSize: 12.5,
		lineHeight: 16
	},
	page: {
		flexGrow: 1
	},
	screen: {
		flex: 1
	},
	sectionCaption: {
		fontSize: 11,
		lineHeight: 14
	},
	sectionHead: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between',
		paddingBottom: 1,
		paddingHorizontal: 3
	},
	sectionHeadSpaced: {
		paddingTop: 12
	},
	sectionTitle: {
		fontSize: 13.5,
		lineHeight: 17
	},
	// Grows to the rest of the page, so a short day still fills the screen with paper.
	sheet: {
		borderTopLeftRadius: SHEET_RADIUS,
		borderTopRightRadius: SHEET_RADIUS,
		flexGrow: 1,
		overflow: 'hidden'
	},
	// Grows to the sheet's height, so the footer links' `marginTop: 'auto'` reaches the bottom.
	sheetContent: {
		flexGrow: 1,
		gap: 9,
		paddingHorizontal: 17,
		paddingTop: 18
	},
	// B8b sets its read list a point tighter than the others.
	sheetContentTight: {
		gap: 8
	},
	topCard: {
		paddingBottom: 18,
		paddingHorizontal: 17
	}
});
