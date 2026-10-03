import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { IconName, IconProps } from './Icon.types';

/**
 * The app's whole icon set, traced from the design system's Icon Set page.
 *
 * Every glyph is drawn on the same 24 grid, renders at 21px by default and inherits
 * `currentColor`. Below 14px the strokes close up, so don't scale past that.
 *
 * **Outlined everywhere, with exactly one exception: the tab bar.** The set's rule is that
 * activity is stroke weight rather than a filled shape, and the Icon Set page overrides it
 * for the five tabs alone — "pasif çizgili, aktif dolgulu". Those carry a second, filled
 * glyph; nothing else does, and nothing else should.
 */
const GRID = 24;

/** The heavier weight the design strokes an active glyph's outline at. */
const ACTIVE_STROKE_WIDTH = 2.1;

/** The design's `fill-opacity` for a `wash`, and `opacity` for a `faint` group. */
const WASH_OPACITY = 0.22;
const FAINT_OPACITY = 0.5;

/** Circles are `[cx, cy, r]`, rects `[x, y, width, height, rx]`; the rest are path `d`s. */
type Shapes = {
	paths?: string[];
	circles?: [number, number, number][];
	rects?: [number, number, number, number, number][];
};

type Glyph = Shapes & {
	/** Painted solid in the icon's colour with no stroke — the tab bar's active variants. */
	filled?: Shapes;
	/**
	 * Stroked at the design's active weight rather than the caller's. The active compass and
	 * bell keep one outlined part apiece, and it has to thicken with the rest or it reads as
	 * a hairline left behind beside the solid.
	 */
	bold?: Shapes;
	/**
	 * Painted in the icon's colour at `WASH_OPACITY`, under the outline. Only the live reading's
	 * glyph has one — the design tints its book while a session runs ("canlıyken dolu").
	 */
	wash?: Shapes;
	/** Stroked like the outline but at `FAINT_OPACITY` — the live glyph's outer, fainter waves. */
	faint?: Shapes;
	/** `faint`'s opacity where the design draws it at another than `FAINT_OPACITY`. */
	faintOpacity?: number;
};

