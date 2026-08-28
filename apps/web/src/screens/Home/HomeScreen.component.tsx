import { ShelfEmptyState } from '@/components/ShelfEmptyState/ShelfEmptyState.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { CaptionText, EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { useSetAllBabsRead } from '@/lib/hooks/useBab';
import { useGetGroups } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { formatBabRange } from '@/lib/utils/babs';
import { TabStackParamList } from '@/navigation/types';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JoinByCodeSheet } from '@/screens/Join/JoinByCodeSheet.component';
import { DockRing, DOCK_DISTANCE } from './DockRing.component';
import type { DockRingGroup } from './DockRing.types';

type HomeNavigationProp = NativeStackNavigationProp<TabStackParamList>;

const SCREEN_HORIZONTAL_PADDING = 20;

/** The design's reserved blocks, in order, above the reader's own content. */
const HERO_HEIGHT = 25;
const GAP_NAME = 34;
const CAPTION_HEIGHT = 16;
const GAP_RANGE = 36;
const GAP_RING = 252;

/** Below this, the finger lifted without throwing the list — no momentum will follow. */
const MOMENTUM_EPSILON = 0.1;

/**
 * 01g — Ana ekran.
 *
 * Every group the reader belongs to, in one column, with a single ring bound to one of
 * them. Tapping a row *moves* the ring; the ring is the only thing that commits, which is
 * what keeps a scrolling list of twenty groups from being twenty places to make a mistake.
 *
 * Scrolling docks that same ring into the pinned pill — see `DockRing`.
 */
