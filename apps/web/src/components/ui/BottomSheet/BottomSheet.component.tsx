import { Header2, Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useRegisterOpenOverlay } from '@/lib/utils/openOverlays';
import { BottomSheet, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppBottomSheetProps } from './BottomSheet.types';

/** Air between the status bar and a sheet the keyboard has pushed to the top of the screen. */
const KEYBOARD_TOP_GAP = 10;

/**
 * The keyboard's height while it is up on iOS, 0 otherwise — see the fixed height below.
 *
 * iOS only: Android's sheet is a window of its own that resizes for the keyboard, and nothing
 * there was seen clipping.
 */
const useIosKeyboardHeight = () => {
	const [height, setHeight] = useState(0);

	useEffect(() => {
		if (Platform.OS !== 'ios') {
			return;
		}

		const show = Keyboard.addListener('keyboardWillShow', event => setHeight(event.endCoordinates.height));
		const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));

		return () => {
			show.remove();
			hide.remove();
		};
	}, []);

	return height;
};

/**
 * The one sheet in the app — every "modal" surface goes through it so they all get the same
 * grabber, spring, scrim and drag-to-dismiss.
 *
 * Declarative on purpose: callers flip `isVisible` instead of juggling present/dismiss refs,
 * which keeps sheet state alongside the rest of a screen's state. There is no close button; the
 * grabber, a downward drag and a tap on the backdrop all dismiss.
 *
 * ---
 *
 * **This is the platform's own sheet — `UISheetPresentationController` on iOS, a Material 3
 * `ModalBottomSheet` on Android — by way of `@expo/ui`'s gorhom-compatible wrapper.**
 * `@gorhom/bottom-sheet` is gone, and with it the drawn surface, the hand-rolled backdrop, the
 * 26pt radius and about a hundred and fifty lines of present/dismiss reconciliation that existed
 * only to work around that library's quirks.
 *
 * Three earlier findings said this could not be done, and all three have since been fixed
 * upstream. Worth knowing, because they are the reasons anyone would hesitate again:
 *
 * - **"Nothing inside it can be touched."** A sheet presents its content in its own view
 *   controller, where React Native's surface root is not an ancestor, so touches were never
 *   dispatched — fields would not focus, buttons were dead. `RNHostView` is the answer, and the
 *   wrapper now uses it. (It is also why hosting by hand was ever necessary.)
 * - **"SwiftUI cannot measure it."** `fitToContents` reads the content with a `GeometryReader`,
 *   which a hosted RN view reported as zero. `RNHostView matchContents` reports a real size, so
 *   a sheet with no `snapPoints` is as tall as what it holds.
 * - **"Android cannot size to content, and its `containerColor` is not forwarded."** Both were
 *   true of the Material 3 view and are no longer: it takes `containerColor`, `contentColor`,
 *   `scrimColor` and `skipPartiallyExpanded`.
 *
 * What we give up, deliberately: the backdrop opacity, the grabber's size and the corner radius
 * are the system's now, and `backdropComponent` / `backgroundComponent` / `handleIndicatorStyle`
 * are accepted by the wrapper but documented as having no effect natively — so they are not
 * passed. The surface is the platform's default rather than our `sheet` token, which is what was
 * asked for: a sheet should look like the OS's, not like a card we drew.
 */
