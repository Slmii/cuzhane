/**
 * What someone *chose* in Görünüm. `'system'` is a preference, not an appearance — it says
 * "whatever the phone is doing", and has to be resolved before anything can be drawn from it.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** What that preference currently comes out as. Every colour in the app is picked with this. */
export type ResolvedThemeMode = 'light' | 'dark';

export type Spacing = {
	xs: number;
	sm: number;
	md: number;
	lg: number;
	xl: number;
};

export type Radius = {
	sm: number;
	md: number;
	lg: number;
	xl: number;
};

export type AppTheme = {
	mode: ThemeMode;
	colors: {
		background: string;
		surface: string;
		/**
		 * Laid **over** a glass surface to pull it back towards `surface`.
		 *
		 * `UIGlassEffect.tintColor` blends rather than replaces, so tinting a card with an
		 * opaque white still leaves it sampling the cream page beneath and coming out beige.
		 * This is the second half: enough of the card's real colour on top to read as white,
		 * little enough that the material still shows through. Only `ui/CardSurface` uses it.
		 */
		surfaceGlassWash: string;
		surfaceMuted: string;
		card: string;
		/** Bottom sheets sit one step off the page background in dark mode. */
		sheet: string;
		/**
		 * The well a segmented control sits in. Distinct from `surfaceMuted`, which is the
		 * same colour as `surface` in dark mode — fine for a tag on the page, invisible for
		 * a control that has to show its own bounds on a card.
		 */
		segmentTrack: string;
		/** Selected pill inside a segmented control — must lift off `segmentTrack`. */
		segmentActive: string;
		/** The brand mark's trailing "not yet read" columns. */
		markFaded: string;
		/** The design's `.stripe` diagonal hatch — marks a bab as belonging to nobody. */
		hatch: string;
		/** Baseline of the empty-state shelf illustration. */
		shelfBase: string;
		inputBackground: string;
		primary: string;
		secondary: string;
		accent: string;
		accentStrong: string;
		accentSoft: string;
		accentMuted: string;
		accentMid: string;
		accentText: string;
		/** Hairline for a ghost accent chip — the "Kurucu" tag, which has no fill. */
		accentOutline: string;
		sand: string;
		sandText: string;
		/** Ana sayfa's "2 sa 30 dk kaldı" — how long the next reading has left, warmer than `sand`. */
		deadline: string;
		deadlineText: string;
		text: string;
		subtext: string;
		faintText: string;
		border: string;
		borderStrong: string;
		divider: string;
		track: string;
		/** A thin progress bar's empty part inside a muted panel — a shade under `track`. */
		progressTrack: string;
		/** A day's bar that fell short of the whole — the Hizb plan's thirty-day chart. */
		barPartial: string;
		danger: string;
		dangerSurface: string;
		/**
		 * The round history's clay — a bab nobody read. Distinct from `danger`: nothing has
		 * gone wrong, a share simply went uncovered, so it reads softer than an error.
		 */
		missed: string;
		missedSurface: string;
		success: string;
		onPrimary: string;
		onAccent: string;
		onDanger: string;
		/**
		 * The QR's own palette, from the design's QR Generator: dark modules on a light plate in
		 * both modes (a scanner does not read light modules on dark reliably), the plate a shade
		 * warmer in dark mode, and the finder eyes and emblem in the sage that stays the deep
		 * `#3E6B5C` in both — the dark theme's lighter accent would wash out on the plate.
		 */
		codePaper: string;
		codeInk: string;
		codeAccent: string;
		/**
		 * H1's coloured top layer and what is written on it. Not `accent`/`onAccent`: dark mode's
		 * accent is a *light* sage meant for marks on a dark page, and a screenful of it would be
		 * a lamp. The design gives the layer its own deep green there instead.
		 */
		headerSurface: string;
		onHeaderSurface: string;
		/**
		 * The one number written in clay on that deep green — "Senin ilerlemen"'s missed count.
		 *
		 * **Fixed in both modes, like `onHeaderSurface` beside it and `codeAccent` above.** The
		 * layer is deep green either way, so what sits on it cannot follow the page: `missed`
		 * is `#A65D5D` in light mode, which on `#3E6B5C` is two dark colours arguing rather
		 * than a number standing out.
		 */
		onHeaderSurfaceMissed: string;
		/**
		 * Q7's full ring on the deep green — the design's `#8FB8A6`, fixed in both modes for the
		 * same reason as the two above: the layer under it does not change with the theme.
		 */
		onHeaderSurfaceRing: string;
		switchTrackOff: string;
		switchThumbOff: string;
		transparent: string;
		// Bab grid — the 10x10 progress board on the group screen.
		babReadByMe: string;
		babReadByOthers: string;
		babOpen: string;
		babOpenText: string;
		babOthersText: string;
		/**
		 * The reader header's 100-tick mini-map. Its four states are **ownership**, not read
		 * state, so the board's `babReadByMe`/`babReadByOthers` don't fit. Read and current
		 * reuse `accent` and `text` — both already equal the design in both themes — "yours"
		 * reuses `accentMid`, and the pool tick reuses **`poolFree`**, which is now the one
		 * colour every surface paints an unclaimed bab in. Only "nobody else's" is left with
		 * no equivalent elsewhere.
		 */
		babMapOther: string;
		/**
		 * Pool cells (07a/07b/07c). A pool bab has three states and the board's colours only
		 * cover one of them: "someone else took this" is a *claim*, not a read, so it can't
		 * borrow `babReadByOthers` — in dark that token is a translucent green wash and the
		 * design asks for a solid panel. "Mine" reuses `accent`/`onAccent` and rings in
		 * `text`, all three of which already equal the design in both themes.
		 */
		poolFree: string;
		/**
		 * The outline under the pool block the reader is **currently inside**, in the reader's
		 * mini-map. Its neighbours are drawn in `babMapOther`, so this is the only thing saying
		 * "this is the block the button below is about to hand you".
		 *
		 * Its own token because nothing else fits: it has to be darker than `poolFree`, which is
		 * the fill the brackets sit under, and lighter than `sandText`, which is body copy.
		 */
		poolLine: string;
		poolTaken: string;
		poolTakenText: string;
		/** "Geri al" on a slot you took this session — an outline button, not a danger one. */
		undoBorder: string;
		undoText: string;
		/**
		 * Fill behind the "+2 aralık daha" chip *in a list row*. The hero chip on Home uses
		 * `accentSoft`; on a card the design asks for a lighter wash in dark mode, where
		 * `accentSoft` is a solid panel that would read as a second surface.
		 */
		sliceChip: string;
		// Profile activity heatmap, coldest -> hottest.
		heatEmpty: string;
		heatLow: string;
		heatMid: string;
		heatHigh: string;
		/**
		 * The reader's header and footer. **Opaque**, and it was a 94% tint: nothing is meant
		 * to pass under these bars, but the header is the scroll view's own sticky child, so the
		 * page *does* scroll beneath it — and through six percent of it the Arabic showed as a
		 * ghost behind "BAB 100 / 100" and made the sura line and the page strip hard to read.
		 */
		readerSurface: string;
		readerRule: string;
		/**
		 * The Hüsrev mushaf's page. **Light in both modes**, like the invite code's plate: the
		 * page images are black ink on a transparent ground, so on the dark theme's page they
		 * would vanish. Dark mode takes it a shade down so the page does not glare.
		 */
		mushafPaper: string;
		/**
		 * The sajdah mark on a Hüsrev page ("Secde süsü" in the Icon Set): the star's fill, its gilt,
		 * and its drop shadow with the design's alpha baked in. It hangs off the page onto the
		 * reader's own ground, so unlike `mushafPaper` it has a dark twin.
		 */
		mushafMarkSurface: string;
		mushafMarkGilt: string;
		mushafMarkShadow: string;
		/**
		 * The sura heading's gilt — its stars, diamonds and inner rule, and the dots between the
		 * caption's facts ("Sure başlığı" in the Icon Set). Only ornament, never text.
		 */
		gilt: string;
		/** The sura heading's cartouche, behind the name — a paler sage than `accentSoft`. */
		suraCartouche: string;
		/** The band behind a sajdah verse's lines — `gilt`, washed ("Secde âyeti" in the Icon Set). */
		giltSoft: string;
		/**
		 * The band behind the verse long-pressed on the typeset page, while its meal is open — the
		 * app's sage, washed, so a selection never reads as the gilt of a sajdah verse.
		 */
		verseSelection: string;
		/**
		 * The verse ornament's crimson — its own colour, not `danger`.
		 *
		 * They coincide in dark mode and diverge in light, where `danger` is the deeper
		 * `#8C3F3F` a destructive action needs. A rosette closing a verse is not a warning.
		 */
		ornament: string;
		/**
		 * What the first-use tour dims the app with, at an alpha the overlay picks.
		 *
		 * **The same ink in both themes**, like `codeInk` above and for the same kind of reason:
		 * a spotlight's job is to darken everything outside its hole, and a scrim that followed
		 * the theme would lighten the dark one — dimming a dark screen with a pale wash makes
		 * the page brighter, not quieter.
		 */
		scrim: string;
	};
	spacing: Spacing;
	radius: Radius;
};

