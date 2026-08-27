import { Icon } from '@/components/ui/Icon/Icon.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet } from 'react-native';
import type { CornerActionProps } from './CornerAction.types';

const SIZE = 44;
const GLYPH = 19;
/**
 * The design writes a stroke weight per glyph rather than one for the control, and the
 * differences are load-bearing at 19pt: the **+** is two bare rules and needs the extra
 * weight to hold, while settings and the key already carry small circles that thicken into
 * blobs if the stroke grows.
 */
const DEFAULT_STROKE_WIDTH = 1.9;
const strokeWidthByIcon: Partial<Record<IconName, number>> = {
	key: 1.8,
	members: 1.8,
	plus: 2,
	settings: 1.8
};

/**
 * The design's corner action: a 44pt square at the top-right of a screen heading, sharing
 * the title's baseline. The **+** on Gruplarım and Paylaş on the group screen are the same
 * control — one shape for "the thing you can do to this whole screen", which is what makes
 * it recognisable rather than decorative.
 *
 * Where two sit side by side — Gruplarım's key and +, the group screen's settings and
 * Paylaş — the accent fill marks the primary of the pair and `surface` the other, so the
 * two never compete for the same emphasis.
 *
 * Handed to `ScreenTitle`/`ScreenHeader` as their `action`, so it lands in the heading row
 * rather than floating over the content.
 */
export const CornerAction = ({ accessibilityLabel, icon, onPress, style, tone = 'accent' }: CornerActionProps) => {
	const { theme } = useThemeContext();

	const isSurface = tone === 'surface';

	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole='button'
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				isSurface ? styles.outlined : null,
				{
					backgroundColor: isSurface ? theme.colors.surface : theme.colors.accent,
					borderColor: isSurface ? theme.colors.borderStrong : theme.colors.transparent,
					borderRadius: theme.radius.lg,
					// `:hover` lifts it in the design; on touch that reads as press.
					transform: [{ translateY: pressed ? -2 : 0 }]
				},
				style
			]}
		>
			<Icon
				color={isSurface ? theme.colors.text : theme.colors.onAccent}
				name={icon}
				size={GLYPH}
				strokeWidth={strokeWidthByIcon[icon] ?? DEFAULT_STROKE_WIDTH}
			/>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	button: {
		alignItems: 'center',
		height: SIZE,
		justifyContent: 'center',
		width: SIZE
	},
	outlined: {
		borderWidth: 1
	}
});
