import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { TextFieldRef } from '@expo/ui/swift-ui';
import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import type { SearchInputProps } from './SearchInput.types';

type SwiftUi = typeof import('@expo/ui/swift-ui');
type SwiftUiModifiers = typeof import('@expo/ui/swift-ui/modifiers');

let swiftUi: SwiftUi | null = null;
let swiftUiModifiers: SwiftUiModifiers | null = null;

// Behind a `Platform` check as well as a `try` — see `SymbolIcon`: the JavaScript resolves on
// Android too, only the native views don't.
if (Platform.OS === 'ios') {
	try {
		swiftUi = require('@expo/ui/swift-ui') as SwiftUi;
		swiftUiModifiers = require('@expo/ui/swift-ui/modifiers') as SwiftUiModifiers;
	} catch {
		swiftUi = null;
		swiftUiModifiers = null;
	}
}

/** One line of text at `fontSize`, which is all the field's host is given. */
const lineHeightFor = (fontSize: number) => Math.ceil(fontSize * 1.35);

/**
 * The text field inside a search box — **SwiftUI's own `TextField` on iOS**, React Native's
 * `TextInput` everywhere else. Only the field: the box around it (its fill, the magnifier, the
 * clear ×) stays the caller's, so the two platforms keep one look.
 *
 * **Controlled, across a bridge that answers late.** The native field reports each change
 * asynchronously, so the text it last reported is kept, and only a value the screen set itself —
 * a clear, a recent search — is pushed back in. Pushing every render would put back a keystroke
 * the screen had not heard about yet.
 */
const NativeSearchInput = ({
	autoFocus = false,
	fontSize,
	maxLength,
	onChangeText,
	onSubmit,
	placeholder,
	ref,
	style,
	submitLabel = 'search',
	value
}: SearchInputProps) => {
	const { theme } = useThemeContext();
	const { Host, Text, TextField, useNativeState } = swiftUi!;
	const modifiers = swiftUiModifiers!;
	const text = useNativeState(value);
	const fieldRef = useRef<TextFieldRef>(null);
	const focusedRef = useRef(false);
	const reportedRef = useRef(value);

	useEffect(() => {
		if (value !== reportedRef.current) {
			reportedRef.current = value;
			void fieldRef.current?.setText(value);
		}
	}, [value]);

	useImperativeHandle(
		ref,
		() => ({
			blur: () => void fieldRef.current?.blur(),
			/*
			 * **Blur first, then focus.** Expo UI's `focus()` only sets a flag that SwiftUI acts on when
			 * it *changes*. A call SwiftUI cannot honour — the search page's first, made mid tab switch
			 * — leaves the flag set with the field unfocused, and every retry then sets it to what it
			 * already is: resolved, and nothing happens. `blur()` puts the flag back, so each attempt
			 * is a change again.
			 */
			focus: () => {
				const field = fieldRef.current;

				if (!field || focusedRef.current) {
					return;
				}

				void field.blur().then(() => field.focus());
			},
			isFocused: () => focusedRef.current
		}),
		[]
	);

	/*
	 * **The same modifiers object across renders.** A new array each render re-applies the chain to
	 * the native field, and doing that while it holds focus dropped the focus: the search page's
	 * own `focus()` resolved, the field reported itself focused, and the keyboard never stayed.
	 */
	const face = useMemo(() => modifiers.font({ family: appFonts.regular, size: fontSize }), [fontSize, modifiers]);
	const fieldModifiers = useMemo(
		() => [
			modifiers.textFieldStyle('plain'),
			face,
			modifiers.foregroundStyle(theme.colors.text),
			modifiers.tint(theme.colors.accent),
			modifiers.submitLabel(submitLabel),
			modifiers.autocorrectionDisabled(),
			modifiers.textInputAutocapitalization('never'),
			...(onSubmit ? [modifiers.onSubmit(onSubmit)] : [])
		],
		[face, modifiers, onSubmit, submitLabel, theme.colors.accent, theme.colors.text]
	);
	const placeholderModifiers = useMemo(
		() => [face, modifiers.foregroundStyle(theme.colors.faintText)],
		[face, modifiers, theme.colors.faintText]
	);

	return (
		<View style={[{ height: lineHeightFor(fontSize) }, style]}>
			<Host ignoreSafeArea='keyboard' style={styles.fill}>
				<TextField
					autoFocus={autoFocus}
					{...(maxLength === undefined ? {} : { maxLength })}
					modifiers={fieldModifiers}
					onFocusChange={focused => {
						focusedRef.current = focused;
					}}
					onTextChange={next => {
						reportedRef.current = next;
						onChangeText(next);
					}}
					ref={fieldRef}
					text={text}
				>
					<TextField.Placeholder>
						<Text modifiers={placeholderModifiers}>{placeholder}</Text>
					</TextField.Placeholder>
				</TextField>
			</Host>
		</View>
	);
};

const DrawnSearchInput = ({
	autoFocus = false,
	fontSize,
	maxLength,
	onChangeText,
	onSubmit,
	placeholder,
	ref,
	style,
	submitLabel = 'search',
	value
}: SearchInputProps) => {
	const { theme } = useThemeContext();
	const inputRef = useRef<TextInput>(null);

	useImperativeHandle(
		ref,
		() => ({
			blur: () => inputRef.current?.blur(),
			focus: () => inputRef.current?.focus(),
			isFocused: () => inputRef.current?.isFocused() ?? false
		}),
		[]
	);

	return (
		<TextInput
			autoCapitalize='none'
			autoCorrect={false}
			autoFocus={autoFocus}
			{...(maxLength === undefined ? {} : { maxLength })}
			onChangeText={onChangeText}
			{...(onSubmit ? { onSubmitEditing: onSubmit } : {})}
			placeholder={placeholder}
			placeholderTextColor={theme.colors.faintText}
			ref={inputRef}
			returnKeyType={submitLabel}
			style={[styles.input, { color: theme.colors.text, fontFamily: appFonts.regular, fontSize }, style]}
			value={value}
		/>
	);
};

export const SearchInput = (props: SearchInputProps) =>
	swiftUi && swiftUiModifiers ? <NativeSearchInput {...props} /> : <DrawnSearchInput {...props} />;

const styles = StyleSheet.create({
	fill: {
		flex: 1
	},
	input: {
		paddingVertical: 0
	}
});
