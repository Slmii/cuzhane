import { BabGrid } from '@/components/BabGrid/BabGrid.component';
import { BabLegend } from '@/components/BabLegend/BabLegend.component';
import { BabRow } from '@/components/BabRow/BabRow.component';
import { GridSkeleton } from '@/components/GridSkeleton/GridSkeleton.component';
import { PoolGrid } from '@/components/PoolGrid/PoolGrid.component';
import { RoundResetRow } from '@/components/RoundResetRow/RoundResetRow.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { CornerAction } from '@/components/ui/CornerAction/CornerAction.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { NavRow } from '@/components/ui/NavRow/NavRow.component';
import { SectionHeader } from '@/components/ui/SectionHeader/SectionHeader.component';
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
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useRoundReset, useTimeUntilReset } from '@/lib/hooks/useRoundReset';
import { useGetRounds } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupBab } from '@/lib/types/domain';
import { BAB_COUNT, formatBabRange } from '@/lib/utils/babs';
import { toBabCells, toPoolCells } from '@/lib/utils/groups';
import type { TabStackParamList } from '@/navigation/types';
import { LeaveGroupButton } from '@/screens/Groups/LeaveGroupButton.component';
import { ManageSheet } from '@/screens/Groups/ManageSheet.component';
import { MembersSheet } from '@/screens/Groups/MembersSheet.component';
import { ShareSheet } from '@/screens/Groups/ShareSheet.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Sheet = 'share' | 'manage' | 'members' | null;

