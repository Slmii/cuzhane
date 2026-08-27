import type { AppSwitchProps } from '@/components/ui/Switch/Switch.types';

export interface SwitchProps extends Omit<AppSwitchProps, 'value' | 'onValueChange'> {
	name: string;
	required?: boolean;
	error?: string;
	helperText?: string;
}

export interface StandaloneSwitchProps extends Omit<SwitchProps, 'name' | 'required'> {
	value?: boolean;
	onValueChange?: (value: boolean) => void;
}
