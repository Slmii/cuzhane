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
	/**
	 * For text that has to be pressable *inside* other text — the reader's invocations, which
	 * open their meal on a long press. A `Pressable` can't do this: a view nested in
	 * right-to-left text is laid out somewhere other than where the line reserved for it,
	 * which is the same constraint that turned the verse ornaments into characters. `Text`
	 * nests in `Text` and carries its own handlers, so the press lives on the type itself.
	 */
	onLongPress?: () => void;
	/** Suppresses the press highlight, which otherwise flashes a box through a paragraph. */
	suppressHighlighting?: boolean;
	style?: StyleProp<TextStyle>;
	textAlign?: TextStyle['textAlign'];
	variant?: TypographyVariant;
	weight?: TypographyWeight;
}

export type ShortcutTextProps = Omit<TypographyProps, 'variant'>;
