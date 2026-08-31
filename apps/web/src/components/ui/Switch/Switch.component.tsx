import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Platform, Switch } from 'react-native';
import type { AppSwitchProps } from './Switch.types';

/**
 * **The platform's own switch**, not one we draw.
 *
 * It used to be a `Pressable` track with an `Animated.View` knob sliding 18pt over 160ms —
 * a faithful copy of the design's switch, and a copy is all it could ever be. A hand-drawn
 * control is frozen at the moment it was written: it does not pick up the system's materials,
 * its haptics, its accessibility behaviours, or the way iOS 26 renders a `UISwitch` in glass.
 * Every OS release quietly widens the gap between it and every other switch on the phone.
 *
 * React Native's `Switch` is a real `UISwitch` on iOS and a Material switch on Android, so all
 * of that arrives for free — and the only thing we hand it is the palette.
 *
 * It is a little larger than the drawn one (51×31 against 44×26, the platform's own metric)
 * and it is left that way deliberately: sizing the native control back down to the mock would
 * be re-imposing exactly the drift this replaced.
 */
export const AppSwitch = ({ disabled = false, onBlur, onValueChange, style, value }: AppSwitchProps) => {
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
			 * over again. Android has no such material and does want the token.
			 */
			{...(Platform.OS === 'android' ? { thumbColor: theme.colors.switchThumbOff } : {})}
			trackColor={{ false: theme.colors.switchTrackOff, true: theme.colors.accent }}
			value={value}
		/>
	);
};
