import { GlassCornerAction } from '@/components/ui/CornerAction/GlassCornerAction.component';
import { GlassSurface } from '@/components/ui/GlassSurface/GlassSurface.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { SymbolIcon } from '@/components/ui/Icon/SymbolIcon.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { MAX_SEARCH_QUERY_LENGTH } from '@/lib/utils/recentSearches';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SearchFieldProps } from './SearchField.types';

const FIELD_HEIGHT = 52;
const FIELD_RADIUS = 26;
const CLEAR_SIZE = 21;
/** `GlassCornerAction`'s target — the back chevron's circle. */
const CLOSE_SIZE = 44;
/** Air between the field and the keyboard's top edge; flush against it the pill read as its lid. */
const KEYBOARD_GAP = 12;

/**
 * K2's bottom row: the glass field with a round × beside it, where the tab bar was. It rides the
 * keyboard — `KeyboardStickyView` moves it up by the keyboard's height as the keyboard comes,
 * and `offset.opened` gives back the home-indicator inset the keyboard already covers, less the
 * gap the field keeps above it.
 */
export const SearchField = ({ inputRef, onChange, onClear, onClose, query }: SearchFieldProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const bottomInset = Math.max(insets.bottom, 10);

	return (
		<KeyboardStickyView offset={{ closed: 0, opened: bottomInset - KEYBOARD_GAP }}>
			<View style={[styles.row, { paddingBottom: bottomInset }]}>
				<View style={styles.field}>
					<GlassSurface
						fallbackColor={theme.colors.surface}
						pointerEvents='none'
						style={[StyleSheet.absoluteFill, styles.glass]}
						tintColor={theme.colors.surface}
					/>
					{/* The set's own magnifier as a symbol, so it and the × are drawn by one hand. */}
					<SymbolIcon
						assetName='ara-search'
						color={theme.colors.subtext}
						icon='search'
						size={17}
						strokeWidth={2.4}
					/>
					<TextInput
						autoCapitalize='none'
						autoCorrect={false}
						// The store's cap, applied at the field so what is typed is what is kept.
						maxLength={MAX_SEARCH_QUERY_LENGTH}
						onChangeText={onChange}
						placeholder={t('search')}
						placeholderTextColor={theme.colors.faintText}
						ref={inputRef}
						returnKeyType='search'
						style={[styles.input, { color: theme.colors.text, fontFamily: appFonts.regular }]}
						value={query}
					/>
					{query !== '' ? (
						<Pressable
							accessibilityLabel={t('filterClear')}
							accessibilityRole='button'
							hitSlop={8}
							onPress={onClear}
							style={[styles.clear, { backgroundColor: theme.colors.borderStrong }]}
						>
							<Icon color={theme.colors.background} name='close' size={10} strokeWidth={3.2} />
						</Pressable>
					) : null}
				</View>
				{/*
				 * A × in the same bare glass circle as the platform's back chevron — a glyph where
				 * K2 wrote "Kapat", and the shape every pushed screen already closes with. In a box
				 * of its own size: on iOS 26 the button is a SwiftUI host that measures itself, which
				 * the row's flex layout can't see, so without the box the field took the whole width
				 * and the × sat past the edge.
				 */}
				<View style={styles.closeSlot}>
					<GlassCornerAction
						accessibilityLabel={t('close')}
						hasOwnGlass
						icon='close'
						onPress={onClose}
						systemIcon='xmark'
						tone='surface'
					/>
				</View>
			</View>
		</KeyboardStickyView>
	);
};

const styles = StyleSheet.create({
	clear: {
		alignItems: 'center',
		borderRadius: CLEAR_SIZE / 2,
		height: CLEAR_SIZE,
		justifyContent: 'center',
		width: CLEAR_SIZE
	},
	closeSlot: {
		height: CLOSE_SIZE,
		width: CLOSE_SIZE
	},
	field: {
		alignItems: 'center',
		flex: 1,
		flexDirection: 'row',
		gap: 8,
		minHeight: FIELD_HEIGHT,
		minWidth: 0,
		paddingHorizontal: 16
	},
	glass: {
		borderRadius: FIELD_RADIUS
	},
	input: {
		flex: 1,
		fontSize: 17,
		letterSpacing: -0.3,
		minWidth: 0,
		paddingVertical: 0
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 12,
		paddingTop: 8
	}
});
