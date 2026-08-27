import type { StyleProp, ViewStyle } from 'react-native';

export interface ShelfIllustrationProps {
	/**
	 * Overlays a magnifier on the shelf. Discover uses it so the state reads as "nothing
	 * matched your search", rather than "no groups exist" the way the bare shelf does.
	 */
	hasMagnifier?: boolean;
	width?: number;
	style?: StyleProp<ViewStyle>;
}
