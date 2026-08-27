import { ToggleRow as BaseToggleRow } from '@/components/ui/ToggleRow/ToggleRow.component';
import { Controller, useFormContext } from 'react-hook-form';
import type { FormToggleRowProps } from './ToggleRow.types';

/** `ToggleRow` bound to a form field — the labelled-row equivalent of `Form/Switch`. */
export const FormToggleRow = ({ disabled, hint, name, title }: FormToggleRowProps) => {
	const { control } = useFormContext();

	return (
		<Controller
			control={control}
			name={name}
			render={({ field }) => (
				<BaseToggleRow
					disabled={disabled}
					hint={hint}
					onBlur={field.onBlur}
					onValueChange={field.onChange}
					title={title}
					value={Boolean(field.value)}
				/>
			)}
		/>
	);
};
