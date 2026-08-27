import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';

export type InputVariant = 'surface' | 'ghost' | 'muted';
export type InputSize = 'sm' | 'md' | 'lg';

export type AppInputProps = Omit<TextInputProps, 'style'> & {
	label?: string;
	/** Renders the value in the serif face — the design sets group names that way. */
	useHeadingFont?: boolean;
	multilineMinHeight?: number;
	size?: InputSize;
	variant?: InputVariant;
	/** Marks the field as invalid; the surrounding `Field` supplies the message. */
	hasError?: boolean;
	/**
	 * A remaining-length readout — the feedback form's `120/600` — drawn inside the box's
	 * bottom-right corner, where the design puts it. Not a message: it says nothing about
	 * validity, so it sits inside the field rather than in the slot below it.
	 */
	counter?: string;
	style?: StyleProp<TextStyle>;
	containerStyle?: StyleProp<ViewStyle>;
};
