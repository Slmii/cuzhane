import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Switch } from 'react-native';
import type { AppSwitchProps } from './Switch.types';

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const TRACK_PADDING = 3;
const KNOB_SIZE = 20;
const KNOB_TRAVEL = TRACK_WIDTH - TRACK_PADDING * 2 - KNOB_SIZE;

/** The design's own switch, drawn to the mock. Used wherever the platform has nothing better. */
const DrawnSwitch = ({ disabled = false, onBlur, onColor, onValueChange, style, value }: AppSwitchProps) => {
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
					backgroundColor: value ? onColor ?? theme.colors.accent : theme.colors.switchTrackOff,
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

/** The real `UISwitch`, whose knob iOS 26 renders in glass during interaction. */
const GlassSwitch = ({ disabled = false, onBlur, onColor, onValueChange, style, value }: AppSwitchProps) => {
	const { theme } = useThemeContext();

	return (
		<Switch
			disabled={disabled}
			/*
			 * The off-state track behind the animation. iOS draws the resting track from this
			 * rather than from `trackColor.false`, which only paints during the transition.
			 */
			ios_backgroundColor={theme.colors.switchTrackOff}
			onValueChange={next => {
				onValueChange(next);
				// The blur a `Controller` is waiting for: a native switch has no focus to lose,
				// so flipping it is the only moment the field can be called touched.
				onBlur?.();
			}}
			style={style}
			/*
			 * **No `thumbColor` on iOS.** The knob there is the system's own material — glass on
			 * 26 — and naming a colour flattens it to a solid disc, which is the drawn switch all
			 * over again.
			 */
			{...(Platform.OS === 'android' ? { thumbColor: theme.colors.switchThumbOff } : {})}
			trackColor={{ false: theme.colors.switchTrackOff, true: onColor ?? theme.colors.accent }}
			value={value}
		/>
	);
};

/**
 * **The platform's switch where the platform has one worth having, ours everywhere else.**
 *
 * `isLiquidGlassSupported` is the gate rather than `Platform.OS`, because the question is not
 * "is this iOS" but "does this device actually render Liquid Glass". It is a compile-time
 * `false` on Android and a runtime `false` on iOS below 26 — so an iPhone on 18 keeps the drawn
 * switch instead of getting a plain `UISwitch` that matches neither the system nor the design.
 *
 * A hand-drawn control is frozen at the moment it was written: no system materials, no haptics,
 * none of the accessibility behaviours the real control grows over time. That argument only
 * pays where the platform is offering something, which is exactly what this gate asks. Android
 * keeps the design's switch, and `ui/SegmentedControl` splits the same way for the same reason.
 *
 * The native one is larger (51×31 against 44×26, the platform's own metric) and left that way —
 * sizing it back down to the mock would re-impose the drift this replaced.
 */
export const AppSwitch = (props: AppSwitchProps) =>
	isLiquidGlassSupported ? <GlassSwitch {...props} /> : <DrawnSwitch {...props} />;

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