const spacing: Spacing = {
	xs: 6,
	sm: 10,
	md: 16,
	lg: 24,
	xl: 32
} as const;

const radius: Radius = {
	sm: 8,
	md: 13,
	lg: 18,
	xl: 24
} as const;

// "Paper + Sage" — warm ink on unbleached paper, sage green as the single accent,
// with a sand tone reserved for the "private / one-off" secondary state.
// Reference palette (from the Cevşen Group Tracker design):
//   paper #F7F5F0 · ink #1C1D1A · sage #3E6B5C · sageDeep #2F5347
//   sageSoft #E8EFEA · sageMuted #DCE7DF · sageMid #A9C7B6
//   sand #F0EBE2 · sandInk #6E5B3E · clay #8C3F3F
export const lightTheme: AppTheme = {
	mode: 'light',
	colors: {
		background: '#F7F5F0',
		surface: '#FFFFFF',
		surfaceGlassWash: 'rgba(255,255,255,0.62)',
		surfaceMuted: '#F2F0EA',
		card: '#FFFFFF',
		sheet: '#F7F5F0',
		segmentTrack: '#F2F0EA',
		segmentActive: '#FFFFFF',
		markFaded: '#C3D2CA',
		hatch: 'rgba(28,29,26,0.07)',
		shelfBase: '#E4E2DB',
		inputBackground: '#FBFAF7',
		primary: '#1C1D1A',
		secondary: '#E4E2DB',
		accent: '#3E6B5C',
		accentStrong: '#2F5347',
		accentSoft: '#E8EFEA',
		accentMuted: '#DCE7DF',
		accentMid: '#A9C7B6',
		accentText: '#5A8674',
		accentOutline: 'rgba(62,107,92,0.42)',
		sand: '#F0EBE2',
		sandText: '#6E5B3E',
		deadline: '#F6ECE1',
		deadlineText: '#8A4F24',
		text: '#1C1D1A',
		subtext: '#6C6D68',
		faintText: '#9A9B95',
		border: '#E7E5DF',
		borderStrong: '#DAD8D1',
		divider: '#EDEBE5',
		track: '#ECEAE4',
		progressTrack: '#E4E1D8',
		barPartial: '#C9D9CF',
		danger: '#8C3F3F',
		dangerSurface: '#F6EDEC',
		missed: '#A65D5D',
		missedSurface: '#F3E4E4',
		success: '#3E6B5C',
		onPrimary: '#FFFFFF',
		onAccent: '#FFFFFF',
		onDanger: '#FFFFFF',
		codePaper: '#F7F5F0',
		codeInk: '#1C1D1A',
		codeAccent: '#3E6B5C',
		headerSurface: '#3E6B5C',
		onHeaderSurface: '#FFFFFF',
		onHeaderSurfaceMissed: '#D48A8A',
		onHeaderSurfaceRing: '#8FB8A6',
		switchTrackOff: '#DEDCD5',
		switchThumbOff: '#FFFFFF',
		transparent: 'transparent',
		babReadByMe: '#3E6B5C',
		babReadByOthers: '#DCE7DF',
		babOpen: '#ECEAE4',
		babOpenText: '#A9A8A2',
		babOthersText: '#5A8674',
		babMapOther: '#DEDCD5',
		poolFree: '#DEC7A6',
		poolLine: '#B08A55',
		poolTaken: '#DCE7DF',
		poolTakenText: '#2F5B4C',
		undoBorder: 'rgba(28,29,26,0.16)',
		undoText: '#3E6B5C',
		sliceChip: '#E8EFEA',
		heatEmpty: '#ECEAE4',
		heatLow: '#DCE7DF',
		heatMid: '#A9C7B6',
		heatHigh: '#3E6B5C',
		readerSurface: '#F7F5F0',
		readerRule: 'rgba(28,29,26,0.07)',
		mushafPaper: '#FFFDF8',
		mushafMarkSurface: '#FFFFFF',
		mushafMarkGilt: '#B8862F',
		mushafMarkShadow: 'rgba(62,50,20,0.16)',
		gilt: '#B8862F',
		suraCartouche: '#F1F5F2',
		giltSoft: 'rgba(184,134,47,0.1)',
		verseSelection: 'rgba(62,107,92,0.14)',
		ornament: '#A65D5D',
		scrim: '#141513'
	},
	spacing,
	radius
};

