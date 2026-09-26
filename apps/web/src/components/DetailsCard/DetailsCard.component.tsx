import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { DetailsCardProps } from './DetailsCard.types';

/**
 * A card of label-and-value rows, edge to edge with a hairline between them — the Hizb lobby's
 * "Süre · Okuma planı" (HC4). The same rows the invite preview draws for its meta table, which
 * still sets out its own: that one carries a second clock under a value and this does not.
 */
export const DetailsCard = ({ rows, style }: DetailsCardProps) => {
	const { theme } = useThemeContext();

	return (
		<CardSurface isFlush style={style}>
			{rows.map((row, index) => (
				<View
					key={row.label}
					style={[
						styles.row,
						index < rows.length - 1
							? { borderBottomColor: theme.colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }
							: null
					]}
				>
					<CaptionText color={theme.colors.subtext}>{row.label}</CaptionText>
					{/* Shrinks rather than pushing the label off, and wraps under itself. */}
					<CaptionText style={styles.value} textAlign='right' weight='semibold'>
						{row.value}
					</CaptionText>
				</View>
			))}
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	value: {
		flexShrink: 1
	}
});
