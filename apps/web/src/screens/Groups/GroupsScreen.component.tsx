import { GroupBrowseBar } from '@/components/GroupBrowseBar/GroupBrowseBar.component';
import { GroupCard } from '@/components/GroupCard/GroupCard.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { ShelfEmptyState } from '@/components/ShelfEmptyState/ShelfEmptyState.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useGetGroups } from '@/lib/hooks/useGroup';
import { CornerAction } from '@/components/ui/CornerAction/CornerAction.component';
import { RoundResetRow } from '@/components/RoundResetRow/RoundResetRow.component';
import { formatBabRange } from '@/lib/utils/babs';
import { roundResetLabels } from '@/lib/utils/roundReset';
import {
	applyGroupBrowse,
	emptyGroupBrowseState,
	isGroupBrowseNarrowed,
	type GroupBrowseState
} from '@/lib/utils/groupBrowse';
import { cycleLabelKey, planLabelKey, visibilityChipTone, visibilityLabelKey } from '@/lib/utils/groups';
import { GroupsScreenParams, TabStackParamList } from '@/navigation/types';
import { JoinByCodeSheet } from '@/screens/Join/JoinByCodeSheet.component';
import { useUser } from '@clerk/expo';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

type GroupsNavigationProp = NativeStackNavigationProp<TabStackParamList>;

/** Same motion as Keşfet — the shelf rearranges rather than repainting. */
const CARD_LAYOUT = LinearTransition.springify().damping(20).stiffness(180).mass(0.7);
const CARD_ENTERING = FadeIn.duration(200);
const CARD_EXITING = FadeOut.duration(140);

