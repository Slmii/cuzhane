import { GlassCornerAction } from '@/components/ui/CornerAction/GlassCornerAction.component';
import { SearchBox } from '@/components/ui/SearchBox/SearchBox.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { MAX_SEARCH_QUERY_LENGTH } from '@/lib/utils/recentSearches';
import { StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SearchFieldProps } from './SearchField.types';

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
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const bottomInset = Math.max(insets.bottom, 10);

	return (
		<KeyboardStickyView offset={{ closed: 0, opened: bottomInset - KEYBOARD_GAP }}>
			<View style={[styles.row, { paddingBottom: bottomInset }]}>
				<SearchBox
					// The store's cap, applied at the field so what is typed is what is kept.
					maxLength={MAX_SEARCH_QUERY_LENGTH}
					onChangeText={onChange}
					onClear={onClear}
					placeholder={t('search')}
					ref={inputRef}
					style={styles.field}
					value={query}
				/>
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
	closeSlot: {
		height: CLOSE_SIZE,
		width: CLOSE_SIZE
	},
	field: {
		flex: 1
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 12,
		paddingTop: 8
	}
});
