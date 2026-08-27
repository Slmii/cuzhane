import type { AppTheme } from '@/lib/theme/tokens';
import { Platform, ViewStyle } from 'react-native';

export const getCardShadowStyle = (theme: AppTheme): ViewStyle => {
	const shadowColor = theme.mode === 'dark' ? '#000000' : '#12343B';
	const shadowOpacity = theme.mode === 'dark' ? 0.24 : 0.1;
	const shadowRadius = theme.mode === 'dark' ? 12 : 8;
	const elevation = theme.mode === 'dark' ? 6 : 3;

	return {
		elevation,
		shadowColor,
		shadowOffset: {
			width: 0,
			height: Platform.OS === 'ios' ? 4 : 3
		},
		shadowOpacity,
		shadowRadius
	};
};
