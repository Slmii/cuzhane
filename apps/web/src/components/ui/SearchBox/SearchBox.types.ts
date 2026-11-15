import type { SearchInputHandle } from '@/components/ui/SearchInput/SearchInput.types';
import type { Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface SearchBoxProps {
	ref?: Ref<SearchInputHandle>;
	value: string;
	onChangeText: (text: string) => void;
	placeholder: string;
	/** The return key's label. */
	submitLabel?: 'search' | 'go';
	maxLength?: number;
	/** The × inside the box, shown once there is text. Omitted, the box has none. */
	onClear?: () => void;
	style?: StyleProp<ViewStyle>;
}