export const GroupsScreen = () => {
	const navigation = useNavigation<GroupsNavigationProp>();
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
	const { user } = useUser();
	const { data: groups, isError, isPending, refetch } = useGetGroups();
	const [isJoinSheetOpen, setIsJoinSheetOpen] = useState(false);
	const [browse, setBrowse] = useState<GroupBrowseState>(emptyGroupBrowseState);
	const route = useRoute<RouteProp<{ Groups: GroupsScreenParams }, 'Groups'>>();
	// Onboarding's "Davet kodum var" lands here asking for the sheet. Read as a second way
	// of being open rather than copied into state by an effect — the arriving param is
	// already a render's worth of information, and mirroring it would only cascade.
	const shouldOpenJoinSheet = route.params?.shouldOpenJoinSheet === true;
	const isJoinSheetVisible = isJoinSheetOpen || shouldOpenJoinSheet;

	const closeJoinSheet = () => {
		setIsJoinSheetOpen(false);

		// Cleared on dismissal, or the flag would reopen the sheet on the next render.
		if (shouldOpenJoinSheet) {
			navigation.setParams({ shouldOpenJoinSheet: undefined });
		}
	};

	const goToGroup = (groupId: string) => navigation.navigate('GroupDetail', { groupId });
	// Creators get the lobby they can start from; members get the waiting screen.
	const goToGathering = (groupId: string, isOwner: boolean) =>
		isOwner ? navigation.navigate('Lobby', { groupId }) : navigation.navigate('JoinedWelcome', { groupId });
	const goToCreateGroup = () => navigation.navigate('CreateGroup');
	// "Nothing on the shelf at all", which is a different state from "nothing matches" —
	// one offers ways to get a group, the other offers to stop narrowing.
	const isEmpty = !isPending && !isError && (!groups || groups.length === 0);

	/**
	 * The same controls as Keşfet, over the shelf instead of the catalogue. Every part of it
	 * is answered client-side here: `useGetGroups` already returns the whole shelf, so
	 * asking the server to search or sort a list we are holding would be a round trip for
	 * nothing.
	 */
	const visibleGroups = useMemo(() => applyGroupBrowse(groups, browse), [browse, groups]);
	const isNarrowed = isGroupBrowseNarrowed(browse);

	const isReducedMotion = useReducedMotion();
	const cardLayout = isReducedMotion ? undefined : CARD_LAYOUT;
	const cardEntering = isReducedMotion ? undefined : CARD_ENTERING;
	const cardExiting = isReducedMotion ? undefined : CARD_EXITING;

	// The design pins this block: the + stays reachable however far the shelf scrolls,
	// which is the whole reason it moved up here from the bottom of the list. It paints
	// the screen background because sticky children sit above the scrolling content.
	const header = (
		<View key='header' style={[styles.header, { backgroundColor: theme.colors.background }]}>
			<ScreenTitle
				action={
					isEmpty ? (
						// The design surfaces the count only when the shelf is empty, and drops
						// both buttons there — the empty state offers the same two errands as
						// full-width actions instead.
						<Typography color={theme.colors.faintText} variant='caption'>
							0
						</Typography>
					) : (
						// The key opens the join sheet; the + starts a group. Two ways onto the
						// shelf, the outlined one for the group somebody else already made.
						<View style={styles.headerActions}>
							<CornerAction
								accessibilityLabel={t('haveCode')}
								icon='key'
								onPress={() => setIsJoinSheetOpen(true)}
								tone='surface'
							/>
							<CornerAction accessibilityLabel={t('newGroup')} icon='plus' onPress={goToCreateGroup} />
						</View>
					)
				}
				label={t('myGroups')}
				secondaryLabel={t('greet', { name: user?.firstName ?? '' })}
			/>
			{/* Not on an empty shelf: a search box over nothing is a control with no subject,
			    and the empty state already offers the only three things worth doing. */}
			{isEmpty ? null : <GroupBrowseBar onChange={setBrowse} state={browse} />}
		</View>
	);

	return (
		<>
			<ScreenContainer shouldIncludeTabBarOffset stickyHeaderIndices={[0]}>
				{header}

				{isPending ? (
					<View style={styles.loader}>
						<ActivityIndicator color={theme.colors.accent} />
					</View>
				) : isError ? (
					<EmptyState actionLabel={t('retry')} onAction={refetch} title={t('genericError')} />
				) : !groups || groups.length === 0 ? (
					<ShelfEmptyState
						actions={
							<>
								<AppButton onPress={goToCreateGroup} title={t('emptyMyCreate')} />
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
						description={t('emptyMySub')}
						title={t('emptyMyTitle')}
					/>
				) : visibleGroups.length === 0 ? (
					// The shelf has groups; this narrowing just doesn't reach any of them. The
					// way out is to stop narrowing, not to go and make another group.
					<ShelfEmptyState
						actions={
							isNarrowed ? (
								<AppButton
									onPress={() => setBrowse(emptyGroupBrowseState)}
									title={t('emptyDiscClear')}
									variant='surface'
								/>
							) : null
						}
						description={t('emptyDiscSub')}
						hasMagnifier
						title={t('emptyDiscTitle')}
					/>
				) : (
					<>
						{visibleGroups.map(group => {
							// A gathering group has no progress to show — the card counts seats
							// instead, and its action is the owner's "start" rather than "continue".
							const isGathering = group.status === 'GATHERING';
							const openSpots = group.spots - group.memberCount;

							if (isGathering) {
								return (
									// Keyed on the wrapper so filtering and sorting *move* the cards
									// rather than repainting the column — same treatment as Keşfet.
									<Animated.View
										entering={cardEntering}
										exiting={cardExiting}
										key={group.id}
										layout={cardLayout}
									>
										<GroupCard
											// "Lobiyi gör", not the bare "Görüntüle" Discover uses for a group
											// you already belong to — one tap apart, the same word would be
											// carrying two different meanings.
											actionLabel={group.isOwner ? t('startNow') : t('viewLobby')}
											badgeLabel={t('lobbyState')}
											badgeTone='sand'
											footerCaption={
												group.isOwner
													? `${openSpots} ${t('openSpots')}`
													: formatBabRange(group.myBabNumbers)
											}
											footerLabel={
												group.isOwner ? `${t('creator')} · ${t('you')}` : t('provisional')
											}
											name={group.name}
											onAction={() => goToGathering(group.id, group.isOwner)}
											onPress={() => goToGathering(group.id, group.isOwner)}
											percent={Math.round((group.memberCount / group.spots) * 100)}
											readCount={group.memberCount}
											subtitle={t('notCounting')}
										/>
									</Animated.View>
								);
							}

							// A finished round has nothing left to continue, so it doesn't claim to.
							const isCompleted = group.completedAt !== null;
							// Called straight rather than through the hook: this is inside a map, and a
							// hook per card would change hook order as the list grows or shrinks.
							const reset = roundResetLabels(group.roundEndsAt, group.cycle, group.timezone, language, t);

							return (
								<Animated.View
									entering={cardEntering}
									exiting={cardExiting}
									key={group.id}
									layout={cardLayout}
								>
									<GroupCard
										actionLabel={isCompleted ? t('view') : t('continue')}
										badgeLabel={t(visibilityLabelKey(group.visibility))}
										badgeTone={visibilityChipTone(group.visibility)}
										footerCaption={`${t('todayLabel')} · ${group.myReadCount}/${
											group.myBabNumbers.length
										}`}
										footerLabel={`${t(planLabelKey(group.splitMode))} · ${formatBabRange(
											group.myBabNumbers
										)}`}
										// Filled even when the round is finished: the hatim itself is ongoing,
										// so a de-emphasised button would read as "this group is done".
										// Only the label softens — there is nothing left to continue today.
										isActionPrimary
										name={group.name}
										onAction={() => goToGroup(group.id)}
										onPress={() => goToGroup(group.id)}
										percent={group.percent}
										readCount={group.readCount}
										{...(reset
											? {
													resetRow: (
														<RoundResetRow
															groupLabel={reset.group}
															localLabel={reset.local}
														/>
													)
											  }
											: {})}
										// The ghost "Kurucu" tag, shown only on groups you started.
										{...(group.isOwner ? { extraBadges: [{ label: t('creator') }] } : {})}
										subtitle={
											group.dedication
												? t('forName', { dedication: group.dedication })
												: t('groupCycleLine', {
														cycle: t(cycleLabelKey(group.cycle)),
														count: group.memberCount
												  })
										}
									/>
								</Animated.View>
							);
						})}
					</>
				)}
			</ScreenContainer>

			<JoinByCodeSheet isVisible={isJoinSheetVisible} onClose={closeJoinSheet} />
		</>
	);
};

const styles = StyleSheet.create({
	header: {
		// ScreenTitle owns the design's `padding: 8px 0 18px`, so the sticky wrapper adds
		// none of its own — it only needs to be opaque.
		zIndex: 3
	},
	headerActions: {
		flexDirection: 'row',
		gap: 8
	},
	loader: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 60
	}
});