export const AppBottomSheet = ({
	children,
	description,
	heightRatio,
	isVisible,
	onClose,
	onDismissed,
	title
}: AppBottomSheetProps) => {
	const { theme } = useThemeContext();
	const { height: windowHeight } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const keyboardHeight = useIosKeyboardHeight();

	/*
	 * **A fixed height gives way to the keyboard.** The platform sheet is as tall as what it holds,
	 * and with the keyboard up iOS lays a sheet taller than the room above it out *centred* — so
	 * the top of it was cut off: create-group lost its step header, the reader's Git sheet its
	 * title, tabs and the very search box being typed into. Capped to the room left, the sheet
	 * shrinks with the keyboard and its scroll view takes the difference.
	 */
	const fixedHeight =
		heightRatio === undefined
			? undefined
			: Math.round(
					keyboardHeight > 0
						? Math.min(
								windowHeight * heightRatio,
								windowHeight - keyboardHeight - insets.top - KEYBOARD_TOP_GAP
						  )
						: windowHeight * heightRatio
			  );

	/**
	 * The sheet is mounted on demand rather than kept alive and toggled.
	 *
	 * Each one is a native host view, and a screen holds several; mounting them all at startup
	 * costs a host apiece for sheets most people never open. It stays mounted through the close
	 * so the animation can finish, and is torn down when the sheet reports itself closed.
	 */
	const [isMounted, setIsMounted] = useState(isVisible);

	// Adjusted during render rather than in an effect, so the sheet exists on the very same
	// commit that `isVisible` flips — a frame's delay here is a frame of nothing after the tap.
	if (isVisible && !isMounted) {
		setIsMounted(true);
	}

	// A hint never puts its card over a sheet, nor over one still animating away.
	useRegisterOpenOverlay(isMounted);

	/**
	 * A close is announced only if the *user* performed it.
	 *
	 * Native sheets report a close when the transition ends, several hundred milliseconds after
	 * it began, and a screen keeps one piece of state for all of its sheets. A caller-driven
	 * close — Apply, a confirm button, switching to another sheet — has already set that state;
	 * announcing it again lands after the next sheet has opened and shuts it straight back. So a
	 * close we asked for is silent, and only a drag or a backdrop tap is news. `isVisible` is
	 * still true in the second case and already false in the first, which is the whole test.
	 *
	 * Not memoised, and it does not need to be: the sheet keeps its callbacks in refs it
	 * refreshes every render, so it always calls the latest one.
	 */
	const handleClose = () => {
		setIsMounted(false);

		// Always: the sheet is gone, whoever closed it. Callers that have to unwind afterwards
		// — a sheet that is a route and must pop itself — hang off this rather than `onClose`.
		onDismissed?.();

		if (isVisible) {
			onClose?.();
		}
	};

	if (!isMounted) {
		return null;
	}

	return (
		<BottomSheet
			/*
			 * **Always on, and no `snapPoints`, ever.** Every sheet is measured from its content;
			 * a caller that wants a fixed height gives its *content* one, below. Two reasons.
			 *
			 * The platforms disagree about detents — iOS takes an arbitrary height, Android has
			 * only "about half" and "expanded" — so the same percentage produced two different
			 * sheets. And toggling this flag is destructive: `BottomSheetView.swift` branches on
			 * `if props.fitToContents`, a *structural* SwiftUI `if`, so flipping it swaps
			 * `_ConditionalContent` arms and tears down the hosted React Native surface, remounting
			 * everything inside. Create-group lost the whole form to that. Held constant, neither
			 * can happen.
			 */
			enableDynamicSizing
			// Both halves of dismissal on iOS: SwiftUI does not let the drag and the backdrop tap
			// be controlled separately, and this sheet wants both.
			enablePanDownToClose
			index={isVisible ? 0 : -1}
			onClose={handleClose}
		>
			{/*
			 * **A gesture root of its own, inside the sheet.**
			 *
			 * `react-native-gesture-handler` routes touches through the nearest
			 * `GestureHandlerRootView` *in the same native window*, and a platform sheet is not in
			 * the same window — Android's Material 3 sheet is a dialog window of its own, and iOS
			 * presents in a separate view controller. The one in `AppRoot` therefore never sees a
			 * touch that lands in a sheet, so every `GestureDetector` inside one is inert: the
			 * reader's size slider registered no drag at all on Android, because the drawn track
			 * is a `Gesture.Pan`. Nesting roots is supported and is what RNGH prescribes for
			 * exactly this case.
			 *
			 * It only takes a flex when the sheet has a height to fill; in a content-sized sheet a
			 * `flex: 1` here would resolve against nothing and collapse the body to zero.
			 */}
			<BottomSheetView style={[styles.content, fixedHeight === undefined ? null : { height: fixedHeight }]}>
				<GestureHandlerRootView style={heightRatio === undefined ? null : styles.fill}>
					{title ? <Header2 style={styles.title}>{title}</Header2> : null}
					{description ? (
						<Typography color={theme.colors.subtext} style={styles.description} variant='caption'>
							{description}
						</Typography>
					) : null}
					{children}
				</GestureHandlerRootView>
			</BottomSheetView>
		</BottomSheet>
	);
};

const styles = StyleSheet.create({
	/*
	 * Our padding inside the platform's container. No bottom safe-area inset: the system sheet
	 * already clears the home indicator, and adding our own stacked two gaps.
	 */
	content: {
		paddingBottom: 28,
		paddingHorizontal: 20,
		paddingTop: 4
	},
	description: {
		marginBottom: 16,
		marginTop: 6,
		maxWidth: 290
	},
	fill: {
		flex: 1
	},
	title: {
		fontSize: 21,
		marginBottom: 4
	}
});
