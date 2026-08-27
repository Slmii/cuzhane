import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { AssignmentBannerProps } from './AssignmentBanner.types';

/** Sage panel with the range badge — "Sana atanan · 1–5". */
export const AssignmentBanner = ({ description, label, range, style }: AssignmentBannerProps) => {
	const { theme } = useThemeContext();

	return (
		<View
			style={[styles.banner, { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.lg }, style]}
		>
			<View style={[styles.badge, { backgroundColor: theme.colors.accent, borderRadius: theme.radius.sm + 4 }]}>
				<Typography color={theme.colors.onAccent} style={styles.badgeLabel} variant='title'>
					{range}
				</Typography>
			</View>
			<View style={styles.copy}>
				<Typography color={theme.colors.accent} style={styles.label} variant='stat' weight='medium'>
					{label}
				</Typography>
				<Typography color={theme.colors.text} variant='caption'>
					{description}
				</Typography>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	badge: {
		alignItems: 'center',
		height: 38,
		justifyContent: 'center',
		minWidth: 38,
		paddingHorizontal: 6
	},
	badgeLabel: {
		fontSize: 14,
		lineHeight: 18
	},
	banner: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	copy: {
		flex: 1,
		gap: 3
	},
	label: {
		letterSpacing: 0.8
	}
});
