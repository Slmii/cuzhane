import type { AppInputProps } from '@/components/ui/Input/Input.types';
import type { StyleProp, TextStyle } from 'react-native';

export interface FieldProps extends Omit<AppInputProps, 'value' | 'onChange' | 'onChangeText' | 'hasError'> {
	name: string;
	required?: boolean;
	error?: string;
	/**
	 * Shown under the field until validation has something to say — the message slot holds
	 * one line, and the error takes it over rather than stacking beneath.
	 */
	helperText?: string;
	messageStyle?: StyleProp<TextStyle>;
}

export interface StandaloneFieldProps extends Omit<FieldProps, 'name' | 'required'> {
	value?: string;
	onChangeText?: (text: string) => void;
}
