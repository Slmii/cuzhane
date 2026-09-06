import type { ReactNode } from 'react';

export interface AppBottomSheetProps {
	isVisible: boolean;
	/**
	 * **The reader dismissed it** — a downward drag or a tap on the backdrop. Deliberately not
	 * fired when the caller closed the sheet itself by flipping `isVisible`, because the caller
	 * has already done whatever this would do, and the native close arrives hundreds of
	 * milliseconds later — late enough to land after the *next* sheet has opened and shut it
	 * again. Use it to keep state in step with a dismissal you did not ask for.
	 */
	onClose?: () => void;
	/**
	 * **The sheet has finished animating away**, whoever started it — a drag, the backdrop, or
	 * the caller setting `isVisible` to false.
	 *
	 * This exists because `onClose` alone cannot express "it is gone now". Create-group is a
	 * *route*, and it popped itself from `onClose`; closing it with its own ✕ set `isVisible`
	 * false, which is exactly the case `onClose` suppresses, so the pop never happened and a
	 * `containedTransparentModal` stayed mounted over the app — invisible, and swallowing every
	 * touch. Anything that has to unwind *after* the animation belongs here rather than there.
	 */
	onDismissed?: () => void;
	title?: string;
	description?: string;
	/**
	 * A fixed height, as a fraction of the screen, for a sheet whose content is taller than it
	 * should be allowed to get — a multi-step form, a list of twenty members. `0.75` leaves a
	 * quarter of what you came from showing, which is what keeps a tall sheet reading as a layer
	 * rather than a screen of its own. Omit it and the sheet is as tall as what it holds.
	 *
	 * **A height, deliberately, and not a detent.** Passing `snapPoints` through to the platform
	 * looks like the obvious way to say this and behaves differently on each: iOS honours an
	 * arbitrary `presentationDetents` height, while Android's Material 3 sheet has only two
	 * states — partial at about half, and expanded — so one snap point is also the last one,
	 * resolves to expanded, and a `flex: 1` body fills the screen. 82% on iOS, 100% on Android,
	 * from the same prop. Sizing the *content* instead is the one instruction both platforms
	 * follow, since both size a sheet to what it holds.
	 *
	 * It also closes a trap for good: the sheet's mode never changes, so nothing can toggle
	 * `fitToContents` and remount everything inside — see the note in `AppBottomSheet`.
	 */
	heightRatio?: number;
	children: ReactNode;
}