// Dark values are lifted from the design's own light/dark pairs (`pBg`, `pCard`,
// `pMuted`, `pTint`, `pSheet`, the `.dk` rules and the `d_*` value sets) rather than
// being derived from the light palette. Two spots deliberately diverge — see below.
export const darkTheme: AppTheme = {
	mode: 'dark',
	colors: {
		background: '#191A18',
		surface: '#232520',
		surfaceGlassWash: 'rgba(35,37,32,0.62)',
		surfaceMuted: '#232520',
		card: '#232520',
		sheet: '#1F211D',
		// An inset well, a step *below* the card it sits on — the design reuses the card
		// colour here, which leaves the control with no visible bounds in dark mode.
		segmentTrack: '#191A18',
		// One step above the well again, so all three surfaces read apart.
		segmentActive: '#3A3C36',
		markFaded: 'rgba(143,184,166,0.28)',
		hatch: 'rgba(242,240,234,0.1)',
		shelfBase: '#2E312B',
		inputBackground: 'rgba(242,240,234,0.04)',
		primary: '#8FB8A6',
		// The design's dark ring keeps the light track colour (#E4E2DB), which reads as a
		// bright cream halo on #191A18. Every other track in the dark frames is this value.
		secondary: 'rgba(242,240,234,0.1)',
		accent: '#8FB8A6',
		accentStrong: '#A6CBB8',
		accentSoft: '#2B3B33',
		accentMuted: 'rgba(143,184,166,0.25)',
		accentMid: 'rgba(143,184,166,0.55)',
		accentText: '#8FB8A6',
		accentOutline: 'rgba(143,184,166,0.42)',
		sand: '#3A342A',
		sandText: '#D8C9A9',
		// No dark frame draws the badge; the light pair carried over the way `sand` is.
		deadline: '#3D2E22',
		deadlineText: '#E3AE84',
		text: '#F2F0EA',
		subtext: 'rgba(242,240,234,0.52)',
		faintText: 'rgba(242,240,234,0.42)',
		border: 'rgba(242,240,234,0.09)',
		borderStrong: 'rgba(242,240,234,0.16)',
		divider: 'rgba(242,240,234,0.09)',
		track: 'rgba(242,240,234,0.1)',
		progressTrack: 'rgba(242,240,234,0.16)',
		barPartial: 'rgba(143,184,166,0.35)',
		// Dark frames carry two reds: #C97B7B on cards and #8C3F3F on the invalid-code
		// strip. The latter is the light value left in place and barely clears its own
		// #3A2A2A background, so the card red is used for both.
		danger: '#C97B7B',
		dangerSurface: '#3A2A2A',
		missed: '#C97B7B',
		missedSurface: '#3A2A2A',
		success: '#8FB8A6',
		onPrimary: '#141513',
		onAccent: '#141513',
		onDanger: '#FFFFFF',
		// The generator's dark theme: the plate a shade warmer, the ink a shade deeper — see the type.
		codePaper: '#F2F0EA',
		codeInk: '#141513',
		codeAccent: '#3E6B5C',
		headerSurface: '#20372F',
		onHeaderSurface: '#F2F0EA',
		onHeaderSurfaceMissed: '#D48A8A',
		onHeaderSurfaceRing: '#8FB8A6',
		switchTrackOff: '#3A3C36',
		switchThumbOff: '#191A18',
		transparent: 'transparent',
		babReadByMe: '#8FB8A6',
		babReadByOthers: 'rgba(143,184,166,0.5)',
		babOpen: 'rgba(242,240,234,0.08)',
		babOpenText: 'rgba(242,240,234,0.62)',
		babOthersText: '#141513',
		babMapOther: 'rgba(242,240,234,0.16)',
		// The light tan at dark-mode weight — same hue, dropped in luminance so it reads as
		// sand on the dark paper rather than glowing.
		poolFree: '#6E5F45',
		poolLine: '#C9AE86',
		poolTaken: '#2B3B33',
		poolTakenText: '#8FB8A6',
		undoBorder: 'rgba(242,240,234,0.18)',
		undoText: '#8FB8A6',
		sliceChip: 'rgba(143,184,166,0.16)',
		heatEmpty: 'rgba(242,240,234,0.08)',
		heatLow: 'rgba(143,184,166,0.25)',
		heatMid: 'rgba(143,184,166,0.55)',
		heatHigh: '#8FB8A6',
		readerSurface: '#191A18',
		readerRule: 'rgba(242,240,234,0.09)',
		mushafPaper: '#ECE8DE',
		mushafMarkSurface: '#26302C',
		mushafMarkGilt: '#D9B36A',
		mushafMarkShadow: 'rgba(0,0,0,0.5)',
		gilt: '#D9B36A',
		suraCartouche: '#1F2724',
		giltSoft: 'rgba(217,179,106,0.12)',
		verseSelection: 'rgba(143,184,166,0.2)',
		ornament: '#C97B7B',
		scrim: '#141513'
	},
	spacing,
	radius
};

