import { useLiveSessionState } from '@/lib/hooks/useLiveSession';
import { TAB_BAR_CONTENT_GAP, TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { CommonActions, StackActions, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hasLiveStrip, liveReaderRouteFor } from './liveReturnStrip';
import { isStripNativeAccessory, liveReturnSlot } from './liveReturnSlot';

/** The design's gaps: 10 above the tab bar, 6 above the home indicator on a screen without one. */
const GAP_ABOVE_BAR = 10;
const GAP_WITHOUT_BAR = 6;
/** The strip's least height — what the room is reserved at until it has been laid out. */
const STRIP_MIN_HEIGHT = 66;

type Props = {
	children: ReactNode;
	/** The tab bar's covered height, as `withTabBarOffset` measures it. */
	coveredHeight: number;
	/** The bar has stepped aside for this screen (`TAB_BAR_HIDDEN_ROUTES`, search's early hide). */
	isBarHidden: boolean;
	/** The screen on top of this tab's stack. */
	screenName: string | undefined;
};

/**
 * **One tab's say in the return strip, and the room its screens leave for it.** The strip itself
 * is drawn once for every tab (`LiveReturnStripOverlay`, or iOS's tab-bar accessory), so it stays
 * put through tab switches; the focused tab tells it, through `liveReturnSlot`, whether it is due
 * on the screen showing, where it belongs above the window's bottom edge, and the way back.
 *
 * **The room travels in `TabBarOffsetContext`**, which is what every screen already insets its
 * content by: while the strip is due, the offset is the strip's top edge rather than the bar's,
 * plus `TAB_BAR_CONTENT_GAP`, so content scrolls clear of it (the design's 112pt under a list,
 * at the strip's least height) and a reader's own action bar stands above it. On the session's
 * own reader, which shows its live bar instead, the offset is the bar's alone again.
 *
 * Kept while the keyboard hides the strip, so a form doesn't jump when it opens.
 */
/** The iOS 26 tab-bar accessory: 48pt tall, 8pt above the bar (measured on iOS 26.5). */
const NATIVE_ACCESSORY_ROOM = 56;

/**
 * Screens that keep their bottom edge for a control of their own and do not read the tab bar's
 * offset (search's field, the how-it-works footer): the strip would sit on that control. The
 * session goes on; the strip is back on the next screen.
 */
const STRIP_HIDDEN_ROUTES = new Set(['Search', 'GroupHowItWorks']);

export const LiveReturnStripHost = ({ children, coveredHeight, isBarHidden, screenName }: Props) => {
	const session = useLiveSessionState();
	const navigation = useNavigation();
	const route = useRoute();
	const isTabFocused = useIsFocused();
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();
	// How tall the shared card came out (it reports it to the slot), for the content's room.
	const reportedHeight = useSyncExternalStore(liveReturnSlot.subscribe, () => liveReturnSlot.get().stripHeight);
	const stripHeight = Math.max(STRIP_MIN_HEIGHT, reportedHeight);
	/*
	 * Where this tab's scene ends, above the window's bottom edge: the tab bar on Android, which
	 * lays the scene out above it; nothing on iOS, where the bar floats over the scene.
	 */
	const sceneRef = useRef<View>(null);
	const [sceneGap, setSceneGap] = useState(0);

	const strip = hasLiveStrip(session) ? session : null;
	const isDue =
		strip !== null &&
		screenName !== liveReaderRouteFor(strip.kind) &&
		!(screenName !== undefined && STRIP_HIDDEN_ROUTES.has(screenName));
	const bottom = isBarHidden ? insets.bottom + GAP_WITHOUT_BAR : coveredHeight + GAP_ABOVE_BAR;
	const isDrawn = isDue && !isStripNativeAccessory;
	/*
	 * Room under the content for whichever strip is showing: the drawn card's own height, or the
	 * native accessory's — iOS stacks it on the bar but does not inset the screens for it.
	 */
	const offset = isDrawn
		? bottom + stripHeight + TAB_BAR_CONTENT_GAP
		: isDue
		? coveredHeight + NATIVE_ACCESSORY_ROOM
		: coveredHeight;

	/*
	 * **Back to the reader inside this tab**, with no params — the reader seeds its place from the
	 * session. Every tab's stack has both readers (`sharedTabScreens`); one already in the stack is
	 * returned to rather than pushed a second time.
	 */
	const handleReturn = useCallback(() => {
		if (!strip) {
			return;
		}

		const target = liveReaderRouteFor(strip.kind);
		const stack = navigation.getState()?.routes.find(entry => entry.key === route.key)?.state;

		if (stack?.type === 'stack' && stack.key !== undefined) {
			const action = stack.routes.some(entry => entry.name === target)
				? StackActions.popTo(target)
				: StackActions.push(target);

			navigation.dispatch({ ...action, target: stack.key });
			return;
		}

		navigation.dispatch(CommonActions.navigate({ name: route.name, params: { screen: target } }));
	}, [navigation, route.key, route.name, strip]);

	// The focused tab speaks for the strip, drawn once for every tab: due or not, where, and the way back.
	useEffect(() => {
		if (!isTabFocused) {
			return undefined;
		}

		liveReturnSlot.set({ bottom: sceneGap + bottom, isDue, onReturn: handleReturn });

		/*
		 * Let go on blur or unmount — a screen over the tabs (creating a group) leaves no tab focused,
		 * and the strip must not stay due for a tab nobody sees. Only if still this tab's: the tab
		 * coming into focus may already have written its own.
		 */
		return () => {
			if (liveReturnSlot.get().onReturn === handleReturn) {
				liveReturnSlot.set({ isDue: false });
			}
		};
	}, [bottom, handleReturn, isDue, isTabFocused, sceneGap]);

	const measureScene = () =>
		sceneRef.current?.measureInWindow((_x, y, _width, height) =>
			setSceneGap(Math.max(0, windowHeight - (y + height)))
		);

	return (
		<TabBarOffsetContext.Provider value={offset}>
			<View collapsable={false} onLayout={measureScene} ref={sceneRef} style={styles.fill}>
				{children}
			</View>
		</TabBarOffsetContext.Provider>
	);
};

const styles = StyleSheet.create({
	fill: {
		flex: 1
	}
});
