import { PullToRefresh } from '@/components/ui/PullToRefresh/PullToRefresh.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { HasTabBarContext, TAB_BAR_CONTENT_GAP, TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { useIsFocused } from '@react-navigation/native';
import { useContext, useEffect, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScreenContainerProps } from './ScreenContainer.types';

const SCREEN_HORIZONTAL_PADDING = 20;
/** Breathing room between the focused field and the top of the keyboard. */
const KEYBOARD_GAP = 24;

export const ScreenContainer = ({
	children,
	contentContainerStyle,
	isScrollable = true,
	pullToRefresh,
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
	const hasTabBar = useContext(HasTabBarContext);
	// The keyboard-aware view's own ref type — a `ScrollView` plus the method it adds.
	const scrollRef = useRef<ComponentRef<typeof KeyboardAwareScrollView> | null>(null);
	// A sticky header pins to the scroll *viewport*, not to the content — so it rises above
	// the content padding that normally carries the top inset and lands under the notch.
	// With one in play the inset moves onto the viewport instead, which shrinks it rather
	// than the content, and the header comes to rest below the status bar.
	const hasStickyHeader = Boolean(stickyHeaderIndices?.length) && isScrollable;
	// A refresh control has the same problem: `UIRefreshControl` draws above the content's
	// top edge, and with the inset carried by the content that edge is the top of the screen,
	// so the spinner turned under the Dynamic Island where nobody could see it.
	const hasRefreshControl = pullToRefresh !== undefined && isScrollable;
	const shouldInsetViewport = (hasStickyHeader || hasRefreshControl) && shouldIncludeTopInset;
	/*
	 * The `bottom` edge is ours only when nothing is below us. Asked of `HasTabBarContext` rather
	 * than of the offset, because on Android the bar covers nothing and is still down there —
	 * reading a zero offset as "no bar" put a gesture inset inside a screen the bar already
	 * clears.
	 */
	const horizontalEdges: readonly Edge[] = hasTabBar ? ['left', 'right'] : ['left', 'right', 'bottom'];
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
	// The bar's height *and* the design's gap above it — content should stop short of the
	// glass, not touch it.
	const paddingBottom = shouldIncludeTabBarOffset ? tabBarHeight + TAB_BAR_CONTENT_GAP : theme.spacing.lg;

	useEffect(() => {
		if (!isScrollable || !shouldScrollToTopOnFocus || !isFocused) {
			return;
		}

		requestAnimationFrame(() => {
			scrollRef.current?.scrollTo({ y: 0, animated: false });
		});
	}, [isFocused, isScrollable, shouldScrollToTopOnFocus]);

	if (isScrollable) {
		const scrollView = (
			/*
			 * **Keyboard-aware, not a plain `ScrollView`.** Every form in the app is inside one
			 * of these, and none of them moved for the keyboard: on sign-in the fields sat
			 * behind it, so you could neither read what you had typed nor reach the paste
			 * callout. `KeyboardAwareScrollView` scrolls the focused input into view and
			 * restores the position afterwards — it is the same library the search field
			 * already rides on, and `KeyboardProvider` is mounted in `AppRoot`, so this is a
			 * swap rather than a new dependency.
			 *
			 * `bottomOffset` is the gap left under the focused field. Zero puts an input flush
			 * against the keyboard's top edge, where iOS draws the paste bar over it.
			 */
			<KeyboardAwareScrollView
				bottomOffset={KEYBOARD_GAP}
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
			</KeyboardAwareScrollView>
		);

		return (
			<SafeAreaView
				edges={edges}
				style={[
					styles.safeArea,
					{ backgroundColor: theme.colors.background, paddingTop: viewportPaddingTop },
					style
				]}
			>
				{pullToRefresh ? <PullToRefresh {...pullToRefresh}>{scrollView}</PullToRefresh> : scrollView}
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
