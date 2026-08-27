import type { ReactNode } from 'react';

export interface AppBottomSheetProps {
	isVisible: boolean;
	/** Fired once the sheet has finished animating away, or when the backdrop is tapped. */
	onClose: () => void;
	title?: string;
	description?: string;
	/**
	 * Fixed detents instead of sizing to the content. Use for sheets whose content is
	 * taller than the screen (a multi-step form), where dynamic sizing has nothing to
	 * measure against.
	 */
	snapPoints?: Array<string | number>;
	/** Caps how far a dynamically-sized sheet may grow. Ignored when `snapPoints` is set. */
	maxHeight?: number;
	/**
	 * Points of screen left uncovered above the sheet at its tallest. The members list is
	 * 52 — a tall sheet that still shows a strip of what it came from, so it reads as a
	 * layer over the screen rather than a screen of its own. Only for sheets whose content
	 * genuinely runs long; everything else sizes to its content and needs neither this nor
	 * `snapPoints`.
	 */
	topInset?: number;
	/** Let the sheet's own scroll view own vertical gestures rather than the sheet. */
	hasScrollableContent?: boolean;
	children: ReactNode;
}
