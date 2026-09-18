import { AppButton } from '@/components/ui/Button/Button.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyText, Header3 } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { EmptyStateProps } from './EmptyState.types';

export const EmptyState = ({ actionLabel, description, icon, onAction, style, title }: EmptyStateProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={[styles.container, style]}>
			{icon === undefined ? null : (
				<View style={[styles.disc, { backgroundColor: theme.colors.accentSoft }]}>
					<Icon color={theme.colors.accent} name={icon} size={30} strokeWidth={1.8} />
				</View>
			)}
			<Header3 textAlign='center'>{title}</Header3>
			{description ? (
				<BodyText color={theme.colors.subtext} style={styles.description} textAlign='center'>
					{description}
				</BodyText>
			) : null}
			{actionLabel && onAction ? (
				<AppButton
					fullWidth={false}
					onPress={onAction}
					style={styles.action}
					title={actionLabel}
					variant='surface'
				/>
			) : null}
		</View>
	);
};

const styles = StyleSheet.create({
	action: {
		marginTop: 8
	},
	container: {
		alignItems: 'center',
		gap: 8,
		paddingVertical: 40
	},
	description: {
		maxWidth: 280
	},
	// The design's own proportions: a wide disc with a small glyph adrift in it, which is what
	// keeps it reading as a quiet state rather than as a button nobody can press.
	disc: {
		alignItems: 'center',
		borderRadius: 56,
		height: 112,
		justifyContent: 'center',
		marginBottom: 8,
		width: 112
	}
});
