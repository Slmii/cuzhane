import { SliceChip } from '@/components/SliceChip/SliceChip.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import type { HomeReadRowProps } from './HomeReadRow.types';

/**
 * A share finished today, under "Bugün okunanlar" (B8c) — a tick, what it was, and when. Not a
 * way into anything: it is a record of the day, not a task.
 *
 * **A list row, not a section — so not a `CardSurface`.** The frame draws it flat at a 14pt
 * corner, lighter than the cards around it; `CardSurface` would give it glass and fix the radius
 * at 18, and the finished shares would read as more tasks.
 */
export const HomeReadRow = ({ moreCount, time, title }: HomeReadRowProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={[styles.row, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
			<View style={[styles.tick, { backgroundColor: theme.colors.accent }]}>
				<Icon color={theme.colors.onAccent} name='check' size={14} strokeWidth={2.2} />
			</View>
			<Typography
				color={toAlphaColor(theme.colors.text, 0.7)}
				numberOfLines={1}
				style={styles.title}
				weight='medium'
			>
				{title}
			</Typography>
			<SliceChip count={moreCount} isCompact tone='wash' />
			<Typography color={theme.colors.faintText} style={styles.time}>
				{time}
			</Typography>
		</View>
	);
};

const styles = StyleSheet.create({
	row: {
		alignItems: 'center',
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 14,
		paddingVertical: 10
	},
	tick: {
		alignItems: 'center',
		borderRadius: 10,
		height: 20,
		justifyContent: 'center',
		width: 20
	},
	// The time keeps the right edge, so the chip sits just after the title rather than beside it.
	time: {
		fontSize: 10.5,
		lineHeight: 14,
		marginLeft: 'auto'
	},
	title: {
		flexShrink: 1,
		fontSize: 11.5,
		lineHeight: 15
	}
});
