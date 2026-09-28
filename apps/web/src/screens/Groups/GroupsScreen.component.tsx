import { GroupCard } from '@/components/GroupCard/GroupCard.component';
import { RoundResetRow } from '@/components/RoundResetRow/RoundResetRow.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { PullToRefresh } from '@/components/ui/PullToRefresh/PullToRefresh.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { ShelfEmptyState } from '@/components/ShelfEmptyState/ShelfEmptyState.component';
import { GroupCardSkeleton } from '@/components/Skeleton/GroupCardSkeleton.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useGetGroups } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { applyGroupBrowse, emptyGroupBrowseState, isGroupBrowseNarrowed } from '@/lib/utils/groupBrowse';
import {
	cycleLabelKey,
	partUnitKey,
	planLabelKey,
	shareSlices,
	visibilityChipTone,
	visibilityIcon,
	visibilityLabelKey
} from '@/lib/utils/groups';
import { roundResetLabels } from '@/lib/utils/roundReset';
import { unitCountFor } from '@/lib/utils/units';
import { GroupsScreenParams, TabStackParamList } from '@/navigation/types';
import { JoinByCodeSheet } from '@/screens/Join/JoinByCodeSheet.component';
import { useGroupBrowse } from '@/components/GroupBrowseBar/GroupBrowse.context';
import { useUser } from '@clerk/expo';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';

type GroupsNavigationProp = NativeStackNavigationProp<TabStackParamList>;

