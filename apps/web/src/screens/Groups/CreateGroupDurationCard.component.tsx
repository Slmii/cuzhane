import { BodyStrongText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

interface CreateGroupDurationCardProps {
	/**
	 * Rendered inside the card, below its header — "Özel" holds the stepper it unlocks. The
	 * header stays the only pressable part, so tapping the number does not re-select the card
	 * underneath it.
	 */
	children?: ReactNode;
	/** The line under the title — "7 gün", or what the custom card says instead. */
	hint: string;
	isSelected: boolean;
	onPress: () => void;
	/**
	 * **`flex: 1` belongs to the row, not to the card.** The two presets share a row and have
	 * to divide its width; the "Özel" card stands alone in a column, where the same rule
	 * makes it stretch to fill whatever height is going — which drew it three times as tall
	 * as the cards above it.
	 */
	style?: StyleProp<ViewStyle>;
	title: string;
}

/**
 * One of QC3's round-length presets.
 *
 * **A shortcut to a number, not a mode.** The stepper below these cards is the real control
 * and is always live; a card sets it to 7 or 30 and lights up while it is still there. That
 * is why the card carries no bound field of its own and reads its selected state from the
 * value rather than from a mode flag — walking the stepper off a preset simply unlights it,
 * with nothing to keep in step.
 *
 * **"Özel" is the same card with the rule inverted**: it lights up when the value is *not*
 * a preset, which is the honest reading of "a number you chose". It has to exist even though
 * the stepper was already reachable — without it the two presets looked like the only
 * answers, and nothing said the number underneath could simply be walked somewhere else.
 *
 * It is not `FormOptionGroup`: that binds a *field* to an option's value, and all three of
 * these and the stepper are the same field.
 */
export const CreateGroupDurationCard = ({
	children,
	hint,
	isSelected,
	onPress,
	style,
	title
}: CreateGroupDurationCardProps) => {
	const { theme } = useThemeContext();

	return (
		<View
			style={[
				styles.card,
				style,
				{
					backgroundColor: isSelected ? theme.colors.accentSoft : theme.colors.surface,
					borderColor: isSelected ? theme.colors.accent : theme.colors.border
				}
			]}
		>
			<Pressable
				accessibilityRole='radio'
				accessibilityState={{ selected: isSelected }}
				onPress={onPress}
				style={({ pressed }) => [styles.header, { opacity: pressed ? 0.85 : 1 }]}
			>
				<BodyStrongText style={styles.title}>{title}</BodyStrongText>
				<CaptionText color={theme.colors.subtext}>{hint}</CaptionText>
			</Pressable>
			{children}
		</View>
	);
};

const styles = StyleSheet.create({
	card: {
		borderRadius: 15,
		borderWidth: 1.5,
		// The body is clipped to the card's corners as it opens, so the stepper's own card
		// cannot square them off on the way past.
		overflow: 'hidden'
	},
	/** The padding used to sit on the card; it belongs to the header now the card has a body. */
	header: {
		padding: 14
	},
	title: {
		marginBottom: 4
	}
});
