import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Names match the design system's Icon Set page. Anything drawn as a glyph in the
 * design (arrows, ×, +, −) is an icon here too — no typographic stand-ins.
 */
export type IconName =
	/*
	 * Tab bar. Each of the five has a resting and an active glyph — "pasif çizgili, aktif
	 * dolgulu", outlined at rest and filled when selected, which is the Icon Set page's own
	 * rule for this row and the one place it overrides the set's general "no filled variant".
	 */
	| 'tabHome'
	| 'tabHomeActive'
	| 'tabGroups'
	| 'tabGroupsActive'
	| 'tabDiscover'
	| 'tabDiscoverActive'
	| 'tabReminders'
	| 'tabRemindersActive'
	| 'tabProfile'
	| 'tabProfileActive'
	// Actions
	| 'back'
	| 'chevronRight'
	| 'chevronLeft'
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
	| 'copy'
	| 'mail'
	| 'invite'
	| 'leave'
	| 'nudge'
	| 'more'
	| 'refresh'
	| 'textSize'
	// Status
	| 'clock'
	| 'play'
	| 'memberCheck'
	| 'memberFull'
	| 'members'
	| 'lock'
	| 'globe'
	| 'calendar'
	| 'bookmark'
	| 'completed'
	| 'countdown'
	| 'range'
	| 'alert'
	| 'alertCircle'
	| 'offline'
	// Reader and pool
	| 'ayahMark'
	| 'translation'
	| 'pool'
	| 'claim'
	// Theme
	| 'sun'
	| 'moon';

export interface IconProps {
	name: IconName;
	/** Rendered edge length in points. The artwork is drawn on a 24 grid. */
	size?: number;
	color?: string;
	/** 1.6 is the resting weight; the tab bar goes to 2.1 when active. */
	strokeWidth?: number;
	style?: StyleProp<ViewStyle>;
}
