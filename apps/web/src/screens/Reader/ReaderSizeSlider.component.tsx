import { Typography } from '@/components/ui/Typography/Typography.component';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { GlassSizeSlider, isGlassSizeSliderAvailable } from './GlassSizeSlider';
import type { ReaderSizeSliderProps } from './ReaderSizeSlider.types';

const TRACK_HEIGHT = 4;
const KNOB_SIZE = 26;

/** The "Aa" bookends, at the ends of the range they stand for. */
const END_LABEL_MIN = 13;
const END_LABEL_MAX = 26;

/**
 * The reader's size, as a continuous slider rather than three preset cards.
 *
 * **The value moves under the finger; only the release is saved.** The preview above follows
 * live, which is the point of dragging it, but persisting every frame would be a request per
 * pixel. `onChange` fires once, on release.
 *
 * Rebuilt on each render rather than memoised — the same reasoning as the reader's rail. A
 * gesture object with identical handlers is something `GestureDetector` absorbs, and
 * memoising would mean naming the shared value as a dependency, which the compiler then
 * won't let a worklet write to.
 */
const DrawnTrack = ({ max, min, onChange, onDraft, value }: ReaderSizeSliderProps) => {
	const { theme } = useThemeContext();
	const [width, setWidth] = useState(0);

	const commit = (next: number) => onChange(next);
	const draft = (next: number) => onDraft(next);

	const sizeAt = (x: number) => {
		'worklet';

		if (width <= 0) {
			return value;
		}

		const ratio = Math.min(1, Math.max(0, x / width));

		return Math.round(min + ratio * (max - min));
	};

	const gesture = Gesture.Pan()
		// Fires on touch-down, so a tap anywhere on the track jumps there.
		.minDistance(0)
		// The track is 4pt tall; without this it is barely hittable.
		.hitSlop({ bottom: 18, top: 18 })
		.onBegin(event => runOnJS(draft)(sizeAt(event.x)))
		.onUpdate(event => runOnJS(draft)(sizeAt(event.x)))
		// `onFinalize`, not `onEnd`: a cancelled drag still has to save where it left the knob,
		// or the preview and the stored size disagree.
		.onFinalize(event => runOnJS(commit)(sizeAt(event.x)));

	const ratio = max === min ? 0 : (value - min) / (max - min);

	return (
		<GestureDetector gesture={gesture}>
			<View
				accessibilityRole='adjustable'
				accessibilityValue={{ max, min, now: value }}
				onLayout={event => setWidth(event.nativeEvent.layout.width)}
				style={styles.trackArea}
			>
				<View style={[styles.track, { backgroundColor: theme.colors.switchTrackOff }]}>
					<View style={[styles.fill, { backgroundColor: theme.colors.accent, width: `${ratio * 100}%` }]} />
				</View>
				{/*
				 * Positioned by percentage and pulled back half its width, so the knob's
				 * centre sits on the value rather than its left edge — at the maximum it
				 * would otherwise hang a full knob past the end of the track.
				 */}
				<View
					style={[
						styles.knob,
						{
							backgroundColor: theme.colors.surface,
							borderColor: theme.colors.accent,
							left: `${ratio * 100}%`
						}
					]}
				/>
			</View>
		</GestureDetector>
	);
};

/**
 * **The platform's slider where the platform has one worth having, ours everywhere else.**
 *
 * `isLiquidGlassSupported` is the gate, not `Platform.OS`: it is false on Android and on iOS
 * below 26, so it asks whether this device actually renders the material — the only reason to
 * hand a control over. The second half asks about the *build*, since `@expo/ui` is a native
 * module a client may predate.
 *
 * **The bookends stay ours either way.** Only the track between them swaps, so the two "Aa"s
 * keep their sizes, their colour and the gap that stops the knob touching them — the row is
 * the design's, and only the thing being dragged is the platform's.
 */
export const ReaderSizeSlider = (props: ReaderSizeSliderProps) => {
	const { theme } = useThemeContext();
	const isGlass = isLiquidGlassSupported && isGlassSizeSliderAvailable;

	return (
		<View style={styles.root}>
			<Typography color={theme.colors.subtext} style={styles.endLabel}>
				Aa
			</Typography>
			{/* The native slider fills the row itself; the drawn one is already `flex: 1`. */}
			<View style={styles.trackSlot}>{isGlass ? <GlassSizeSlider {...props} /> : <DrawnTrack {...props} />}</View>
			<Typography color={theme.colors.subtext} style={styles.endLabelLarge}>
				Aa
			</Typography>
		</View>
	);
};

const styles = StyleSheet.create({
	endLabel: {
		fontSize: END_LABEL_MIN,
		lineHeight: KNOB_SIZE
	},
	endLabelLarge: {
		fontSize: END_LABEL_MAX,
		lineHeight: KNOB_SIZE
	},
	fill: {
		borderRadius: TRACK_HEIGHT / 2,
		height: '100%'
	},
	knob: {
		borderRadius: KNOB_SIZE / 2,
		borderWidth: 2.5,
		height: KNOB_SIZE,
		marginLeft: -KNOB_SIZE / 2,
		position: 'absolute',
		top: 0,
		width: KNOB_SIZE
	},
	root: {
		alignItems: 'center',
		flexDirection: 'row',
		/*
		 * Half a knob wider than it looks. At either end of the range the knob's centre sits on
		 * the track's end, so half of it hangs past — a bare 12 here left the knob touching the
		 * "Aa" at 40px. This is that overhang plus the gap actually wanted.
		 */
		gap: KNOB_SIZE / 2 + 11
	},
	track: {
		borderRadius: TRACK_HEIGHT / 2,
		height: TRACK_HEIGHT,
		overflow: 'hidden',
		width: '100%'
	},
	// Tall enough to hold the knob; the track is centred inside it.
	trackArea: {
		flex: 1,
		height: KNOB_SIZE,
		justifyContent: 'center'
	},
	/* Holds whichever track renders, so the row's layout does not depend on which one it is. */
	trackSlot: {
		flex: 1,
		justifyContent: 'center',
		minHeight: KNOB_SIZE
	}
});
