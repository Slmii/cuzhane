import { AppInput } from '@/components/ui/Input/Input.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Controller, useFormContext } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import type { FieldProps, StandaloneFieldProps } from './Field.types';

const normalizeFieldValue = (value: unknown) => {
	if (typeof value === 'string') {
		return value;
	}

	if (value === undefined || value === null) {
		return '';
	}

	return String(value);
};

/** The input plus its message, without form binding — for values held outside a `Form`. */
export const StandaloneField = ({
	containerStyle,
	error,
	helperText,
	messageStyle,
	...props
}: StandaloneFieldProps) => {
	const { theme } = useThemeContext();
	// One slot, not two: an error replaces the hint instead of appearing below it.
	const message = error || helperText;

	return (
		// `containerStyle` lands on this wrapper, not on the input's own container: the
		// message sits outside the input, so a `flex: 1` applied inside would leave the
		// field's outer box at its intrinsic width and collapse it in a row.
		<View style={containerStyle}>
			<AppInput {...props} hasError={!!error} />
			{message ? (
				<CaptionText
					color={error ? theme.colors.danger : theme.colors.subtext}
					style={[styles.message, messageStyle]}
				>
					{message}
				</CaptionText>
			) : null}
		</View>
	);
};

export const Field = (props: FieldProps) => {
	const { control } = useFormContext();

	return (
		<Controller
			control={control}
			name={props.name}
			rules={{ required: props.required }}
			render={({ field, fieldState }) => (
				<StandaloneField
					{...props}
					error={fieldState.error?.message || props.error}
					onBlur={event => {
						field.onBlur();
						props.onBlur?.(event);
					}}
					onChangeText={value => field.onChange(value)}
					value={normalizeFieldValue(field.value)}
				/>
			)}
		/>
	);
};

const styles = StyleSheet.create({
	message: {
		marginLeft: 14,
		marginTop: 4
	}
});
