import { SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { MUSHAF_PAGE_ASPECT } from '@/lib/content/mushaf';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** A Hüsrev page is fifteen lines, each spread to the full measure. */
const LINE_COUNT = 15;

type MushafPageSkeletonProps = {
	/** What the page will be announced as — the bones stand in for it, busy until it draws. */
	accessibilityLabel: string;
	style?: StyleProp<ViewStyle>;
};

/**
 * Q5l · Cüz okuyucu yükleniyor — the one wait the Kuran reader has: a Hüsrev page downloading.
 *
 * **Not the frame's reader skeleton.** Q5l stubs the whole reader, header and all, over a
 * block of ragged lines. Here the header is drawn at once — the page count and the sura are
 * bundled — and the typeset text never waits, so only the printed page can. It is stubbed as
 * what it will be: fifteen full lines on the paper, at the page's own shape, where a spinner
 * sat in the middle of a blank sheet.
 *
 * **Tinted from the ink, not `Bone`'s neutrals.** The paper is light in both themes; the
 * theme's bone tones are dark in dark mode and would draw charcoal bars on cream.
 */
export const MushafPageSkeleton = ({ accessibilityLabel, style }: MushafPageSkeletonProps) => {
	const { theme } = useThemeContext();
	const strong = toAlphaColor(theme.colors.codeInk, 0.08);
	const soft = toAlphaColor(theme.colors.codeInk, 0.05);

	return (
		<SkeletonPulse style={[styles.page, style]}>
			<View
				accessibilityLabel={accessibilityLabel}
				accessibilityRole='image'
				accessibilityState={{ busy: true }}
				accessible
				style={styles.lines}
			>
				{Array.from({ length: LINE_COUNT }, (_, index) => (
					<View key={index} style={[styles.line, { backgroundColor: index % 2 === 0 ? strong : soft }]} />
				))}
			</View>
		</SkeletonPulse>
	);
};

const styles = StyleSheet.create({
	line: {
		borderRadius: 4,
		height: 9,
		width: '100%'
	},
	// Evenly down the page, inset the way the print sits inside its frame.
	lines: {
		flex: 1,
		justifyContent: 'space-evenly',
		paddingHorizontal: 10,
		paddingVertical: 14
	},
	// The page's exact shape, the same box the image draws into — nothing moves when it lands.
	page: {
		aspectRatio: MUSHAF_PAGE_ASPECT,
		width: '100%'
	}
});
