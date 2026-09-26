import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { PortionBarProps } from './PortionBar.types';

/**
 * B8's progress under a share — **by portion, not by percent.** A Cevşen share is a segment a
 * bab ("61–65" is five, two of them filled), a hatim's cüz one bar filled by the pages read,
 * and the day's card a segment a task. Each segment is the thing that gets read, so the bar
 * counts what the reader counts.
 *
 * **Up to a point.** A five-seat group hands out twenty babs a share, and a pool claim adds
 * twenty more: past `MAX_SEGMENTS` the 3pt gaps take the whole width and the segments shrink to
 * nothing, so a share that long draws as one bar filled by the same proportion.
 */
const MAX_SEGMENTS = 24;

export const PortionBar = ({ fraction, segments }: PortionBarProps) => {
	const { theme } = useThemeContext();

	if (segments === undefined || segments.total > MAX_SEGMENTS) {
		const filled = segments ? (segments.total === 0 ? 0 : segments.filled / segments.total) : fraction ?? 0;

		return (
			<View style={[styles.bar, styles.track, { backgroundColor: theme.colors.track }]}>
				<View
					style={[
						styles.bar,
						{ backgroundColor: theme.colors.accent, width: `${Math.round(filled * 100)}%` }
					]}
				/>
			</View>
		);
	}

	return (
		<View style={styles.segments}>
			{Array.from({ length: segments.total }, (_, index) => (
				<View
					key={index}
					style={[
						styles.bar,
						styles.segment,
						{ backgroundColor: index < segments.filled ? theme.colors.accent : theme.colors.track }
					]}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	bar: {
		borderRadius: 3,
		height: 5
	},
	segment: {
		flex: 1
	},
	segments: {
		flexDirection: 'row',
		gap: 3
	},
	track: {
		overflow: 'hidden'
	}
});
