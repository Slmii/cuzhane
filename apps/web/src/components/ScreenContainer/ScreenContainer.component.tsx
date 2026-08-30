import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { useIsFocused } from '@react-navigation/native';
import { useContext, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScreenContainerProps } from './ScreenContainer.types';

const SCREEN_HORIZONTAL_PADDING = 20;

export const ScreenContainer = ({
	children,
	contentContainerStyle,
	isScrollable = true,
	shouldIncludeTabBarOffset = true,
	shouldIncludeTopInset = true,
	shouldScrollToTopOnFocus = false,
	stickyHeaderIndices,
	style
}: ScreenContainerProps) => {
	const { theme } = useThemeContext();
	const insets = useSafeAreaInsets();
	const isFocused = useIsFocused();
	const tabBarHeight = useContext(TabBarOffsetContext);
	const scrollRef = useRef<ScrollView | null>(null);
	// A sticky header pins to the scroll *viewport*, not to the content — so it rises above
	// the content padding that normally carries the top inset and lands under the notch.
	// With one in play the inset moves onto the viewport instead, which shrinks it rather
	// than the content, and the header comes to rest below the status bar.
	const hasStickyHeader = Boolean(stickyHeaderIndices?.length) && isScrollable;
	const shouldInsetViewport = hasStickyHeader && shouldIncludeTopInset;
	const horizontalEdges: readonly Edge[] = tabBarHeight > 0 ? ['left', 'right'] : ['left', 'right', 'bottom'];
	/*
	 * **The top inset is padding we compute, never a `SafeAreaView` edge.**
	 *
	 * `edges` is frame-aware: the native side works out how much of each inset actually
	 * applies from where the view sits in the window. That is the right behaviour for a
	 * static layout and the wrong one during a push — the incoming screen is translated
	 * off to the side, resolves a top inset of 0 while it slides, and only gains the real
	 * one when it lands. On a warm cache (no skeleton to hide it) that showed as the header
	 * drawn over the clock for ~370ms and then dropping into place; measured off a screen
	 * recording, content sat at y=176 before settling at y=254.
	 *
	 * `useSafeAreaInsets` is the plain context value with no measurement behind it, so it is
	 * correct on the very first frame the screen exists.
	 */
	const edges: readonly Edge[] = horizontalEdges;
	const viewportPaddingTop = shouldInsetViewport ? insets.top : 0;
	const topInset = shouldIncludeTopInset && !shouldInsetViewport ? insets.top : 0;
	const paddingTop = topInset + theme.spacing.sm;
	const paddingBottom = shouldIncludeTabBarOffset ? tabBarHeight : theme.spacing.lg;

	useEffect(() => {
		if (!isScrollable || !shouldScrollToTopOnFocus || !isFocused) {
			return;
		}

		requestAnimationFrame(() => {
			scrollRef.current?.scrollTo({ y: 0, animated: false });
		});
	}, [isFocused, isScrollable, shouldScrollToTopOnFocus]);

	if (isScrollable) {
		return (
			<SafeAreaView
				edges={edges}
				style={[
					styles.safeArea,
					{ backgroundColor: theme.colors.background, paddingTop: viewportPaddingTop },
					style
				]}
			>
				<ScrollView
					ref={scrollRef}
					contentContainerStyle={[
						styles.scrollableContent,
						{
							paddingBottom,
							paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
							paddingTop
						},
						contentContainerStyle
					]}
					keyboardShouldPersistTaps='handled'
					scrollIndicatorInsets={{ bottom: paddingBottom }}
					showsVerticalScrollIndicator={false}
					{...(stickyHeaderIndices ? { stickyHeaderIndices } : {})}
				>
					{children}
				</ScrollView>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView
			edges={edges}
			style={[
				styles.safeArea,
				{ backgroundColor: theme.colors.background, paddingTop: viewportPaddingTop },
				style
			]}
		>
			<View
				style={[
					styles.staticContent,
					{
						paddingBottom,
						paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
						paddingTop
					},
					contentContainerStyle
				]}
			>
				{children}
			</View>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1
	},
	scrollableContent: {
		flexGrow: 1,
		gap: 12
	},
	staticContent: {
		flex: 1,
		gap: 12
	}
});
