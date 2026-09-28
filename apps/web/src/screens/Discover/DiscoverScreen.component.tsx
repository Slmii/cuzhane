import { useGroupBrowse } from '@/components/GroupBrowseBar/GroupBrowse.context';
import { GroupCard } from '@/components/GroupCard/GroupCard.component';
import { HizbDiscoverCard } from '@/components/HizbDiscoverCard/HizbDiscoverCard.component';
import { GroupResetTime } from '@/components/ResetTimeLabel/GroupResetTime.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { PullToRefresh } from '@/components/ui/PullToRefresh/PullToRefresh.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { ShelfEmptyState } from '@/components/ShelfEmptyState/ShelfEmptyState.component';
import { GroupCardSkeleton } from '@/components/Skeleton/GroupCardSkeleton.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import type { ChipTone } from '@/components/ui/Chip/Chip.types';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { SeatStack } from '@/components/ui/SeatStack/SeatStack.component';
import { useDiscoverGroups } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupCycle } from '@/lib/types/domain';
import { applyGroupBrowse, emptyGroupBrowseState, isGroupBrowseNarrowed } from '@/lib/utils/groupBrowse';
import { cycleLabelKey, splitModeLabelKey } from '@/lib/utils/groups';
import { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';

type DiscoverNavigationProp = NativeStackNavigationProp<TabStackParamList>;

/**
 * Reordering the list is a *move*, so the cards travel to their new places instead of the
 * whole column repainting. A spring rather than a duration: several cards slide different
 * distances at once, and a spring keeps them feeling like one shelf being rearranged.
 * Entering and leaving rows only fade — sliding them in as well reads as motion for its
 * own sake when the cause was a filter, not a scroll.
 */
const CARD_LAYOUT = LinearTransition.springify().damping(20).stiffness(180).mass(0.7);

/**
 * The cadence badge's tone. A record, so a new cycle has to be given one; the month takes the
 * `neutral` the old switch's fallthrough already handed anything that was neither.
 */
const BADGE_TONE_FOR_CYCLE: Record<GroupCycle, ChipTone> = {
	CUSTOM: 'neutral',
	DAILY: 'sand',
	MONTHLY: 'neutral',
	WEEKLY: 'accent'
};

export const DiscoverScreen = () => {
	const navigation = useNavigation<DiscoverNavigationProp>();
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	// Shared with the navigator's browse menu, which sits outside this screen — see the context.
	const { browse, setBrowse } = useGroupBrowse();

	// Someone who has asked the OS for less motion gets the instant reorder they asked for.
	const isReducedMotion = useReducedMotion();
	const cardLayout = isReducedMotion ? undefined : CARD_LAYOUT;

	// Only offer "clear" when something is actually narrowing the list; with neither a
	// query nor a filter there is genuinely nothing to browse, not nothing matching.
	const isNarrowed = isGroupBrowseNarrowed(browse);

	const clearNarrowing = () => setBrowse(emptyGroupBrowseState);

	const discoverQuery = useDiscoverGroups({ cycle: browse.cycle });
	const { data: groups, isError, isPending } = discoverQuery;
	const pullToRefresh = usePullToRefresh(discoverQuery);

	/**
	 * The cadence also goes to the server, because it decides *which* groups exist for this
	 * browse; re-applying it here is a no-op that keeps one function responsible for what the
	 * controls mean. Durum and the sort are answered by fields every row already carries, so
	 * sending them would be a round trip to reorder something we are holding.
	 */
	const visibleGroups = useMemo(() => applyGroupBrowse(groups, browse), [browse, groups]);

	// The title pinned as the list's header. No search box here: searching, open groups
	// included, is the Ara tab's job; filter and sort are the navigator's pull-down.
	const header = (
		<View key='header' style={[styles.header, { backgroundColor: theme.colors.background }]}>
			{/*
			 * Under the navigator's bar, which carries this screen's browse menu.
			 *
			 * `hasReservedSecondaryLabel={false}` for the same reason as the inbox: D4 heads
			 * with `padding: 8px 0 16px` and no eyebrow, the way G1 and G3 do. Gruplarım (D2)
			 * is the one tab root with that row, because it has a greeting to put in it.
			 */}
			<ScreenTitle hasReservedSecondaryLabel={false} isUnderNavigationBar label={t('discover')} />
		</View>
	);

	type Row = (typeof visibleGroups)[number];

	const keyExtractor = useCallback((group: Row) => group.id, []);

	const renderGroup = useCallback(
		({ item }: { item: Row }) => (
			/*
			 * `layout` only. `entering`/`exiting` used to sit here too, so that changing the
			 * filter faded rows in and out — but in a windowed list those fire as rows scroll
			 * into the window, and every card would fade in on the way past. `layout` is safe:
			 * it animates a row that *moves*, which is still exactly the filter/sort case.
			 */
			<Animated.View layout={cardLayout}>
				{/* A Hizb plan group has its own card (section 5): no seats, today's 33 instead. */}
				{item.kind === 'HIZB' && item.hizbPlan != null ? (
					<HizbDiscoverCard
						group={item}
						onPress={() => navigation.navigate('InvitePreview', { groupId: item.id })}
					/>
				) : (
					<GroupCard
						kind={item.kind}
						badgeLabel={t(cycleLabelKey(item.cycle))}
						badgeTone={BADGE_TONE_FOR_CYCLE[item.cycle]}
						// Cycle, then whether it has started. The design also has a "Kurucu" chip
						// here, but a group you created is one you're in, and those no longer reach
						// this list.
						extraBadges={[{ label: t(item.status === 'RUNNING' ? 'running' : 'notStarted') }]}
						footerCaption={
							item.splitMode === 'FLEXIBLE'
								? t('flexibleMembers', { count: item.memberCount })
								: item.isFull
								? `${t('full')} · ${item.spots}/${item.spots}`
								: `${item.spotsLeft} ${t('spotsLeft')} · ${item.memberCount}/${item.spots}`
						}
						footerLeading={<SeatStack />}
						footerTrailing={<GroupResetTime group={item} />}
						name={item.name}
						// Always the read-only preview: joining happens there, not from the row.
						onPress={() => navigation.navigate('InvitePreview', { groupId: item.id })}
						subtitle={`${t(cycleLabelKey(item.cycle))} · ${t(splitModeLabelKey(item.splitMode))}`}
					/>
				)}
			</Animated.View>
		),
		[cardLayout, navigation, t]
	);

	if (isError) {
		return <ErrorState queries={[discoverQuery]} />;
	}

	const empty = isPending ? (
		<GroupCardSkeleton statusLabel={t('loadingDiscover')} />
	) : (
		<ShelfEmptyState
			actions={
				<>
					{isNarrowed ? (
						<AppButton onPress={clearNarrowing} title={t('emptyDiscClear')} variant='surface' />
					) : null}
					<AppButton onPress={() => navigation.navigate('CreateGroup')} title={t('emptyDiscCreate')} />
				</>
			}
			description={t('emptyDiscSub')}
			hasMagnifier
			title={t('emptyDiscTitle')}
		/>
	);

	return (
		/*
		 * A **windowed list**. Discover is capped at fifty server-side, and every card carries
		 * badges, a seat stack and an animated progress bar — mapped into a `ScrollView` that
		 * is fifty full card trees mounted before the first one is on screen.
		 *
		 * The container hands over a flush surface so the list scrolls edge to edge; it keeps
		 * `paddingTop`, which is carrying the status-bar inset.
		 */
		<ScreenContainer contentContainerStyle={styles.flush} isScrollable={false} shouldIncludeTabBarOffset>
			<PullToRefresh {...pullToRefresh}>
				<FlatList
					contentContainerStyle={styles.listContent}
					data={visibleGroups}
					initialNumToRender={6}
					keyboardShouldPersistTaps='handled'
					keyExtractor={keyExtractor}
					ListEmptyComponent={empty}
					ListHeaderComponent={header}
					maxToRenderPerBatch={6}
					removeClippedSubviews
					renderItem={renderGroup}
					showsVerticalScrollIndicator={false}
					stickyHeaderIndices={[0]}
					windowSize={7}
				/>
			</PullToRefresh>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	// The list carries the screen's own padding so its scroll runs edge to edge; the container
	// keeps `paddingTop`, which is where the status-bar inset lives.
	flush: {
		paddingHorizontal: 0
	},
	header: {
		// `ScreenTitle` and the browse bar own their padding; the sticky wrapper only has to
		// be opaque, since a sticky child sits above the scrolling content.
		zIndex: 3
	},
	listContent: {
		gap: 12,
		paddingBottom: 24,
		paddingHorizontal: 20
	},
	loader: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 60
	}
});
