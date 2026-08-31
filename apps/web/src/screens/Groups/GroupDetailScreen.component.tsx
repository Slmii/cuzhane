import { BabGrid } from '@/components/BabGrid/BabGrid.component';
import { BabLegend } from '@/components/BabLegend/BabLegend.component';
import { BabRow } from '@/components/BabRow/BabRow.component';
import { GridSkeleton } from '@/components/GridSkeleton/GridSkeleton.component';
import { PoolGrid } from '@/components/PoolGrid/PoolGrid.component';
import { RoundResetRow } from '@/components/RoundResetRow/RoundResetRow.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { SliceChip } from '@/components/SliceChip/SliceChip.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { CornerAction } from '@/components/ui/CornerAction/CornerAction.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { NavRow } from '@/components/ui/NavRow/NavRow.component';
import {
	BodyText,
	CaptionText,
	NumericText,
	StatText,
	TitleText,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { useGetBabs, useSetBabRead } from '@/lib/hooks/useBab';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetGroupById, useMarkPoolReleasesSeen } from '@/lib/hooks/useGroup';
import { useRoundReset, useTimeUntilReset } from '@/lib/hooks/useRoundReset';
import { useGetRounds } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupBab } from '@/lib/types/domain';
import { BAB_COUNT } from '@/lib/utils/babs';
import { shareSlices, toBabCells, toPoolCells } from '@/lib/utils/groups';
import type { TabStackParamList } from '@/navigation/types';
import { LeaveGroupButton } from '@/screens/Groups/LeaveGroupButton.component';
import { ManageSheet } from '@/screens/Groups/ManageSheet.component';
import { MembersSheet } from '@/screens/Groups/MembersSheet.component';
import { ShareSheet } from '@/screens/Groups/ShareSheet.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { GroupDetailSkeleton } from './GroupDetailSkeleton.component';
import { LobbySkeleton } from './LobbySkeleton.component';

type Sheet = 'share' | 'manage' | 'members' | null;

const CHEVRON_DOWN_DEGREES = 90;
const CHEVRON_UP_DEGREES = -90;
/** One duration for the panel and the chevron, so the two read as a single movement. */
const PANEL_DURATION_MS = 260;
/**
 * How tall the open bab list may grow — roughly five rows. Past that it scrolls in place
 * rather than pushing the rest of the screen down; see `openHeight`.
 */
const MY_BABS_MAX_HEIGHT = 310;

/**
 * Stood up once, because they are memo dependencies: `?? []` written inline is a new array
 * on every render, which would invalidate the cells it guards every time and defeat the
 * point of memoising them.
 */
const NO_BABS: GroupBab[] = [];
const NO_NUMBERS: number[] = [];
/** Entries in `BabLegend` — the skeleton stubs the same number so the card keeps its height. */
const BAB_LEGEND_COUNT = 5;

type Props = NativeStackScreenProps<TabStackParamList, 'GroupDetail'>;

