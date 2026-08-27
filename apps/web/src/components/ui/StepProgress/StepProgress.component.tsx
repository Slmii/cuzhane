import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { StepProgressProps } from './StepProgress.types';

export const StepProgress = ({ current, style, total }: StepProgressProps) => {
	const { theme } = useThemeContext();

	return (
		<View
			accessibilityRole='progressbar'
			accessibilityValue={{ now: current, min: 1, max: total }}
			style={[styles.row, style]}
		>
			{Array.from({ length: total }, (_, index) => (
				<View
					key={index}
					style={[
						styles.bar,
						{ backgroundColor: index < current ? theme.colors.accent : theme.colors.switchTrackOff }
					]}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	bar: {
		borderRadius: 2,
		flex: 1,
		height: 3
	},
	row: {
		flexDirection: 'row',
		gap: 5
	}
});
