import { AppButton } from '@/components/ui/Button/Button.component';
import { BodyText, Header3 } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { EmptyStateProps } from './EmptyState.types';

export const EmptyState = ({ actionLabel, description, onAction, style, title }: EmptyStateProps) => {
	const { theme } = useThemeContext();

	return (
		<View style={[styles.container, style]}>
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
	}
});
