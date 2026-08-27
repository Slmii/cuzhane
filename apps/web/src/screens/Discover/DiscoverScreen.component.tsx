import { GroupCard } from '@/components/GroupCard/GroupCard.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { ShelfEmptyState } from '@/components/ShelfEmptyState/ShelfEmptyState.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import type { ChipTone } from '@/components/ui/Chip/Chip.types';
import { Divider } from '@/components/ui/Divider/Divider.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { SeatStack } from '@/components/ui/SeatStack/SeatStack.component';
import { BodyStrongText, CaptionText, EyebrowText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useDiscoverGroups } from '@/lib/hooks/useGroup';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { StringKey } from '@/lib/i18n/strings';
import type { GroupCycle } from '@/lib/types/domain';
import { cycleLabelKey, splitModeLabelKey } from '@/lib/utils/groups';
import { TabStackParamList } from '@/navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

type DiscoverNavigationProp = NativeStackNavigationProp<TabStackParamList>;

/** The design's filter sheet: "all" first, then the three cadences. */
const FILTER_OPTIONS: (GroupCycle | undefined)[] = [undefined, 'DAILY', 'WEEKLY'];

type SortKey = 'newest' | 'seats' | 'soon';

/** Order matches the sheet: newest, most seats free, starting soon. */
const SORT_OPTIONS: { key: SortKey; labelKey: StringKey }[] = [
	{ key: 'newest', labelKey: 'sortNewest' },
	{ key: 'seats', labelKey: 'sortMostSeats' },
	{ key: 'soon', labelKey: 'sortStartingSoon' }
];

