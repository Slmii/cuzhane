import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { DividerProps } from './Divider.types';

export const Divider = ({ style }: DividerProps) => {
	const { theme } = useThemeContext();

	return <View style={[styles.line, { backgroundColor: theme.colors.divider }, style]} />;
};

const styles = StyleSheet.create({
	line: {
		height: StyleSheet.hairlineWidth
	}
});
