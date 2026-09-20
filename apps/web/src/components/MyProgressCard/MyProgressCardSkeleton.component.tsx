import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';

/**
 * "Senin ilerlemen" before its counts arrive, at the real banner's metrics.
 *
 * **It stands in two places, which is why it is its own component.** The group screen gates
 * only on the group query — the board and the pool card each hold their own space while
 * theirs lands — and my-progress is a separate request that does strictly more work
 * (membership, rollover, then a scan of the window's reads), so it almost always resolves
 * second. Rendered as `{progress ? <Banner/> : null}` everything beneath it jumped on every
 * first visit, which is the shift `GroupDetailSkeleton` exists to prevent.
 *
 * **It keeps the green.** A grey stand-in for the one coloured strip on the page would have
 * the screen appear to change colour when the data lands rather than simply fill in — the
 * same reason the assigned panel's skeleton keeps its sage. So the bones are drawn in the
 * header's own ink at low alpha instead of the usual `Bone` tone.
 */
export const MyProgressCardSkeleton = () => {
	const { theme } = useThemeContext();
	const ink = toAlphaColor(theme.colors.onHeaderSurface, 0.22);

	return (
		<CardSurface hasGlassSurface={false} style={[styles.banner, { backgroundColor: theme.colors.headerSurface }]}>
			{/* The title, then the run of numbers, then the chevron's slot. */}
			<View style={[styles.title, { backgroundColor: ink }]} />
			<View style={[styles.stats, { backgroundColor: ink }]} />
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	banner: {
		alignItems: 'center',
		flexDirection: 'row',
		// The real banner's own numbers.
		gap: 10,
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	stats: {
		borderRadius: 5,
		flex: 1,
		height: 10,
		minWidth: 0
	},
	title: {
		borderRadius: 5,
		height: 11,
		width: 104
	}
});
