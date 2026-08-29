import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { RoundResetRowProps } from './RoundResetRow.types';

/**
 * "When does this reset?" answered in both clocks at once.
 *
 * The design repeats this on the group card and again on the group screen, and it earns the
 * repetition: the reset is a group-wide fact on the creator's clock, so for anyone in
 * another zone the bare countdown is off by hours with nothing on screen explaining why.
 */
export const RoundResetRow = ({ groupLabel, localLabel, style, variant = 'card' }: RoundResetRowProps) => {
	const { theme } = useThemeContext();
	const isPanel = variant === 'panel';

	return (
		<View style={[styles.row, isPanel ? styles.panel : styles.card, style]}>
			<Icon color={theme.colors.faintText} name='clock' size={isPanel ? 15 : 13} strokeWidth={1.7} />
			<CaptionText
				color={isPanel ? theme.colors.text : theme.colors.subtext}
				weight={isPanel ? 'semibold' : 'regular'}
			>
				{groupLabel}
			</CaptionText>
			{isPanel ? null : <CaptionText color={theme.colors.faintText}>·</CaptionText>}
			<CaptionText
				// The local time is the one the reader acts on, so it carries the accent in both
				// variants — greyed on the panel it read as a footnote to the group's own clock.
				color={theme.colors.accent}
				style={isPanel ? styles.panelLocal : undefined}
				weight={isPanel ? 'regular' : 'semibold'}
			>
				{localLabel}
			</CaptionText>
		</View>
	);
};

const styles = StyleSheet.create({
	card: {
		flexWrap: 'wrap',
		gap: 7
	},
	panel: {
		gap: 10,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	panelLocal: {
		marginLeft: 'auto',
		textAlign: 'right'
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row'
	}
});
