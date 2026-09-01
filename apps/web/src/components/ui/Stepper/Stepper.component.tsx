import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe, useReducedMotion } from 'react-native-reanimated';
import type { StepperProps } from './Stepper.types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * `sg-pop` at the count's own timing — `.34s cubic-bezier(.2,1.4,.4,1)`, a touch shorter than
 * the cells' `.38s` and on a fractionally springier curve. Both numbers are the design's, and
 * the difference between the two curves is deliberate on its part, so they are written out
 * separately rather than shared with `CellGrid`.
 *
 * Built fresh each time because `Keyframe` is mutable and a shared instance would be
 * reconfigured by whoever touched it last.
 */
const COUNT_POP_EASING = Easing.bezier(0.2, 1.4, 0.4, 1);

const countPop = () =>
	new Keyframe({
		0: { opacity: 0, transform: [{ scale: 0.55 }] },
		62: { easing: COUNT_POP_EASING, opacity: 1, transform: [{ scale: 1.14 }] },
		100: { easing: COUNT_POP_EASING, opacity: 1, transform: [{ scale: 1 }] }
	}).duration(340);

export const Stepper = ({ caption, max = 50, min = 5, onChange, step = 5, style, value, values }: StepperProps) => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	// Walking a list of allowed values, or adding a constant. The index is found rather than
	// tracked, so a value arriving from outside the list (a saved draft, a schema default)
	// still moves: `findIndex` misses, and the first press lands on the nearest end.
	const valueIndex = values ? values.indexOf(value) : -1;
	const isMinDisabled = values ? valueIndex <= 0 : value <= min;
	const isMaxDisabled = values ? valueIndex === values.length - 1 : value >= max;

	const handleChange = (delta: number) => {
		if (!values) {
			onChange(clamp(value + delta, min, max));

			return;
		}

		const nextIndex = clamp(valueIndex + (delta > 0 ? 1 : -1), 0, values.length - 1);
		const next = values[nextIndex];

		if (next !== undefined) {
			onChange(next);
		}
	};

	return (
		<View accessibilityRole='adjustable' style={[styles.row, style]}>
			{/* `.spot-btn:active { transform: scale(.96) }` — the prototype's only press feedback,
			    and `:disabled { opacity:.35 }` its only disabled state. */}
			<Pressable
				accessibilityRole='button'
				disabled={isMinDisabled}
				onPress={() => handleChange(-step)}
				style={({ pressed }) => [
					styles.button,
					{
						backgroundColor: theme.colors.surface,
						borderColor: theme.colors.border,
						opacity: isMinDisabled ? 0.35 : 1,
						transform: [{ scale: pressed ? 0.96 : 1 }]
					}
				]}
			>
				<Icon name='minus' size={17} />
			</Pressable>
			<View style={styles.centerColumn}>
				{/*
				 * `spot-stepper.html`: the seat count re-pops on every change, in the same beat as
				 * the cells arriving. Keyed on the value so it remounts — a mounted view's
				 * `entering` never replays, which is the same reason the prototype swaps the
				 * node rather than restarting the CSS animation on it.
				 */}
				<Animated.View entering={isReducedMotion ? undefined : countPop()} key={value}>
					<Typography color={theme.colors.accent} style={styles.value} variant='display'>
						{value}
					</Typography>
				</Animated.View>
				{caption ? (
					<CaptionText color={theme.colors.faintText} style={styles.caption} textAlign='center'>
						{caption}
					</CaptionText>
				) : null}
			</View>
			<Pressable
				accessibilityRole='button'
				disabled={isMaxDisabled}
				onPress={() => handleChange(step)}
				style={({ pressed }) => [
					styles.button,
					{
						backgroundColor: theme.colors.surface,
						borderColor: theme.colors.border,
						opacity: isMaxDisabled ? 0.35 : 1,
						transform: [{ scale: pressed ? 0.96 : 1 }]
					}
				]}
			>
				<Icon name='plus' size={17} />
			</Pressable>
		</View>
	);
};

const styles = StyleSheet.create({
	button: {
		alignItems: 'center',
		borderRadius: 12,
		borderWidth: 1,
		height: 36,
		justifyContent: 'center',
		width: 36
	},
	caption: {
		fontSize: 10.5,
		marginTop: 5
	},
	centerColumn: {
		alignItems: 'center'
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	value: {
		fontSize: 34,
		lineHeight: 36
	}
});
