import { OptionCard } from '@/components/ui/OptionCard/OptionCard.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Controller, useFormContext } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import type { FormOptionGroupProps } from './OptionGroup.types';

/**
 * A radio group rendered as the design's choice cards (visibility, split mode), bound
 * to a form field. Same `Controller` pattern as `Field`/`Switch`, different control.
 */
export const FormOptionGroup = ({ direction = 'row', error, name, onChange, options, style }: FormOptionGroupProps) => {
	const { theme } = useThemeContext();
	const { control } = useFormContext();

	return (
		<Controller
			control={control}
			name={name}
			render={({ field, fieldState }) => {
				const message = fieldState.error?.message || error;

				return (
					<View style={style}>
						<View style={[styles.group, direction === 'row' ? styles.row : styles.column]}>
							{options.map(option => (
								<OptionCard
									hint={option.hint}
									isSelected={field.value === option.value}
									key={option.value}
									onPress={() => {
										field.onChange(option.value);
										onChange?.(option.value);
									}}
									style={direction === 'row' ? styles.rowItem : undefined}
									title={option.title}
								/>
							))}
						</View>
						{message ? (
							<CaptionText color={theme.colors.danger} style={styles.message}>
								{message}
							</CaptionText>
						) : null}
					</View>
				);
			}}
		/>
	);
};

const styles = StyleSheet.create({
	column: {
		flexDirection: 'column'
	},
	group: {
		gap: 9
	},
	message: {
		marginLeft: 14,
		marginTop: 4
	},
	row: {
		flexDirection: 'row'
	},
	rowItem: {
		flex: 1
	}
});
