import { Stepper } from '@/components/ui/Stepper/Stepper.component';
import { Controller, useFormContext } from 'react-hook-form';
import type { FormStepperProps } from './Stepper.types';

/** `Stepper` bound to a numeric form field — the group spots picker. */
export const FormStepper = ({ caption, max, min, name, step, style, values }: FormStepperProps) => {
	const { control } = useFormContext();

	return (
		<Controller
			control={control}
			name={name}
			render={({ field }) => (
				<Stepper
					caption={caption}
					max={max}
					min={min}
					onChange={field.onChange}
					step={step}
					style={style}
					value={Number(field.value)}
					values={values}
				/>
			)}
		/>
	);
};
