import { IsInsideSheetProvider } from '@/components/ui/BottomSheet/BottomSheet.context';
import { GlassSurface } from '@/components/ui/GlassSurface/GlassSurface.component';
import { Header2, Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps, BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppBottomSheetProps } from './BottomSheet.types';

/**
 * SwiftUI's sheet, and the host that makes its contents usable.
 *
 * **`RNHostView` is not optional here.** A sheet presents its content in its own view controller,
 * where React Native's surface root is not an ancestor — so touches are never dispatched to it.
 * Without the host every control in every sheet was dead: fields would not focus so no keyboard
 * appeared, and buttons did nothing. `@expo/ui`'s own note on the component says exactly this,
 * and its `layoutRoot` prop is what makes hosted content dispatch its own touches *and* be the
 * origin it is measured from. `matchContents` is the second half: it reports the children's size
 * back into the React Native tree, which is what lets the sheet size to its content.
 *
 * Assembled here rather than through `@expo/ui`'s universal `BottomSheet`, which hosts with
 * `pointerEvents="none"` and no `RNHostView` — the reason the first attempt at this failed.
 *
 * Required in a `try` like every other `@expo/ui` surface: the package resolves native views as
 * it loads, so a client built before it was added would throw as this module is evaluated.
 * Absent — and on Android, which has no SwiftUI — every sheet takes the drawn path below.
 */
type SwiftUi = typeof import('@expo/ui/swift-ui');
type SwiftUiModifiers = typeof import('@expo/ui/swift-ui/modifiers');

let swiftUi: SwiftUi | null = null;
let swiftUiModifiers: SwiftUiModifiers | null = null;

try {
	swiftUi = require('@expo/ui/swift-ui') as SwiftUi;
	swiftUiModifiers = require('@expo/ui/swift-ui/modifiers') as SwiftUiModifiers;
} catch {
	swiftUi = null;
	swiftUiModifiers = null;
}

/**
 * How much of the display a sheet may cover — a strip of the screen it came from is what keeps a
 * sheet a layer rather than a screen of its own.
 */
const NATIVE_MAX_HEIGHT_RATIO = 0.75;

/**
 * The one sheet in the app — every "modal" surface goes through it so they all get the
 * same grabber, spring, fading backdrop and drag-to-dismiss.
 *
 * Declarative on purpose: callers flip `isVisible` instead of juggling present/dismiss
 * refs, which keeps sheet state alongside the rest of a screen's state. There is no
 * close button; the grabber, a downward drag and a tap on the backdrop all dismiss.
 *
 * ---
 *
 * **Presenting these natively was tried and reverted.** `@expo/ui`'s sheet — a
 * `UISheetPresentationController` on iOS, a Material 3 `ModalBottomSheet` on Android — would
 * have given the system's own detents, scrim and dismissal, and an Android sheet that belongs
 * there. Four things stopped it, and the last is fatal:
 *
 * - **Nothing inside it can be touched.** The wrapper hosts content with `pointerEvents="none"`,
 *   so the whole subtree stops receiving events: fields never focus, so the keyboard never
 *   appears, and every button is dead. Assembling the sheet by hand with `box-none` on our own
 *   `Host` does not fix it — the presented content is not reachable from React Native's touch
 *   system at all.
 * - **SwiftUI cannot measure it.** `fitToContents` reads the content with a `GeometryReader` and
 *   a hosted RN view reports zero, so every sheet fell back to `.medium` whatever it held.
 * - **Android cannot size to content.** Material keeps a partial detent at half the viewport and
 *   the only way to skip it also fills the screen — the `SnapPoint` union has no value that
 *   means "content height, no partial detent".
 * - **Android's `containerColor` is not forwarded**, so the sheet's own surface cannot be ours.
 *
 * Worth knowing before anyone tries again: the first is the one to test first, because it is
 * cheap to check and it ends the question.
 */
