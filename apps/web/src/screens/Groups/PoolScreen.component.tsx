import { useHintScreen } from '@/components/Hints/useHintScreen';
import { useRequireRoundCuz } from '@/lib/hooks/useHatimRoundGate';
import { GridSkeleton } from '@/components/GridSkeleton/GridSkeleton.component';
import { FlexibleReadingPanel } from '@/components/FlexibleReadingPanel/FlexibleReadingPanel.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { PoolGrid } from '@/components/PoolGrid/PoolGrid.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { BodyStrongText, CaptionText, NumericText, Typography } from '@/components/ui/Typography/Typography.component';
import { useCachedGroup } from '@/lib/hooks/useCachedGroup';
import { useGetGroupById, useGetPoolSlots, useReleasePoolSlot, useTakePoolSlot } from '@/lib/hooks/useGroup';
import { CuzPoolScreen } from './CuzPoolScreen.component';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useViewerIdentity } from '@/lib/hooks/useViewerIdentity';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { PoolSlot } from '@/lib/types/domain';
import { FILL_STEP_MS, type PoolCell } from '@/lib/utils/groups';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HizbPoolScreen } from './HizbPoolScreen.component';

type Props = NativeStackScreenProps<TabStackParamList, 'Pool'>;

/** The design's 44pt range badge. */
const BADGE_SIZE = 44;
/** The design's 31pt owner mark on a taken row. */
const AVATAR_SIZE = 31;
/**
 * Cells to stub while loading. The pool's real size isn't known until the request lands, so
 * this is a middling guess — a block and a half — chosen to be close enough that the card
 * doesn't visibly resize for the common case rather than to be right every time.
 */
const SKELETON_CELL_COUNT = 15;

/**
 * How long a block takes to drain: the last cell's stagger plus its own colour change, and a
 * frame's grace. `CellGrid` eases a cell over 300ms; the step is shared with the üstlen fill,
 * because the undo *is* that fill reversed.
 */
const CELL_COLOR_MS = 300;
const BLOCK_DRAIN_MS = (babCount: number) => Math.max(0, babCount - 1) * FILL_STEP_MS + CELL_COLOR_MS + 32;

/**
 * Slots claimed since the app started, by group — the ones whose sub-line reads "az önce
 * üstlendin" rather than a bare count.
 *
 * Module scope rather than component state, because "this session" means the app's, not this
 * screen's: stepping back to the group to look at what you took and returning is the ordinary
 * thing to do, and held in the screen the wording changed under you when you did.
 *
 * It no longer decides whether the *button* appears — that follows from holding the slot, so
 * a reload can't take away your way back. This only decides the wording, which really is a
 * claim about the last minute. Nothing here is authoritative: the server decides who holds
 * what.
 */
const claimedThisSession = new Map<string, Set<number>>();

const rememberClaim = (groupId: string, slotIndex: number) => {
	const claims = claimedThisSession.get(groupId) ?? new Set<number>();

	claims.add(slotIndex);
	claimedThisSession.set(groupId, claims);
};

const forgetClaim = (groupId: string, slotIndex: number) => {
	claimedThisSession.get(groupId)?.delete(slotIndex);
};

/**
 * The share of the seats nobody took (design 07a, and 07b once the pool grows — one screen,
 * since a crowded pool is the same board with more slots). Slots are offered whole rather
 * than bab by bab, so taking one hands you exactly what joining that seat would have.
 *
 * An open slot wears the hatch across the whole card — the same mark the board uses for
 * a bab with no owner. A slot someone has already taken is dimmed and shows who has it.
 */
