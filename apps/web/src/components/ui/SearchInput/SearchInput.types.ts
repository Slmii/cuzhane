import type { Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** What a screen does with the field: bring the keyboard up, put it away, ask whether it is up. */
export type SearchInputHandle = {
	focus: () => void;
	blur: () => void;
	isFocused: () => boolean;
};

export interface SearchInputProps {
	ref?: Ref<SearchInputHandle>;
	/** Controlled: what the screen holds. Setting it from the screen (a clear, a recent search) shows it. */
	value: string;
	onChangeText: (text: string) => void;
	placeholder: string;
	/** The text's size; the field is one line of it. */
	fontSize: number;
	/** The return key's label. */
	submitLabel?: 'search' | 'go';
	/** Keep it stable (`useCallback`): a new one re-applies the native field's modifiers, which drops its focus. */
	onSubmit?: () => void;
	maxLength?: number;
	autoFocus?: boolean;
	/** The field's slot in its row — it takes the width it is given. */
	style?: StyleProp<ViewStyle>;
}
