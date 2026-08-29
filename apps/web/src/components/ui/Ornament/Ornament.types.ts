import type { ReaderNumerals } from '@/lib/types/domain';

export type OrnamentProps = {
	/**
	 * The number inside the rosette, set in Arabic-Indic digits. 1–120.
	 *
	 * Omit it for the bare rosette that opens a bab — that one marks the start of a reading
	 * rather than closing a numbered verse, so there is nothing for it to count.
	 */
	n?: number;
	/**
	 * Rendered width and height. The design's three sizes are 20 inline, 26 default and 40
	 * at the head of a section, and it must never go below 20 — the petals close up.
	 */
	size?: number;
	/** Arabic-Indic ١٢٣ or Latin 123. Defaults to Arabic, which is what the page prints. */
	numerals?: ReaderNumerals;
	/** Defaults to `theme.colors.ornament`. */
	color?: string;
	/**
	 * What the centre disc is filled with. It has to match whatever the ornament sits on,
	 * because that disc is what cuts the petals' inner halves away. Defaults to the page.
	 */
	backgroundColor?: string;
};
