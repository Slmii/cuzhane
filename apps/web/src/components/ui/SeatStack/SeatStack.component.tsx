import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { SeatStackProps } from './SeatStack.types';

/**
 * Three blank tinted discs standing in for a group's members. The design uses them
 * wherever it shows "people are here" to someone who isn't in the group yet — Keşfet's
 * rows and the invite preview — so there are no faces to show and none are invented.
 */
export const SeatStack = ({ style }: SeatStackProps) => {
	const { theme } = useThemeContext();
	const tones = [theme.colors.accentSoft, theme.colors.sand, theme.colors.secondary];

	return (
		<View style={[styles.stack, style]}>
			{tones.map((tone, index) => (
				<View
					key={tone}
					style={[
						styles.seat,
						{ backgroundColor: tone, borderColor: theme.colors.surface },
						index > 0 ? styles.overlap : null
					]}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	overlap: {
		marginLeft: -7
	},
	seat: {
		borderRadius: 11,
		borderWidth: 1.5,
		height: 22,
		width: 22
	},
	stack: {
		flexDirection: 'row'
	}
});
