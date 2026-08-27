import { CaptionText, TitleText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { SectionHeaderProps } from './SectionHeader.types';

export const SectionHeader = ({ meta, style, title }: SectionHeaderProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={[styles.row, style]}>
			<TitleText>{title}</TitleText>
			{meta ? <CaptionText color={theme.colors.faintText}>{meta}</CaptionText> : null}
		</View>
	);
};

const styles = StyleSheet.create({
	row: {
		alignItems: 'baseline',
		flexDirection: 'row',
		justifyContent: 'space-between'
	}
});