const DEFAULT_SORT: SortKey = 'newest';

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
	const [searchInput, setSearchInput] = useState('');
	const [search, setSearch] = useState('');
	const [cycle, setCycle] = useState<GroupCycle | undefined>(undefined);
	const [isNotStartedOnly, setIsNotStartedOnly] = useState(false);
	const [hasSeatsOnly, setHasSeatsOnly] = useState(false);
	const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT);
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [isSortOpen, setIsSortOpen] = useState(false);

	// Someone who has asked the OS for less motion gets the instant reorder they asked for.
	const isReducedMotion = useReducedMotion();
	const cardLayout = isReducedMotion ? undefined : CARD_LAYOUT;
	const cardEntering = isReducedMotion ? undefined : CARD_ENTERING;
	const cardExiting = isReducedMotion ? undefined : CARD_EXITING;

	const isFilterActive = cycle !== undefined || isNotStartedOnly || hasSeatsOnly;
	const isSortActive = sortKey !== DEFAULT_SORT;
	// Only offer "clear" when something is actually narrowing the list; with neither a
	// query nor a filter there is genuinely nothing to browse, not nothing matching.
	const isNarrowed = isFilterActive || searchInput.trim() !== '';

	const clearNarrowing = () => {
		setCycle(undefined);
		setIsNotStartedOnly(false);
		setHasSeatsOnly(false);
		setSearchInput('');
	};

	useEffect(() => {
		const handle = setTimeout(() => setSearch(searchInput.trim()), 300);

		return () => clearTimeout(handle);
	}, [searchInput]);

	const { data: groups, isError, isPending, refetch } = useDiscoverGroups({ cycle, search: search || undefined });

	/**
	 * One source list, narrowed and ordered here. The cadence and the search term go to the
	 * server because they decide *which* groups exist for this browse; Durum and the sort
	 * are answered by fields every row already carries, so sending them would be a round
	 * trip to reorder something we are holding.
	 */
	const visibleGroups = useMemo(() => {
		const filtered = (groups ?? []).filter(
			group => (!isNotStartedOnly || group.status === 'GATHERING') && (!hasSeatsOnly || group.spotsLeft > 0)
		);

		return [...filtered].sort((a, b) => {
			if (sortKey === 'seats') {
				return b.spotsLeft - a.spotsLeft;
			}

			if (sortKey === 'soon') {
				// "Yakında başlıyor" — a gathering group starts when it fills, so the one with
				// fewest seats left is nearest to opening. Groups already running have no start
				// to wait for and sit below them.
				const aWaiting = a.status === 'GATHERING';
				const bWaiting = b.status === 'GATHERING';

				if (aWaiting !== bWaiting) {
					return aWaiting ? -1 : 1;
				}

				return a.spotsLeft - b.spotsLeft;
			}

			return Date.parse(b.createdAt) - Date.parse(a.createdAt);
		});
	}, [groups, hasSeatsOnly, isNotStartedOnly, sortKey]);

	// Title, search box and filter pinned as one block: searching a long list is exactly
	// when you scroll away from the field, and having to scroll back up to change a term
	// is what makes a search feel like a form rather than a filter.
	const header = (
		<View key='header' style={[styles.header, { backgroundColor: theme.colors.background }]}>
			<ScreenTitle label={t('discover')} />

			<View style={styles.searchRow}>
				<View
					style={[
						styles.searchField,
						{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
					]}
				>
					<Icon color={theme.colors.faintText} name='search' size={15} strokeWidth={1.7} />
					<TextInput
						onChangeText={setSearchInput}
						placeholder={t('searchGroups')}
						placeholderTextColor={theme.colors.faintText}
						style={[styles.searchInput, { color: theme.colors.text, fontFamily: appFonts.regular }]}
						value={searchInput}
					/>
				</View>
				<Pressable
					accessibilityLabel={t('filterTitle')}
					accessibilityRole='button'
					onPress={() => setIsFilterOpen(true)}
					style={({ pressed }) => [
						styles.filterButton,
						{
							backgroundColor: isFilterActive ? theme.colors.accentSoft : theme.colors.surface,
							borderColor: isFilterActive ? theme.colors.accent : theme.colors.border,
							opacity: pressed ? 0.7 : 1
						}
					]}
				>
					<Icon
						color={isFilterActive ? theme.colors.accent : theme.colors.subtext}
						name='filter'
						size={20}
						strokeWidth={1.6}
					/>
					{isFilterActive ? (
						<View style={[styles.filterDot, { backgroundColor: theme.colors.accent }]} />
					) : null}
				</Pressable>
				{/* Its own control, not a row inside the filter sheet: narrowing and ordering
				    are different questions, and folding the second into the first hides it. */}
				<Pressable
					accessibilityLabel={t('sortTitle')}
					accessibilityRole='button'
					onPress={() => setIsSortOpen(true)}
					style={({ pressed }) => [
						styles.filterButton,
						{
							backgroundColor: isSortActive ? theme.colors.accentSoft : theme.colors.surface,
							borderColor: isSortActive ? theme.colors.accent : theme.colors.border,
							opacity: pressed ? 0.7 : 1
						}
					]}
				>
					<Icon
						color={isSortActive ? theme.colors.accent : theme.colors.subtext}
						name='sort'
						size={20}
						strokeWidth={1.6}
					/>
					{isSortActive ? (
						<View style={[styles.filterDot, { backgroundColor: theme.colors.accent }]} />
					) : null}
				</Pressable>
			</View>
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
							// The key has to be on this wrapper — a layout animation belongs to the
							// element whose position React is changing.
							<Animated.View
								entering={cardEntering}
								exiting={cardExiting}
								key={group.id}
								layout={cardLayout}
							>
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
									subtitle={`${t(cycleLabelKey(group.cycle))} · ${t(
										splitModeLabelKey(group.splitMode)
									)}`}
								/>
							</Animated.View>
						);
					})
				)}
			</ScreenContainer>

			<AppBottomSheet isVisible={isFilterOpen} onClose={() => setIsFilterOpen(false)} title={t('filterTitle')}>
				<EyebrowText color={theme.colors.faintText} style={styles.filterEyebrow}>
					{t('filterCadence')}
				</EyebrowText>
				<CardSurface isFlush style={styles.filterCard}>
					{FILTER_OPTIONS.map((option, index) => {
						const isSelected = cycle === option;

						return (
							<View key={option ?? 'all'}>
								{index > 0 ? <Divider /> : null}
								<Pressable
									accessibilityRole='radio'
									accessibilityState={{ selected: isSelected }}
									// Picking doesn't dismiss. The sheet now holds two sections and an
									// Uygula, so closing on the first tap would take Durum away
									// before it had been answered.
									onPress={() => setCycle(option)}
									style={({ pressed }) => [styles.filterRow, { opacity: pressed ? 0.7 : 1 }]}
								>
									<BodyStrongText>
										{option ? t(cycleLabelKey(option)) : t('allGroups')}
									</BodyStrongText>
									<View
										style={[
											styles.filterRing,
											{
												borderColor: isSelected
													? theme.colors.accent
													: theme.colors.borderStrong
											}
										]}
									>
										<View
											style={[
												styles.filterRingDot,
												{
													backgroundColor: isSelected
														? theme.colors.accent
														: theme.colors.transparent
												}
											]}
										/>
									</View>
								</Pressable>
							</View>
						);
					})}
				</CardSurface>

				{/*
				 * Durum: two independent conditions, so checkboxes rather than the radio ring
				 * above. Neither closes the sheet — you may well want both, and a sheet that
				 * shuts on the first tap makes the second one a second trip.
				 */}
				<EyebrowText color={theme.colors.faintText} style={styles.filterEyebrow}>
					{t('filterStatus')}
				</EyebrowText>
				<CardSurface isFlush style={styles.filterCard}>
					{[
						{
							isOn: isNotStartedOnly,
							label: t('fNotStarted'),
							onToggle: () => setIsNotStartedOnly(value => !value),
							sub: t('fNotStartedSub')
						},
						{
							isOn: hasSeatsOnly,
							label: t('fSeats'),
							onToggle: () => setHasSeatsOnly(value => !value),
							sub: t('fSeatsSub')
						}
					].map((row, index) => (
						<View key={row.label}>
							{index > 0 ? <Divider /> : null}
							<Pressable
								accessibilityRole='checkbox'
								accessibilityState={{ checked: row.isOn }}
								onPress={row.onToggle}
								style={({ pressed }) => [styles.statusRow, { opacity: pressed ? 0.7 : 1 }]}
							>
								<View style={styles.statusCopy}>
									<BodyStrongText>{row.label}</BodyStrongText>
									<CaptionText color={theme.colors.subtext}>{row.sub}</CaptionText>
								</View>
								<View
									style={[
										styles.statusBox,
										{
											backgroundColor: row.isOn ? theme.colors.accent : theme.colors.transparent,
											borderColor: row.isOn ? theme.colors.accent : theme.colors.borderStrong
										}
									]}
								>
									{row.isOn ? (
										<Icon color={theme.colors.onAccent} name='check' size={12} strokeWidth={2.6} />
									) : null}
								</View>
							</Pressable>
						</View>
					))}
				</CardSurface>

				<AppButton onPress={() => setIsFilterOpen(false)} title={t('filterApply')} />
			</AppBottomSheet>

			<AppBottomSheet isVisible={isSortOpen} onClose={() => setIsSortOpen(false)} title={t('sortTitle')}>
				<CardSurface isFlush style={styles.filterCard}>
					{SORT_OPTIONS.map((option, index) => {
						const isSelected = sortKey === option.key;

						return (
							<View key={option.key}>
								{index > 0 ? <Divider /> : null}
								<Pressable
									accessibilityRole='radio'
									accessibilityState={{ selected: isSelected }}
									onPress={() => {
										setSortKey(option.key);
										setIsSortOpen(false);
									}}
									style={({ pressed }) => [styles.filterRow, { opacity: pressed ? 0.7 : 1 }]}
								>
									<BodyStrongText>{t(option.labelKey)}</BodyStrongText>
									<View
										style={[
											styles.filterRing,
											{
												borderColor: isSelected
													? theme.colors.accent
													: theme.colors.borderStrong
											}
										]}
									>
										<View
											style={[
												styles.filterRingDot,
												{
													backgroundColor: isSelected
														? theme.colors.accent
														: theme.colors.transparent
												}
											]}
										/>
									</View>
								</Pressable>
							</View>
						);
					})}
				</CardSurface>
			</AppBottomSheet>
		</>
	);
};