const GLYPHS: Record<IconName, Glyph> = {
	// Tab bar — the five sit in a fixed order and never change.
	/*
	 * Home **is** the brand mark, not a flattening of it. It used to be four columns of its
	 * own invention; it is now the logo's five, and the proof is in the proportions — the
	 * design's heights of 8.4 · 11.6 · 10 · 13.2 · 10.8 normalise to exactly the ratios
	 * `BrandMark` draws at 42 · 58 · 50 · 66 · 54. Same shelf, same silhouette, 24 grid
	 * instead of 100.
	 *
	 * The baseline runs the full 3.4–20.6 rather than the old inset 4.5–19.5, so the mark
	 * fills its box the way the app icon does.
	 */
	tabHome: {
		paths: ['M3.4 20.2h17.2', 'M4.6 17.6V9.2', 'M8.3 17.6V6', 'M12 17.6V7.6', 'M15.7 17.6V4.4', 'M19.4 17.6V6.8']
	},
	// Three prayer beads — the trio reading together.
	tabGroups: {
		circles: [
			[8, 8.6, 2.9],
			[16, 8.6, 2.9],
			[12, 16.4, 2.9]
		]
	},
	// Compass — searching out open groups.
	tabDiscover: { circles: [[12, 12, 8.6]], paths: ['M15.6 8.4l-1.9 5.3-5.3 1.9 1.9-5.3z'] },
	tabReminders: { paths: ['M6.3 17h11.4l-1.7-2.4v-3.7a4 4 0 0 0-8 0v3.7z', 'M10.2 20h3.6'] },
	tabProfile: { circles: [[12, 8.8, 3.4]], paths: ['M5.6 19.4a6.4 6.4 0 0 1 12.8 0'] },

	/*
	 * The selected halves of the five above.
	 *
	 * They are not the resting glyph with a fill dropped in: the design redraws each one so
	 * the solid holds the same optical weight as the outline it replaces. The bars become
	 * rounded rects a touch wider than their strokes, the beads and the head grow by 0.2, and
	 * the two that keep an outlined part thicken it to 2.1 rather than leaving it hairline.
	 */
	tabHomeActive: {
		// The same five columns as solids, each 2.4 wide and centred on its resting stroke.
		filled: {
			rects: [
				[3.4, 9.2, 2.4, 8.4, 1.2],
				[7.1, 6, 2.4, 11.6, 1.2],
				[10.8, 7.6, 2.4, 10, 1.2],
				[14.5, 4.4, 2.4, 13.2, 1.2],
				[18.2, 6.8, 2.4, 10.8, 1.2],
				[3.4, 19.1, 17.2, 2.2, 1.1]
			]
		}
	},
	tabGroupsActive: {
		filled: {
			circles: [
				[8, 8.6, 3.1],
				[16, 8.6, 3.1],
				[12, 16.4, 3.1]
			]
		}
	},
	tabDiscoverActive: {
		bold: { circles: [[12, 12, 8.6]] },
		filled: { paths: ['M15.6 8.4l-1.9 5.3-5.3 1.9 1.9-5.3z'] }
	},
	tabRemindersActive: {
		bold: { paths: ['M10.2 20h3.6'] },
		filled: { paths: ['M6.3 17h11.4l-1.7-2.4v-3.7a4 4 0 0 0-8 0v3.7z'] }
	},
	tabProfileActive: {
		// The shoulders close into a solid — note the `z` the resting arc does not have.
		filled: { circles: [[12, 8.8, 3.6]], paths: ['M5.6 19.4a6.4 6.4 0 0 1 12.8 0z'] }
	},

	// The round-reset clock. Traced from the group card and stat panel in the design file,
	// where it is written inline rather than pulled from the Icon Set sheet.
	clock: { circles: [[12, 12, 8.6]], paths: ['M12 7.8V12l3 1.8'] },

	/*
	 * An open book — B6's "Tüm bablar" card, the door to the free reader.
	 *
	 * Traced from the tracker's own two paths rather than the Icon Set sheet, which does not
	 * carry this glyph yet: two facing pages hinged at the spine, drawn on the same 24 grid
	 * and open at the bottom so it reads as a book rather than a folder.
	 */
	book: {
		paths: [
			'M4 5.4h6.2A1.8 1.8 0 0 1 12 7.2v11.4a1.6 1.6 0 0 0-1.6-1.6H4z',
			'M20 5.4h-6.2A1.8 1.8 0 0 0 12 7.2v11.4a1.6 1.6 0 0 1 1.6-1.6H20z'
		]
	},
	// `uygulamada-oku-read-in-app` — two leaves on a rahle, as the design's Q4 draws it.
	readInApp: {
		paths: [
			'M4 5.5h6.5v13H4z',
			'M13.5 5.5H20v13h-6.5z',
			'M10.5 18.5c-1.6-1-4.9-1-6.5 0M13.5 18.5c1.6-1 4.9-1 6.5 0'
		]
	},
	// `devret-hand-over` — a card with a plus, for passing a cüz on. Drawn, unused since Devret was removed.
	handOver: {
		paths: ['M9 18l-4 2V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v15l-4-2', 'M12 8v6', 'M9 11h6']
	},

	// An arrow curving back on itself — "Geri al" on a pool slot you just took. Traced from
	// the handoff's own two paths rather than mirroring `back`, which is a bare chevron and
	// would read as navigation instead of as taking something back.
	undo: { paths: ['M4 10h10a5 5 0 0 1 0 10h-3', 'M8 6l-4 4 4 4'] },

	// Three connected nodes — one person passing the group to two others.
	share: {
		circles: [
			[17.6, 5.6, 2.6],
			[6.4, 12, 2.6],
			[17.6, 18.4, 2.6]
		],
		paths: ['M15.3 6.9l-6.6 3.8', 'M8.7 13.3l6.6 3.8']
	},

	// The two ways a gathering group starts, from 03c: the creator pressing start, and the
	// group filling up on its own.
	play: { paths: ['M8 5.5l10 6.5-10 6.5z'] },
	memberCheck: {
		circles: [[9, 8.6, 2.8]],
		paths: ['M4 18a5 5 0 0 1 10 0', 'M16.5 12.5l2 2 3-3.4']
	},

	// A range that exists but has nothing to open yet — 03e's "Başlangıçta açılır" pill.
	lock: { paths: ['M8.6 11V8.6a3.4 3.4 0 0 1 6.8 0V11'], rects: [[5.5, 11, 13, 8.5, 2.2]] },
	// "İsimler gizli" — an eye struck through (Hizb Kişisel Plan, Keşfet card 07).
	eyeOff: {
		paths: [
			'M3 3l18 18',
			'M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.4.8-1.3 2-2.5 3.2M6.6 7.6C4.6 8.9 3.2 10.8 2.5 12c1 1.8 4.5 6 9.5 6 1.6 0 3-.4 4.3-1',
			'M9.9 10a3 3 0 0 0 4.1 4.1'
		]
	},

	/*
	 * The rest of the Icon Set page, added wholesale rather than one at a time. An icon set is
	 * a vocabulary: half of it is not much use, and the alternative — reaching for the sheet
	 * again every time a screen wants a glyph — is how the traced set drifted from the design
	 * in the first place. What each is *for* is the design's own note, kept here.
	 */

	// "Kodu kopyala" on the share sheet — two stacked sheets, not a link.
	copy: {
		paths: ['M8 8.5V6.5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2h-2'],
		rects: [[4.5, 8.5, 9, 11, 2]]
	},
	// The reset flow's "check your inbox".
	mail: { paths: ['M4.5 8l7.5 5 7.5-5'], rects: [[3.5, 6, 17, 12, 2.4]] },
	// A member with a plus — inviting rather than counting.
	invite: {
		circles: [[9.5, 8.8, 3.1]],
		paths: ['M3.8 18.6a5.7 5.7 0 0 1 11.4 0', 'M17.5 7.5v5', 'M20 10h-5']
	},
	// A door with an arrow out of it — "Gruptan ayrıl".
	leave: {
		paths: [
			'M14 5.5H7.4a1.9 1.9 0 0 0-1.9 1.9v9.2a1.9 1.9 0 0 0 1.9 1.9H14',
			'M17.2 15.2L20.5 12l-3.3-3.2',
			'M20.5 12h-9.7'
		]
	},
	// Two sparks — the design's "nazik dürtme" to a member who hasn't read.
	nudge: {
		paths: [
			'M11.2 4.8l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z',
			'M17.6 16.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z'
		]
	},
	more: {
		circles: [
			[12, 5.6, 1.5],
			[12, 12, 1.5],
			[12, 18.4, 1.5]
		]
	},
	refresh: { paths: ['M19.4 12a7.4 7.4 0 1 1-2.2-5.2', 'M19.6 4.6v4.2h-4.2'] },
	// R1's "Kitaptan okudum": a printed book, two pages side by side. Traced from the Hizb plan
	// design file.
	bookPages: {
		paths: [
			'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z',
			'M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z'
		]
	},
	// T1d's "Sıfırla": a count wound back — the arrow turns the other way from `refresh`.
	// Traced from the Hizb plan design file.
	reset: { paths: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4v4h4'] },
	// Two A's at different sizes — the reader's size control, where the header sets "Aa" as
	// type because the design does, and a sheet row would use this.
	textSize: {
		paths: ['M3.4 18l4.3-11 4.3 11', 'M4.9 14.4h5.6', 'M14 18l3.3-8 3.3 8', 'M15.2 15.3h4.2']
	},

	// A globe — "Açık grup", against `lock` for "Özel".
	globe: {
		circles: [[12, 12, 8]],
		paths: ['M4 12h16', 'M12 4c2.4 2.3 3.6 5 3.6 8s-1.2 5.7-3.6 8c-2.4-2.3-3.6-5-3.6-8s1.2-5.7 3.6-8z']
	},
	calendar: { paths: ['M4 10h16', 'M8.5 4v3', 'M15.5 4v3'], rects: [[4, 6, 16, 14, 2.4]] },
	bookmark: { paths: ['M7 4.5h10v15l-5-3.8-5 3.8z'] },
	// A tick inside a ring — a hatim finished, distinct from `check`'s bare mark.
	completed: { circles: [[12, 12, 8]], paths: ['M8.4 12.3l2.6 2.6 4.6-5.4'] },
	// A clock with a winder — the round about to roll, where `clock` is the round itself.
	countdown: { circles: [[12, 13.2, 7.2]], paths: ['M12 9.6v3.6l2.4 1.5', 'M9.4 3.4h5.2'] },
	// A block cut into three — a member's range of babs.
	range: {
		paths: ['M4.5 8.5v8a1.6 1.6 0 0 0 1.6 1.6h11.8a1.6 1.6 0 0 0 1.6-1.6v-8', 'M9.2 18.1V8.5', 'M14.8 18.1V8.5']
	},
	alert: { paths: ['M12 4.8L3.6 19.2h16.8z', 'M12 10v3.6', 'M12 16.4v.2'] },
	/*
	 * The icon export's `bildirim-notification`, path for path — dome, clapper, stem.
	 *
	 * The export ships it as `-filled`, with a solid r2.2 circle at (17.6, 6.4): the unread dot,
	 * baked into the glyph. It is dropped here, as frame P1 drops it, because the count belongs
	 * on the **tab** now — the bell tab carries the platform's own badge — and because a custom
	 * SF Symbol cannot hold a filled shape anyway, so the drawn glyph and the symbol built from
	 * this same file stay identical.
	 *
	 * Not `tabReminders`, which is the same object drawn differently — two paths, slightly
	 * smaller, no stem. That one is what the bell *tab* draws.
	 */
	bell: { paths: ['M6 17h12l-1.8-2.5V10.6a4.2 4.2 0 0 0-8.4 0v3.9z', 'M10 20h4', 'M12 4v2'] },
	// Frame 2a's mark, traced: the exclamation in a ring, not the triangle above and not
	// `info` (which is the same three shapes the other way up).
	alertCircle: { circles: [[12, 12, 8.4]], paths: ['M12 7.6v5', 'M12 15.7v.2'] },
	offline: {
		paths: [
			'M4 4l16 16',
			'M5.2 9.4a11 11 0 0 1 3.4-2',
			'M18.8 9.4a11 11 0 0 0-6.5-2.6',
			'M8 12.8a6.6 6.6 0 0 1 2-1.3',
			'M16 12.8a6.6 6.6 0 0 0-2.4-1.4',
			'M12 17.6v.2'
		]
	},

	/*
	 * The verse rosette as an *icon*, for a list row or a legend. `ui/Ornament` stays the
	 * drawn mark that opens a bab — it carries a numeral on a real baseline and is a different
	 * job from a 21px glyph inheriting `currentColor`.
	 */
	ayahMark: {
		circles: [
			[12, 12, 6.1],
			[17.4, 12, 2.6],
			[16.1, 8.7, 2.6],
			[12, 7.4, 2.6],
			[7.9, 8.7, 2.6],
			[6.6, 12, 2.6],
			[7.9, 15.3, 2.6],
			[12, 16.6, 2.6],
			[16.1, 15.3, 2.6]
		]
	},
	// An alif beside a Latin A — the meal, one script explained in another.
	translation: {
		paths: [
			'M4.5 6.5h7',
			'M8 4.6v1.9',
			'M10.2 6.5c0 3.6-2.4 6.4-5.7 7.6',
			'M6.1 9.8c1.2 2.2 3 3.6 5.4 4.3',
			'M12.6 19.4l3.4-8 3.4 8',
			'M13.9 16.6h4.2'
		]
	},
	// A drop — the shared pool.
	pool: {
		paths: ['M12 3.8s5.4 5 5.4 8.7a5.4 5.4 0 0 1-10.8 0C6.6 8.8 12 3.8 12 3.8z', 'M9.3 13.4a2.7 2.7 0 0 0 2.7 2.7']
	},
	// An open hand — "Üstlen", taking a block on.
	claim: {
		paths: [
			'M8.4 11.6V5.9a1.6 1.6 0 0 1 3.2 0v4.9',
			'M11.6 10.4V8.6a1.6 1.6 0 0 1 3.2 0v2.2',
			'M14.8 10.9V9.6a1.6 1.6 0 0 1 3.2 0v5.1a5.4 5.4 0 0 1-5.4 5.4h-1.3a5.4 5.4 0 0 1-4.6-2.6l-2-3.3a1.6 1.6 0 0 1 2.6-1.9l1.5 1.9'
		]
	},

	/*
	 * **The inbox's own vocabulary** — the icon set's "Bildirim türleri" section, traced path for
	 * path. Every kind used to borrow: a range for a finished share, the hatim-complete mark for
	 * a closed round, a member tick for somebody joining. They were all legible on their own and
	 * read as six unrelated marks in a column, because each had been drawn to mean something else
	 * somewhere else.
	 *
	 * The two person glyphs are deliberately one stroke apart — a plus and a minus on the same
	 * figure — since joining and leaving are the same event in opposite directions.
	 */
	memberJoined: {
		circles: [[10, 8.6, 3.2]],
		paths: ['M4 19.2a6 6 0 0 1 12 0', 'M18.4 6.4v5', 'M15.9 8.9h5']
	},
	memberLeft: {
		circles: [[10, 8.6, 3.2]],
		paths: ['M4 19.2a6 6 0 0 1 12 0', 'M15.9 8.9h5']
	},
	// A block of babs with a tick inside it — the share, finished.
	shareRead: {
		paths: [
			'M4.5 8.5v8a1.6 1.6 0 0 0 1.6 1.6h11.8a1.6 1.6 0 0 0 1.6-1.6v-8',
			'M9.2 8.5v2.4',
			'M14.8 8.5v2.4',
			'M8.6 14.2l2.3 2.3 4.6-4.8'
		]
	},
	/*
	 * Not `completed`, which is the hatim mark. This is the *round* closing — the ring with its
	 * four rays, which is the one moment in the app that is purely good news.
	 */
	roundComplete: {
		circles: [[12, 12, 8.6]],
		paths: ['M8.2 12.3l2.5 2.5 5.2-5.4', 'M12 3.4v-1', 'M12 21.6v-1', 'M3.4 12h-1', 'M21.6 12h-1']
	},
	// Lifted *out* of the pool: the water, and an arrow leaving it.
	poolTaken: {
		paths: [
			'M4 16.4c1.6 1.2 3.2 1.2 4.8 0s3.2-1.2 4.8 0 3.2 1.2 4.8 0',
			'M4 20c1.6 1.2 3.2 1.2 4.8 0s3.2-1.2 4.8 0 3.2 1.2 4.8 0',
			'M12 12.8V4.2',
			'M8.6 7.6L12 4.2l3.4 3.4'
		]
	},
	// Handed on: an arrow into the seat that has just been filled.
	claimReleased: {
		paths: ['M3.5 12.5h7', 'M8 10l2.5 2.5L8 15', 'M16.75 8v9'],
		rects: [[13, 8, 7.5, 9, 1.6]]
	},
	// A block with nobody's mark on it, and a warning above — babs still unclaimed near the
	// boundary. **Nothing raises this yet**; it is here because the set defines it (P2).
	unclaimed: {
		paths: [
			'M4.5 8.5v8a1.6 1.6 0 0 0 1.6 1.6h11.8a1.6 1.6 0 0 0 1.6-1.6v-8',
			'M9.2 18.1V8.5',
			'M14.8 18.1V8.5',
			'M12 2.4v3.4',
			'M12 7.2v.2'
		]
	},

	sun: {
		circles: [[12, 12, 4.1]],
		paths: [
			'M12 3.6v2.1',
			'M12 18.3v2.1',
			'M3.6 12h2.1',
			'M18.3 12h2.1',
			'M6.1 6.1l1.5 1.5',
			'M16.4 16.4l1.5 1.5',
			'M17.9 6.1l-1.5 1.5',
			'M7.6 16.4l-1.5 1.5'
		]
	},
	moon: { paths: ['M17.6 15.2A7.2 7.2 0 0 1 8.8 6.4a7.6 7.6 0 1 0 8.8 8.8z'] },

	// A member with a dash where the next one would go — 03f's "no room left".
	memberFull: {
		circles: [[9, 8.6, 2.9]],
		paths: ['M3.6 18.4a5.4 5.4 0 0 1 10.8 0', 'M16.4 10.2h5']
	},

	// "Üyeler · Members" — traced from the Icon Set sheet, which now ships this glyph.
	members: {
		circles: [
			[9.2, 9.4, 3],
			[16.8, 8.2, 2.2]
		],
		paths: ['M3.6 18.4a5.6 5.6 0 0 1 11.2 0', 'M16.8 12.6a4.4 4.4 0 0 1 3.6 1.9']
	},
	/*
	 * "Birlikte oku · Live session" — traced from the Icon Set sheet: an open book with a signal
	 * over it. The dot is the sheet's solid r1.5 — a stroked ring that small left a pinhole on
	 * Android. Its SF Symbol (`birlikte-oku-live-session`) has the ring instead, since the
	 * converter takes centreline strokes only.
	 */
	liveSession: {
		filled: { circles: [[12, 5.4, 1.5]] },
		paths: [
			'M12 11.6c-2.4-1.4-5.4-1.8-8.4-1.4v8.4c3-.4 6 0 8.4 1.4 2.4-1.4 5.4-1.8 8.4-1.4v-8.4c-3-.4-6 0-8.4 1.4z',
			'M12 11.6V20',
			'M9.2 3.2a3.4 3.4 0 0 0 0 4.4',
			'M14.8 3.2a3.4 3.4 0 0 1 0 4.4'
		]
	},
	/*
	 * "Göster"'s first-session hint (Birlikte oku v2, R3): a dot inside a faint ring — the line the
	 * reader points at. Drawn inline in the design rather than taken from the Icon Set sheet.
	 */
	pointLine: { faint: { circles: [[12, 12, 7.5]] }, faintOpacity: 0.45, filled: { circles: [[12, 12, 2.8]] } },
	// "Takip et" while detached: which way the reader's line went (Birlikte oku v2, R2).
	arrowDown: { paths: ['M12 5v14', 'M6 13l6 6 6-6'] },
	arrowUp: { paths: ['M12 19V5', 'M6 11l6-6 6 6'] },
	/*
	 * The same button while a live reading runs — the sheet's "canlıyken dolu": the book tinted,
	 * the dot grown to r1.9 and a second, fainter pair of waves outside the first. Its SF Symbol
	 * (`birlikte-oku-live-session-live`) is monochrome: the native image takes no rendering mode,
	 * so it has no tint and draws the outer waves at full strength.
	 */
	liveSessionLive: {
		wash: {
			paths: [
				'M12 11.6c-2.4-1.4-5.4-1.8-8.4-1.4v8.4c3-.4 6 0 8.4 1.4 2.4-1.4 5.4-1.8 8.4-1.4v-8.4c-3-.4-6 0-8.4 1.4z'
			]
		},
		filled: { circles: [[12, 5.4, 1.9]] },
		paths: [
			'M12 11.6c-2.4-1.4-5.4-1.8-8.4-1.4v8.4c3-.4 6 0 8.4 1.4 2.4-1.4 5.4-1.8 8.4-1.4v-8.4c-3-.4-6 0-8.4 1.4z',
			'M12 11.6V20',
			'M9.2 3.2a3.4 3.4 0 0 0 0 4.4',
			'M14.8 3.2a3.4 3.4 0 0 1 0 4.4'
		],
		faint: { paths: ['M7 1.6a6 6 0 0 0 0 7.6', 'M17 1.6a6 6 0 0 1 0 7.6'] }
	},
	/*
	 * The return-to-reading strip's lead while the session runs: `liveSession` with its book washed
	 * (the design's fill .22), and none of `liveSessionLive`'s outer waves. Ended, the strip draws
	 * the plain `liveSession` — the design's fill 0.
	 */
	liveSessionTinted: {
		wash: {
			paths: [
				'M12 11.6c-2.4-1.4-5.4-1.8-8.4-1.4v8.4c3-.4 6 0 8.4 1.4 2.4-1.4 5.4-1.8 8.4-1.4v-8.4c-3-.4-6 0-8.4 1.4z'
			]
		},
		filled: { circles: [[12, 5.4, 1.5]] },
		paths: [
			'M12 11.6c-2.4-1.4-5.4-1.8-8.4-1.4v8.4c3-.4 6 0 8.4 1.4 2.4-1.4 5.4-1.8 8.4-1.4v-8.4c-3-.4-6 0-8.4 1.4z',
			'M12 11.6V20',
			'M9.2 3.2a3.4 3.4 0 0 0 0 4.4',
			'M14.8 3.2a3.4 3.4 0 0 1 0 4.4'
		]
	},

	// Actions
	back: { paths: ['M14.5 5.5L8 12l6.5 6.5'] },
	chevronRight: { paths: ['M9.5 5.5L16 12l-6.5 6.5'] },
	chevronLeft: { paths: ['M14.5 5.5L8 12l6.5 6.5'] },
	close: { paths: ['M6 6l12 12', 'M18 6L6 18'] },
	/** `sil-delete` — a lid over a tapering body with two staves. */
	delete: {
		paths: [
			'M4.5 7h15',
			'M6.4 7l.9 11.1a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7L17.6 7',
			'M9.6 7V5.4a1.4 1.4 0 0 1 1.4-1.4h2a1.4 1.4 0 0 1 1.4 1.4V7',
			'M10.4 10.8v5.6',
			'M13.6 10.8v5.6'
		]
	},
	check: { paths: ['M5 12.6l4.4 4.4L19 7.4'] },
	plus: { paths: ['M12 5.5v13', 'M5.5 12h13'] },
	minus: { paths: ['M5.5 12h13'] },
	search: { circles: [[11, 11, 6.2]], paths: ['M15.6 15.6L20 20'] },
	// `git-go-to` — three lines of text and a small lens: Q5's "Git", a place in the mushaf.
	goTo: { circles: [[17, 13, 3.2]], paths: ['M4 6h10', 'M4 12h7', 'M4 18h10', 'M19.4 15.4L21 17'] },
	// The magnifier with a cross in its lens — "Grup bulunamadı". Not `search` plus a
	// separate ×: the cross belongs inside the glass, which is what makes it read as
	// "looked and found nothing" rather than "dismiss this search".
	searchOff: {
		circles: [[11, 11, 6.4]],
		paths: ['M15.8 15.8L20 20', 'M8.8 8.8l4.4 4.4', 'M13.2 8.8l-4.4 4.4']
	},
	filter: { paths: ['M4.5 7.5h15', 'M7 12h10', 'M10 16.5h4'] },
	// Two arrows facing opposite ways — ordering, beside `filter`'s narrowing rules.
	sort: { paths: ['M7.5 5v14', 'M4.5 16l3 3 3-3', 'M16.5 19V5', 'M13.5 8l3-3 3 3'] },
	edit: { paths: ['M4.5 19l4.2-1.1 9.1-9.1a2 2 0 0 0 0-2.8l-.8-.8a2 2 0 0 0-2.8 0l-9.1 9.1z'] },

	// Three rules with a handle on each — group settings, beside Paylaş in the 07 header.
	// Distinct from `filter`'s tapering rules: this one is something you adjust, not narrow.
	settings: {
		circles: [
			[9.2, 6.6, 2.1],
			[15.2, 12, 2.1],
			[9.2, 17.4, 2.1]
		],
		paths: ['M4.6 6.6h14.8', 'M4.6 12h14.8', 'M4.6 17.4h14.8']
	},

	// "Davet kodum var" — the key beside the + on Gruplarım. An invitation is now a code
	// you're handed rather than a link you follow, and a key is what that looks like.
	key: {
		circles: [[8.4, 15.4, 3.5]],
		paths: ['M10.9 12.9l7.6-7.6', 'M15.4 8.4l2.1 2.1', 'M17.6 6.2l2.1 2.1']
	},
	// The dot is a zero-length stroke rather than a filled circle — the set carries no fill.
	info: { circles: [[12, 12, 8.6]], paths: ['M12 8.2v.2', 'M12 11.4v4.4'] },

	/*
	 * Live voice (Birlikte Oku Ses, lane I). "Açık olmayı dolgu anlatır, duraklamayı iki çizgi":
	 * on is the shape washed, paused is the shape with two bars beside it — the paused microphone
	 * moved 2.6 left to make room for them.
	 */
	mic: { paths: ['M5.6 11.6a6.4 6.4 0 0 0 12.8 0', 'M12 18v2.8'], rects: [[8.6, 3.4, 6.8, 11, 3.4]] },
	micOn: {
		wash: { rects: [[8.6, 3.4, 6.8, 11, 3.4]] },
		paths: ['M5.6 11.6a6.4 6.4 0 0 0 12.8 0', 'M12 18v2.8'],
		rects: [[8.6, 3.4, 6.8, 11, 3.4]]
	},
	micPaused: {
		paths: ['M3 11.6a6.4 6.4 0 0 0 12.8 0', 'M9.4 18v2.8', 'M18.8 8.4v5.4', 'M21.6 8.4v5.4'],
		rects: [[6, 3.4, 6.8, 11, 3.4]]
	},
	micOff: {
		paths: ['M5.6 11.6a6.4 6.4 0 0 0 12.8 0', 'M12 18v2.8', 'M4.4 4.4l15.2 15.2'],
		rects: [[8.6, 3.4, 6.8, 11, 3.4]]
	},
	speaker: { paths: ['M4.4 9.6h3.2l4.4-3.8v12.4l-4.4-3.8H4.4z', 'M15.4 9.4a3.8 3.8 0 0 1 0 5.2'] },
	speakerOn: {
		wash: { paths: ['M4.4 9.6h3.2l4.4-3.8v12.4l-4.4-3.8H4.4z'] },
		paths: [
			'M4.4 9.6h3.2l4.4-3.8v12.4l-4.4-3.8H4.4z',
			'M15.4 9.4a3.8 3.8 0 0 1 0 5.2',
			'M18.2 6.8a7.6 7.6 0 0 1 0 10.4'
		]
	},
	speakerPaused: { paths: ['M4.4 9.6h3.2l4.4-3.8v12.4l-4.4-3.8H4.4z', 'M16.6 9.4v5.2', 'M19.8 9.4v5.2'] },
	// Solid, as the design draws it on the button and the lock screen ("dolu").
	stop: { filled: { rects: [[6.6, 6.6, 10.8, 10.8, 2.2]] } }
};

/**
 * One group of shapes, either stroked at a given weight or painted solid.
 *
 * Keyed on geometry rather than an index so a glyph that gains a shape doesn't remount the
 * ones beside it — and `fill`/`stroke` are set per shape rather than on the `<Svg>`, because
 * a filled glyph and an outlined one can share a single icon.
 */
const renderShapes = (
	shapes: Shapes | undefined,
	paint: { fill?: string; opacity?: number; stroke?: string; strokeWidth?: number }
) => {
	if (!shapes) {
		return null;
	}

	const common = {
		fill: paint.fill ?? 'none',
		opacity: paint.opacity ?? 1,
		strokeLinecap: 'round',
		strokeLinejoin: 'round'
	} as const;

	return (
		<>
			{shapes.circles?.map(([cx, cy, r]) => (
				<Circle
					{...common}
					cx={cx}
					cy={cy}
					key={`c-${cx}-${cy}-${r}`}
					r={r}
					{...(paint.stroke ? { stroke: paint.stroke, strokeWidth: paint.strokeWidth } : {})}
				/>
			))}
			{shapes.rects?.map(([x, y, width, height, rx]) => (
				<Rect
					{...common}
					height={height}
					key={`r-${x}-${y}-${width}`}
					rx={rx}
					width={width}
					x={x}
					y={y}
					{...(paint.stroke ? { stroke: paint.stroke, strokeWidth: paint.strokeWidth } : {})}
				/>
			))}
			{shapes.paths?.map(d => (
				<Path
					{...common}
					d={d}
					key={`p-${d}`}
					{...(paint.stroke ? { stroke: paint.stroke, strokeWidth: paint.strokeWidth } : {})}
				/>
			))}
		</>
	);
};

export const Icon = ({ color, name, size = 21, strokeWidth = 1.8, style }: IconProps) => {
	const { theme } = useThemeContext();
	const glyph = GLYPHS[name];
	const ink = color ?? theme.colors.text;

	return (
		<Svg fill='none' height={size} style={style} viewBox={`0 0 ${GRID} ${GRID}`} width={size}>
			{/* First, so the outline it tints is drawn over it. */}
			{renderShapes(glyph.wash, { fill: ink, opacity: WASH_OPACITY })}
			{renderShapes(glyph, { stroke: ink, strokeWidth })}
			{renderShapes(glyph.bold, { stroke: ink, strokeWidth: ACTIVE_STROKE_WIDTH })}
			{renderShapes(glyph.faint, { opacity: glyph.faintOpacity ?? FAINT_OPACITY, stroke: ink, strokeWidth })}
			{/* Last, so a solid sits over the outline it shares an icon with. */}
			{renderShapes(glyph.filled, { fill: ink })}
		</Svg>
	);
};