export const HomeScreen = () => {
	const navigation = useNavigation<HomeNavigationProp>();
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const tabBarHeight = useContext(TabBarOffsetContext);

	const { data: groups, isError, isPending, refetch } = useGetGroups();
	const setAllBabsRead = useSetAllBabsRead();

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isJoinSheetOpen, setIsJoinSheetOpen] = useState(false);
	const [width, setWidth] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);
	const scrollRef = useRef<ScrollView>(null);

	/**
	 * The dock is scroll-driven, so letting go mid-travel left the ring frozen between its
	 * two designed states — neither the full ring nor the pill. Anything in between snaps to
	 * whichever end is nearer, so the animation always completes or never starts.
	 */
	const snapDock = useCallback((offsetY: number) => {
		if (offsetY <= 0 || offsetY >= DOCK_DISTANCE) {
			return;
		}

		scrollRef.current?.scrollTo({ animated: true, y: offsetY < DOCK_DISTANCE / 2 ? 0 : DOCK_DISTANCE });
	}, []);
	const scrollY = useSharedValue(0);

	const scrollHandler = useAnimatedScrollHandler(event => {
		scrollY.value = event.contentOffset.y;
	});

	// Only a running group owes the reader anything today.
	const rows = useMemo<DockRingGroup[]>(
		() =>
			(groups ?? [])
				.filter(group => group.status === 'RUNNING' && group.myBabNumbers.length > 0)
				.map(group => ({
					id: group.id,
					name: group.name,
					range: formatBabRange(group.myBabNumbers),
					total: group.myBabNumbers.length,
					done: group.myReadCount,
					nextBabNumber: group.myNextBabNumber
				})),
		[groups]
	);

	// Finished groups sink to the bottom, so whatever is still owed stays at the top.
	const ordered = useMemo(
		() => [...rows].sort((a, b) => Number(a.done >= a.total) - Number(b.done >= b.total)),
		[rows]
	);

	const selected = rows.find(row => row.id === selectedId) ?? ordered.find(row => row.done < row.total) ?? ordered[0];

	const doneToday = rows.reduce((sum, row) => sum + row.done, 0);
	const totalToday = rows.reduce((sum, row) => sum + row.total, 0);
	const pending = rows.filter(row => row.done < row.total).length;

	const handleCommit = (group: DockRingGroup) => {
		setAllBabsRead.mutate({ groupId: group.id, read: group.done < group.total });
	};

	if (isPending) {
		return (
			<SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
				<View style={styles.centerFill}>
					<ActivityIndicator color={theme.colors.accent} />
				</View>
			</SafeAreaView>
		);
	}

	if (isError) {
		return (
			<SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
				<View style={styles.padded}>
					<EmptyState actionLabel={t('retry')} onAction={refetch} title={t('genericError')} />
				</View>
			</SafeAreaView>
		);
	}

	if (!selected) {
		return (
			<SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
				<JoinByCodeSheet isVisible={isJoinSheetOpen} onClose={() => setIsJoinSheetOpen(false)} />
				<View style={styles.padded}>
					{/*
					 * 01f. The eyebrow stays even with nothing to show — the screen is still
					 * "today", it just has no share in it. Three ways out rather than one: the
					 * reason someone lands here is as often "I was invited" as "I need a group".
					 */}
					<EyebrowText>{t('today')}</EyebrowText>
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
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView
			edges={tabBarHeight > 0 ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
			style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
		>
			<View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={styles.fill}>
				<Animated.ScrollView
					contentContainerStyle={[
						styles.content,
						{
							// Guarantees the dock can finish. With only a few groups the column
							// barely scrolls, so the offset could never reach `DOCK_DISTANCE` and
							// the ring sat permanently half-collapsed at the bottom of the list.
							// `minHeight` off the viewport is stable — unlike padding derived from
							// the content, it can't feed back into the measurement that set it.
							minHeight: viewportHeight + DOCK_DISTANCE,
							paddingBottom: tabBarHeight + 24
						}
					]}
					onLayout={(event: LayoutChangeEvent) => setViewportHeight(event.nativeEvent.layout.height)}
					onMomentumScrollEnd={event => snapDock(event.nativeEvent.contentOffset.y)}
					onScroll={scrollHandler}
					// The finger lifting is only the end of the gesture if no momentum follows;
					// when it does, `onMomentumScrollEnd` is the one that settles the position.
					onScrollEndDrag={event => {
						const { contentOffset, velocity } = event.nativeEvent;

						if (!velocity || Math.abs(velocity.y) < MOMENTUM_EPSILON) {
							snapDock(contentOffset.y);
						}
					}}
					ref={scrollRef}
					scrollEventThrottle={16}
					showsVerticalScrollIndicator={false}
				>
					{/*
					 * The dock paints above this column, so the space it occupies at rest is
					 * reserved rather than filled — the hero captions, the two flying labels
					 * and the ring itself.
					 */}
					<View style={styles.reserved} />

					<CardSurface style={styles.summary}>
						<View style={styles.summaryRow}>
							<Typography style={styles.summaryLabel} variant='bodyStrong'>
								{t('todaysTotal')}
							</Typography>
							<Typography color={theme.colors.subtext} style={styles.summaryValue} variant='mono'>
								{t('babsOfTotal', { done: doneToday, total: totalToday })}
							</Typography>
						</View>
						<ProgressBar percent={totalToday === 0 ? 0 : Math.round((doneToday / totalToday) * 100)} />
					</CardSurface>

					<View style={styles.listHeader}>
						<Typography color={theme.colors.subtext} style={styles.listHeaderLabel}>
							{t('groups')}
						</Typography>
						<Typography color={theme.colors.subtext} style={styles.listHeaderLabel}>
							{t('groupsWaiting', { count: pending })}
						</Typography>
					</View>

					<CardSurface isFlush style={styles.list}>
						{ordered.map(row => {
							const isSelected = row.id === selected.id;
							const isFull = row.done >= row.total;
							// Read out of the row so the null check narrows inside the button's
							// own callback, which a property access would not.
							const nextBabNumber = row.nextBabNumber;

							return (
								<Pressable
									accessibilityRole='button'
									accessibilityState={{ selected: isSelected }}
									key={row.id}
									// Selecting only rebinds the ring — it never marks anything.
									onPress={() => setSelectedId(row.id)}
									style={[
										styles.row,
										isSelected ? { backgroundColor: theme.colors.accentSoft } : null
									]}
								>
									<View
										style={[
											styles.tick,
											{
												backgroundColor: isSelected
													? theme.colors.accent
													: isFull
													? toAlphaColor(theme.colors.accent, 0.35)
													: theme.colors.transparent
											}
										]}
									/>
									<Typography color={theme.colors.subtext} style={styles.rowRange} variant='mono'>
										{row.range}
									</Typography>
									<Typography
										color={isFull && !isSelected ? theme.colors.subtext : theme.colors.text}
										numberOfLines={1}
										style={styles.rowName}
									>
										{row.name}
									</Typography>
									<View style={[styles.mini, { backgroundColor: theme.colors.track }]}>
										<View
											style={[
												styles.miniFill,
												{
													backgroundColor: theme.colors.accent,
													width: `${row.total === 0 ? 0 : (row.done / row.total) * 100}%`
												}
											]}
										/>
									</View>
									{/* Same 26pt column either way, so a row finishing doesn't shuffle
									    the ones under it. The tick is right-aligned like the count
									    it replaces. */}
									{isFull ? (
										<View style={[styles.rowAmount, styles.rowDone]}>
											<Icon
												color={theme.colors.subtext}
												name='check'
												size={13}
												strokeWidth={1.9}
											/>
										</View>
									) : (
										<Typography
											color={theme.colors.subtext}
											style={styles.rowAmount}
											variant='mono'
										>
											{`${row.done}/${row.total}`}
										</Typography>
									)}
									{/*
									 * Straight to the next unread bab, skipping the group screen. Its
									 * own Pressable, so the tap opens the reader rather than bubbling
									 * up and merely rebinding the ring — the row and the button do
									 * different things and must not be confused for one another.
									 *
									 * A finished share keeps the slot but leaves it empty, so ticked
									 * rows stay aligned with the ones still owed.
									 */}
									<View style={styles.rowReadSlot}>
										{nextBabNumber === null ? null : (
											<Pressable
												accessibilityLabel={`${row.name} — ${t('read')}`}
												accessibilityRole='button'
												onPress={() =>
													navigation.navigate('BabReader', {
														groupId: row.id,
														babNumber: nextBabNumber
													})
												}
												style={({ pressed }) => [
													styles.rowRead,
													{
														// `segmentTrack`, not `surface` or
														// `surfaceMuted`: both of those equal the
														// card's own colour in one theme or the
														// other, which leaves the pill with no
														// visible bounds. This is the token that
														// steps off a card in light and dark alike.
														backgroundColor: theme.colors.segmentTrack,
														opacity: pressed ? 0.7 : 1
													}
												]}
											>
												{/* One line, always — the slot is sized for the longest
												    label ("Read"), and a wrapped "Oku" would double
												    the row's height. */}
												<Typography
													numberOfLines={1}
													style={styles.rowReadLabel}
													variant='stat'
													weight='semibold'
												>
													{t('read')}
												</Typography>
											</Pressable>
										)}
									</View>
								</Pressable>
							);
						})}
					</CardSurface>

					<CaptionText color={theme.colors.subtext} style={styles.footNote} textAlign='center'>
						{t('sharesDone', { count: rows.length - pending })}
					</CaptionText>
				</Animated.ScrollView>

				{width > 0 ? (
					<DockRing
						group={selected}
						horizontalInset={SCREEN_HORIZONTAL_PADDING}
						isCommitting={setAllBabsRead.isPending}
						onCommit={handleCommit}
						scrollY={scrollY}
						topInset={0}
						totalToday={`${doneToday}/${totalToday}`}
						width={width - SCREEN_HORIZONTAL_PADDING * 2}
					/>
				) : null}
			</View>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	centerFill: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	},
	content: {
		flexGrow: 1,
		paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
		paddingTop: 2
	},
	fill: {
		flex: 1
	},
	footNote: {
		fontSize: 11,
		marginTop: 10
	},
	list: {
		paddingVertical: 4
	},
	listHeader: {
		alignItems: 'baseline',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 8,
		marginTop: 16
	},
	listHeaderLabel: {
		fontSize: 11,
		letterSpacing: 1.1,
		textTransform: 'uppercase'
	},
	mini: {
		borderRadius: 3,
		height: 5,
		overflow: 'hidden',
		width: 50
	},
	miniFill: {
		height: '100%'
	},
	padded: {
		flex: 1,
		paddingHorizontal: SCREEN_HORIZONTAL_PADDING
	},
	// Hero captions, the two flying labels and the ring all paint from the dock overlay;
	// this is the height they occupy in the column at rest.
	reserved: {
		height: HERO_HEIGHT + GAP_NAME + CAPTION_HEIGHT + GAP_RANGE + GAP_RING
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 14,
		paddingVertical: 9
	},
	rowAmount: {
		fontSize: 10.5,
		textAlign: 'right',
		width: 26
	},
	// `textAlign` does nothing to a view, so the icon gets the same right edge this way.
	rowDone: {
		alignItems: 'flex-end'
	},
	// Matches `BabRow`'s "Oku" — the same errand on the group screen, so the same pill.
	rowRead: {
		borderRadius: 8,
		paddingHorizontal: 9,
		paddingVertical: 5
	},
	rowReadLabel: {
		fontSize: 10.5,
		letterSpacing: 0,
		textTransform: 'none'
	},
	// Reserved whether or not the button is there, so a share finishing doesn't pull the
	// row's contents rightwards. Wide enough for "Read" plus the pill's padding — any
	// narrower and the label wraps instead of the button growing.
	rowReadSlot: {
		alignItems: 'flex-end',
		width: 52
	},
	rowName: {
		flex: 1,
		fontSize: 11.5,
		fontWeight: '600'
	},
	rowRange: {
		fontSize: 10.5,
		width: 38
	},
	safeArea: {
		flex: 1
	},
	summary: {
		marginTop: 16,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	summaryLabel: {
		fontSize: 11.5
	},
	summaryRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 9
	},
	summaryValue: {
		fontSize: 11
	},
	tick: {
		borderRadius: 3,
		height: 20,
		width: 5
	}
});
