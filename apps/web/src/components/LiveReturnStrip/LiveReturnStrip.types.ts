import type { LiveSessionState } from '@/lib/hooks/useLiveSession';

export interface LiveReturnStripProps {
	state: LiveSessionState;
	/** Points from the bottom of the scene: above the tab bar, or above the home indicator without one. */
	bottom: number;
	/** Back to the session's reader. */
	onReturn: () => void;
	/** "Tamam" on an ended session — puts it away. */
	onDismiss: () => void;
	/** The strip's height as laid out, for the room the screens leave under their content. */
	onHeightChange: (height: number) => void;
}
