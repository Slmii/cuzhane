import { FieldLabelText, MonoText } from '@/components/ui/Typography/Typography.component';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, TextStyle, View } from 'react-native';
import type { AppInputProps, InputSize } from './Input.types';

const sizeStyleMap: Record<InputSize, TextStyle> = {
	sm: {
		fontSize: 13,
		minHeight: 40,
		paddingHorizontal: 12,
		paddingVertical: 10
	},
	md: {
		fontSize: 13,
		minHeight: 48,
		paddingHorizontal: 14,
		paddingVertical: 14
	},
	lg: {
		fontSize: 15,
		minHeight: 54,
		paddingHorizontal: 16,
		paddingVertical: 16
	}
};

/**
 * The app's single text input. `Form/Field` wraps this with a `Controller` and renders
 * the validation message; use `AppInput` directly only for inputs that aren't part of
 * a form (search boxes and the like).
 */
export const AppInput = forwardRef<TextInput, AppInputProps>(
	(
		{
			containerStyle,
			counter,
			hasError = false,
			label,
			multiline = false,
			multilineMinHeight = 80,
			size = 'md',
			style,
			useHeadingFont = false,
			variant = 'surface',
			...props
		},
		ref
	) => {
		const { theme } = useThemeContext();
		const [isFocused, setIsFocused] = useState(false);
		/*
		 * **One input, in a sheet or out of it.** This used to swap in `@gorhom/bottom-sheet`'s
		 * own `TextInput` when it was inside a sheet, because that library only learned a field
		 * had focus if the field told it — and without that the keyboard rose straight over the
		 * sheet. Sheets are the platform's now, and an OS sheet moves itself for its own
		 * keyboard, so there is nothing to tell and nothing to swap. (`@expo/ui` still exports a
		 * `BottomSheetTextInput` for drop-in compatibility; it is React Native's `TextInput`.)
		 * The `IsInsideSheetContext` this read was deleted with it.
		 */
		const toneByVariant = {
			surface: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
			muted: { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border },
			ghost: { backgroundColor: theme.colors.transparent, borderColor: theme.colors.transparent }
		}[variant];

		const borderColor = hasError
			? theme.colors.danger
			: isFocused
			? theme.colors.accent
			: toneByVariant.borderColor;

		return (
			<View style={containerStyle}>
				{label ? (
					<FieldLabelText color={theme.colors.faintText} style={styles.label}>
						{label}
					</FieldLabelText>
				) : null}
				{/* Relative only when there's a counter to place, so every other input keeps
				    exactly the box it had. */}
				<View style={counter === undefined ? null : styles.field}>
					<TextInput
						multiline={multiline}
						placeholderTextColor={theme.colors.faintText}
						ref={ref}
						{...props}
						onBlur={event => {
							setIsFocused(false);
							props.onBlur?.(event);
						}}
						onFocus={event => {
							setIsFocused(true);
							props.onFocus?.(event);
						}}
						style={[
							styles.input,
							sizeStyleMap[size],
							{
								backgroundColor: toneByVariant.backgroundColor,
								borderColor,
								borderRadius: theme.radius.md,
								color: theme.colors.text,
								fontFamily: useHeadingFont ? appFonts.headingRegular : appFonts.regular,
								opacity: props.editable === false ? 0.6 : 1
							},
							useHeadingFont ? styles.heading : null,
							multiline ? { minHeight: multilineMinHeight, textAlignVertical: 'top' } : null,
							// Keeps the last line of typing clear of the counter sitting over
							// the box's bottom-right corner.
							counter === undefined ? null : styles.counteredInput,
							style
						]}
					/>
					{counter === undefined ? null : (
						<MonoText color={theme.colors.faintText} style={styles.counter}>
							{counter}
						</MonoText>
					)}
				</View>
			</View>
		);
	}
);

AppInput.displayName = 'AppInput';

const styles = StyleSheet.create({
	counter: {
		bottom: 8,
		fontSize: 10.5,
		position: 'absolute',
		right: 14
	},
	counteredInput: {
		paddingBottom: 26
	},
	field: {
		position: 'relative'
	},
	heading: {
		fontSize: 14
	},
	input: {
		borderWidth: 1
	},
	label: {
		marginBottom: 8
	}
});
