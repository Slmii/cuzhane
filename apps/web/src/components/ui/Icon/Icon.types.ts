import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Names match the design system's Icon Set page. Anything drawn as a glyph in the
 * design (arrows, ×, +, −) is an icon here too — no typographic stand-ins.
 */
export type IconName =
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
	| 'back'
	| 'chevronRight'
	| 'chevronLeft'
	| 'close'
	| 'check'
	| 'delete'
	| 'plus'
	| 'minus'
	| 'search'
	| 'searchOff'
	| 'goTo'
	| 'filter'
	| 'sort'
	| 'edit'
	| 'info'
	| 'share'
	| 'settings'
	| 'key'
	| 'undo'
	| 'book'
	/** Q4's "Uygulamada oku" and the frame's "Devret" — the set's open book and its hand-over card. */
	| 'readInApp'
	| 'handOver'
	| 'copy'
	| 'mail'
	| 'invite'
	| 'leave'
	| 'nudge'
	| 'more'
	| 'refresh'
	| 'reset'
	| 'bookPages'
	| 'textSize'
	| 'clock'
	| 'play'
	| 'memberCheck'
	| 'memberFull'
	| 'members'
	| 'lock'
	| 'eyeOff'
	| 'globe'
	| 'calendar'
	| 'bookmark'
	| 'completed'
	| 'countdown'
	| 'range'
	| 'alert'
	| 'alertCircle'
	| 'bell'
	| 'offline'
	| 'ayahMark'
	| 'translation'
	| 'pool'
	| 'claim'
	/*
	 * The inbox's own glyphs, from the icon set's "Bildirim türleri" section (design P2). Each
	 * kind had been borrowing an icon meant for something else — a range, a completed hatim, a
	 * member tick — which read as a list of unrelated marks rather than a vocabulary.
	 */
	| 'memberJoined'
	| 'memberLeft'
	| 'shareRead'
	| 'roundComplete'
	| 'poolTaken'
	| 'claimReleased'
	| 'unclaimed'
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
