import { useLiveVoiceLevel } from '@/lib/hooks/useLiveVoice';
import { LEVEL_INTERVAL_MS } from '@/lib/live/liveVoice';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import type { LiveVoiceMeterProps } from './LiveVoice.types';
import { METER_REST, METER_STILL, meterScales } from './meterScales';

/**
 * **The live voice's level meter** (Birlikte Oku Ses, lanes I and J) — four rounded bars that
 * follow the real sound: the reader's own microphone, or what a listener receives. Read every
 * `LEVEL_INTERVAL_MS` while it is on screen and eased over the same time ("120 ms yumuşatarak").
 * Silence rests the bars low ("ses yoksa alçalır"); a voice lifts them, each bar its own way
 * (`meterScales`). A pause is never drawn as moving bars: the caller shows the pause glyph.
 *
 * Reduce Motion holds the design's still shape and reads nothing. Hidden from the screen
 * reader — the words beside it say the state.
 */
export const LiveVoiceMeter = ({ color, size }: LiveVoiceMeterProps) => {
	const isReducedMotion = useReducedMotion();
	const { loudness, sampledAt } = useLiveVoiceLevel(!isReducedMotion);
	const barWidth = Math.max(2, Math.round(size / 5.5));
	const scales = isReducedMotion ? METER_STILL : meterScales(loudness, sampledAt);

	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility='no-hide-descendants'
			style={[styles.row, { gap: Math.max(1.5, size / 7), height: size }]}
		>
			{scales.map((scale, index) => (
				<Animated.View
					key={index}
					style={{
						backgroundColor: color,
						borderRadius: barWidth,
						height: size,
						transform: [{ scaleY: scale ?? METER_REST }],
						transitionDuration: LEVEL_INTERVAL_MS,
						transitionProperty: 'transform',
						transitionTimingFunction: 'ease-out',
						width: barWidth
					}}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	row: {
		alignItems: 'center',
		flexDirection: 'row'
	}
});
