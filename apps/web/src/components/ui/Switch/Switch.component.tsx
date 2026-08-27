import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import type { AppSwitchProps } from './Switch.types';

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const TRACK_PADDING = 3;
const KNOB_SIZE = 20;
const KNOB_TRAVEL = TRACK_WIDTH - TRACK_PADDING * 2 - KNOB_SIZE;

export const AppSwitch = ({ disabled = false, onBlur, onValueChange, style, value }: AppSwitchProps) => {
	const { theme } = useThemeContext();
	// Lazy `useState` rather than `useRef().current` — reading `.current` during render
	// trips react-hooks/refs, and the initialiser still runs only once.
	const [translateX] = useState(() => new Animated.Value(value ? KNOB_TRAVEL : 0));

	useEffect(() => {
		Animated.timing(translateX, {
			toValue: value ? KNOB_TRAVEL : 0,
			duration: 160,
			useNativeDriver: true
		}).start();
	}, [translateX, value]);

	return (
		<Pressable
			accessibilityRole='switch'
			accessibilityState={{ checked: value, disabled }}
			disabled={disabled}
			onPress={() => {
				onValueChange(!value);
				onBlur?.();
			}}
			style={[
				styles.track,
				{
					backgroundColor: value ? theme.colors.accent : theme.colors.switchTrackOff,
					opacity: disabled ? 0.5 : 1
				},
				style
			]}
		>
			<Animated.View
				style={[
					styles.knob,
					{
						backgroundColor: value ? theme.colors.surface : theme.colors.switchThumbOff,
						transform: [{ translateX }]
					}
				]}
			/>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	knob: {
		borderRadius: KNOB_SIZE / 2,
		height: KNOB_SIZE,
		width: KNOB_SIZE
	},
	track: {
		borderRadius: TRACK_HEIGHT / 2,
		height: TRACK_HEIGHT,
		justifyContent: 'center',
		padding: TRACK_PADDING,
		width: TRACK_WIDTH
	}
});
