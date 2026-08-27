import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

export type TypographyVariant =
	| 'display'
	| 'header1'
	| 'header2'
	| 'header3'
	| 'title'
	| 'numeric'
	| 'eyebrow'
	| 'fieldLabel'
	| 'body'
	| 'bodyStrong'
	| 'caption'
	| 'stat'
	| 'mono';

export type TypographyWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export interface TypographyProps {
	children: ReactNode;
	color?: string;
	numberOfLines?: number;
	style?: StyleProp<TextStyle>;
	textAlign?: TextStyle['textAlign'];
	variant?: TypographyVariant;
	weight?: TypographyWeight;
}

export type ShortcutTextProps = Omit<TypographyProps, 'variant'>;
