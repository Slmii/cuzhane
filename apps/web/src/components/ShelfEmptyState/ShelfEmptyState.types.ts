import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface ShelfEmptyStateProps {
	title: string;
	description: string;
	/** Stacked full-width buttons, most important first. */
	actions: ReactNode;
	/** Discover's "no results" variant overlays a magnifier on the shelf. */
	hasMagnifier?: boolean;
	style?: StyleProp<ViewStyle>;
}
