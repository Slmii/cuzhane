import { ShelfIllustration } from '@/components/ui/ShelfIllustration/ShelfIllustration.component';
import { Header2, Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { ShelfEmptyStateProps } from './ShelfEmptyState.types';

/**
 * The full-height empty state shared by Groups and Discover: shelf drawing, a serif
 * line, a short explanation and the ways out. It fills the space left under whatever
 * chrome the screen keeps — Discover deliberately keeps its search field above this.
 */
export const ShelfEmptyState = ({ actions, description, hasMagnifier = false, style, title }: ShelfEmptyStateProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={[styles.container, style]}>
			<ShelfIllustration hasMagnifier={hasMagnifier} style={styles.illustration} />
			<Header2 style={styles.title} textAlign='center'>
				{title}
			</Header2>
			<Typography color={theme.colors.subtext} style={styles.description} textAlign='center' variant='caption'>
				{description}
			</Typography>
			<View style={styles.actions}>{actions}</View>
		</View>
	);
};

const styles = StyleSheet.create({
	actions: {
		alignSelf: 'stretch',
		gap: 9,
		marginTop: 26
	},
	container: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	},
	description: {
		lineHeight: 20,
		marginTop: 10,
		maxWidth: 252
	},
	illustration: {
		marginBottom: 22
	},
	title: {
		fontSize: 22
	}
});
