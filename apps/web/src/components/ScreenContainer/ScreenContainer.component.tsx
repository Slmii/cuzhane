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
	// With one in play the inset moves onto the safe area instead, which shrinks the
	// viewport rather than the content, and the header comes to rest below the status bar.
	const hasStickyHeader = Boolean(stickyHeaderIndices?.length) && isScrollable;
	const shouldInsetSafeArea = hasStickyHeader && shouldIncludeTopInset;
	const horizontalEdges: readonly Edge[] = tabBarHeight > 0 ? ['left', 'right'] : ['left', 'right', 'bottom'];
	const edges: readonly Edge[] = shouldInsetSafeArea ? [...horizontalEdges, 'top'] : horizontalEdges;
	const topInset = shouldIncludeTopInset && !shouldInsetSafeArea ? insets.top : 0;
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
			<SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor: theme.colors.background }, style]}>
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
		<SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor: theme.colors.background }, style]}>
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
