import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { IconName, IconProps } from './Icon.types';

/**
 * The app's whole icon set, traced from the design system's Icon Set page.
 *
 * Every glyph is drawn on the same 24 grid, renders at 21px by default, inherits
 * `currentColor` and carries no fill — activity is expressed by stroke weight, never
 * by a filled variant. Below 14px the strokes close up, so don't scale past that.
 */
const GRID = 24;

/** Circles are `[cx, cy, r]`, rects `[x, y, width, height, rx]`; the rest are path `d`s. */
type Glyph = {
	paths?: string[];
	circles?: [number, number, number][];
	rects?: [number, number, number, number, number][];
};

const GLYPHS: Record<IconName, Glyph> = {
	// Tab bar — the five sit in a fixed order and never change.
	// Home is the brand mark's shelf of cüz, flattened.
	tabHome: { paths: ['M4.5 19.8h15', 'M7 16.6V9.4', 'M11 16.6V5.4', 'M15 16.6V7.6', 'M19 16.6v-5'] },
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

	// The round-reset clock. Traced from the group card and stat panel in the design file,
	// where it is written inline rather than pulled from the Icon Set sheet.
	clock: { circles: [[12, 12, 8.6]], paths: ['M12 7.8V12l3 1.8'] },

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

	// Actions
	back: { paths: ['M14.5 5.5L8 12l6.5 6.5'] },
	chevron: { paths: ['M9.5 5.5L16 12l-6.5 6.5'] },
	close: { paths: ['M6 6l12 12', 'M18 6L6 18'] },
	check: { paths: ['M5 12.6l4.4 4.4L19 7.4'] },
	plus: { paths: ['M12 5.5v13', 'M5.5 12h13'] },
	minus: { paths: ['M5.5 12h13'] },
	search: { circles: [[11, 11, 6.2]], paths: ['M15.6 15.6L20 20'] },
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
	info: { circles: [[12, 12, 8.6]], paths: ['M12 8.2v.2', 'M12 11.4v4.4'] }
};

export const Icon = ({ color, name, size = 21, strokeWidth = 1.8, style }: IconProps) => {
	const { theme } = useThemeContext();
	const glyph = GLYPHS[name];
	const stroke = color ?? theme.colors.text;

	return (
		<Svg fill='none' height={size} style={style} viewBox={`0 0 ${GRID} ${GRID}`} width={size}>
			{glyph.circles?.map(([cx, cy, r]) => (
				<Circle
					cx={cx}
					cy={cy}
					key={`${cx}-${cy}-${r}`}
					r={r}
					stroke={stroke}
					strokeLinecap='round'
					strokeLinejoin='round'
					strokeWidth={strokeWidth}
				/>
			))}
			{glyph.rects?.map(([x, y, width, height, rx]) => (
				<Rect
					height={height}
					key={`${x}-${y}`}
					rx={rx}
					stroke={stroke}
					strokeLinecap='round'
					strokeLinejoin='round'
					strokeWidth={strokeWidth}
					width={width}
					x={x}
					y={y}
				/>
			))}
			{glyph.paths?.map(d => (
				<Path
					d={d}
					key={d}
					stroke={stroke}
					strokeLinecap='round'
					strokeLinejoin='round'
					strokeWidth={strokeWidth}
				/>
			))}
		</Svg>
	);
};
