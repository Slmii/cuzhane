import { GlassSurface } from '@/components/ui/GlassSurface/GlassSurface.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { SymbolIcon } from '@/components/ui/Icon/SymbolIcon.component';
import { SearchInput } from '@/components/ui/SearchInput/SearchInput.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SearchBoxProps } from './SearchBox.types';

const FIELD_HEIGHT = 52;
const FIELD_RADIUS = 26;
const CLEAR_SIZE = 21;
const FONT_SIZE = 17;

/**
 * K2's search pill — the glass box, the set's magnifier, the field and its clear × — as one
 * piece, so every search box on iOS is the same one. The search page draws it everywhere; the
 * Mushaf's Git sheet on iOS only, keeping its own flat box on Android.
 */
export const SearchBox = ({
	maxLength,
	onChangeText,
	onClear,
	placeholder,
	ref,
	style,
	submitLabel,
	value
}: SearchBoxProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	return (
		<View style={[styles.field, style]}>
			<GlassSurface
				fallbackColor={theme.colors.surface}
				pointerEvents='none'
				style={[StyleSheet.absoluteFill, styles.glass]}
				tintColor={theme.colors.surface}
			/>
			{/* The set's own magnifier as a symbol, so it and the × are drawn by one hand. */}
			<SymbolIcon assetName='ara-search' color={theme.colors.subtext} icon='search' size={17} strokeWidth={2.4} />
			<SearchInput
				fontSize={FONT_SIZE}
				{...(maxLength === undefined ? {} : { maxLength })}
				onChangeText={onChangeText}
				placeholder={placeholder}
				{...(ref ? { ref } : {})}
				style={styles.input}
				{...(submitLabel ? { submitLabel } : {})}
				value={value}
			/>
			{onClear && value !== '' ? (
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
	field: {
		alignItems: 'center',
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
		minWidth: 0
	}
});
