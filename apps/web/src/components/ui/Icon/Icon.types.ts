import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Names match the design system's Icon Set page. Anything drawn as a glyph in the
 * design (arrows, ×, +, −) is an icon here too — no typographic stand-ins.
 */
export type IconName =
	// Tab bar
	| 'tabHome'
	| 'tabGroups'
	| 'tabDiscover'
	| 'tabReminders'
	| 'tabProfile'
	// Actions
	| 'back'
	| 'chevron'
	| 'close'
	| 'check'
	| 'plus'
	| 'minus'
	| 'search'
	| 'searchOff'
	| 'filter'
	| 'sort'
	| 'edit'
	| 'info'
	| 'share'
	| 'settings'
	| 'key'
	| 'undo'
	| 'book'
	// Status
	| 'clock'
	| 'play'
	| 'memberCheck'
	| 'memberFull'
	| 'members'
	| 'lock';

export interface IconProps {
	name: IconName;
	/** Rendered edge length in points. The artwork is drawn on a 24 grid. */
	size?: number;
	color?: string;
	/** 1.6 is the resting weight; the tab bar goes to 2.1 when active. */
	strokeWidth?: number;
	style?: StyleProp<ViewStyle>;
}
