import { ShelfEmptyState } from '@/components/ShelfEmptyState/ShelfEmptyState.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { PullToRefresh } from '@/components/ui/PullToRefresh/PullToRefresh.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useGetGroups } from '@/lib/hooks/useGroup';
import { useNotificationPermissionPrompt } from '@/lib/hooks/useNotificationPermissionPrompt';
import { useGetProfileStats } from '@/lib/hooks/useProfileStats';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { shareSlices } from '@/lib/utils/groups';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { TabStackParamList } from '@/navigation/types';
import { JoinByCodeSheet } from '@/screens/Join/JoinByCodeSheet.component';
import { useUser } from '@clerk/expo';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useContext, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { HomeEmptyState } from './HomeEmptyState.component';
import { HomeGroupRow } from './HomeGroupRow.component';
import type { HomeGroupRowGroup } from './HomeGroupRow.types';
import { HomeSkeleton } from './HomeSkeleton.component';
import { StreakCard } from './StreakCard.component';

type HomeNavigationProp = NativeStackNavigationProp<TabStackParamList, 'Home'>;

/** The paper layer's corner. */
const SHEET_RADIUS = 32;
/** The heading's small ring: a 60-unit circle drawn at 24pt, so `2πr` is 163.4. */
const RING_SIZE = 24;
const RING_VIEWBOX = 60;
const RING_RADIUS = 26;
const RING_WIDTH = 7;
const RING_CIRCUMFERENCE = 163.4;

/**
 * **H1 — two layers.** A coloured top the greeting sits on, and a paper sheet rounded over it
 * holding the streak and its week, then the groups that owe the reader something today.
 *
 * **Only the rows scroll.** The streak card and the "Gruplarım" heading are pinned above them,
 * the way the search screen pins its field and scope: with five groups the list is the part
 * that moves, and scrolling the week out of sight to reach the third group made the card feel
 * like a banner rather than the state of things.
 *
 * It replaces the docking ring (01g), which showed one group at a time with the others listed
 * under it. Here every group is a row of the same kind and the ring survives only as the small
 * dial beside the heading — the summary, not the subject.
 *
 * **With no group at all it is H1-E** (`HomeEmptyState`): the two layers stay, the sheet becomes
 * the two ways into a group, and the streak card goes with the list.
 *
 * **Nothing on this screen marks a bab read.** The old ring committed a whole share from here;
 * a row opens the group and its button opens the reader, which is where a read has always been
 * a read. The account (and search, on Android) is the navigator's own bar item, floating over
 * the coloured layer beside the greeting.
 */
