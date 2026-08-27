import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyStrongText, CaptionText, NumericText, Typography } from '@/components/ui/Typography/Typography.component';
import { useGetPoolSlots, useTakePoolSlot } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { PoolSlot } from '@/lib/types/domain';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'Pool'>;

/** The design's 44pt range badge. */
const BADGE_SIZE = 44;

/**
 * The share of the seats nobody took (design 07a). Slots are offered whole rather than
 * bab by bab, so taking one hands you exactly what joining that seat would have.
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
			<ScreenContainer isScrollable={false}>
				<ActivityIndicator color={theme.colors.accent} style={styles.loading} />
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
	// The design counts the whole pool, not just what is still going: "10 sahipsiz bab ·
	// 2 boş kontenjan" for two five-bab seats, one of which Mehmet has already taken.
	const babCount = slots.reduce((total, slot) => total + slot.babNumbers.length, 0);
	const poolBabNumbers = slots.flatMap(slot => slot.babNumbers);

	const renderSlot = (slot: PoolSlot) => {
		const isTaken = slot.takenByUserId !== null;
		const takerLabel = slot.takenByMe ? t('poolTaken') : `${slot.takenByDisplayName ?? ''} ${t('takenBy')}`.trim();

		return (
			<CardSurface key={slot.slotIndex} style={[styles.slotCard, isTaken ? styles.slotCardTaken : null]}>
				{isTaken ? null : <Hatch radius={theme.radius.lg} />}
				<View
					style={[
						styles.slotBadge,
						{
							backgroundColor: isTaken ? theme.colors.accentSoft : theme.colors.surface,
							borderColor: isTaken ? 'transparent' : theme.colors.border
						}
					]}
				>
					<Typography color={theme.colors.accent} numberOfLines={1} textAlign='center' variant='body'>
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
					<Icon color={theme.colors.accent} name='check' size={19} strokeWidth={2} />
				) : (
					<AppButton
						// Sits beside the badge and the label, so it shrinks to its own text
						// rather than taking the row's full width.
						fullWidth={false}
						isLoading={takeSlot.isPending}
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
							<NumericText color={theme.colors.accent}>{babCount}</NumericText>
							<CaptionText color={theme.colors.faintText}>{t('poolBabs')}</CaptionText>
							<CaptionText color={theme.colors.faintText} style={styles.summaryNote}>
								{`${slots.length} ${t('openSpots')}`}
							</CaptionText>
						</View>
						<CellGrid
							columns={10}
							gap={3}
							items={poolBabNumbers.map(number => ({
								backgroundColor: theme.colors.track,
								isHatched: true,
								key: number
							}))}
							radius={4}
						/>
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
	loading: {
		flex: 1
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
