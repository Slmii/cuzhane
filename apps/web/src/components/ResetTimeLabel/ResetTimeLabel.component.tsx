import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { ResetTimeLabelProps } from './ResetTimeLabel.types';

/**
 * When the group's day or round turns over, in the reader's own clock ("sende 23:00") — a Keşfet
 * card's footer, at its right. One time only: the group's own zone is the preview's to state.
 */
export const ResetTimeLabel = ({ label }: ResetTimeLabelProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={styles.row}>
			<Icon color={theme.colors.faintText} name='clock' size={12} strokeWidth={1.8} />
			<CaptionText color={theme.colors.subtext} numberOfLines={1} style={styles.label}>
				{label}
			</CaptionText>
		</View>
	);
};

const styles = StyleSheet.create({
	label: { fontSize: 11 },
	row: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: 5 }
});