// No `navigation`: going back is the navigator's own header button now.
const CevsenPoolScreen = ({ route }: Props) => {
	const { groupId } = route.params;
	const group = useGetGroupById(groupId);
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	// Only ever mounted for a Cevşen seat pool — `PoolScreen` below sends a hatim to `CuzPoolScreen`.
	const pool = useGetPoolSlots(groupId);
	// Your own name and photo: a row you just claimed can draw your avatar before the server
	// echoes the name back, and it draws the picture you actually set rather than a generated
	// face — see `useViewerIdentity`.
	const viewer = useViewerIdentity();
	const takeSlot = useTakePoolSlot();
	const releaseSlot = useReleasePoolSlot();
	const pullToRefresh = usePullToRefresh(pool);

	/** Seeded from the session store above, so the wording survives leaving and coming back. */
	const [takenHere, setTakenHere] = useState<number[]>(() => [...(claimedThisSession.get(groupId) ?? [])]);
	/**
	 * The slot draining right now. Held only for as long as the sweep lasts: it exists to tell
	 * the board which run to play backwards, and a stale one would reverse a later claim.
	 */
	const [drainingSlot, setDrainingSlot] = useState<number | null>(null);
	const drainTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (drainTimeout.current) {
				clearTimeout(drainTimeout.current);
			}
		},
		[]
	);

	const handleTake = (slotIndex: number) => {
		rememberClaim(groupId, slotIndex);
		setTakenHere(current => (current.includes(slotIndex) ? current : [...current, slotIndex]));
		takeSlot.mutate({ groupId, slotIndex });
	};

	const handleUndo = (slotIndex: number) => {
		/*
		 * The board is told to drain *before* the request goes out, and the optimistic release
		 * repaints the cells a frame later — so the reversed sweep is what the eye follows all
		 * the way through rather than something that starts once the server has agreed.
		 */
		setDrainingSlot(slotIndex);
		forgetClaim(groupId, slotIndex);
		setTakenHere(current => current.filter(index => index !== slotIndex));
		releaseSlot.mutate({ groupId, slotIndex });

		if (drainTimeout.current) {
			clearTimeout(drainTimeout.current);
		}

		// Cleared once the last cell has finished, so the next claim sweeps forwards again.
		drainTimeout.current = setTimeout(
			() => setDrainingSlot(null),
			BLOCK_DRAIN_MS(pool.data?.find(slot => slot.slotIndex === slotIndex)?.babNumbers.length ?? 0)
		);
	};

	/*
	 * Slot state carried down to the bab, memoised above the early returns with the query.
	 * A whole block is taken at once, so every cell in it shares its slot's state — which is
	 * why this can be built from the slots rather than from the board.
	 *
	 * Memoised because `CellGrid` keeps a cell only while the item it was handed keeps its
	 * identity, and üstlen is exactly the moment that matters: taking a slot re-renders this
	 * screen two or three times in a row, and rebuilt inline that handed all forty cells a new
	 * object each time — re-rendering the whole board underneath the fill it was running.
	 *
	 * Sorted by bab number, not left in slot order. Under ROTATION a seat's block this round
	 * is not its standing one, so the slots arrive as (say) 69–84, 85–100, 1–17 — and the
	 * group screen's card, which builds the same board from the hundred, would draw those
	 * same babs ascending. Two pictures of one pool in two different orders, one tap apart.
	 * The rows below stay in slot order: each is a labelled range, so it reads either way.
	 */
	const cells = useMemo<PoolCell[]>(
		() =>
			(pool.data ?? [])
				.flatMap(slot => {
					// Per bab, not per slot: someone else's block shows how far they have got,
					// so the read half of it has to be identifiable cell by cell.
					const read = new Set(slot.readBabNumbers);

					return slot.babNumbers.map(number => ({
						number,
						// Carried so the fill can be timed from the start of *this* block: claiming
						// one slot should sweep its own cells, not run the length of the pool.
						slotIndex: slot.slotIndex,
						state:
							slot.takenByUserId === null
								? ('open' as const)
								: slot.takenByMe
								? ('takenByMe' as const)
								: read.has(number)
								? ('takenByOthersRead' as const)
								: ('takenByOthers' as const)
					}));
				})
				.sort((a, b) => a.number - b.number),
		[pool.data]
	);

	/**
	 * The draining slot, as a **stable array**.
	 *
	 * Built inline at the call site this was a fresh `[]` on every render, and `PoolGrid`
	 * names it in the dependency list of the `useMemo` that builds all the cells — so the memo
	 * never once hit, and every render rebuilt every cell object and recomputed every fill
	 * delay. Taking a slot renders several times in quick succession (the optimistic paint,
	 * `takenHere`, the server's answer, the drain timer), which is exactly when the sweep is
	 * supposed to be running.
	 */
	const drainingSlotIndexes = useMemo(() => (drainingSlot === null ? [] : [drainingSlot]), [drainingSlot]);

	if (pool.isLoading) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				{/*
				 * The board's shape rather than a spinner. The header and back link are real —
				 * they don't depend on the request — so only the part that is actually unknown
				 * is stubbed, and the card lands at roughly its final height.
				 */}
				<ScreenHeader eyebrow={t('pool')} hasBackButton subtitle={t('poolSub')} title={t('poolTitle')} />
				<GridSkeleton cellCount={SKELETON_CELL_COUNT} />
				<SkeletonStatusRow label={t('loadingPool')} />
			</ScreenContainer>
		);
	}

	if (pool.isError || !pool.data) {
		return <ErrorState queries={[pool]} />;
	}

	const slots = pool.data;
	// Free only, not the whole pool. The header is the answer to "what can I take on right
	// now", so a block somebody has already volunteered for is not part of the offer — it
	// stays in the rows below, where its owner is named.
	const freeSlots = slots.filter(slot => slot.takenByUserId === null);
	const freeBabCount = freeSlots.reduce((total, slot) => total + slot.babNumbers.length, 0);

	const renderSlot = (slot: PoolSlot) => {
		const isTaken = slot.takenByUserId !== null;
		// "This session" is deliberately memory, not a stored timestamp: the offer to undo is
		// about the tap you just made, and it should not survive leaving the screen.
		/*
		 * Two different questions, and they were one for a while.
		 *
		 * *Can* you hand it back — true of any slot you hold, because the server lets you
		 * release your own claim for as long as the round is open. Gating the button on the
		 * session instead meant it vanished on every reload: the memory is this app run's, so
		 * blocks you took yesterday, or ten minutes before a restart, had no way back at all.
		 *
		 * *Did you just take it* — the sub-line's claim, and that one really is about this
		 * run, because "az önce üstlendin" is a statement about the last minute.
		 */
		const canUndo = isTaken && slot.takenByMe;
		const isJustTaken = canUndo && takenHere.includes(slot.slotIndex);
		// A member-private group names nobody but the viewer — the owner excepted.
		const hidesTaker =
			!slot.takenByMe &&
			(slot.takenByUserId?.startsWith('anonymous:') || (group.data?.hideMemberNames && !group.data.isOwner));
		const takerName = hidesTaker ? t('anonymousMember') : slot.takenByDisplayName ?? '';
		// A sentence, to sit beside "Ali üstlendi" — not the legend's one-word `legendMine`.
		const takerLabel = slot.takenByMe ? t('poolTakenByYou') : `${takerName} ${t('takenBy')}`.trim();
		/*
		 * Matched against the slot actually in flight. Both mutations belong to the whole screen,
		 * so read bare they would dim every free row's button at once — a crowded pool would look
		 * like you had taken all of them.
		 */
		const isSlotPending =
			(takeSlot.isPending && takeSlot.variables?.slotIndex === slot.slotIndex) ||
			(releaseSlot.isPending && releaseSlot.variables?.slotIndex === slot.slotIndex);
		// The badge wears the state its cells do, so a range reads the same in the row as it
		// does on the board above it.
		const badgeBackgroundColor = slot.takenByMe
			? theme.colors.accent
			: isTaken
			? theme.colors.poolTaken
			: theme.colors.surface;
		const badgeLabelColor = slot.takenByMe
			? theme.colors.onAccent
			: isTaken
			? theme.colors.poolTakenText
			: theme.colors.accent;

		return (
			/*
			 * The wash for a claimed row sits on what it *describes* — the range and the label —
			 * and never on the controls beside them. Applied to the whole card it took the
			 * avatar and the button down with it, and a dark green button at 62% comes out pale
			 * enough to read as disabled, which is the opposite of what that row offers.
			 */
			<CardSurface key={slot.slotIndex} style={styles.slotCard}>
				{isTaken ? null : <Hatch radius={theme.radius.lg} />}
				<View
					style={[
						styles.slotBadge,
						isTaken ? styles.claimed : null,
						{
							backgroundColor: badgeBackgroundColor,
							borderColor: isTaken ? theme.colors.transparent : theme.colors.border
						}
					]}
				>
					<Typography color={badgeLabelColor} numberOfLines={1} textAlign='center' variant='body'>
						{`${slot.start}–${slot.end}`}
					</Typography>
				</View>
				{/* One line each, always. The undo row carries an avatar *and* a button where the
				    free one carries only a button, so the text column is narrower there — left to
				    wrap, the sub-line went to two lines and the whole row grew as you undid it. */}
				<View style={[styles.slotText, isTaken ? styles.claimed : null]}>
					<BodyStrongText numberOfLines={1}>{isTaken ? takerLabel : t('poolOwnerless')}</BodyStrongText>
					<CaptionText color={theme.colors.subtext} numberOfLines={1} style={styles.slotSub}>
						{isJustTaken
							? `${slot.babNumbers.length} ${t('babs')} · ${t('poolUndoHint')}`
							: isTaken
							? `${slot.babNumbers.length} ${t('babs')}`
							: `${slot.babNumbers.length} ${t('babs')} · ${t('poolExtra')}`}
					</CaptionText>
				</View>
				{/*
				 * Whose block this is, rather than a tick saying only "claimed". The design
				 * draws initials here; this is the app's avatar, seeded on the same name the
				 * members list seeds on, so one person looks like themselves everywhere.
				 *
				 * Everyone's real photo, the server's for other members and Clerk's own for
				 * you — yours comes from the client because an optimistic row is drawn before
				 * the server has said anything, and a seed that changes afterwards redraws as
				 * a different face.
				 */}
				{isTaken ? (
					<Avatar
						imageUrl={slot.takenByMe ? viewer.imageUrl : hidesTaker ? null : slot.takenByImageUrl}
						name={slot.takenByMe ? viewer.displayName : takerName}
						size={AVATAR_SIZE}
						tone={slot.takenByMe ? 'accent' : 'sand'}
					/>
				) : null}
				{/*
				 * **One button in one place, whichever way it reads.** "Üstlen" and "Geri al" used
				 * to be two elements in two branches of a ternary, so taking a block unmounted one
				 * and mounted the other — and a glass button is a SwiftUI host that measures itself
				 * and reports its width back a frame later, so the freshly mounted one had no width
				 * yet and visibly spilled past the card's right edge before snapping back. Sharing
				 * one element keeps the host mounted and turns that into an ordinary re-measure.
				 *
				 * The two have always been the same button down to the fill — standing in the same
				 * slot, a different colour or height made the row twitch as you undid what you had
				 * just done. Only the glyph and the word change, and now that is literally true.
				 *
				 * Nothing at all for someone else's block: their avatar is the whole answer.
				 *
				 * Disabled rather than spinning while the tap is in flight. The board is already
				 * filling or draining, last bab first, and that sweep *is* the confirmation — a
				 * spinner would report a wait the reader has been shown the end of. What the dim
				 * does buy is that the second tap of a double tap cannot fire the opposite action.
				 */}
				{canUndo || !isTaken ? (
					<AppButton
						// Sits beside the badge and the label, so it shrinks to its own text
						// rather than taking the row's full width.
						disabled={isSlotPending}
						fullWidth={false}
						onPress={() => (canUndo ? handleUndo(slot.slotIndex) : handleTake(slot.slotIndex))}
						size='sm'
						title={canUndo ? t('poolUndo') : t('poolTake')}
						variant='accent'
						/*
						 * **Both states carry their glyph.** Undo had one and taking did not, which
						 * left the pair reading as two different controls; the icon set names
						 * `claim` for this exact button ("Üstlen · Claim — E4 havuzdan bab alma").
						 */
						icon={canUndo ? 'undo' : 'claim'}
					/>
				) : null}
			</CardSurface>
		);
	};

	return (
		<ScreenContainer pullToRefresh={pullToRefresh} shouldIncludeTabBarOffset>
			<ScreenHeader eyebrow={t('pool')} hasBackButton subtitle={t('poolSub')} title={t('poolTitle')} />
			{slots.length === 0 ? (
				<EmptyState title={t('poolNone')} />
			) : (
				<>
					<CardSurface style={styles.summaryCard}>
						<View style={styles.summaryRow}>
							<NumericText color={theme.colors.accent}>{freeBabCount}</NumericText>
							<CaptionText color={theme.colors.faintText}>{t('poolBabs')}</CaptionText>
							<CaptionText color={theme.colors.faintText} style={styles.summaryNote}>
								{`${freeSlots.length} ${t('openSpots')}`}
							</CaptionText>
						</View>
						{/*
						 * Numbered and marked per slot, so a block that has been taken stops
						 * looking unclaimed. Painting every cell hatched meant "Üstlen" changed
						 * the card underneath and left this grid — the thing you actually look
						 * at — saying nothing had happened.
						 */}
						<PoolGrid cells={cells} drainingSlotIndexes={drainingSlotIndexes} />
					</CardSurface>
					<View style={styles.slots}>{slots.map(renderSlot)}</View>
				</>
			)}
		</ScreenContainer>
	);
};