const CHEVRON_DOWN_DEGREES = 90;
const CHEVRON_UP_DEGREES = -90;
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
	const myBabsRotation = useSharedValue(CHEVRON_DOWN_DEGREES);
	const chevronStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${myBabsRotation.value}deg` }]
	}));

	const toggleMyBabs = () => {
		const willOpen = !isMyBabsOpen;

		setIsMyBabsOpen(willOpen);
		myBabsRotation.value = withTiming(willOpen ? CHEVRON_UP_DEGREES : CHEVRON_DOWN_DEGREES, { duration: 300 });
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
			<ScreenContainer isScrollable={false}>
				<View style={styles.centered}>
					<ActivityIndicator color={theme.colors.accent} />
				</View>
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
	const babs = babsQuery.data ?? [];
	// The pool card's own loading state: the group already says how big the pool is, but who
	// holds each bab comes from the board.
	const isPoolPending = babsQuery.isPending && detail.poolAllBabNumbers.length > 0;

	// The redirect above has already fired; hold the spinner rather than render a board
	// for a group that has no progress yet.
	if (detail.status === 'GATHERING') {
		return (
			<ScreenContainer isScrollable={false}>
				<View style={styles.centered}>
					<ActivityIndicator color={theme.colors.accent} />
				</View>
			</ScreenContainer>
		);
	}
	// The server decides what "mine" means today — under ROTATION the babs a member reads
	// are a different seat's block every round, so this can't be derived from assignment.
	const myBabNumbers = detail.myBabNumbers;
	const myBabNumberSet = new Set(myBabNumbers);
	// The pool as the Havuz screen counts it — every block of an empty seat, whether or not
	// somebody has already volunteered for it.
	const poolCells = toPoolCells(babs, { poolAllBabNumbers: detail.poolAllBabNumbers, viewerUserId: userId ?? null });
	const myBabs = babs.filter(bab => myBabNumberSet.has(bab.number)).sort((a, b) => a.number - b.number);
	const myRange = formatBabRange(myBabNumbers);
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

	const canOpenBab = (bab: GroupBab) => myBabNumberSet.has(bab.number);

	const handlePressBab = (babNumber: number) => {
		const bab = babs.find(candidate => candidate.number === babNumber);

		if (bab && canOpenBab(bab)) {
			navigation.navigate('BabReader', { groupId, babNumber });
		}
	};

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
				// 07c only. A daily group counts down in hours, so its cadence isn't legible
				// from the countdown the way "2 gün" makes it on a weekly one.
				{...(isDaily ? { titleTrailing: <Chip label={t('daily')} tone='accent' /> } : {})}
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
				<CardSurface isFlush style={styles.statsCard}>
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
						<View style={[styles.myBabsBadge, { backgroundColor: theme.colors.accent }]}>
							<Typography color={theme.colors.onAccent} style={styles.myBabsBadgeLabel} variant='title'>
								{myRange}
							</Typography>
						</View>
						<View style={styles.myBabsCopy}>
							<Typography
								color={theme.colors.accent}
								style={styles.myBabsLabel}
								variant='stat'
								weight='medium'
							>
								{t('assigned')}
							</Typography>
							<CaptionText>{t('assignedTo', { range: myRange })}</CaptionText>
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
					{!isMyBabsOpen ? null : myBabNumbers.length === 0 ? (
						<BodyText color={theme.colors.faintText} style={styles.noAssignedBabs}>
							{t('noAssignedBabs')}
						</BodyText>
					) : (
						myBabs.map(bab => {
							const isRead = bab.readAt !== null;

							return (
								<BabRow
									isRead={isRead}
									key={bab.number}
									onOpen={() => navigation.navigate('BabReader', { groupId, babNumber: bab.number })}
									onToggle={() =>
										setBabRead.mutate({ babNumber: bab.number, groupId, read: !isRead })
									}
									openLabel={t('read')}
									subtitle={isRead ? t('readToday') : t('notRead')}
									title={t('babOrdinal', { n: bab.number })}
								/>
							);
						})
					)}
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
					<GridSkeleton cellCount={detail.poolAllBabNumbers.length} style={styles.poolCard} />
				) : poolCells.length > 0 ? (
					<CardSurface isFlush style={styles.poolCard}>
						<View style={[styles.poolHeader, { borderBottomColor: theme.colors.divider }]}>
							<TitleText>{t('pool')}</TitleText>
							{/* Just "15 bab" — the card is already headed "Ortak havuz", so
							    repeating "sahipsiz" here says it twice. The Havuz screen's own
							    header carries the fuller wording, where it isn't redundant. */}
							<Chip label={`${poolCells.length} ${t('babs')}`} tone='sand' />
						</View>
						<View style={styles.poolBody}>
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
				 * Both group actions are corner actions in the heading now, so the only
				 * full-width button left is the one the owner can't have: 07d's way out. An
				 * owner cannot leave a group they would strand, and has nothing here.
				 */}
				{detail.isOwner ? null : <LeaveGroupButton groupId={groupId} />}

				{/* The count is the group's own, so the heading is real either way. */}
				<SectionHeader meta={`${detail.readCount} / 100`} title={t('groupProgress')} />

				{babsQuery.isPending ? (
					/*
					 * The skeleton, not a blank hundred. `emptyBabCells` renders every cell in
					 * the "unread" tone, which doesn't read as loading — it reads as nobody
					 * having read anything, which is a claim about the data rather than an
					 * admission that it hasn't arrived.
					 */
					<GridSkeleton cellCount={BAB_COUNT} hasHeader={false} legendCount={BAB_LEGEND_COUNT} />
				) : (
					<>
						<CardSurface style={styles.gridCard}>
							<BabGrid
								cells={toBabCells(babs, {
									viewerUserId: userId ?? null,
									myBabNumbers: detail.myBabNumbers,
									poolBabNumbers: detail.poolBabNumbers
								})}
								onPressBab={handlePressBab}
							/>
						</CardSurface>

						<BabLegend />
					</>
				)}
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
	gridCard: {
		paddingHorizontal: 13,
		paddingVertical: 14
	},
	poolBody: {
		gap: 12,
		padding: 15
	},
	poolCard: {
		marginBottom: 12
	},
	poolHeader: {
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
	myBabsCopy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	myBabsHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	myBabsLabel: {
		letterSpacing: 0.8
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
		marginBottom: 12,
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
	statsCard: {
		marginBottom: 12
	},
	statsReset: {
		borderTopWidth: StyleSheet.hairlineWidth
	},
	statsRow: {
		flexDirection: 'row',
		gap: 8
	}
});