export const AppBottomSheet = ({
	children,
	description,
	hasScrollableContent = false,
	isVisible,
	maxHeight,
	onClose,
	snapPoints,
	title,
	topInset
}: AppBottomSheetProps) => {
	const { theme } = useThemeContext();
	const insets = useSafeAreaInsets();
	const { height: windowHeight, width: windowWidth } = useWindowDimensions();
	/*
	 * A sheet that scrolls needs a definite height, not a cap: `maxHeight` bounds a view without
	 * giving it one, and a `ScrollView` filling its parent with `flex: 1` then resolves to zero.
	 */
	const nativeMaxHeight = maxHeight ?? Math.round(windowHeight * NATIVE_MAX_HEIGHT_RATIO);
	const hasNativeFixedHeight = hasScrollableContent || snapPoints !== undefined || topInset !== undefined;
	const sheetRef = useRef<BottomSheetModal>(null);
	// Fixed detents mean the sheet no longer measures its content, so the body has to
	// fill the detent itself instead of hugging the children.
	const hasFixedHeight = snapPoints !== undefined;
	const paddingBottom = Math.max(insets.bottom, 24);

	/**
	 * Two facts about the close currently running, declared up here because every effect
	 * below reads or writes them.
	 *
	 * `hasAnnouncedClose` — whether the caller has already been told. `onClose` must fire
	 * exactly once per close: both the start of the animation and the dismissal that lands a
	 * few hundred milliseconds later used to call it, and screens keep one piece of state for
	 * all their sheets, so the trailing call arrived after the next sheet had been opened and
	 * shut it again.
	 *
	 * `isCallerDrivenClose` — whether *we* asked for this close. If so the caller already
	 * knows, and announcing it back is worse than useless: switching sheets sets the shared
	 * state to the new one, and the outgoing sheet's announcement would set it straight back
	 * to null.
	 */
	const hasAnnouncedCloseRef = useRef(false);
	const isCallerDrivenCloseRef = useRef(false);

	/**
	 * The modal is mounted on demand rather than kept alive and toggled with
	 * `present()`/`dismiss()`. On a screen that has been mounted since app start — which
	 * is every tab root — a `present()` call arriving long after mount is silently
	 * dropped, so the sheet would never appear. Presenting a freshly mounted modal is
	 * reliable, and unmounting after `onDismiss` keeps the closing animation intact.
	 */
	const [isMounted, setIsMounted] = useState(isVisible);

	// Adjusting state during render rather than in an effect, so the modal exists on the
	// very same commit that `isVisible` flips — an extra frame here loses the present.
	if (isVisible && !isMounted) {
		setIsMounted(true);
	}

	/*
	 * Present whenever the caller wants it open and the modal exists — keyed on `isVisible`
	 * too, not just on the mount.
	 *
	 * Closing takes a few hundred milliseconds to animate, and the modal stays mounted for
	 * all of it. Reopening inside that window left `isMounted` already true, so an effect
	 * watching only the mount never ran again and the tap did nothing; the sheet then
	 * appeared a second or so later, when the old dismissal finally unmounted it and the
	 * whole cycle started over. Fast enough taps looked like a dead button.
	 *
	 * A *layout* effect, so the present is asked for in the same commit that mounted the
	 * modal rather than after the browser-equivalent paint. A passive effect spent a frame
	 * with the sheet mounted and still off screen, which reads as a beat of nothing between
	 * the tap and the sheet starting to rise.
	 */
	useLayoutEffect(() => {
		if (isMounted && isVisible) {
			// Every open starts from a clean slate. Both flags describe a close that is over by
			// now, and a stale one left standing is what makes a sheet stop opening — so they
			// are cleared here rather than only where they happen to be read.
			hasAnnouncedCloseRef.current = false;
			isCallerDrivenCloseRef.current = false;
			sheetRef.current?.present();
		}
	}, [isMounted, isVisible]);

	/*
	 * A caller-driven close (Apply, a confirm button) still animates out — but only if the
	 * sheet isn't already closing under its own steam.
	 *
	 * Announcing at the start of a user dismissal turns `isVisible` false while the sheet is
	 * still mounted and still animating, which looks exactly like the caller asking for a
	 * close. Without this guard that mistake dismissed an already-dismissing sheet and left
	 * the "caller asked for it" flag standing; the *next* close then went unannounced, the
	 * screen kept believing the sheet was open, and every tap after that wrote the state
	 * value it already held. Open, close, open, close, and the button was dead.
	 */
	useEffect(() => {
		if (!isVisible && isMounted && !hasAnnouncedCloseRef.current) {
			isCallerDrivenCloseRef.current = true;
			sheetRef.current?.dismiss();
		}
	}, [isMounted, isVisible]);

	/**
	 * The caller is told the sheet is closing when the animation *starts*, not when it lands.
	 *
	 * This is what made the opening button look dead. `onDismiss` fires at the end of a
	 * several-hundred-millisecond close, so for all of it the screen still held "this sheet is
	 * open" — and tapping the button in that window set the state to the value it already had,
	 * which React quite correctly treats as nothing happening. The tap vanished, the sheet
	 * finished closing, and only the *second* tap did anything.
	 */
	const handleAnimate = useCallback(
		(_fromIndex: number, toIndex: number) => {
			if (toIndex === -1) {
				// Only a dismissal the *user* performed is news to the caller.
				if (!isCallerDrivenCloseRef.current) {
					hasAnnouncedCloseRef.current = true;
					onClose();
				}

				return;
			}

			// Opening, or moving between detents — the next close is a new one to announce.
			hasAnnouncedCloseRef.current = false;
		},
		[onClose]
	);

	/**
	 * A dismissal always closes. Nothing here decides it "belongs to an earlier close" and
	 * re-presents.
	 *
	 * That guard existed for one narrow race — reopening while a close was still animating —
	 * and it twice produced a sheet that would not stay shut, because the signal it read was
	 * wrong both times. Its worst case is a sheet you cannot get rid of; the worst case
	 * without it is a flash if that race ever lands, and `onAnimate` above has already made
	 * the reopening tap itself work. Fail towards closing.
	 */
	const handleDismiss = useCallback(() => {
		setIsMounted(false);

		/*
		 * Told once, or not at all. Not if the start of the animation already said so, and not
		 * if the caller asked for this close in the first place — the fallback exists only so a
		 * user dismissal is still reported should `onAnimate` never fire.
		 */
		if (!hasAnnouncedCloseRef.current && !isCallerDrivenCloseRef.current) {
			onClose();
		}

		hasAnnouncedCloseRef.current = false;
		isCallerDrivenCloseRef.current = false;
	}, [onClose]);

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				appearsOnIndex={0}
				disappearsOnIndex={-1}
				opacity={0.42}
				pressBehavior='close'
			/>
		),
		[]
	);

	/**
	 * The sheet's surface: iOS 26's own material where the platform has it, and the flat `sheet`
	 * token — the surface every one of these was designed on — on Android and older iOS.
	 * `ui/GlassSurface` owns that decision, along with Reduce Transparency.
	 *
	 * iOS 26 gives a *system* sheet the material for free, and this is not one: it is
	 * `@gorhom/bottom-sheet`, a JS view, and no prop will ever make it a
	 * `UISheetPresentationController`. Handing it a glass background is the closest thing that
	 * doesn't cost the behaviour — every sheet keeps the one grabber, the one spring, the fading
	 * backdrop, drag-to-dismiss, `snapPoints` and `topInset`, all of which exist because ten
	 * hand-rolled modals had drifted apart. A real `pageSheet` would take the material and lose
	 * all of it. What it doesn't get: the system's corner radius as that moves across OS
	 * versions, and the edge insets iOS 26 gives a half-height sheet. `backgroundStyle` still
	 * carries our 26 — gorhom merges it into this component's `style` — so the shape stays ours.
	 */
	const renderBackground = useCallback(
		({ pointerEvents, style }: BottomSheetBackgroundProps) => (
			<GlassSurface fallbackColor={theme.colors.sheet} pointerEvents={pointerEvents} style={style} />
		),
		[theme.colors.sheet]
	);

	if (!isMounted) {
		return null;
	}

	const body = (
		// Only the drawn sheet counts as "inside a sheet" — `AppInput` reads this to swap in
		// gorhom's input, which needs that sheet's context and has none in a presented one.
		<IsInsideSheetProvider value={!swiftUi}>
			{title ? <Header2 style={styles.title}>{title}</Header2> : null}
			{description ? (
				<Typography color={theme.colors.subtext} style={styles.description} variant='caption'>
					{description}
				</Typography>
			) : null}
			{children}
		</IsInsideSheetProvider>
	);

	/*
	 * Any of these means the content runs long, so the platform sheet is out — see the note on
	 * the component. `isMounted` above still gates both paths, so a sheet that has never been
	 * opened costs nothing either way.
	 */

	if (swiftUi && swiftUiModifiers) {
		const { BottomSheet, Host, RNHostView } = swiftUi;
		const { presentationDragIndicator } = swiftUiModifiers;

		return (
			<Host pointerEvents='box-none' style={styles.nativeHost}>
				<BottomSheet
					/*
					 * SwiftUI reads the content's size with a `GeometryReader`; it comes back zero
					 * for a hosted React Native view unless `RNHostView` below is reporting one,
					 * which is the other thing that wrapper buys us. With it the sheet is as tall
					 * as what it holds, and `nativeBody`'s cap keeps that under three quarters.
					 */
					fitToContents
					isPresented={isVisible}
					onIsPresentedChange={(presented: boolean) => {
						if (!presented) {
							onClose();
						}
					}}
					modifiers={[presentationDragIndicator('visible')]}
				>
					{/* `matchContents` so the sheet is as tall as what it holds — see the note on
					    the module for why this wrapper is what makes any of it work at all. */}
					<RNHostView matchContents>
						<View
							style={[
								styles.nativeBody,
								hasNativeFixedHeight ? { height: nativeMaxHeight } : { maxHeight: nativeMaxHeight },
								{ width: windowWidth }
							]}
						>
							{body}
						</View>
					</RNHostView>
				</BottomSheet>
			</Host>
		);
	}

	return (
		<BottomSheetModal
			backdropComponent={renderBackdrop}
			// The colour lives in `renderBackground` above, which decides between the material and
			// the token. Left here it would paint a flat fill over the glass.
			backgroundComponent={renderBackground}
			backgroundStyle={{ borderRadius: 26 }}
			enableContentPanningGesture={!hasScrollableContent}
			enableDynamicSizing={snapPoints === undefined}
			enablePanDownToClose
			handleIndicatorStyle={{ backgroundColor: theme.colors.borderStrong, width: 38, height: 4 }}
			keyboardBehavior='interactive'
			keyboardBlurBehavior='restore'
			{...(maxHeight !== undefined ? { maxDynamicContentSize: maxHeight } : {})}
			onAnimate={handleAnimate}
			onDismiss={handleDismiss}
			/*
			 * `push`, never the default `switch`.
			 *
			 * `switch` *minimises* whatever sheet is already open when a new one presents, and
			 * minimising runs the same close animation to index -1 that a user dismissal does —
			 * which `onAnimate` below cannot tell apart. So opening the member-removal
			 * confirmation from inside the members list announced the list as closed, the screen
			 * tore it down, and the confirmation went with it: two sheets gone from one tap.
			 *
			 * Nothing in this app wants the automatic minimise. Sheets that are alternatives to
			 * each other are mutually exclusive through the screen's own state, and a sheet
			 * opened *on top* of another is a confirmation that should leave it where it is.
			 */
			stackBehavior='push'
			ref={sheetRef}
			{...(snapPoints !== undefined ? { snapPoints } : {})}
			// A detent of `100%` measures the space below the inset, so the two together are
			// what pin the sheet's top edge exactly `topInset` points down the screen.
			{...(topInset !== undefined ? { topInset } : {})}
		>
			{hasFixedHeight ? (
				<View style={[styles.content, styles.fill, { paddingBottom }]}>{body}</View>
			) : (
				<BottomSheetView style={[styles.content, { paddingBottom }]}>{body}</BottomSheetView>
			)}
		</BottomSheetModal>
	);
};

const styles = StyleSheet.create({
	/** The anchor the sheet is presented from — it occupies nothing in the screen's layout. */
	nativeHost: {
		position: 'absolute'
	},
	/** The drawn sheet's padding, applied inside the platform's container. */
	nativeBody: {
		paddingBottom: 28,
		paddingHorizontal: 20,
		paddingTop: 22
	},
	content: {
		paddingHorizontal: 20,
		paddingTop: 4
	},
	/*
	 * The drawn sheet's own padding, applied inside the platform's container — plus the bottom
	 * inset it does not add for us, and the rounded top the system clips to, so our surface meets
	 * its corners rather than showing a square edge inside them.
	 */
	fill: {
		flex: 1
	},
	description: {
		marginBottom: 16,
		marginTop: 6,
		maxWidth: 290
	},
	title: {
		fontSize: 21,
		marginBottom: 4
	}
});
