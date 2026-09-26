import { SliceChip } from '@/components/SliceChip/SliceChip.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { ReadingTypeMark } from '@/components/ui/ReadingTypeMark/ReadingTypeMark.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import type { HomeGroupRowProps } from './HomeGroupRow.types';
import { PortionBar } from './PortionBar.component';

const MARK_SIZE = 22;

/**
 * One share under "Sonra" (B8) — **one row style for both kinds.** The kind's mark, the place
 * in the heading face, the group, how far along, the portion bar, and the way in. Cevşen counts
 * babs ("2/5", a segment each); a cüz counts pages and says how long its round has left
 * ("0/20 s · 6 gün"), since a hatim's round runs for days.
 *
 * The whole row opens the reading, as the button does: nothing here marks anything read, and
 * the group itself is a tab away.
 */
export const HomeGroupRow = ({
	actionLabel,
	fraction,
	heading,
	kind,
	meta,
	moreCount,
	name,
	onPress,
	segments
}: HomeGroupRowProps) => {
	const { theme } = useThemeContext();

	return (
		<CardSurface onPress={onPress} style={styles.card}>
			<ReadingTypeMark color={toAlphaColor(theme.colors.accent, 0.75)} kind={kind} size={MARK_SIZE} />
			<View style={styles.body}>
				<View style={styles.titleRow}>
					<Typography color={theme.colors.accent} style={styles.heading} variant='title' weight='regular'>
						{heading}
					</Typography>
					<SliceChip count={moreCount} isCompact tone='wash' />
					<Typography numberOfLines={1} style={styles.name} weight='semibold'>
						{name}
					</Typography>
					<Typography color={theme.colors.faintText} style={styles.meta}>
						{meta}
					</Typography>
				</View>
				<PortionBar {...(segments ? { segments } : { fraction: fraction ?? 0 })} />
			</View>
			<AppButton
				accessibilityLabel={`${name} · ${actionLabel}`}
				fullWidth={false}
				onPress={onPress}
				size='sm'
				title={actionLabel}
				variant='accent'
			/>
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	body: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	card: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 14,
		paddingVertical: 12
	},
	heading: {
		fontSize: 15,
		lineHeight: 17
	},
	meta: {
		fontSize: 10.5,
		lineHeight: 14
	},
	name: {
		flex: 1,
		fontSize: 12.5,
		lineHeight: 16
	},
	titleRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 8,
		minWidth: 0
	}
});
