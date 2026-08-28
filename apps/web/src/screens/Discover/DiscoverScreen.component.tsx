import { GroupBrowseBar } from '@/components/GroupBrowseBar/GroupBrowseBar.component';
import { GroupCard } from '@/components/GroupCard/GroupCard.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
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
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

type DiscoverNavigationProp = NativeStackNavigationProp<TabStackParamList>;

/**
 * Reordering the list is a *move*, so the cards travel to their new places instead of the
 * whole column repainting. A spring rather than a duration: several cards slide different
 * distances at once, and a spring keeps them feeling like one shelf being rearranged.
 * Entering and leaving rows only fade — sliding them in as well reads as motion for its
 * own sake when the cause was a filter, not a scroll.
 */
const CARD_LAYOUT = LinearTransition.springify().damping(20).stiffness(180).mass(0.7);
const CARD_ENTERING = FadeIn.duration(200);
const CARD_EXITING = FadeOut.duration(140);

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
	const cardEntering = isReducedMotion ? undefined : CARD_ENTERING;
	const cardExiting = isReducedMotion ? undefined : CARD_EXITING;

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

	return (
		<ScreenContainer shouldIncludeTabBarOffset stickyHeaderIndices={[0]}>
			{header}

			{isPending ? (
				<View style={styles.loader}>
					<ActivityIndicator color={theme.colors.accent} />
				</View>
			) : isError ? (
				<EmptyState actionLabel={t('retry')} onAction={refetch} title={t('genericError')} />
			) : visibleGroups.length === 0 ? (
				<ShelfEmptyState
					actions={
						<>
							{isNarrowed ? (
								<AppButton onPress={clearNarrowing} title={t('emptyDiscClear')} variant='surface' />
							) : null}
							<AppButton
								onPress={() => navigation.navigate('CreateGroup')}
								title={t('emptyDiscCreate')}
							/>
						</>
					}
					description={t('emptyDiscSub')}
					hasMagnifier
					title={t('emptyDiscTitle')}
				/>
			) : (
				visibleGroups.map(group => {
					// Discover never lists a group you're already in, so every row here is one
					// you could join — the only distinction left is whether it has room.
					const actionLabel = group.isFull ? t('full') : t('join');
					// Public groups are always open, and joining happens on the preview — so
					// the row's label describes what you'll find rather than acting itself.
					const statusBadge = { label: t(group.status === 'RUNNING' ? 'running' : 'notStarted') };
					const seatsCaption = group.isFull
						? `${t('full')} · ${group.spots}/${group.spots}`
						: `${group.spotsLeft} ${t('spotsLeft')} · ${group.memberCount}/${group.spots}`;

					// Always the read-only preview: joining happens there, not from the row.
					const openRow = () => navigation.navigate('InvitePreview', { groupId: group.id });

					return (
						// Keyed on the group, so changing the filter or the sort *moves* these
						// cards rather than replacing them: `layout` carries each one to its new
						// place, and rows joining or leaving the result fade instead of blinking.
						<Animated.View entering={cardEntering} exiting={cardExiting} key={group.id} layout={cardLayout}>
							<GroupCard
								actionLabel={actionLabel}
								badgeLabel={t(cycleLabelKey(group.cycle))}
								badgeTone={badgeToneForCycle(group.cycle)}
								// Cycle, then whether it has started. The design also has a "Kurucu"
								// chip here, but a group you created is one you're in, and those no
								// longer reach this list.
								extraBadges={[statusBadge]}
								footerCaption={seatsCaption}
								footerLeading={<SeatStack />}
								isActionPrimary={!group.isFull}
								name={group.name}
								onPress={openRow}
								subtitle={`${t(cycleLabelKey(group.cycle))} · ${t(splitModeLabelKey(group.splitMode))}`}
							/>
						</Animated.View>
					);
				})
			)}
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	header: {
		// `ScreenTitle` and the browse bar own their padding; the sticky wrapper only has to
		// be opaque, since a sticky child sits above the scrolling content.
		zIndex: 3
	},
	loader: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 60
	}
});
