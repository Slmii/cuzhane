import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { zodResolver } from '@hookform/resolvers/zod';
import { type FieldValues, FormProvider, type SubmitHandler, useForm } from 'react-hook-form';
import { Platform, View } from 'react-native';
import type { FormProps } from './Form.types';

/**
 * Wraps `react-hook-form` with the zod resolver and puts the methods on context so
 * `Field`, `Switch`, `OptionGroup` and friends can bind themselves by `name`.
 * Every screen that submits values should go through this rather than hand-rolling
 * `useState` per input.
 */
export function Form<T extends FieldValues>({
	children,
	action,
	schema,
	defaultValues,
	mode = 'onSubmit',
	render,
	noValidate = true,
	isDisabled = false,
	isFullHeight = true
}: FormProps<T>) {
	const { theme } = useThemeContext();
	const methods = useForm({
		// @ts-expect-error Type issue with zod resolver
		resolver: schema ? zodResolver(schema) : undefined,
		defaultValues: typeof defaultValues === 'function' ? defaultValues() : defaultValues,
		mode
	});

	const content = (
		<View
			style={{
				// Only stretch when this is the outermost element. Inside a scroll view a
				// forced height pins the form to the viewport and hides its overflow.
				height: isFullHeight ? '100%' : undefined,
				width: '100%',
				display: 'flex',
				flexDirection: 'column',
				gap: theme.spacing.md,
				opacity: isDisabled ? 0.5 : 1,
				pointerEvents: isDisabled ? 'none' : 'auto'
			}}
		>
			{render ? render(methods) : children}
		</View>
	);

	const handleSubmit = methods.handleSubmit(action as SubmitHandler<Record<string, unknown>>);

	if (Platform.OS === 'web') {
		if (action) {
			return (
				<FormProvider {...methods}>
					<form noValidate={noValidate} onSubmit={handleSubmit}>
						{content}
					</form>
				</FormProvider>
			);
		}

		return <FormProvider {...methods}>{content}</FormProvider>;
	}

	return <FormProvider {...methods}>{content}</FormProvider>;
}
