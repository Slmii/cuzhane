import type { SearchInputHandle } from '@/components/ui/SearchInput/SearchInput.types';
import type { RefObject } from 'react';

export interface SearchFieldProps {
	query: string;
	onChange: (query: string) => void;
	/** The × inside the field: empties the query, keeps searching. */
	onClear: () => void;
	/** The round × beside it: leaves search mode altogether. */
	onClose: () => void;
	inputRef: RefObject<SearchInputHandle | null>;
}