const styles = StyleSheet.create({
	loader: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 60
	},
	searchInput: {
		flex: 1,
		fontSize: 13,
		padding: 0
	},
	filterButton: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: StyleSheet.hairlineWidth,
		flex: 0,
		justifyContent: 'center',
		width: 46
	},
	// 16 under every card, 9 under every eyebrow — so a section reads as a heading bound to
	// the card beneath it, and "Uygula" sits clear of the last one rather than against it.
	// Sized for the sheet to have two sections; at the old 4 they ran together.
	filterCard: {
		marginBottom: 16
	},
	filterDot: {
		borderRadius: 3,
		height: 6,
		position: 'absolute',
		right: 9,
		top: 9,
		width: 6
	},
	filterEyebrow: {
		marginBottom: 9
	},
	filterRing: {
		alignItems: 'center',
		borderRadius: 9,
		borderWidth: 1.5,
		height: 18,
		justifyContent: 'center',
		width: 18
	},
	statusBox: {
		alignItems: 'center',
		borderRadius: 6,
		borderWidth: 1.5,
		height: 20,
		justifyContent: 'center',
		width: 20
	},
	statusCopy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	statusRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	filterRingDot: {
		borderRadius: 4,
		height: 8,
		width: 8
	},
	filterRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		padding: 15
	},
	searchField: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: StyleSheet.hairlineWidth,
		flex: 1,
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 14,
		paddingVertical: 12
	},
	header: {
		// `ScreenTitle` and `searchRow` own their padding; the sticky wrapper only has to be
		// opaque, since a sticky child sits above the scrolling content.
		zIndex: 3
	},
	searchRow: {
		alignItems: 'stretch',
		flexDirection: 'row',
		gap: 9,
		marginBottom: 16
	}
});
