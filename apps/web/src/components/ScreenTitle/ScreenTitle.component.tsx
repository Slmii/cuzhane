import {
	CaptionText,
	EYEBROW_LINE_HEIGHT,
	EyebrowText,
	Header1,
	Header2,
	TitleText
} from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { ScreenTitleProps } from './ScreenTitle.types';

/**
 * The heading block at the top of every screen. It exists so the title lands on the
 * same baseline everywhere — screens used to space their own headings and drifted
 * apart by a few points, which is visible as a jump when switching tabs.
 *
 * Matches the design's `padding: 8px 0 18px` header block.
 */
export const SCREEN_TITLE_PADDING_TOP = 8;
const SCREEN_TITLE_PADDING_BOTTOM = 18;

export const ScreenTitle = ({
	action,
	description,
	hasReservedSecondaryLabel = true,
	label,
	leading,
	secondaryLabel,
	size = 'page',
	style,
	trailing
}: ScreenTitleProps) => {
	const { theme } = useThemeContext();
	// A label the user hasn't filled in yet (Profile before a name is set) would otherwise
	// reserve a heading's worth of empty height, leaving the description sitting below the
	// centre of whatever `leading` holds. With no label there is no baseline to protect,
	// so the block collapses to the description and the row centres it against the avatar.
	const hasLabel = label.trim().length > 0;
	// The empty eyebrow row exists to hold every screen's title on one baseline. A heading
	// with something beside it isn't on that baseline — it is centred against the avatar —
	// so reserving the row there only pushes the name and its caption below the middle.
	const shouldReserveSecondaryLabel = hasReservedSecondaryLabel && !leading;

	return (
		<View style={[styles.container, style]}>
			{leading}
			<View style={styles.copy}>
				{/* One fixed-height row whether or not there's an eyebrow, so the label always
				    starts at the same offset. The height is pinned rather than left to the
				    text: a diacritic like the "Â" in "Selâm" grows the line box and would
				    otherwise push that screen's title a few points lower than the rest. */}
				{secondaryLabel || (shouldReserveSecondaryLabel && hasLabel) ? (
					<View style={styles.secondaryLabelRow}>
						{secondaryLabel ? (
							<EyebrowText color={theme.colors.faintText}>{secondaryLabel}</EyebrowText>
						) : null}
					</View>
				) : null}
				{!hasLabel ? null : (
					// Wrapped only when there's something to sit beside it, so every screen
					// without a trailing slot keeps exactly the layout it had.
					<View style={trailing ? styles.labelRow : null}>
						{size === 'compact' ? (
							<TitleText numberOfLines={1}>{label}</TitleText>
						) : size === 'name' ? (
							<Header2 numberOfLines={1}>{label}</Header2>
						) : (
							<Header1 numberOfLines={2}>{label}</Header1>
						)}
						{trailing}
					</View>
				)}
				{description ? (
					<CaptionText color={theme.colors.subtext} style={hasLabel ? styles.description : null}>
						{description}
					</CaptionText>
				) : null}
			</View>
			{action}
		</View>
	);
};

const styles = StyleSheet.create({
	// Wraps rather than squeezing the title: a long group name plus a chip has to break
	// onto two lines, not shrink the heading.
	labelRow: {
		alignItems: 'center',
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 9
	},
	container: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 14,
		paddingBottom: SCREEN_TITLE_PADDING_BOTTOM,
		paddingTop: SCREEN_TITLE_PADDING_TOP
	},
	copy: {
		flex: 1,
		minWidth: 0
	},
	description: {
		marginTop: 3
	},
	secondaryLabelRow: {
		height: EYEBROW_LINE_HEIGHT,
		justifyContent: 'center',
		marginBottom: 5
	}
});
