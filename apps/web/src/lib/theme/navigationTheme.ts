import { type AppTheme } from '@/lib/theme/tokens';
import { type Theme } from '@react-navigation/native';

/**
 * Maps our AppTheme to a React Navigation Theme so native navigator
 * views use the correct background color instead of defaulting to white.
 * This prevents white-flash when the app returns from the background.
 */
export const buildNavigationTheme = (appTheme: AppTheme): Theme => ({
	dark: appTheme.mode === 'dark',
	colors: {
		primary: appTheme.colors.primary,
		background: appTheme.colors.background,
		card: appTheme.colors.surface,
		text: appTheme.colors.text,
		border: appTheme.colors.border,
		notification: appTheme.colors.primary
	},
	fonts: {
		regular: { fontFamily: 'System', fontWeight: '400' },
		medium: { fontFamily: 'System', fontWeight: '500' },
		bold: { fontFamily: 'System', fontWeight: '700' },
		heavy: { fontFamily: 'System', fontWeight: '900' }
	}
});
