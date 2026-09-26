import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { NumericText, Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { GroupProgressSummaryProps } from './GroupProgressSummary.types';

/**
 * The "78 / 100 bab" count line above a progress bar — the design's core status readout.
 *
 * The total and its noun are the caller's: a Cevşen group counts its hundred babs, a Hizb
 * group its 33 portions, and a gathering group's lobby card counts members against its seats.
 */
export const GroupProgressSummary = ({ percent, readCount, style, total, unit }: GroupProgressSummaryProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={style}>
			<View style={styles.countRow}>
				<NumericText color={theme.colors.accent}>{readCount}</NumericText>
				<Typography color={theme.colors.faintText} variant='caption'>
					{`/ ${total} ${unit}`}
				</Typography>
			</View>
			<ProgressBar percent={percent} style={styles.bar} />
		</View>
	);
};

const styles = StyleSheet.create({
	bar: {
		marginBottom: 16
	},
	countRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 7,
		marginBottom: 8
	}
});
