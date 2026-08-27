import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface ScreenContainerProps {
	children: ReactNode;
	isScrollable?: boolean;
	shouldIncludeTopInset?: boolean;
	shouldIncludeTabBarOffset?: boolean;
	shouldScrollToTopOnFocus?: boolean;
	/**
	 * Indices of children that pin to the top while the rest scrolls under them — the
	 * design's `position:sticky` headers. The child must paint its own background, or the
	 * content scrolling beneath will show through it.
	 *
	 * Ignored when `isScrollable` is false: there is no scroll for a header to stick to.
	 */
	stickyHeaderIndices?: number[];
	contentContainerStyle?: StyleProp<ViewStyle>;
	style?: StyleProp<ViewStyle>;
}
