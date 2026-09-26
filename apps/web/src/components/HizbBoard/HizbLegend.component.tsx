import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { HizbLegendProps } from './HizbBoard.types';
import { HIZB_LEGEND, HIZB_RING_WIDTH, hizbCellPalette } from './hizbCellPalette';

const SWATCH_RADIUS = 3;

/**
 * The Hizb board's key — Okundu, Alındı, Sahipsiz, Senin — under the group screen's board and
 * the Havuz lattice alike, each swatch drawn by the palette it explains.
 */
export const HizbLegend = ({ style }: HizbLegendProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<View style={[hizbLegendLayout.legend, style]}>
			{HIZB_LEGEND.map(entry => {
				const palette = hizbCellPalette(entry.cell, theme);

				return (
					<View key={entry.labelKey} style={hizbLegendLayout.legendEntry}>
						<View
							style={[
								styles.swatch,
								{ backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }
							]}
						>
							{/* The primitive the cells use, so the key can't drift from the thing it keys. */}
							{entry.cell.state === 'pool' ? <Hatch radius={SWATCH_RADIUS} /> : null}
						</View>
						<Typography color={theme.colors.subtext} style={styles.legendLabel} variant='caption'>
							{t(entry.labelKey)}
						</Typography>
					</View>
				);
			})}
		</View>
	);
};

/**
 * The legend's frame, shared with `HizbBoardSkeleton` so the stand-in's row of bones is exactly
 * as tall as the row of labels that replaces it.
 */
export const hizbLegendLayout = StyleSheet.create({
	legend: {
		columnGap: 13,
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 10,
		rowGap: 6
	},
	legendEntry: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6,
		// The caption's own line, so a row of bones is as tall as a row of labels.
		minHeight: 17
	}
});

const styles = StyleSheet.create({
	legendLabel: {
		fontSize: 10.5
	},
	swatch: {
		borderRadius: SWATCH_RADIUS,
		borderWidth: HIZB_RING_WIDTH,
		height: 11,
		overflow: 'hidden',
		width: 11
	}
});
