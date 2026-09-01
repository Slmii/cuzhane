import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface ScreenHeaderProps {
	title: string;
	/** Forwarded to `ScreenTitle` — set to 1 when the title is user-supplied. */
	titleLines?: number;
	subtitle?: string;
	/** Small caps line above the title — the pool screen's "ORTAK HAVUZ". */
	eyebrow?: string;
	/** Inline beside the title — the group screen's cycle chip on a daily group. */
	titleTrailing?: ReactNode;
	/** Far right of the heading row — the design's corner action, e.g. Paylaş. */
	action?: ReactNode;
	/**
	 * Reserves the band the navigator's back button floats in, rather than drawing one.
	 *
	 * The control itself belongs to the native header now — the system chevron on iOS, in glass
	 * on 26, and the material arrow on Android — so a screen says only *that it has one*. Set it
	 * wherever the route carries `nativeBackScreenOptions`, and nowhere else: on a screen with no
	 * back button this is just an empty 44pt gap.
	 */
	hasBackButton?: boolean;
	style?: StyleProp<ViewStyle>;
}