/**
 * The havuz, by what the group reads — each kind's own screen, never another's:
 *
 * - **A hatim's havuz is a different screen, not a branch of the Cevşen one.** The seat pool
 *   works in `slotIndex` — a slot is an empty *seat's* block, offered whole — and a hatim has no
 *   seats that divide anything: its havuz is loose cüz, taken one at a time (`CuzPoolScreen`).
 * - A FLEXIBLE group's pool is individual parts, whichever book it reads.
 * - A Hizb seat pool is taken a portion at a time (`HizbPoolScreen`); a Cevşen one a block.
 *
 * The kind is read off the group, seeded from the shelf's cache — and before the group answers
 * (opened cold, from a push) from a list that may still know it, or the route's hint — so the
 * right screen is drawn on the first frame.
 */
export const PoolScreen = (props: Props) => {
	const { groupId, kind: kindHint } = props.route.params;
	// One card that says what this page is for.
	useHintScreen('pool');
	// Holding no cüz this round means QR1 comes first, however this screen was reached.
	useRequireRoundCuz(groupId, props.navigation);
	const group = useGetGroupById(groupId);
	const cachedKind = useCachedGroup(groupId)?.kind;
	const { t } = useTranslation();
	const kind = group.data?.kind ?? cachedKind ?? kindHint;
	const splitMode = group.data?.splitMode;

	if (kind === 'HATIM') {
		return <CuzPoolScreen groupId={groupId} />;
	}

	if (splitMode === 'FLEXIBLE' && group.data) {
		const detail = group.data;

		return (
			<ScreenContainer>
				<ScreenHeader hasBackButton title={detail.name} />
				<FlexibleReadingPanel
					group={detail}
					onOpenReader={number =>
						detail.kind === 'HIZB'
							? props.navigation.navigate('HizbReader', { groupId, partNumber: number })
							: props.navigation.navigate('BabReader', { groupId, babNumber: number })
					}
				/>
			</ScreenContainer>
		);
	}

	if (kind !== undefined && splitMode !== undefined && splitMode !== 'FLEXIBLE') {
		return kind === 'HIZB' ? <HizbPoolScreen {...props} /> : <CevsenPoolScreen {...props} />;
	}

	if (group.isError) {
		return <ErrorState queries={[group]} />;
	}

	return (
		<ScreenContainer>
			<CaptionText>{t('loadingPool')}</CaptionText>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	// Square at 44pt for a short range, widening rather than wrapping for one like
	// "96–100". The height stays fixed so the row keeps its rhythm either way.
	slotBadge: {
		alignItems: 'center',
		borderRadius: 13,
		borderWidth: StyleSheet.hairlineWidth,
		height: BADGE_SIZE,
		justifyContent: 'center',
		minWidth: BADGE_SIZE,
		paddingHorizontal: 6
	},
	slotCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	// The design's dimming for a block that is no longer on offer. Applied to the range and
	// the label only — see the card above.
	claimed: {
		opacity: 0.62
	},
	slotSub: {
		marginTop: 2
	},
	slotText: {
		flex: 1,
		minWidth: 0
	},
	slots: {
		gap: 9
	},
	summaryCard: {
		marginBottom: 12,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	summaryNote: {
		marginLeft: 'auto'
	},
	summaryRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 8,
		marginBottom: 12
	}
});
