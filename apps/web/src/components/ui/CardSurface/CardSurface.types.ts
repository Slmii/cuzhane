import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface CardSurfaceProps {
	children: ReactNode;
	/**
	 * Fills the card with iOS 26's glass instead of the flat `surface` token, falling back to
	 * that token wherever the material isn't available — Android and older iOS. Not Reduce
	 * Transparency: that is the system's business, and `GlassSurface` leaves it to UIKit rather
	 * than swapping in a fill of its own.
	 *
	 * **On by default.** It began as an opt-in on Profile and is now what a section surface
	 * looks like everywhere: Home, Gruplarım, Keşfet, the group and round screens, the lobby,
	 * the invite preview, Hatırlatma. Every one of those is a card sitting on the page with
	 * content behind and beneath it, which is the condition the material needs.
	 *
	 * Pass `false` for the one case where it is wrong rather than merely unnecessary: **a card
	 * with a fill of its own** — `accentSoft` for the assigned panel, `sand` for the pool release
	 * notice. The glass tints itself `surface` and washes over it, so a colour handed in through
	 * `style` is painted out and the card loses the one thing that identified it.
	 *
	 * **Inside a sheet is fine, and three panels use this component there deliberately** — the
	 * share sheet's code and `PlanPreview` in create-group with the glass, `AssignmentBanner` in
	 * the join sheet without it (its sage fill, per the opt-out above). The worry was glass on
	 * glass, since a sheet is already the platform's material; looking at it settled the other
	 * way, because a panel inside a sheet still has to read as a distinct surface from the sheet
	 * it sits on. What sheets should not get is a *sweep* of cards for their own sake.
	 *
	 * Not for the reader's bars, which are not cards: glass was measured there and reverted, and
	 * `BabReaderScreen` records why. Not for controls either — search boxes, chips, option cards
	 * and steppers keep their flat fill.
	 *
	 * A caller must not override `borderRadius` in `style`: the glass layers are drawn at
	 * `theme.radius.lg` and the card clips to whatever `style` says, so a smaller radius slices
	 * the material's corners and the hairline stops short around each curve.
	 */
	hasGlassSurface?: boolean;
	/** Removes the inner padding so rows can run edge-to-edge inside the card. */
	isFlush?: boolean;
	style?: StyleProp<ViewStyle>;
	onLongPress?: () => void;
	onPress?: () => void;
}