export const HomeScreen = () => {
	const navigation = useNavigation<HomeNavigationProp>();
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const { user } = useUser();
	const insets = useSafeAreaInsets();
	const tabBarHeight = useContext(TabBarOffsetContext);
	// Asked here rather than at launch or in onboarding: this is the screen the reminder is
	// about, so the dialog arrives next to the thing it is for. Fires once, and only when
	// iOS would actually show it.
	useNotificationPermissionPrompt();

	const groupsQuery = useGetGroups();
	const statsQuery = useGetProfileStats();
	const pullToRefresh = usePullToRefresh(groupsQuery, statsQuery);
	const { data: groups, isError, isPending } = groupsQuery;

	const [isJoinSheetOpen, setIsJoinSheetOpen] = useState(false);

	// Only a running group owes the reader anything today.
	const rows = useMemo<HomeGroupRowGroup[]>(
		() =>
			(groups ?? [])
				.filter(group => group.status === 'RUNNING' && group.myBabNumbers.length > 0)
				.map(group => {
					// One slice large, the rest counted — a share held in several pieces would
					// otherwise spell three ranges across a row built for one.
					const slices = shareSlices(group.myBabNumbers, group.myNextBabNumber);

					return {
						done: group.myReadCount,
						id: group.id,
						moreCount: slices.moreCount,
						name: group.name,
						range: slices.current,
						total: group.myBabNumbers.length
					};
				}),
		[groups]
	);

	// Finished groups sink to the bottom, so whatever is still owed stays at the top.
	const ordered = useMemo(
		() => [...rows].sort((a, b) => Number(a.done >= a.total) - Number(b.done >= b.total)),
		[rows]
	);

	const openReader = (groupId: string) => {
		const group = (groups ?? []).find(candidate => candidate.id === groupId);
		// Where they left off, or the start of the share once it is finished — the reader
		// opens on a bab either way, and the group screen is the fallback for neither.
		const babNumber = group?.myNextBabNumber ?? group?.myBabNumbers[0];

		if (babNumber === undefined) {
			navigation.navigate('GroupDetail', { groupId });

			return;
		}

		navigation.navigate('BabReader', { babNumber, groupId });
	};

	/*
	 * **Two different empty screens, and the difference is real.** Belonging to no group at
	 * all is H1-E: the screen becomes an invitation, and the streak card goes with the list
	 * because a run of days is a record of shares taken. Belonging to groups that simply owe
	 * nothing today — all gathering, or all finished — keeps the streak and says so.
	 */
	const hasNoGroups = (groups ?? []).length === 0;
	const doneGroups = rows.filter(row => row.done >= row.total).length;
	const isAllDone = rows.length > 0 && doneGroups === rows.length;
	const doneBabs = rows.reduce((sum, row) => sum + row.done, 0);
	const totalBabs = rows.reduce((sum, row) => sum + row.total, 0);
	const ringOffset = totalBabs === 0 ? RING_CIRCUMFERENCE : RING_CIRCUMFERENCE * (1 - doneBabs / totalBabs);
	const onHeader = theme.colors.onHeaderSurface;
	const stats = statsQuery.data;

	if (isPending) {
		return <HomeSkeleton />;
	}

	return (
		<View style={[styles.screen, { backgroundColor: theme.colors.headerSurface }]}>
			<JoinByCodeSheet isVisible={isJoinSheetOpen} onClose={() => setIsJoinSheetOpen(false)} />
			{/* The greeting only. The account — and search on Android — is the navigator's bar
			    item, which floats over this layer at the right of the same row. */}
			<View style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
				<View style={styles.greeting}>
					{/* "Hoş geldin" rather than "Selâm, X" while there is no group: the line
					    below it welcomes them, and greeting someone by name into an empty
					    screen was the design's own distinction. */}
					<Typography color={toAlphaColor(onHeader, 0.6)} style={styles.greetingLabel} weight='medium'>
						{hasNoGroups ? t('homeEmptyGreet') : t('greet', { name: user?.firstName ?? '' })}
					</Typography>
					<Typography color={onHeader} style={styles.welcome} variant='header2' weight='regular'>
						{t('homeTogether')}
					</Typography>
				</View>
				{/* Reading outside a share, which belongs on the coloured layer with the greeting:
				    it is the one thing here that is not about a group. */}
				<Pressable
					accessibilityRole='button'
					onPress={() => navigation.navigate('AllBabs')}
					style={({ pressed }) => [
						styles.freeRead,
						{
							backgroundColor: toAlphaColor(onHeader, 0.14),
							borderColor: toAlphaColor(onHeader, 0.2),
							opacity: pressed ? 0.8 : 1
						}
					]}
				>
					<View style={[styles.freeReadBadge, { backgroundColor: toAlphaColor(onHeader, 0.18) }]}>
						<Icon color={onHeader} name='book' size={16} strokeWidth={1.8} />
					</View>
					<View style={styles.freeReadCopy}>
						<Typography color={onHeader} style={styles.freeReadTitle} weight='semibold'>
							{t('allBabs')}
						</Typography>
						<Typography color={toAlphaColor(onHeader, 0.62)} style={styles.freeReadSub}>
							{t('allBabsSub')}
						</Typography>
					</View>
					<Icon color={toAlphaColor(onHeader, 0.6)} name='chevronRight' size={15} strokeWidth={1.8} />
				</Pressable>
			</View>

			{/* The paper layer. `overflow: hidden` is what makes the corner a corner: the list
			    inside would otherwise paint its own background square over it.

			    The error state lives *in* here rather than replacing the screen, so the coloured
			    layer stays — `AppStatusBar` reads the route, and a light bar over `ErrorState`'s
			    pale page would be unreadable. */}
			<View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
				{isError ? (
					<ErrorState queries={[groupsQuery, statsQuery]} />
				) : (
					<>
						{/* Nothing is pinned on H1-E: the sheet is a single column from its own
						    top, and the streak card is part of what the empty state promises. */}
						{hasNoGroups ? null : (
							<View style={styles.pinned}>
								{/* Absent rather than zeroed while the stats are still coming, and
								    if they fail: "0" and an empty week are a claim about the
								    reader's month, and the groups below are what this screen is
								    for. */}
								{stats ? (
									<StreakCard
										last30Days={stats.last30Days}
										longestStreakDays={stats.longestStreakDays}
										streakDays={stats.streakDays}
									/>
								) : null}

								{rows.length === 0 ? null : (
									<View style={styles.groupsHead}>
										<View style={styles.groupsCopy}>
											<Typography style={styles.groupsTitle} weight='medium'>
												{t('myGroups')}
											</Typography>
											<CaptionText color={theme.colors.faintText} style={styles.groupsSummary}>
												{t('groupsDone', { done: doneGroups, total: rows.length })}
											</CaptionText>
										</View>
										{/* The docking ring's descendant: the day's whole share as
										    one dial, rotated so it fills from the top. */}
										<Svg
											height={RING_SIZE}
											style={styles.ring}
											viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
											width={RING_SIZE}
										>
											<Circle
												cx={RING_VIEWBOX / 2}
												cy={RING_VIEWBOX / 2}
												fill='none'
												r={RING_RADIUS}
												stroke={theme.colors.border}
												strokeWidth={RING_WIDTH}
											/>
											<Circle
												cx={RING_VIEWBOX / 2}
												cy={RING_VIEWBOX / 2}
												fill='none'
												r={RING_RADIUS}
												stroke={theme.colors.accent}
												strokeDasharray={RING_CIRCUMFERENCE}
												strokeDashoffset={ringOffset}
												strokeLinecap='round'
												strokeWidth={RING_WIDTH}
											/>
										</Svg>
									</View>
								)}
							</View>
						)}

						<PullToRefresh {...pullToRefresh}>
							<ScrollView
								contentContainerStyle={[
									styles.list,
									{ paddingBottom: tabBarHeight + theme.spacing.xl }
								]}
								showsVerticalScrollIndicator={false}
							>
								{hasNoGroups ? (
									<HomeEmptyState
										onCreate={() => navigation.navigate('CreateGroup')}
										onDiscover={() => navigation.navigate('Discover')}
										onJoin={() => setIsJoinSheetOpen(true)}
									/>
								) : rows.length === 0 ? (
									/*
									 * In groups, but none of them owes anything today — every one
									 * still gathering, or every one already finished. A different
									 * sentence from H1-E's, and the streak card above it stays.
									 */
									<ShelfEmptyState
										actions={
											<>
												<AppButton
													onPress={() => navigation.navigate('CreateGroup')}
													title={t('emptyMyCreate')}
												/>
												<AppButton
													onPress={() => setIsJoinSheetOpen(true)}
													title={t('emptyMyJoin')}
													variant='surface'
												/>
												<AppButton
													onPress={() => navigation.navigate('Discover')}
													title={t('emptyMyBrowse')}
													variant='ghost'
												/>
											</>
										}
										description={t('emptyHomeSub')}
										title={t('emptyHomeTitle')}
									/>
								) : (
									<>
										{ordered.map(group => (
											<HomeGroupRow
												group={group}
												key={group.id}
												onOpenReader={() => openReader(group.id)}
												onPress={() =>
													navigation.navigate('GroupDetail', { groupId: group.id })
												}
											/>
										))}

										{isAllDone ? (
											<Typography
												color={theme.colors.accent}
												style={styles.cheer}
												variant='title'
											>
												{t('homeAllDone')}
											</Typography>
										) : null}
									</>
								)}
							</ScrollView>
						</PullToRefresh>
					</>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	cheer: {
		paddingHorizontal: 4,
		paddingTop: 2
	},
	freeRead: {
		alignItems: 'center',
		borderRadius: 15,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 11,
		paddingHorizontal: 14,
		paddingVertical: 12
	},
	freeReadBadge: {
		alignItems: 'center',
		borderRadius: 9,
		height: 30,
		justifyContent: 'center',
		width: 30
	},
	freeReadCopy: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	freeReadSub: {
		fontSize: 10.5,
		lineHeight: 14
	},
	freeReadTitle: {
		fontSize: 12.5,
		lineHeight: 16
	},
	greeting: {
		gap: 2,
		// The bar's item sits at the right of this same row, so the greeting stops short of it.
		paddingRight: 56
	},
	greetingLabel: {
		fontSize: 12,
		lineHeight: 15
	},
	groupsCopy: {
		flex: 1,
		minWidth: 0
	},
	groupsHead: {
		alignItems: 'flex-end',
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 3,
		paddingTop: 12
	},
	groupsSummary: {
		marginTop: 3
	},
	groupsTitle: {
		fontSize: 13.5,
		lineHeight: 17
	},
	header: {
		gap: 18,
		paddingBottom: 20,
		paddingHorizontal: 20
	},
	list: {
		// So the empty state can take the height it centres itself in.
		flexGrow: 1,
		gap: 11,
		paddingHorizontal: 17,
		paddingTop: 11
	},
	pinned: {
		paddingHorizontal: 17,
		paddingTop: 16
	},
	ring: {
		// The arc starts at three o'clock; a quarter turn back puts it at the top.
		transform: [{ rotate: '-90deg' }]
	},
	screen: {
		flex: 1
	},
	sheet: {
		borderTopLeftRadius: SHEET_RADIUS,
		borderTopRightRadius: SHEET_RADIUS,
		flex: 1,
		overflow: 'hidden'
	},
	welcome: {
		fontSize: 23,
		lineHeight: 26
	}
});