/** Same motion as Keşfet — the shelf rearranges rather than repainting. */
const CARD_LAYOUT = LinearTransition.springify().damping(20).stiffness(180).mass(0.7);
export const GroupsScreen = () => {
	const navigation = useNavigation<GroupsNavigationProp>();

	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
	const { user } = useUser();
	const groupsQuery = useGetGroups();
	const { data: groups, isError, isPending } = groupsQuery;
	const pullToRefresh = usePullToRefresh(groupsQuery);
	const [isJoinSheetOpen, setIsJoinSheetOpen] = useState(false);
	// Shared with the navigator's filter menu, which sits outside this screen — see the context.
	const { browse, setBrowse } = useGroupBrowse();
	const route = useRoute<RouteProp<{ Groups: GroupsScreenParams }, 'Groups'>>();
	// Onboarding's "Davet kodum var" lands here asking for the sheet. Read as a second way
	// of being open rather than copied into state by an effect — the arriving param is
	// already a render's worth of information, and mirroring it would only cascade.
	const shouldOpenJoinSheet = route.params?.shouldOpenJoinSheet === true;
	// A scanned QR lands here too (`groups/join/:inviteCode`), with the code to open the sheet on.
	const scannedInviteCode = route.params?.inviteCode;
	const isJoinSheetVisible = isJoinSheetOpen || shouldOpenJoinSheet || scannedInviteCode !== undefined;

	const closeJoinSheet = () => {
		setIsJoinSheetOpen(false);

		// Cleared on dismissal, or the params would reopen the sheet on the next render.
		if (shouldOpenJoinSheet || scannedInviteCode !== undefined) {
			navigation.setParams({ inviteCode: undefined, shouldOpenJoinSheet: undefined });
		}
	};

	// `useCallback` because the list's `renderItem` closes over these: a fresh function each
	// render would invalidate it and rebuild every row on screen.
	const goToGroup = useCallback((groupId: string) => navigation.navigate('GroupDetail', { groupId }), [navigation]);
	// Creators get the lobby they can start from; members get the waiting screen.
	const goToGathering = useCallback(
		(groupId: string, isOwner: boolean) =>
			isOwner ? navigation.navigate('Lobby', { groupId }) : navigation.navigate('JoinedWelcome', { groupId }),
		[navigation]
	);
	const goToCreateGroup = useCallback(() => navigation.navigate('CreateGroup'), [navigation]);
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

	// The design pins this block: the + stays reachable however far the shelf scrolls,
	// which is the whole reason it moved up here from the bottom of the list. It paints
	// the screen background because sticky children sit above the scrolling content.
	const header = (
		<View key='header' style={[styles.header, { backgroundColor: theme.colors.background }]}>
			<ScreenTitle
				// The count only, and only on an empty shelf — the design surfaces it there and
				// nowhere else. The key and the + moved into the navigator's bar; see the effect
				// above.
				action={
					isEmpty ? (
						<Typography color={theme.colors.faintText} variant='caption'>
							0
						</Typography>
					) : null
				}
				// The key and the + sit in the navigator's bar above, so the greeting starts
				// below it rather than behind them.
				isUnderNavigationBar
				label={t('myGroups')}
				// "Selâm" alone without a first name, rather than "Selâm, " — as on Ana sayfa.
				secondaryLabel={
					user?.firstName?.trim() ? t('greet', { name: user.firstName.trim() }) : t('greetNoName')
				}
			/>
			{/* No search box: searching is the Ara tab's job. Filter and sort are the navigator's pull-down. */}
		</View>
	);

	type Row = (typeof visibleGroups)[number];

	const keyExtractor = useCallback((group: Row) => group.id, []);

	const renderGroup = useCallback(
		({ item }: { item: Row }) => {
			// A gathering group has no progress to show — the card counts seats instead, and
			// its action is the owner's "start" rather than "continue".
			const isGathering = item.status === 'GATHERING';
			/*
			 * The share as **one slice plus a count**, never a list — on both cards, reserved or
			 * running. A hatim's next cüz and how many others it holds; a Cevşen share's current
			 * block and how many more blocks sit on top of it.
			 */
			const hatimCurrent = item.myNextBabNumber ?? item.myBabNumbers[0];
			const share =
				item.kind === 'HATIM'
					? {
							current: hatimCurrent === undefined ? '—' : String(hatimCurrent),
							moreCount: Math.max(0, item.myBabNumbers.length - 1)
					  }
					: shareSlices(item.myBabNumbers, item.myNextBabNumber);
			const shareLabelKey = item.kind === 'HATIM' ? 'qMyCuz' : 'yourRange';

			/*
			 * `layout` only. `entering`/`exiting` used to sit here as well, so a filter change
			 * faded rows in and out — but in a windowed list those fire whenever a row enters
			 * the window, so every card would fade in as you scrolled past it. `layout` still
			 * animates a row that *moves*, which is the filter-and-sort case it was for.
			 */
			if (isGathering) {
				const openSpots = item.spots - item.memberCount;
				/*
				 * The count sits beside "/ 30 cüz" or "/ 100 bab", so it counts units, not people: a
				 * hatim member can hold several cüz, and a Cevşen seat reserves a block. Whatever is
				 * not in the pool — cüz nobody holds, blocks of empty seats — is taken.
				 */
				const unitCount = unitCountFor(item.kind);
				const gathered = unitCount - item.poolBabNumbers.length;

				return (
					<Animated.View layout={cardLayout}>
						<GroupCard
							kind={item.kind}
							// "Lobiyi gör", not the bare "Görüntüle" Discover uses for a group you
							// already belong to — one tap apart, the same word would be carrying two
							// different meanings.
							actionLabel={item.isOwner ? t('startNow') : t('viewLobby')}
							badgeLabel={t('lobbyState')}
							badgeTone='sand'
							// The same ghost "Kurucu" tag the running card carries, so a group
							// doesn't stop saying it is yours while it gathers.
							{...(item.isOwner ? { extraBadges: [{ label: t('creator') }] } : {})}
							// A joiner's reservation reads like the running card's share — "Cüzlerin · 9"
							// with a chip — and the caption says it isn't final yet.
							footerCaption={item.isOwner ? `${openSpots} ${t('openSpots')}` : t('provisional')}
							footerLabel={
								item.isOwner
									? `${t('creator')} · ${t('you')}`
									: `${t(shareLabelKey)} · ${share.current}`
							}
							footerMoreCount={item.isOwner ? 0 : share.moreCount}
							name={item.name}
							onAction={() => goToGathering(item.id, item.isOwner)}
							onPress={() => goToGathering(item.id, item.isOwner)}
							/*
							 * A seat group (Cevşen, Hizb) counts members out of seats, as its lobby does —
							 * "4 / 12 katıldı"; it read "4 / 100 bab" once, a seat count set against the
							 * hundred. A hatim counts cüz taken out of thirty: a member may hold several,
							 * and its `spots` is only a ceiling on membership.
							 */
							progress={
								item.kind === 'HATIM'
									? {
											kind: item.kind,
											percent: Math.round((gathered / unitCount) * 100),
											readCount: gathered,
											total: unitCount,
											unit: t(partUnitKey(item.kind))
									  }
									: {
											kind: item.kind,
											percent: Math.round((item.memberCount / item.spots) * 100),
											readCount: item.memberCount,
											total: item.spots,
											unit: t('joinedCount')
									  }
							}
							subtitle={t('notCounting')}
						/>
					</Animated.View>
				);
			}

			// A finished round has nothing left to continue, so it doesn't claim to.
			const isCompleted = item.completedAt !== null;
			// Called straight rather than through the hook: this renders per row, and a hook
			// per card would change hook order as the list grows or shrinks.
			const reset = roundResetLabels(
				item.roundEndsAt,
				item.cycle,
				item.roundDays,
				item.timezone,
				language,
				t,
				item.kind,
				item.startedAt
			);
			const isFlexible = item.splitMode === 'FLEXIBLE';

			return (
				<Animated.View layout={cardLayout}>
					<GroupCard
						kind={item.kind}
						actionLabel={isCompleted ? t('view') : t('continue')}
						badgeIcon={visibilityIcon(item.visibility)}
						badgeLabel={item.hizbIndividual ? t('hpIndividual') : t(visibilityLabelKey(item.visibility))}
						badgeTone={visibilityChipTone(item.visibility)}
						// The round's cadence, not "Bugün": a weekly share's 3/3 is this week's. A Hizb plan
						// says whether today's portion is done; a FLEXIBLE group has no share, so it counts people.
						footerCaption={
							item.hizbIndividual
								? t(item.hizbToday?.completed ? 'hpComplete' : 'hpPending')
								: isFlexible
								? t('flexibleMembers', { count: item.memberCount })
								: `${t(cycleLabelKey(item.cycle))} · ${item.myReadCount}/${item.myBabNumbers.length}`
						}
						/*
						 * **A hatim has no reading plan to name.** `splitMode` decides which block a
						 * seat rotates onto, and a hatim has neither — it stores `FIXED` because the
						 * column cannot be empty, so the Cevşen label would read "Sabit · 7, 22" and
						 * describe nothing. The design's own footer names the holding instead:
						 * "Cüzlerin · 7, 22". A FLEXIBLE group (Cevşen or Hizb) names its plan.
						 *
						 * **One slice plus a count**, never the list: "Cüzlerin · 7" with a +1 chip, and
						 * a Cevşen share with pool blocks on top as its current block plus a chip.
						 */
						footerLabel={
							isFlexible
								? item.hizbPlan != null
									? item.hizbPlan
										? t('hpDays', { days: item.hizbPlan })
										: t('hpMixed')
									: t('planFlexible')
								: `${item.kind === 'HATIM' ? t('qMyCuz') : t(planLabelKey(item.splitMode))} · ${
										share.current
								  }`
						}
						footerMoreCount={isFlexible ? 0 : share.moreCount}
						// Filled even when the round is finished: the hatim itself is ongoing, so a
						// de-emphasised button would read as "this group is done". Only the label
						// softens — there is nothing left to continue today.
						isActionPrimary
						name={item.name}
						onAction={() => goToGroup(item.id)}
						onPress={() => goToGroup(item.id)}
						progress={{
							kind: item.kind,
							percent: item.percent,
							readCount: item.readCount,
							total: item.partCount,
							// A private plan counts today's one reading: "1 / 1 bölüm", never "1 / 1 portions".
							unit: t(item.partCount === 1 ? 'portionsOne' : partUnitKey(item.kind))
						}}
						{...(reset
							? { resetRow: <RoundResetRow groupLabel={reset.group} localLabel={reset.local} /> }
							: {})}
						// The ghost "Kurucu" tag, shown only on groups you started.
						{...(item.isOwner ? { extraBadges: [{ label: t('creator') }] } : {})}
						subtitle={
							item.dedication
								? t('forName', { dedication: item.dedication })
								: t(pluralKey(language, item.memberCount, 'groupCycleLineOne', 'groupCycleLine'), {
										cycle: t(cycleLabelKey(item.cycle)),
										count: item.memberCount
								  })
						}
					/>
				</Animated.View>
			);
		},
		[cardLayout, goToGathering, goToGroup, language, t]
	);

	if (isError) {
		return <ErrorState queries={[groupsQuery]} />;
	}

	const empty = isPending ? (
		<GroupCardSkeleton statusLabel={t('loadingGroups')} />
	) : !groups || groups.length === 0 ? (
		<ShelfEmptyState
			actions={
				<>
					<AppButton onPress={goToCreateGroup} title={t('emptyMyCreate')} />
					<AppButton onPress={() => setIsJoinSheetOpen(true)} title={t('emptyMyJoin')} variant='surface' />
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
	) : (
		// The shelf has groups; this narrowing just doesn't reach any of them. The way out is
		// to stop narrowing, not to go and make another group.
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
	);

	return (
		<>
			{/*
			 * A **windowed list**. The shelf has no cap — it holds every group you belong to,
			 * and each card carries badges, a progress bar and a reset row — so mapping them
			 * into a `ScrollView` mounted the whole history before the first card was on
			 * screen. The container hands over a flush surface and keeps only `paddingTop`,
			 * which is where the status-bar inset lives.
			 */}
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

			<JoinByCodeSheet
				{...(scannedInviteCode === undefined ? {} : { initialCode: scannedInviteCode })}
				isVisible={isJoinSheetVisible}
				onClose={closeJoinSheet}
			/>
		</>
	);
};

const styles = StyleSheet.create({
	// The list carries the screen's padding so its scroll runs edge to edge; the container
	// keeps `paddingTop`, which is where the status-bar inset lives.
	flush: {
		paddingHorizontal: 0
	},
	listContent: {
		gap: 12,
		paddingBottom: 24,
		paddingHorizontal: 20
	},
	header: {
		// ScreenTitle owns the design's `padding: 8px 0 18px`, so the sticky wrapper adds
		// none of its own — it only needs to be opaque.
		zIndex: 3
	},
	loader: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 60
	}
});