export const GroupDetailScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const userId = useCurrentUserId();
	const [sheet, setSheet] = useState<Sheet>(null);
	// Declared up here with the other hooks: the loading and error branches below return
	// early, and a hook that only runs on the happy path would change order between renders.
	const [isMyBabsOpen, setIsMyBabsOpen] = useState(false);
	// The base `chevron` glyph points right, so down is +90° and up is -90°. Closed points
	// down at the content it will reveal; open points up at the content it will hide. One
	// glyph rotated through half a turn, rather than swapping in a second icon.
	const isReducedMotion = useReducedMotion();
	/*
	 * Both halves of the disclosure are driven *from* `isMyBabsOpen` inside their worklets,
	 * the way `CellGrid` eases its colours, rather than by writing to a shared value from the
	 * press handler — one source of truth, and no imperative mutation for the compiler to
	 * object to.
	 */
	const chevronStyle = useAnimatedStyle(() => {
		const angle = `${isMyBabsOpen ? CHEVRON_UP_DEGREES : CHEVRON_DOWN_DEGREES}deg`;

		return {
			transform: [{ rotate: isReducedMotion ? angle : withTiming(angle, { duration: PANEL_DURATION_MS }) }]
		};
	});
	/*
	 * The panel animates its real height — not a fade, and not a layout transition.
	 *
	 * The rows stay mounted and measured, and opening runs the clipped wrapper from nothing to
	 * that measurement. It has to be the actual height because this card sits mid-column in a
	 * scroll view: `LinearTransition` commits the new layout at once and interpolates only the
	 * card, so everything below would jump to its final place while the card was still growing
	 * into it.
	 */
	const [myBabsHeight, setMyBabsHeight] = useState(0);
	/*
	 * Capped, and the rows scroll inside the cap.
	 *
	 * A share is five babs in a small group and twenty-six once pool blocks are on top of it,
	 * and at full height that panel ran well past a screen — opening it pushed the pool card,
	 * the board and everything else so far down that the page turned into a list of one
	 * member's babs. Five rows is enough to show it *is* a list and to start reading down it;
	 * the rest is a scroll away rather than a page away.
	 */
	const openHeight = Math.min(myBabsHeight, MY_BABS_MAX_HEIGHT);
	const myBabsBodyStyle = useAnimatedStyle(() => {
		const height = isMyBabsOpen ? openHeight : 0;
		const opacity = isMyBabsOpen ? 1 : 0;

		return isReducedMotion
			? { height, opacity }
			: {
					height: withTiming(height, { duration: PANEL_DURATION_MS }),
					opacity: withTiming(opacity, { duration: PANEL_DURATION_MS })
			  };
	});

	const toggleMyBabs = () => {
		setIsMyBabsOpen(current => !current);
	};

	const groupQuery = useGetGroupById(groupId);
	const babsQuery = useGetBabs(groupId);
	// Both read from the query data rather than the narrowed `detail` below, so they sit with
	// the other hooks above the early returns and keep hook order stable.
	const reset = useRoundReset({
		cycle: groupQuery.data?.cycle ?? 'WEEKLY',
		roundEndsAt: groupQuery.data?.roundEndsAt ?? null,
		timezone: groupQuery.data?.timezone ?? 'UTC'
	});
	const untilReset = useTimeUntilReset(groupQuery.data?.roundEndsAt ?? null);
	const roundsQuery = useGetRounds(groupId);
	const setBabRead = useSetBabRead();
	const markPoolReleasesSeen = useMarkPoolReleasesSeen();

	/*
	 * The two boards' cells, and the tap that opens one, memoised up here with the other
	 * hooks — above the early returns, and reading from the query data rather than the
	 * narrowed `detail` below, for the same reason `reset` does: hook order has to hold.
	 *
	 * `CellGrid` memoises a cell on the identity of the item it was handed, so building these
	 * inline in the JSX gave a hundred cells a new object every render and re-evaluated a
	 * hundred animated styles because a sheet opened.
	 */
	const babs = babsQuery.data ?? NO_BABS;
	// The server decides what "mine" means today — under ROTATION the babs a member reads
	// are a different seat's block every round, so this can't be derived from assignment.
	const myBabNumbers = groupQuery.data?.myBabNumbers ?? NO_NUMBERS;
	const myBabNumberSet = useMemo(() => new Set(myBabNumbers), [myBabNumbers]);
	// The pool as the Havuz screen counts it — every block of an empty seat, whether or not
	// somebody has already volunteered for it.
	const poolCells = useMemo(
		() =>
			toPoolCells(babs, {
				poolAllBabNumbers: groupQuery.data?.poolAllBabNumbers ?? NO_NUMBERS,
				viewerUserId: userId ?? null
			}),
		[babs, groupQuery.data?.poolAllBabNumbers, userId]
	);
	const babCells = useMemo(
		() =>
			toBabCells(babs, {
				myBabNumbers,
				poolBabNumbers: groupQuery.data?.poolBabNumbers ?? NO_NUMBERS,
				viewerUserId: userId ?? null
			}),
		[babs, groupQuery.data?.poolBabNumbers, myBabNumbers, userId]
	);
	const handlePressBab = useCallback(
		(babNumber: number) => {
			const bab = babs.find(candidate => candidate.number === babNumber);

			if (bab && myBabNumberSet.has(bab.number)) {
				navigation.navigate('BabReader', { groupId, babNumber });
			}
		},
		[babs, groupId, myBabNumberSet, navigation]
	);

	const status = groupQuery.data?.status;
	const isOwnerOfGroup = groupQuery.data?.isOwner === true;

	// A group that hasn't started has no board to show — the lobby is the whole screen.
	// `replace` rather than `navigate` so the two never stack and back still leaves the
	// group entirely.
	useEffect(() => {
		if (status === 'GATHERING') {
			// The lobby is the creator's; a waiting member gets the "you're in, waiting to
			// start" screen instead. One screen per state, not one per role.
			navigation.replace(isOwnerOfGroup ? 'Lobby' : 'JoinedWelcome', { groupId });
		}
	}, [groupId, isOwnerOfGroup, navigation, status]);

	// Only the group gates the screen. The board arrives separately, and the two things that
	// need it — the pool card and the hundred — each have their own stand-in, so waiting on
	// it no longer blanks the whole page.
	if (groupQuery.isPending) {
		return (
			<ScreenContainer>
				<GroupDetailSkeleton />
			</ScreenContainer>
		);
	}

	if (groupQuery.isError || babsQuery.isError || !groupQuery.data) {
		return (
			<ScreenContainer isScrollable={false}>
				<View style={styles.centered}>
					<EmptyState
						actionLabel={t('retry')}
						onAction={() => {
							groupQuery.refetch();
							babsQuery.refetch();
						}}
						title={t('genericError')}
					/>
				</View>
			</ScreenContainer>
		);
	}

	const detail = groupQuery.data;
	// The pool card's own loading state: the group already says how big the pool is, but who
	// holds each bab comes from the board.
	const isPoolPending = babsQuery.isPending && detail.poolAllBabNumbers.length > 0;

	// The redirect above has already fired; hold rather than render a board for a group that
	// has no progress yet. It shows the *lobby's* skeleton, because that is where the redirect
	// is going — holding this screen's own shape would flash a layout that never arrives.
	if (detail.status === 'GATHERING') {
		return (
			<ScreenContainer>
				<LobbySkeleton />
			</ScreenContainer>
		);
	}
	// One card however many blocks were taken over — "27–39, 66–78" reads better than a
	// stack of identical notices.
	const poolReleaseRanges = detail.poolReleases.map(release => `${release.startBab}–${release.endBab}`).join(', ');
	const myBabs = babs.filter(bab => myBabNumberSet.has(bab.number)).sort((a, b) => a.number - b.number);
	// The slice the reader is on, plus a count of the others — see `shareSlices`.
	const mySlices = shareSlices(myBabNumbers, detail.myNextBabNumber);
	const myReadCount = myBabs.filter(bab => bab.readAt !== null).length;
	// The open-ended cycle is retired and can no longer be created, but a legacy group whose
	// `endsAt` was never backfilled can still surface a null `daysLeft` here — fall back to
	// an em dash rather than a removed string.
	const daysLeftLabel = detail.daysLeft === null ? '—' : `${detail.daysLeft} ${t('days')}`;
	const isDaily = detail.cycle === 'DAILY';
	// Newest closed round — the list arrives newest-first with the open one at the head.
	const lastClosedRound = (roundsQuery.data ?? []).find(round => !round.isOpen);
	const leftValue = isDaily
		? t('hoursLeft', { hours: untilReset.hours, minutes: untilReset.minutes })
		: daysLeftLabel;

	// One sheet swaps for the other rather than stacking: Yönet's members row is a way
	// *into* the list, not a second surface on top of the settings it came from.
	const handleOpenMembers = () => setSheet('members');

	// Pinned like Gruplarım's: the back link and Paylaş stay reachable however far the
	// board scrolls, and this screen scrolls a long way — a hundred cells plus the pool.
	// It paints the screen background because a sticky child sits above the content.
	const header = (
		<View key='header' style={[styles.header, { backgroundColor: theme.colors.background }]}>
			<ScreenHeader
				// Both of the screen's whole-group actions sit on the title's baseline now.
				// Yönet used to be a full-width button below the board, which put the owner's
				// settings further from the group than the pool was; as an outlined square
				// beside the filled Paylaş it reads as the quieter of the two and costs no
				// vertical space.
				//
				// A member has no settings to open, so that slot carries the one thing the
				// settings sheet held for them — the members list — rather than sitting empty.
				// It is the only way in now that the "Bu grupta kimler var" row is gone.
				action={
					<View style={styles.headerActions}>
						{detail.isOwner ? (
							<CornerAction
								accessibilityLabel={t('manage')}
								icon='settings'
								onPress={() => setSheet('manage')}
								tone='surface'
							/>
						) : (
							<CornerAction
								accessibilityLabel={t('whoIsIn')}
								icon='members'
								onPress={() => setSheet('members')}
								tone='surface'
							/>
						)}
						<CornerAction accessibilityLabel={t('share')} icon='share' onPress={() => setSheet('share')} />
					</View>
				}
				onBack={navigation.goBack}
				subtitle={detail.dedication ? t('forName', { dedication: detail.dedication }) : undefined}
				title={detail.name}
				// A group's name is whatever somebody typed, so it truncates rather than wrapping.
				titleLines={1}
				// Both cadences, not just daily. The chip was daily-only on the reasoning that a
				// weekly group's countdown already says "2 gün" while a daily one counts hours —
				// true, but it made the *chip itself* conditional, so a weekly group looked like a
				// group with no cadence rather than one whose cadence you had to infer. Turlar
				// shows both; this now matches it.
				titleTrailing={<Chip label={t(isDaily ? 'daily' : 'weekly')} tone='accent' />}
			/>
		</View>
	);

	return (
		<>
			<ScreenContainer stickyHeaderIndices={[0]}>
				{header}

				{/*
				 * 07 / 07c. One card rather than two loose tiles: the reset line belongs to
				 * the same fact as the countdown beside it — how long is left, and until when
				 * exactly. Split apart, the countdown reads as the reader's own clock when it
				 * never was.
				 */}
				<CardSurface isFlush>
					<View style={styles.statsRow}>
						<View
							style={[
								styles.statCell,
								styles.statCellDivided,
								{ borderRightColor: theme.colors.divider }
							]}
						>
							<NumericText>{`${detail.memberCount} / ${detail.spots}`}</NumericText>
							<StatText color={theme.colors.faintText} style={styles.statLabel}>
								{t('members')}
							</StatText>
						</View>
						<View style={styles.statCell}>
							<NumericText>{leftValue}</NumericText>
							<StatText color={theme.colors.faintText} style={styles.statLabel}>
								{/* A DAILY round counts down in hours — "1 gün" would say nothing. */}
								{isDaily ? t('untilMidnight') : t('left')}
							</StatText>
						</View>
					</View>
					{reset ? (
						<RoundResetRow
							groupLabel={reset.group}
							localLabel={reset.local}
							style={[styles.statsReset, { borderTopColor: theme.colors.divider }]}
							variant='panel'
						/>
					) : null}
				</CardSurface>

				{/*
				 * The sage "Sana atanan" strip *is* the collapsible's header now. It used to be
				 * a separate banner sitting above a "Babların 1–5" row, which said the same
				 * range twice and put the thing you tap below the thing that explains it.
				 *
				 * The card takes the strip's colour while closed: a rounded card is white at
				 * the corners, and with a green header filling it edge to edge those corners
				 * were four white nicks against the sage.
				 */}
				<CardSurface isFlush style={isMyBabsOpen ? null : { backgroundColor: theme.colors.accentSoft }}>
					<Pressable
						// The eyebrow and the sentence are gone from the row, so the label they carried
						// has to come from here or it announces nothing but its numbers.
						accessibilityLabel={`${t('assigned')} ${mySlices.current}`}
						accessibilityRole='button'
						accessibilityState={{ expanded: isMyBabsOpen }}
						onPress={toggleMyBabs}
						style={[
							styles.myBabsHeader,
							{ backgroundColor: theme.colors.accentSoft },
							isMyBabsOpen
								? {
										borderBottomColor: theme.colors.divider,
										borderBottomWidth: StyleSheet.hairlineWidth
								  }
								: null
						]}
					>
						{/* The badge carries one slice, not the whole share, with the count of the
						    others pinned to it — spelled out, "1–13, 27–39" ran the badge to twice
						    the width and wrapped the sentence beside it onto three lines. The chip
						    belongs *here*, against the range it is counting, rather than up beside
						    the eyebrow where it read as a tag on the words. */}
						<View style={styles.myBabsBadgeRow}>
							<View style={[styles.myBabsBadge, { backgroundColor: theme.colors.accent }]}>
								<Typography
									color={theme.colors.onAccent}
									style={styles.myBabsBadgeLabel}
									variant='title'
								>
									{mySlices.current}
								</Typography>
							</View>
							<SliceChip count={mySlices.moreCount} isCompact tone='surface' />
						</View>
						{/* The eyebrow stays; the sentence under it went. It named the range a second
						    time and, once the share came in pieces, needed three lines to do it —
						    while the badge beside it had already said where you are. */}
						<View style={styles.myBabsCopy}>
							<Typography
								color={theme.colors.accent}
								style={styles.myBabsLabel}
								variant='stat'
								weight='medium'
							>
								{t('assigned')}
							</Typography>
						</View>
						<View style={styles.myBabsMeta}>
							<CaptionText color={theme.colors.accent} weight='semibold'>{`${myReadCount} / ${
								myBabNumbers.length
							} ${t('done')}`}</CaptionText>
							<Animated.View style={chevronStyle}>
								<Icon color={theme.colors.faintText} name='chevron' size={15} strokeWidth={1.8} />
							</Animated.View>
						</View>
					</Pressable>
					{/* Clipped, and inert while closed: the rows stay mounted so the panel has a
					    height to animate to, which also means they would otherwise still be
					    reachable by a tap or by VoiceOver in a card that reads as shut. */}
					<Animated.View
						accessibilityElementsHidden={!isMyBabsOpen}
						importantForAccessibility={isMyBabsOpen ? 'auto' : 'no-hide-descendants'}
						pointerEvents={isMyBabsOpen ? 'auto' : 'none'}
						style={[styles.myBabsBody, myBabsBodyStyle]}
					>
						{/*
						 * The rows live in a scroller that fills the wrapper absolutely — which is
						 * also what lets them be measured. As an ordinary child they inherited the
						 * wrapper's animated height (nothing, while closed) and reported zero, so
						 * the panel had no size to open to; a scroll view measures its content
						 * unconstrained however short its own frame is.
						 *
						 * Scrolling turns on only when there is more than the cap, so a share that
						 * fits can't swallow the page's own scroll.
						 *
						 * Not a `FlatList`: nesting a VirtualizedList inside the screen's
						 * ScrollView is the thing React Native warns about, and a share is at most
						 * a couple of dozen rows — the cap already stops it from being long, and
						 * virtualising two dozen cheap rows would cost more than it saves.
						 */}
						<ScrollView
							nestedScrollEnabled
							scrollEnabled={isMyBabsOpen && myBabsHeight > MY_BABS_MAX_HEIGHT}
							style={styles.myBabsScroll}
						>
							<View onLayout={event => setMyBabsHeight(event.nativeEvent.layout.height)}>
								{myBabNumbers.length === 0 ? (
									<BodyText color={theme.colors.faintText} style={styles.noAssignedBabs}>
										{t('noAssignedBabs')}
									</BodyText>
								) : (
									myBabs.map(bab => {
										const isRead = bab.readAt !== null;
										/*
										 * **Who read it, not merely that it was read.** A bab in your
										 * share can already have been read by whoever held that block on
										 * an earlier rotation day. This drew your own ticked box over
										 * their work and then offered an undo the server refuses —
										 * only the reader may clear a read — so the tick was a control
										 * that could not do the thing it looked like it did.
										 */
										const isReadByOthers = isRead && bab.readByUserId !== userId;

										return (
											<BabRow
												isRead={isRead}
												isReadByOthers={isReadByOthers}
												key={bab.number}
												onOpen={() =>
													navigation.navigate('BabReader', { groupId, babNumber: bab.number })
												}
												onToggle={() =>
													setBabRead.mutate({ babNumber: bab.number, groupId, read: !isRead })
												}
												openLabel={t('read')}
												subtitle={
													isReadByOthers
														? // Named where the server could resolve one, and falling
														  // back where it couldn't rather than printing an id: a
														  // member who has since left still has reads on this
														  // board, and "cmt9x…" says less than nothing.
														  bab.readByDisplayName
															? t('readBeforeYoursBy', { name: bab.readByDisplayName })
															: t('readBeforeYours')
														: isRead
														? t('readToday')
														: t('notRead')
												}
												title={t('babOrdinal', { n: bab.number })}
											/>
										);
									})
								)}
							</View>
						</ScrollView>
					</Animated.View>
				</CardSurface>

				{/*
				 * "Geçen tur" — the way into Turlar. Shown only once a round has actually closed:
				 * before that there is no history to look at, and a nav row to an empty screen is
				 * worse than no row.
				 */}
				{lastClosedRound ? (
					<CardSurface
						onPress={() => navigation.navigate('Rounds', { groupId })}
						style={styles.lastRoundCard}
					>
						<View
							style={[
								styles.lastRoundBadge,
								{
									backgroundColor: lastClosedRound.missedCount
										? theme.colors.missedSurface
										: theme.colors.accentSoft
								}
							]}
						>
							<Typography
								color={lastClosedRound.missedCount ? theme.colors.missed : theme.colors.accent}
								style={styles.lastRoundBadgeLabel}
								variant='title'
							>
								{lastClosedRound.missedCount}
							</Typography>
						</View>
						<View style={styles.lastRoundCopy}>
							<CaptionText weight='semibold'>
								{`${t('lastRound')} · ${t('roundN')} ${lastClosedRound.roundIndex + 1}`}
							</CaptionText>
							<CaptionText color={theme.colors.subtext} style={styles.lastRoundSub}>
								{`${lastClosedRound.missedCount} ${t('missedBabs')}`}
							</CaptionText>
						</View>
						<Icon color={theme.colors.faintText} name='chevron' size={15} strokeWidth={1.8} />
					</CardSurface>
				) : null}

				{/*
				 * "A joiner took over the block you volunteered for." The push says it first,
				 * but only if it could be delivered — permission may be denied and the phone
				 * may have been off. This is the copy of that news which cannot go missing.
				 * Dismissible, because it reports something already done rather than asking.
				 */}
				{detail.poolReleases.length > 0 ? (
					<CardSurface style={[styles.releaseCard, { backgroundColor: theme.colors.sand }]}>
						<View style={styles.releaseRow}>
							<Icon color={theme.colors.sandText} name='info' size={19} strokeWidth={1.8} />
							<View style={styles.releaseCopy}>
								<CaptionText color={theme.colors.sandText} weight='semibold'>
									{t('poolReleasedTitle')}
								</CaptionText>
								<CaptionText color={theme.colors.sandText} style={styles.releaseBody}>
									{t('poolReleasedBody', { range: poolReleaseRanges })}
								</CaptionText>
							</View>
						</View>
						<AppButton
							onPress={() => markPoolReleasesSeen.mutate(groupId)}
							size='sm'
							title={t('gotIt')}
							variant='surface'
						/>
					</CardSurface>
				) : null}

				{/*
				 * Only groups that started with seats to spare have a pool at all — but the
				 * whole pool, not just the part still going. Counted off `poolBabNumbers`
				 * this card used to shed cells as members claimed blocks and vanish once the
				 * last one went, taking the only way to the Havuz screen with it.
				 *
				 * Whether there *is* a pool, and how big, comes from the group — so the
				 * skeleton below is sized exactly rather than guessed. Only who holds each
				 * bab needs the board, which is why this one section can still be waiting
				 * while the rest of the screen is real.
				 */}
				{isPoolPending ? (
					<GridSkeleton cellCount={detail.poolAllBabNumbers.length} />
				) : poolCells.length > 0 ? (
					<CardSurface isFlush>
						<View style={[styles.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
							<TitleText>{t('pool')}</TitleText>
							{/* Just "15 bab" — the card is already headed "Ortak havuz", so
							    repeating "sahipsiz" here says it twice. The Havuz screen's own
							    header carries the fuller wording, where it isn't redundant. */}
							<Chip label={`${poolCells.length} ${t('babs')}`} tone='sand' />
						</View>
						<View style={styles.sectionBody}>
							{/* Literally the Havuz screen's board, component and all — this card
							    is the door to that screen, so the two cannot be allowed to
							    describe the same babs differently. */}
							<PoolGrid cells={poolCells} />
							<CaptionText color={theme.colors.subtext}>{t('poolHint')}</CaptionText>
							<NavRow
								label={t('poolSee')}
								onPress={() => navigation.navigate('Pool', { groupId })}
								style={styles.poolNav}
							/>
						</View>
					</CardSurface>
				) : null}

				{/*
				 * The hundred, in the same card the pool above it uses: heading and count on a
				 * white surface, a divider, then the board and its legend in the body. The
				 * heading used to sit outside on the page background with the board floating
				 * under it, so two sections of the same screen — the same lattice, twice —
				 * were built as two different kinds of thing.
				 */}
				{babsQuery.isPending ? (
					/*
					 * The skeleton, not a blank hundred. `emptyBabCells` renders every cell in
					 * the "unread" tone, which doesn't read as loading — it reads as nobody
					 * having read anything, which is a claim about the data rather than an
					 * admission that it hasn't arrived.
					 */
					<GridSkeleton cellCount={BAB_COUNT} legendCount={BAB_LEGEND_COUNT} />
				) : (
					<CardSurface isFlush>
						<View style={[styles.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
							<TitleText>{t('groupProgress')}</TitleText>
							{/* The count is the group's own, so the heading is real either way. */}
							<CaptionText color={theme.colors.faintText}>{`${detail.readCount} / 100`}</CaptionText>
						</View>
						<View style={styles.sectionBody}>
							<BabGrid cells={babCells} onPressBab={handlePressBab} />
							<BabLegend />
						</View>
					</CardSurface>
				)}

				{/*
				 * Both group actions are corner actions in the heading now, so the only
				 * full-width button left is the one the owner can't have: 07d's way out. An
				 * owner cannot leave a group they would strand, and has nothing here.
				 *
				 * Last thing on the screen, under the board. It used to sit between the pool and
				 * the hundred, which put an irreversible action in the middle of the page you
				 * scroll through to read — you meet it on the way past rather than by going
				 * looking for it.
				 */}
				{detail.isOwner ? null : <LeaveGroupButton groupId={groupId} style={styles.leaveButton} />}
			</ScreenContainer>

			<ShareSheet group={detail} isVisible={sheet === 'share'} onClose={() => setSheet(null)} />
			{detail.isOwner ? (
				<ManageSheet
					group={detail}
					isVisible={sheet === 'manage'}
					onClose={() => setSheet(null)}
					onOpenMembers={handleOpenMembers}
				/>
			) : null}
			<MembersSheet groupId={groupId} isVisible={sheet === 'members'} onClose={() => setSheet(null)} />
		</>
	);
};

const styles = StyleSheet.create({
	actionButton: {
		flex: 1
	},
	actionsRow: {
		flexDirection: 'row',
		gap: 8
	},
	header: {
		// `ScreenHeader` owns its own padding, so the sticky wrapper only has to be opaque.
		zIndex: 3
	},
	headerActions: {
		flexDirection: 'row',
		gap: 8
	},
	centered: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	},
	// Set apart from the legend above it, so the last thing on the page doesn't read as
	// belonging to the board.
	leaveButton: {
		marginTop: 18
	},
	sectionBody: {
		gap: 12,
		padding: 15
	},
	releaseBody: {
		marginTop: 3
	},
	releaseCard: {
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	releaseCopy: {
		flex: 1,
		minWidth: 0
	},
	releaseRow: {
		flexDirection: 'row',
		gap: 11
	},
	sectionHeader: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingBottom: 13,
		paddingHorizontal: 16,
		paddingTop: 15
	},
	poolNav: {
		marginTop: 1
	},
	myBabsBadge: {
		alignItems: 'center',
		borderRadius: 12,
		height: 38,
		justifyContent: 'center',
		// `minWidth`, not a width: "96–100" is wider than the 38pt square "1–5" fits in.
		minWidth: 38,
		paddingHorizontal: 6
	},
	myBabsBadgeLabel: {
		fontSize: 15,
		lineHeight: 19
	},
	// Clips the rows to whatever the animated height currently is; without it they spill out
	// of the card and over the section below on the way open.
	myBabsBody: {
		overflow: 'hidden'
	},
	// Fills the clipped wrapper rather than sitting in its flow, so the rows keep their own
	// height to be measured by even when the wrapper is animated down to nothing.
	myBabsScroll: {
		...StyleSheet.absoluteFill
	},
	myBabsHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	// Takes the slack between the range and the count, so the two ends stay put however long
	// the label in the middle is.
	myBabsCopy: {
		flex: 1,
		minWidth: 0
	},
	myBabsLabel: {
		letterSpacing: 0.8
	},
	// Badge and chip travel together as the row's leading block.
	myBabsBadgeRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	myBabsMeta: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9
	},
	noAssignedBabs: {
		paddingHorizontal: 16,
		paddingVertical: 20
	},
	lastRoundBadge: {
		alignItems: 'center',
		borderRadius: 13,
		height: 40,
		justifyContent: 'center',
		// `minWidth`, not a fixed width: the design's mock never exceeds a single digit, but
		// a round nobody touched reads 100 and spills straight out of a 40pt square.
		minWidth: 40,
		paddingHorizontal: 6
	},
	lastRoundBadgeLabel: {
		// 15/19, matching the design and the app's other badge tiles — not the 25/28 numeric
		// scale. A tall line box in a 40pt square centres the *line*, not the glyph, which is
		// what left the digit sitting high.
		fontSize: 15,
		lineHeight: 19
	},
	lastRoundCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	lastRoundCopy: {
		flex: 1,
		minWidth: 0
	},
	lastRoundSub: {
		marginTop: 2
	},
	statCell: {
		flex: 1,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	statCellDivided: {
		borderRightWidth: StyleSheet.hairlineWidth
	},
	statLabel: {
		marginTop: 4
	},
	statsReset: {
		borderTopWidth: StyleSheet.hairlineWidth
	},
	statsRow: {
		flexDirection: 'row',
		gap: 8
	}
});
