import { AppSwitch } from '@/components/ui/Switch/Switch.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Controller, useFormContext } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import type { StandaloneSwitchProps, SwitchProps } from './Switch.types';

export const StandaloneSwitch = ({
	error,
	helperText,
	onValueChange,
	value = false,
	...props
}: StandaloneSwitchProps) => {
	const { theme } = useThemeContext();
	const message = error || helperText;

	return (
		<View>
			<AppSwitch {...props} onValueChange={onValueChange ?? (() => {})} value={value} />
			{message ? (
				<CaptionText color={error ? theme.colors.danger : theme.colors.subtext} style={styles.message}>
					{message}
				</CaptionText>
			) : null}
		</View>
	);
};

export const Switch = (props: SwitchProps) => {
	const { control } = useFormContext();

	return (
		<Controller
			control={control}
			name={props.name}
			rules={{ required: props.required }}
			render={({ field, fieldState }) => (
				<StandaloneSwitch
					{...props}
					error={fieldState.error?.message || props.error}
					onBlur={() => field.onBlur()}
					onValueChange={value => field.onChange(value)}
					value={Boolean(field.value)}
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
