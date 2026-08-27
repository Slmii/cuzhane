import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { NumericText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { BAB_COUNT } from '@/lib/utils/babs';
import { StyleSheet, View } from 'react-native';
import type { GroupProgressSummaryProps } from './GroupProgressSummary.types';

/** The "78 / 100 bab" count line above a progress bar — the design's core status readout. */
export const GroupProgressSummary = ({ percent, readCount, style }: GroupProgressSummaryProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<View style={style}>
			<View style={styles.countRow}>
				<NumericText color={theme.colors.accent}>{readCount}</NumericText>
				<Typography color={theme.colors.faintText} variant='caption'>
					{`/ ${BAB_COUNT} ${t('babs')}`}
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
