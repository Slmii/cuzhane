import { SliceChip } from '@/components/SliceChip/SliceChip.component';
import { TourTarget } from '@/components/Tour/TourTarget.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { BodyStrongText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { HomeGroupRowProps } from './HomeGroupRow.types';

/**
 * One group on H1: the stretch the reader is in, the group's name, how much of their own
 * share is done, and the way in.
 *
 * **The row and its button go to two different places.** The row opens the group, which is
 * what a row of a list of groups should do; the button opens the reader at the bab the reader
 * left off on. It says "Oku" while anything is owed and "Tamam" once nothing is, and it opens
 * the reader either way — a finished share is a thing to look at, not a thing to undo.
 * Nothing here marks babs read; that happens where the text is.
 */
export const HomeGroupRow = ({ group, isTourTarget = false, onOpenReader, onPress }: HomeGroupRowProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const isDone = group.done >= group.total;
	const percent = group.total === 0 ? 0 : Math.round((group.done / group.total) * 100);

	const button = (
		<AppButton
			accessibilityLabel={`${group.name} · ${isDone ? t('commitShareDone') : t('read')}`}
			fullWidth={false}
			onPress={onOpenReader}
			size='sm'
			title={isDone ? t('commitShareDone') : t('read')}
			variant={isDone ? 'surface' : 'primary'}
		/>
	);

	return (
		<CardSurface onPress={onPress} style={styles.card}>
			<View style={styles.body}>
				<View style={styles.titleRow}>
					{/* The range in the heading face, as the design sets it — it is the one number
					    on the row somebody reads as a place rather than a measure. */}
					<Typography color={theme.colors.accent} style={styles.range} variant='title' weight='regular'>
						{group.range}
					</Typography>
					<BodyStrongText numberOfLines={1} style={styles.name}>
						{group.name}
					</BodyStrongText>
					{group.moreCount > 0 ? <SliceChip count={group.moreCount} isCompact tone='wash' /> : null}
				</View>
				<ProgressBar percent={percent} />
			</View>
			{/*
			 * The wrapper is only mounted for the row the tour points at. `TourTarget` renders a
			 * plain `View` around its child, and this button sizes itself to its label — so
			 * wrapping every row would put a measured box around nine controls for the sake of one.
			 */}
			{isTourTarget ? <TourTarget id='read'>{button}</TourTarget> : button}
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	body: {
		flex: 1,
		gap: 9,
		minWidth: 0
	},
	card: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	name: {
		flex: 1,
		fontSize: 12.5,
		minWidth: 0
	},
	range: {
		fontSize: 15,
		lineHeight: 17
	},
	titleRow: {
		// Baselines, not boxes. The range is Newsreader and the name is Manrope at a smaller
		// size; centring their boxes left the two sitting on different lines, which is what the
		// design's own `align-items: baseline` avoids.
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 8,
		minWidth: 0
	}
});
