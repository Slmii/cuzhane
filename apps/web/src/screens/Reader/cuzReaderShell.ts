import { SECDE_ORNAMENT_OVERHANG } from '@/screens/Reader/SecdeOrnament.component';
import { StyleSheet } from 'react-native';
import { cubicBezier } from 'react-native-reanimated';

/*
 * The Kur'an reader's shell — its metrics, its cüz-crossing motion and its styles — shared by the
 * grouped reader (`CuzReaderScreen`) and the free Mushaf (`MushafScreen`), which read the same
 * pages in the same shell and must not drift apart.
 *
 * **A plain module, not the screen's file.** Exported from `CuzReaderScreen.component.tsx`, these
 * made it a file that exports more than components, which Fast Refresh cannot patch in place —
 * every edit to the reader reloaded the whole app.
 */

export type CuzTurn = 'next' | 'previous';

/**
 * Crossing into another cüz slides the new one in **from the side of the arrow** — from the
 * right for ›, the left for ‹ — with a short fade. CSS keyframes on a view keyed by the cüz,
 * as `MenuAction`'s levels do, rather than `entering`: see that component for why.
 */
export const CUZ_TURN_EASING = cubicBezier(0.2, 0.9, 0.3, 1);
const CUZ_TURN_OFFSET = 28;
/** How long a page-strip segment takes to ease into its new colour. */
export const SEGMENT_TRANSITION_MS = 240;
/**
 * Room above a Hüsrev page, and it is the sajdah mark's: the mark hangs 22 over the paper's top
 * edge, and at 16 its top slid under the header.
 */
export const IMAGE_BODY_TOP = SECDE_ORNAMENT_OVERHANG + 4;
export const IMAGE_BODY_SIDE = 12;
/** `body`'s foot, which is where the paper ends once the page is scrolled to the bottom. */
export const BODY_BOTTOM = 26;
/** Where the sajdah mark's tap leaves the verse's green: this far below the header. */
export const SECDE_SCROLL_MARGIN = 32;

export const cuzTurnStyle = (direction: CuzTurn) => {
	const keyframes = {
		'0%': { opacity: 0, transform: [{ translateX: direction === 'next' ? CUZ_TURN_OFFSET : -CUZ_TURN_OFFSET }] },
		'100%': { opacity: 1, transform: [{ translateX: 0 }] }
	};

	return {
		...keyframes['0%'],
		animationDuration: 260,
		animationFillMode: 'both' as const,
		animationName: keyframes,
		animationTimingFunction: CUZ_TURN_EASING
	};
};

/** The shell's styles — the same header, page and sajdah track in both readers. */
export const cuzReaderStyles = StyleSheet.create({
	body: {
		paddingBottom: BODY_BOTTOM,
		paddingHorizontal: 22,
		paddingTop: 26
	},
	footer: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 9,
		paddingBottom: 12,
		paddingHorizontal: 20,
		paddingTop: 12
	},
	// The Cevşen reader's slot for Okudum: it takes the room between the arrows, which keep
	// their own width — set to stretch, it pushed both of them off the edge of the screen.
	markButtonSlot: {
		flex: 1,
		minWidth: 0
	},
	header: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		gap: 10,
		overflow: 'hidden',
		paddingBottom: 12,
		paddingHorizontal: 20,
		paddingTop: 8
	},
	headerBottomRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	// Natural width, never shrunk: the two side slots split what is left, which is what
	// centres it. Stretched to `flex: 1` between two equal sides it had a third of the row
	// and "20. Cüz · Sayfa 1 / 20" wrapped.
	headerCenter: {
		alignItems: 'center',
		flexShrink: 0
	},
	headerSide: {
		alignItems: 'flex-start',
		flex: 1
	},
	headerSideEnd: {
		alignItems: 'flex-end'
	},
	// A page image carries its own margins, so it takes more of the width than the typeset text.
	imageBody: {
		paddingHorizontal: IMAGE_BODY_SIDE,
		paddingTop: IMAGE_BODY_TOP
	},
	// The paper's width and its unscrolled top, so the mark's corner offsets are the paper's.
	secdeTrack: {
		left: IMAGE_BODY_SIDE,
		position: 'absolute',
		right: IMAGE_BODY_SIDE
	},
	headerTopRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		// Shares its band with the navigator's back button — see `BabReaderScreen`.
		minHeight: 44
	},
	page: {
		flexGrow: 1
	},
	// The scroll view and the sajdah mark fixed over it, so the mark's offsets start under the inset.
	viewport: {
		flex: 1
	},
	safeArea: {
		flex: 1
	},
	segment: {
		borderRadius: 2,
		flex: 1,
		height: 5
	},
	strip: {
		flexDirection: 'row',
		gap: 2
	},
	suraTitle: {
		flexShrink: 1
	}
});