/**
 * **Q7's illustration** — "Hatim Tamamlandı" in the design: the page's green, the little mushaf
 * that opens, turns its pages and closes, and the gilt that bursts and falls around it.
 *
 * One palette, not a light and a dark one: Q7 is always the deep green page in either mode, as
 * the design draws it, so these never follow the theme. Kept here rather than in the screen so
 * the rule that no component carries its own hex still holds.
 */
export const hatimCompletePalette = {
	/** The page's radial wash: lit at the top, `headerSurface`'s green in the middle, deeper below. */
	pageLight: '#4F8472',
	pageMiddle: '#3E6B5C',
	pageDeep: '#30574A',
	/** The celebration's golds and the confetti's other two colours. */
	goldLight: '#E9C98A',
	gold: '#D9B36A',
	goldDeep: '#C98A2B',
	sagePale: '#BFD8CC',
	white: '#FFFFFF',
	twinkle: '#F3DFB2',
	/** The book: its binding, its pages, the illuminated first pages, the endpaper and the ink. */
	binding: '#24463B',
	page: '#F6F1E4',
	parchment: '#EFE3C8',
	parchmentEdge: '#E0CCA5',
	cartouche: '#EDE0C3',
	endpaper: '#EFE6CF',
	ink: 'rgba(52,40,24,0.82)',
	/** The illuminated page's hatched bands — the same ink, fainter. */
	hatch: 'rgba(52,40,24,0.6)',
	inkDeep: '#3A2C1A',
	script: 'rgba(40,30,18,0.75)',
	scriptFaint: 'rgba(40,30,18,0.35)',
	rule: 'rgba(28,29,26,0.13)',
	shade: 'rgba(0,0,0,0.07)',
	shadeDeep: 'rgba(0,0,0,0.12)',
	/** The binding's inner edge at the spine, and the boards' drop shadow. */
	spineShade: 'rgba(0,0,0,0.25)',
	shadow: '#000000'
} as const;

export const toAlphaColor = (color: string, alpha = 0.16) => {
	if (/^#[\da-f]{6}$/i.test(color)) {
		const alphaByte = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
			.toString(16)
			.padStart(2, '0');
		return `${color}${alphaByte}`;
	}

	return 'rgba(28, 29, 26, 0.12)';
};
