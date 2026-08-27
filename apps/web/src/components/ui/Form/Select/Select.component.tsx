import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Controller, useFormContext } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import type { FormSelectProps } from './Select.types';

/**
 * Single-choice select bound to a form field. Renders as the design's cycle pills by
 * default, or as a segmented control where the design uses one.
 */
export const Select = ({ error, name, options, style, variant = 'chips' }: FormSelectProps) => {
	const { theme } = useThemeContext();
	const { control } = useFormContext();

	return (
		<Controller
			control={control}
			name={name}
			render={({ field, fieldState }) => {
				const message = fieldState.error?.message || error;
				const value = typeof field.value === 'string' ? field.value : '';
				const isFilled = variant === 'filled';

				return (
					<View style={style}>
						{variant === 'segmented' ? (
							<SegmentedControl onChange={field.onChange} options={options} value={value} />
						) : (
							<View style={isFilled ? styles.filledChips : styles.chips}>
								{options.map(option => {
									const isSelected = value === option.value;

									return (
										<Pressable
											accessibilityRole='radio'
											accessibilityState={{ selected: isSelected }}
											key={option.value}
											onPress={() => field.onChange(option.value)}
											style={({ pressed }) => [
												styles.chip,
												isFilled ? styles.filledChip : null,
												{
													backgroundColor: isSelected
														? isFilled
															? theme.colors.accent
															: theme.colors.accentSoft
														: isFilled
														? theme.colors.transparent
														: theme.colors.surface,
													borderColor: isSelected
														? theme.colors.accent
														: isFilled
														? theme.colors.borderStrong
														: theme.colors.border,
													transform: [{ scale: pressed ? 0.96 : 1 }]
												}
											]}
										>
											<Typography
												color={
													isSelected
														? isFilled
															? theme.colors.onAccent
															: theme.colors.accent
														: theme.colors.subtext
												}
												style={styles.chipLabel}
												variant='bodyStrong'
											>
												{option.label}
											</Typography>
										</Pressable>
									);
								})}
							</View>
						)}
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
	chip: {
		borderRadius: 11,
		borderWidth: 1.5,
		paddingHorizontal: 13,
		paddingVertical: 10
	},
	chipLabel: {
		fontSize: 12
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 7
	},
	// No wrapping and no growth beyond a share of the row: the topic row is three equal
	// columns, so a longer label narrows the text rather than dropping onto a second line.
	filledChip: {
		alignItems: 'center',
		borderWidth: 1,
		flex: 1,
		paddingHorizontal: 6
	},
	filledChips: {
		flexDirection: 'row',
		gap: 7
	},
	message: {
		marginLeft: 14,
		marginTop: 4
	}
});
