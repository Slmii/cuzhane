import { GroupBrowseBar } from '@/components/GroupBrowseBar/GroupBrowseBar.component';
import { GroupCard } from '@/components/GroupCard/GroupCard.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { GroupCardSkeleton } from '@/components/Skeleton/GroupCardSkeleton.component';
import { ShelfEmptyState } from '@/components/ShelfEmptyState/ShelfEmptyState.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import type { ChipTone } from '@/components/ui/Chip/Chip.types';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { SeatStack } from '@/components/ui/SeatStack/SeatStack.component';
import { useDiscoverGroups } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupCycle } from '@/lib/types/domain';
import {
	applyGroupBrowse,
	emptyGroupBrowseState,
	isGroupBrowseNarrowed,
	type GroupBrowseState
} from '@/lib/utils/groupBrowse';
import { cycleLabelKey, splitModeLabelKey } from '@/lib/utils/groups';
import { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
const SEARCH_DEBOUNCE_MS = 300;

const badgeToneForCycle = (cycle: GroupCycle): ChipTone => {
	switch (cycle) {
		case 'WEEKLY':
			return 'accent';
		case 'DAILY':
			return 'sand';
		default:
			return 'neutral';
	}
};

export const DiscoverScreen = () => {
	const navigation = useNavigation<DiscoverNavigationProp>();
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const [browse, setBrowse] = useState<GroupBrowseState>(emptyGroupBrowseState);
	/** Debounced copy of the query, so a request isn't sent per keystroke. */
	const [search, setSearch] = useState('');

	// Someone who has asked the OS for less motion gets the instant reorder they asked for.
	const isReducedMotion = useReducedMotion();
	const cardLayout = isReducedMotion ? undefined : CARD_LAYOUT;

	// Only offer "clear" when something is actually narrowing the list; with neither a
	// query nor a filter there is genuinely nothing to browse, not nothing matching.
	const isNarrowed = isGroupBrowseNarrowed(browse);

	const clearNarrowing = () => setBrowse(emptyGroupBrowseState);

	useEffect(() => {
		const handle = setTimeout(() => setSearch(browse.search.trim()), SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(handle);
	}, [browse.search]);

	const {
		data: groups,
		isError,
		isPending,
		refetch
	} = useDiscoverGroups({ cycle: browse.cycle, search: search || undefined });

	/**
	 * The cadence and the search term also go to the server, because they decide *which*
	 * groups exist for this browse; re-applying them here is a no-op that keeps one function
	 * responsible for what the controls mean. Durum and the sort are answered by fields
	 * every row already carries, so sending them would be a round trip to reorder something
	 * we are holding.
	 */
	const visibleGroups = useMemo(() => applyGroupBrowse(groups, { ...browse, search }), [browse, groups, search]);

	// Title, search box and filter pinned as one block: searching a long list is exactly
	// when you scroll away from the field, and having to scroll back up to change a term
	// is what makes a search feel like a form rather than a filter.
	const header = (
		<View key='header' style={[styles.header, { backgroundColor: theme.colors.background }]}>
			<ScreenTitle label={t('discover')} />
			<GroupBrowseBar onChange={setBrowse} state={browse} />
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
				<GroupCard
					actionLabel={item.isFull ? t('full') : t('join')}
					badgeLabel={t(cycleLabelKey(item.cycle))}
					badgeTone={badgeToneForCycle(item.cycle)}
					// Cycle, then whether it has started. The design also has a "Kurucu" chip
					// here, but a group you created is one you're in, and those no longer reach
					// this list.
					extraBadges={[{ label: t(item.status === 'RUNNING' ? 'running' : 'notStarted') }]}
					footerCaption={
						item.isFull
							? `${t('full')} · ${item.spots}/${item.spots}`
							: `${item.spotsLeft} ${t('spotsLeft')} · ${item.memberCount}/${item.spots}`
					}
					footerLeading={<SeatStack />}
					isActionPrimary={!item.isFull}
					name={item.name}
					// Always the read-only preview: joining happens there, not from the row.
					onPress={() => navigation.navigate('InvitePreview', { groupId: item.id })}
					subtitle={`${t(cycleLabelKey(item.cycle))} · ${t(splitModeLabelKey(item.splitMode))}`}
				/>
			</Animated.View>
		),
		[cardLayout, navigation, t]
	);

	const empty = isPending ? (
		<GroupCardSkeleton statusLabel={t('loadingDiscover')} />
	) : isError ? (
		<EmptyState actionLabel={t('retry')} onAction={refetch} title={t('genericError')} />
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
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	// The list carries the screen's own padding so its scroll runs edge to edge; the container
	// keeps `paddingTop`, which is where the status-bar inset lives.
	flush: {
		paddingBottom: 0,
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
