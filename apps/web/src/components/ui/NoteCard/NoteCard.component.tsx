import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { NoteCardProps } from './NoteCard.types';

/**
 * A card that explains rather than asks: the accent glyph, then a line of prose.
 *
 * Used where a choice has a consequence the controls themselves cannot state — Q1's note
 * that a hatim hands out cüz instead of shares, which is the whole difference between the
 * two cards above it and is not visible in either.
 *
 * `hasGlassSurface` is not offered and the fill is flat `surface`: this is a **control's**
 * neighbour, not a section of the screen, and the create-group sheet is one of the places
 * the glass is deliberately not swept across.
 */
export const NoteCard = ({ style, text }: NoteCardProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={[styles.card, { backgroundColor: theme.colors.surface }, style]}>
			<Icon color={theme.colors.accent} name='info' size={16} strokeWidth={1.8} />
			<CaptionText color={theme.colors.subtext} style={styles.text}>
				{text}
			</CaptionText>
		</View>
	);
};

const styles = StyleSheet.create({
	card: {
		alignItems: 'flex-start',
		borderRadius: 16,
		flexDirection: 'row',
		gap: 11,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	text: {
		flex: 1
	}
});
