import type { RefObject } from 'react';
import type { TextInput } from 'react-native';

export interface SearchFieldProps {
	query: string;
	onChange: (query: string) => void;
	/** The × inside the field: empties the query, keeps searching. */
	onClear: () => void;
	/** The round × beside it: leaves search mode altogether. */
	onClose: () => void;
	inputRef: RefObject<TextInput | null>;
}
