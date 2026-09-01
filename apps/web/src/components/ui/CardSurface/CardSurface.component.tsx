import { CardSurfaceProps } from '@/components/ui/CardSurface/CardSurface.types';
import { GlassSurface } from '@/components/ui/GlassSurface/GlassSurface.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

export const CardSurface = ({
	children,
	hasGlassSurface = false,
	isFlush = false,
	onLongPress,
	onPress,
	style
}: CardSurfaceProps) => {
	const { theme } = useThemeContext();
	const [scale] = useState(() => new Animated.Value(1));

	const surfaceStyle = [
		styles.surface,
		{
			// A glass card paints its own fill underneath, so the card itself must not carry one.
			backgroundColor: hasGlassSurface ? 'transparent' : theme.colors.surface,
			borderColor: theme.colors.border,
			borderRadius: theme.radius.lg,
			padding: isFlush ? 0 : theme.spacing.md
		},
		style
	];

	/*
	 * Behind the children, and **given the card's radius rather than left to be clipped into
	 * it**. `LiquidGlassView` copies its own `layer.cornerRadius` from the style it is handed,
	 * so a bare `absoluteFill` makes a square panel: the card's `overflow: 'hidden'` then slices
	 * the four corners off, and the hairline border visibly stops short around each curve while
	 * running unbroken along the straight edges. Naming the radius means the material is the
	 * right shape to begin with and the border keeps its curve.
	 *
	 * **Tinted with `surface` — the colour the card was before it was glass.** Untinted, the
	 * material samples what is behind it, and behind a card is `background`: in light mode a
	 * white-ish card sat on `#F7F5F0` and came out near enough the same cream, so the stack of
	 * cards lost its edges and the page read as one flat sheet. The tint is blended into the
	 * glass rather than laid over it, so the blur and the specular edge survive — this is the
	 * card getting its own colour back, not the material being painted out. `fallbackColor` is
	 * the same token, which is what keeps the glass and non-glass builds looking alike.
	 *
	 * **The wash on top is the other half of that**, and it is needed because the tint alone
	 * wasn't enough. `UIGlassEffect.tintColor` blends with the backdrop rather than replacing
	 * it, so even an opaque white tint kept sampling the cream page and the cards came out
	 * beige rather than white. `surfaceGlassWash` is the card's own colour laid over the
	 * material at 0.62 — enough to read as the white it used to be, little enough that the
	 * blur and the specular edge are still there underneath. Its radius matches for the same
	 * reason the glass's does.
	 *
	 * `pointerEvents='none'` on both keeps them out of the way of anything pressable inside.
	 */
	const glass = hasGlassSurface ? (
		<>
			<GlassSurface
				fallbackColor={theme.colors.surface}
				pointerEvents='none'
				style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.lg }]}
				tintColor={theme.colors.surface}
			/>
			<View
				pointerEvents='none'
				style={[
					StyleSheet.absoluteFill,
					{ backgroundColor: theme.colors.surfaceGlassWash, borderRadius: theme.radius.lg }
				]}
			/>
		</>
	) : null;

	const isInteractive = Boolean(onPress || onLongPress);

	if (!isInteractive) {
		return (
			<View style={surfaceStyle}>
				{glass}
				{children}
			</View>
		);
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
				<View style={surfaceStyle}>
					{glass}
					{children}
				</View>
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
