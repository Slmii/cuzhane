import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { BabLegendProps } from './BabLegend.types';

/** Matches the swatch style below, so the hatch is clipped to the same rounding. */
const SWATCH_RADIUS = 3;

export const BabLegend = ({ style }: BabLegendProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	// Swatches mirror `BabGrid`'s tones, including the outlined "assigned to you but
	// not read yet" state, which the board draws as a surface fill with an accent ring.
	const entries = [
		{ backgroundColor: theme.colors.babReadByMe, borderColor: theme.colors.babReadByMe, label: t('legendRead') },
		{ backgroundColor: theme.colors.surface, borderColor: theme.colors.accent, label: t('legendMine') },
		{
			backgroundColor: theme.colors.babReadByOthers,
			borderColor: theme.colors.babReadByOthers,
			label: t('legendOthers')
		},
		{ backgroundColor: theme.colors.babOpen, borderColor: theme.colors.babOpen, label: t('legendOpen') },
		// The pool has no reader yet, so it can't reuse a progress colour — `poolFree` and the
		// hatch read as "belongs to a seat nobody took" rather than a fifth progress state.
		//
		// **`poolFree`, the same token the cells it labels use.** This swatch was drawn in
		// `track`, which was neither the board's pool colour nor the pool board's — a legend
		// key that didn't match the thing it was a key for.
		{
			backgroundColor: theme.colors.poolFree,
			borderColor: theme.colors.poolFree,
			isHatched: true,
			label: t('legendPool')
		}
	];

	return (
		<View style={[styles.legend, style]}>
			{entries.map(entry => (
				<View key={entry.label} style={styles.entry}>
					<View
						style={[
							styles.swatch,
							{ backgroundColor: entry.backgroundColor, borderColor: entry.borderColor }
						]}
					>
						{/* The same primitive the board cells and pool cards use, so the swatch
						    can't drift from the thing it is explaining. */}
						{entry.isHatched ? <Hatch radius={SWATCH_RADIUS} /> : null}
					</View>
					<Typography color={theme.colors.subtext} style={styles.label} variant='caption'>
						{entry.label}
					</Typography>
				</View>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	entry: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	label: {
		fontSize: 10.5
	},
	legend: {
		columnGap: 14,
		flexDirection: 'row',
		flexWrap: 'wrap',
		rowGap: 6
	},
	swatch: {
		borderRadius: 3,
		borderWidth: 1.5,
		height: 11,
		overflow: 'hidden',
		width: 11
	}
});
