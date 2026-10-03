import { useLiveSessionState } from '@/lib/hooks/useLiveSession';
import { liveSession } from '@/lib/live/liveSession';
import { useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { LiveReturnStrip } from './LiveReturnStrip.component';
import { hasLiveStrip } from './liveReturnStrip';
import { isStripNativeAccessory, liveReturnSlot } from './liveReturnSlot';

/**
 * **The return strip as a card, drawn once above every tab** — Android's and older iOS's
 * equivalent of iOS 26's tab-bar accessory, which Android has no slot for. Drawn inside each tab,
 * it went with the old tab and came back with the new one on every switch; drawn here, above the
 * navigator, it stays still while the screens change under it, like the bar it sits on.
 *
 * Where it goes is the focused tab's call (`liveReturnSlot.bottom`, measured from the window's
 * bottom edge); this only turns that into its own frame. Hidden under the keyboard. Passes every
 * touch it does not use through to the screens beneath.
 */
export const LiveReturnStripOverlay = () => {
	const session = useLiveSessionState();
	const slot = useSyncExternalStore(liveReturnSlot.subscribe, liveReturnSlot.get);
	const isKeyboardVisible = useKeyboardState(state => state.isVisible);
	const { height: windowHeight } = useWindowDimensions();
	const frameRef = useRef<View>(null);
	// How far this overlay's own bottom edge is above the window's, to place the card in it.
	const [frameGap, setFrameGap] = useState(0);

	const isShown = !isStripNativeAccessory && hasLiveStrip(session) && slot.isDue && !isKeyboardVisible;

	return (
		<View
			collapsable={false}
			onLayout={() =>
				frameRef.current?.measureInWindow((_x, y, _width, height) =>
					setFrameGap(Math.max(0, windowHeight - (y + height)))
				)
			}
			pointerEvents='box-none'
			ref={frameRef}
			style={StyleSheet.absoluteFill}
		>
			{isShown && session ? (
				<LiveReturnStrip
					bottom={Math.max(0, slot.bottom - frameGap)}
					onDismiss={liveSession.leave}
					onHeightChange={stripHeight => liveReturnSlot.set({ stripHeight })}
					onReturn={slot.onReturn}
					state={session}
				/>
			) : null}
		</View>
	);
};
