import type { JSX, ReactNode } from 'react';
import type { DefaultValues, FieldValues, Mode, SubmitHandler, UseFormReturn } from 'react-hook-form';
import type { ZodType } from 'zod';
import type { $ZodTypeInternals } from 'zod/v4/core';

export interface FormProps<T extends FieldValues> {
	/**
	 * Function to execute on form submit
	 */
	action?: SubmitHandler<T>;
	/**
	 * Zod validator schema for the form's values
	 */
	schema?: ZodType<T, unknown, $ZodTypeInternals<T, unknown>>;
	/**
	 * Default values in a form
	 */
	defaultValues: DefaultValues<T> | (() => DefaultValues<T>);
	/**
	 * Option to configure the validation before onSubmit event
	 */
	mode?: Mode;
	/**
	 * Render all JSX elements with this prop. Using this prop will make react hook form props
	 * available as parameters to use, example `getValues, formState`.
	 *
	 * Using this prop will also ignore direct children.
	 */
	render?: (props: UseFormReturn<T, unknown, T>) => JSX.Element;
	children?: ReactNode;
	noValidate?: boolean;
	isDisabled?: boolean;
	/**
	 * Whether the form fills its parent's height. Correct when `Form` is the outermost
	 * element (it wraps a `ScreenContainer`), but **must be `false` when the form sits
	 * inside a scroll view** — a forced `height: '100%'` pins it to the viewport, so
	 * taller content overflows invisibly and the top becomes unreachable.
	 */
	isFullHeight?: boolean;
}
