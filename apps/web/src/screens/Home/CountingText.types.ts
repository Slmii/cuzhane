import type { StyleProp, TextStyle } from 'react-native';
import type { TypographyVariant } from '@/components/ui/Typography/Typography.types';

export interface CountingTextProps {
	/** The string to show. Digit runs inside it count from their previous values. */
	value: string;
	color?: string;
	style?: StyleProp<TextStyle>;
	variant?: TypographyVariant;
}
