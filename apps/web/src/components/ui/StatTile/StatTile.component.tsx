import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { NumericText, StatText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet } from 'react-native';
import type { StatTileProps } from './StatTile.types';

export const StatTile = ({ hasGlassSurface = false, label, style, tone = 'default', value }: StatTileProps) => {
	const { theme } = useThemeContext();

	return (
		<CardSurface hasGlassSurface={hasGlassSurface} isFlush style={[styles.card, style]}>
			<NumericText color={tone === 'accent' ? theme.colors.accent : theme.colors.text}>{value}</NumericText>
			<StatText color={theme.colors.faintText} style={styles.label}>
				{label}
			</StatText>
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	card: {
		padding: 14
	},
	label: {
		marginTop: 4
	}
});
