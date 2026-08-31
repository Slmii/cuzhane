import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import type { HatchProps } from './Hatch.types';

/**
 * The design's `.stripe`: `repeating-linear-gradient(135deg, hatch 0 6px, transparent 6px 12px)`.
 *
 * React Native has no repeating gradient, so the bands are drawn as rotated views. It
 * exists once because the hatch carries a meaning — a bab belongs to a seat nobody took —
 * and has to read identically on the 100-bab board, the legend swatch and a pool card.
 */
const BAND_WIDTH = 6;
const BAND_GAP = 6;
const PERIOD = BAND_WIDTH + BAND_GAP;

export const Hatch = ({ radius = 0, style }: HatchProps) => {
	const { theme } = useThemeContext();
	const [size, setSize] = useState({ height: 0, width: 0 });

	const handleLayout = (event: LayoutChangeEvent) => {
		const { height, width } = event.nativeEvent.layout;
		setSize(current => (current.width === width && current.height === height ? current : { height, width }));
	};

	// Each band is a tall thin view centred on the box and rotated 45°, so it crosses the
	// box as a diagonal. It has to be as long as the diagonal to reach both corners, and
	// the sweep starts a full height to the left because a rotated band drifts sideways by
	// its own height on the way across.
	const bandLength = Math.ceil(Math.hypot(size.width, size.height));
	const bandCount = size.width > 0 ? Math.ceil((size.width + size.height * 2) / PERIOD) : 0;

	return (
		<View onLayout={handleLayout} pointerEvents='none' style={[styles.overlay, { borderRadius: radius }, style]}>
			{Array.from({ length: bandCount }, (_, index) => (
				<View
					key={index}
					style={[
						styles.band,
						{
							backgroundColor: theme.colors.hatch,
							height: bandLength,
							left: index * PERIOD - size.height,
							marginTop: -bandLength / 2,
							width: BAND_WIDTH
						}
					]}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	band: {
		position: 'absolute',
		// Centred on the box, so the 45° rotation pivots about the box itself rather than
		// a point outside it — which is what left the stripes clipped to one edge.
		top: '50%',
		transform: [{ rotate: '45deg' }]
	},
	overlay: {
		...StyleSheet.absoluteFill,
		overflow: 'hidden'
	}
});
