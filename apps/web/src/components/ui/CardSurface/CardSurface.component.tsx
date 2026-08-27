import { CardSurfaceProps } from '@/components/ui/CardSurface/CardSurface.types';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

export const CardSurface = ({ children, isFlush = false, onLongPress, onPress, style }: CardSurfaceProps) => {
	const { theme } = useThemeContext();
	const [scale] = useState(() => new Animated.Value(1));

	const surfaceStyle = [
		styles.surface,
		{
			backgroundColor: theme.colors.surface,
			borderColor: theme.colors.border,
			borderRadius: theme.radius.lg,
			padding: isFlush ? 0 : theme.spacing.md
		},
		style
	];

	const isInteractive = Boolean(onPress || onLongPress);

	if (!isInteractive) {
		return <View style={surfaceStyle}>{children}</View>;
	}

	const animateScale = (toValue: number) => {
		Animated.timing(scale, {
			toValue,
			duration: 120,
			useNativeDriver: true
		}).start();
	};

	return (
		<Animated.View style={{ transform: [{ scale }] }}>
			<Pressable
				onLongPress={onLongPress}
				onPress={onPress}
				onPressIn={() => {
					animateScale(0.98);
				}}
				onPressOut={() => {
					animateScale(1);
				}}
			>
				<View style={surfaceStyle}>{children}</View>
			</Pressable>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	surface: {
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden'
	}
});
