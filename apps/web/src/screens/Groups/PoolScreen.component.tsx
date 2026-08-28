import { GridSkeleton } from '@/components/GridSkeleton/GridSkeleton.component';
import { PoolGrid } from '@/components/PoolGrid/PoolGrid.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { BodyStrongText, CaptionText, NumericText, Typography } from '@/components/ui/Typography/Typography.component';
import { useGetPoolSlots, useTakePoolSlot } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { PoolSlot } from '@/lib/types/domain';
import type { PoolCell } from '@/lib/utils/groups';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

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
 * The share of the seats nobody took (design 07a, and 07b once the pool grows — one screen,
 * since a crowded pool is the same board with more slots). Slots are offered whole rather
 * than bab by bab, so taking one hands you exactly what joining that seat would have.
 *
 * An open slot wears the hatch across the whole card — the same mark the board uses for
 * a bab with no owner. A slot someone has already taken is dimmed and shows who has it.
 */
export const PoolScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const pool = useGetPoolSlots(groupId);
	const takeSlot = useTakePoolSlot();

	if (pool.isLoading) {
		return (
			<ScreenContainer shouldIncludeTabBarOffset>
				{/*
				 * The board's shape rather than a spinner. The header and back link are real —
				 * they don't depend on the request — so only the part that is actually unknown
				 * is stubbed, and the card lands at roughly its final height.
				 */}
				<ScreenHeader
					eyebrow={t('pool')}
					onBack={navigation.goBack}
					subtitle={t('poolSub')}
					title={t('poolTitle')}
				/>
				<GridSkeleton cellCount={SKELETON_CELL_COUNT} />
			</ScreenContainer>
		);
	}

	if (pool.isError || !pool.data) {
		return (
			<ScreenContainer isScrollable>
				<EmptyState actionLabel={t('retry')} onAction={() => pool.refetch()} title={t('genericError')} />
			</ScreenContainer>
		);
	}

	const slots = pool.data;
	// Free only, not the whole pool. The header is the answer to "what can I take on right
	// now", so a block somebody has already volunteered for is not part of the offer — it
	// stays in the rows below, where its owner is named.
	const freeSlots = slots.filter(slot => slot.takenByUserId === null);
	const freeBabCount = freeSlots.reduce((total, slot) => total + slot.babNumbers.length, 0);
	/*
	 * Slot state carried down to the bab. A whole block is taken at once, so every cell in
	 * it shares its slot's state — which is why this can be built from the slots rather
	 * than from the board.
	 *
	 * Sorted by bab number, not left in slot order. Under ROTATION a seat's block this round
	 * is not its standing one, so the slots arrive as (say) 69–84, 85–100, 1–17 — and the
	 * group screen's card, which builds the same board from the hundred, would draw those
	 * same babs ascending. Two pictures of one pool in two different orders, one tap apart.
	 * The rows below stay in slot order: each is a labelled range, so it reads either way.
	 */
	const cells: PoolCell[] = slots
		.flatMap(slot =>
			slot.babNumbers.map(number => ({
				number,
				// Carried so the fill can be timed from the start of *this* block: claiming
				// one slot should sweep its own cells, not run the length of the pool.
				slotIndex: slot.slotIndex,
				state:
					slot.takenByUserId === null
						? ('open' as const)
						: slot.takenByMe
							? ('takenByMe' as const)
							: ('takenByOthers' as const)
			}))
		)
		.sort((a, b) => a.number - b.number);

	const renderSlot = (slot: PoolSlot) => {
		const isTaken = slot.takenByUserId !== null;
		const takerLabel = slot.takenByMe ? t('poolMine') : `${slot.takenByDisplayName ?? ''} ${t('takenBy')}`.trim();
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
			<CardSurface key={slot.slotIndex} style={[styles.slotCard, isTaken ? styles.slotCardTaken : null]}>
				{isTaken ? null : <Hatch radius={theme.radius.lg} />}
				<View
					style={[
						styles.slotBadge,
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
				<View style={styles.slotText}>
					<BodyStrongText>{isTaken ? takerLabel : t('poolOwnerless')}</BodyStrongText>
					<CaptionText color={theme.colors.subtext} style={styles.slotSub}>
						{isTaken
							? `${slot.babNumbers.length} ${t('babs')}`
							: `${slot.babNumbers.length} ${t('babs')} · ${t('poolExtra')}`}
					</CaptionText>
				</View>
				{isTaken ? (
					/*
					 * Whose block this is, rather than a tick saying only "claimed". The design
					 * draws initials here; this is the app's avatar, seeded on the same name the
					 * members list seeds on, so one person looks like themselves everywhere.
					 */
					<Avatar
						name={slot.takenByDisplayName ?? ''}
						size={AVATAR_SIZE}
						tone={slot.takenByMe ? 'accent' : 'sand'}
					/>
				) : (
					<AppButton
						// Sits beside the badge and the label, so it shrinks to its own text
						// rather than taking the row's full width.
						fullWidth={false}
						// Matched against the slot actually in flight. `isPending` belongs to the
						// one mutation the whole screen shares, so read bare it spins every free
						// row's button at once — a crowded pool looks like you took all of them.
						isLoading={takeSlot.isPending && takeSlot.variables?.slotIndex === slot.slotIndex}
						onPress={() => takeSlot.mutate({ groupId, slotIndex: slot.slotIndex })}
						size='sm'
						title={t('poolTake')}
						variant='accent'
					/>
				)}
			</CardSurface>
		);
	};

	return (
		<ScreenContainer shouldIncludeTabBarOffset>
			<ScreenHeader
				eyebrow={t('pool')}
				onBack={navigation.goBack}
				subtitle={t('poolSub')}
				title={t('poolTitle')}
			/>
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
						<PoolGrid cells={cells} />
					</CardSurface>
					<View style={styles.slots}>{slots.map(renderSlot)}</View>
					<CaptionText color={theme.colors.faintText} style={styles.hint}>
						{t('poolHint')}
					</CaptionText>
				</>
			)}
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	hint: {
		marginTop: 14
	},
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
	slotCardTaken: {
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
