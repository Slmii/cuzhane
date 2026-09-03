import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { cloneElement, useState } from 'react';
import { type LayoutChangeEvent, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import type { PullToRefreshProps } from './PullToRefresh.types';

/*
 * Android's half is Jetpack Compose, required behind a `Platform` check as well as a `try` —
 * see `DestructiveDialog` for why the check is the part that matters: `@expo/ui` ships one
 * JavaScript module for both platforms and only the *native* views are missing on iOS.
 */
type Compose = typeof import('@expo/ui/jetpack-compose');
type ComposeModifiers = typeof import('@expo/ui/jetpack-compose/modifiers');

let compose: Compose | null = null;
let composeModifiers: ComposeModifiers | null = null;

if (Platform.OS === 'android') {
	try {
		compose = require('@expo/ui/jetpack-compose') as Compose;
		composeModifiers = require('@expo/ui/jetpack-compose/modifiers') as ComposeModifiers;
	} catch {
		compose = null;
		composeModifiers = null;
	}
}

/**
 * Pull-to-refresh, as each platform draws it, around the one scrollable it is given.
 *
 * **iOS** is `UIRefreshControl`: the child is cloned with React Native's own `RefreshControl`
 * as its `refreshControl`. It has to be that element and not a component wrapping one —
 * `ScrollView` mounts the prop as its native child — so the cloning happens here, once.
 * The design's copy rides along as the title ("Yenilemek için çek" / "Yenileniyor…").
 *
 * **Android** is Material 3's `PullToRefreshBox`, with the Expressive loading indicator the
 * app's Compose sheets and dialogs already belong to. React Native's `RefreshControl` there is
 * `SwipeRefreshLayout`'s white disc and arrow, a generation older than everything around it.
 * The list itself stays a React Native view: `RNHostView` hosts it inside Compose and forwards
 * its nested scrolling upward, which is how `PullToRefreshBox` learns the list is at the top
 * and being dragged down — the same path the members list rides inside the Material sheet.
 * Two things that path needs and Android's `ScrollView` doesn't give by default:
 *
 * - `nestedScrollEnabled`, which is off unless asked for; without it the list never offers
 *   its scroll to a parent and the box never hears the pull.
 * - **Something to scroll.** A `ScrollView` whose content fits refuses the drag outright
 *   (`onInterceptTouchEvent` bails when it can't scroll), so a short screen — the lobby, a
 *   group preview, a shelf with one group — would never pull. `SwipeRefreshLayout` sidesteps
 *   that by grabbing the touch itself; the Compose box can't. So the content is held one
 *   pixel taller than the host: invisible, and enough for the drag to be a scroll.
 *
 * If the Compose module isn't there, Android falls back to the iOS path.
 *
 * The design prototypes the gesture as a drawn arc turning with the drag and a label under
 * it; both platforms already do that natively, and a JS-drawn one has to fight the scroll
 * view's own bounce for the same pixels. What carries over is the accent tint.
 */
export const PullToRefresh = ({ children, isRefreshing, onRefresh }: PullToRefreshProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const [hostHeight, setHostHeight] = useState(0);

	if (compose && composeModifiers) {
		const { Host, PullToRefreshBox, RNHostView } = compose;
		const onLayout = (event: LayoutChangeEvent) => setHostHeight(event.nativeEvent.layout.height);

		return (
			<View onLayout={onLayout} style={styles.fill}>
				<Host style={styles.fill}>
					<PullToRefreshBox
						// The indicator sits at the box's content alignment (Expo's wrapper doesn't
						// centre it itself), so top-centre; the hosted list fills the box regardless.
						contentAlignment='topCenter'
						indicator={{ color: theme.colors.accent, containerColor: theme.colors.surface }}
						isRefreshing={isRefreshing}
						modifiers={[composeModifiers.fillMaxSize()]}
						onRefresh={onRefresh}
					>
						<RNHostView>
							{cloneElement(children, {
								contentContainerStyle: [
									children.props.contentContainerStyle,
									hostHeight > 0 ? { minHeight: hostHeight + 1 } : null
								],
								nestedScrollEnabled: true
							})}
						</RNHostView>
					</PullToRefreshBox>
				</Host>
			</View>
		);
	}

	return cloneElement(children, {
		refreshControl: (
			<RefreshControl
				onRefresh={onRefresh}
				refreshing={isRefreshing}
				tintColor={theme.colors.accent}
				title={isRefreshing ? t('ptrRefreshing') : t('ptrPull')}
				titleColor={theme.colors.faintText}
			/>
		)
	});
};

const styles = StyleSheet.create({
	fill: {
		flex: 1
	}
});
