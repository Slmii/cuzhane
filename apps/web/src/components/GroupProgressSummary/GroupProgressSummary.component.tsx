import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { NumericText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { unitCountFor, unitLabelKey } from '@/lib/utils/units';
import { StyleSheet, View } from 'react-native';
import type { GroupProgressSummaryProps } from './GroupProgressSummary.types';

/**
 * The "78 / 100 bab" count line above a progress bar — the design's core status readout.
 *
 * **Both halves come from the group's kind unless the caller names them**, never from
 * `BAB_COUNT`: a hatim reads "18 / 30 cüz", a Hizb group "12 / 33 bölüm". Taking the total and
 * the word from one argument is what stops the two disagreeing — "18 / 100 cüz" is the shape of
 * that bug. A gathering group's lobby card passes its own pair instead: members against seats.
 *
 * **Every kind draws a bar.** A hatim briefly drew its thirty cells here instead, on the
 * grounds that a bar cannot show a cüz nobody has taken. True, and the wrong place to say
 * it: on a shelf the card is a glance at how far along a group is, the board below the fold
 * on the group screen is where its state is read, and thirty cells made one card twice the
 * height of the one under it for a detail nobody was scanning for.
 */
export const GroupProgressSummary = ({ kind, percent, readCount, style, total, unit }: GroupProgressSummaryProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<View style={style}>
			<View style={styles.countRow}>
				<NumericText color={theme.colors.accent}>{readCount}</NumericText>
				<Typography color={theme.colors.faintText} variant='caption'>
					{`/ ${total ?? unitCountFor(kind)} ${unit ?? t(unitLabelKey(kind))}`}
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
