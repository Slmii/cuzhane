export type ThemeMode = 'light' | 'dark';

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
		text: string;
		subtext: string;
		faintText: string;
		border: string;
		borderStrong: string;
		divider: string;
		track: string;
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
		// Reader chrome sits over the page and blurs what scrolls beneath it.
		readerSurface: string;
		readerRule: string;
		/**
		 * The verse ornament's crimson — its own colour, not `danger`.
		 *
		 * They coincide in dark mode and diverge in light, where `danger` is the deeper
		 * `#8C3F3F` a destructive action needs. A rosette closing a verse is not a warning.
		 */
		ornament: string;
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
		text: '#1C1D1A',
		subtext: '#6C6D68',
		faintText: '#9A9B95',
		border: '#E7E5DF',
		borderStrong: '#DAD8D1',
		divider: '#EDEBE5',
		track: '#ECEAE4',
		danger: '#8C3F3F',
		dangerSurface: '#F6EDEC',
		missed: '#A65D5D',
		missedSurface: '#F3E4E4',
		success: '#3E6B5C',
		onPrimary: '#FFFFFF',
		onAccent: '#FFFFFF',
		onDanger: '#FFFFFF',
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
		poolTaken: '#DCE7DF',
		poolTakenText: '#2F5B4C',
		undoBorder: 'rgba(28,29,26,0.16)',
		undoText: '#3E6B5C',
		sliceChip: '#E8EFEA',
		heatEmpty: '#ECEAE4',
		heatLow: '#DCE7DF',
		heatMid: '#A9C7B6',
		heatHigh: '#3E6B5C',
		readerSurface: 'rgba(247,245,240,0.94)',
		readerRule: 'rgba(28,29,26,0.07)',
		ornament: '#A65D5D'
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
		text: '#F2F0EA',
		subtext: 'rgba(242,240,234,0.52)',
		faintText: 'rgba(242,240,234,0.42)',
		border: 'rgba(242,240,234,0.09)',
		borderStrong: 'rgba(242,240,234,0.16)',
		divider: 'rgba(242,240,234,0.09)',
		track: 'rgba(242,240,234,0.1)',
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
		poolTaken: '#2B3B33',
		poolTakenText: '#8FB8A6',
		undoBorder: 'rgba(242,240,234,0.18)',
		undoText: '#8FB8A6',
		sliceChip: 'rgba(143,184,166,0.16)',
		heatEmpty: 'rgba(242,240,234,0.08)',
		heatLow: 'rgba(143,184,166,0.25)',
		heatMid: 'rgba(143,184,166,0.55)',
		heatHigh: '#8FB8A6',
		readerSurface: 'rgba(25,26,24,0.94)',
		readerRule: 'rgba(242,240,234,0.09)',
		ornament: '#C97B7B'
	},
	spacing,
	radius
};

export const toAlphaColor = (color: string, alpha = 0.16) => {
	if (/^#[\da-f]{6}$/i.test(color)) {
		const alphaByte = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
			.toString(16)
			.padStart(2, '0');
		return `${color}${alphaByte}`;
	}

	return 'rgba(28, 29, 26, 0.12)';
};
