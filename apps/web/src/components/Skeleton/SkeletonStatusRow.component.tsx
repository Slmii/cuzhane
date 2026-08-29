import { SkeletonSpinner } from '@/components/Skeleton/SkeletonSpinner.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/**
 * The line every loading frame ends on: a small turning ring and a word for what is being
 * waited on.
 *
 * It is the only text on a skeleton, and it earns its place — bones alone say "something is
 * coming" but not what, which on a slow connection is the difference between waiting and
 * wondering whether the screen is broken.
 */
export const SkeletonStatusRow = ({ label }: { label: string }) => {
	const { theme } = useThemeContext();

	return (
		<View style={styles.row}>
			<SkeletonSpinner size={13} thickness={1.8} />
			<CaptionText color={theme.colors.faintText}>{label}</CaptionText>
		</View>
	);
};

const styles = StyleSheet.create({
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		justifyContent: 'center',
		marginBottom: 4,
		marginTop: 16
	}
});
