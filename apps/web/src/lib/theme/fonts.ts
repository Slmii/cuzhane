export const appFonts = {
	regular: 'Manrope_400Regular',
	medium: 'Manrope_500Medium',
	semibold: 'Manrope_600SemiBold',
	bold: 'Manrope_700Bold',
	headingRegular: 'Newsreader_400Regular',
	headingMedium: 'Newsreader_500Medium',
	headingSemibold: 'Newsreader_600SemiBold',
	mono: 'IBMPlexMono_400Regular',
	monoMedium: 'IBMPlexMono_500Medium',
	arabicNumeral: 'NotoNaskhArabic_500Medium'
} as const;

export const arabicReaderFonts = {
	/**
	 * Kitab, not Noto Naskh. A classical naskh built on Scheherazade and drawn after the
	 * Monotype metal faces, so it sits closer to a printed Ottoman page than Noto's modern,
	 * screen-first cut. The key stays `naskh` because it names the *script*, which is the
	 * whole reason the enum was named that way — swapping the family behind it costs no
	 * migration.
	 */
	naskh: 'Kitab_400Regular',
	amiri: 'AmiriQuran_400Regular',
	/**
	 * The Madinah mushaf's own face — KFGQPC Uthmanic Script HAFS, from the King Fahd
	 * Complex. Bundled **unmodified**, which its licence requires: free to use, copy and
	 * distribute, but not to sell, modify or alter. That rules out subsetting it, so the
	 * whole 246KB ships.
	 *
	 * Its sibling, KFGQPC Uthman Taha Naskh, was rejected — it is missing 119 characters
	 * this text uses, including all three ornament marks.
	 */
	madinah: 'UthmanicHafs_400Regular'
} as const;

/**
 * How large each face draws for a given `fontSize`.
 *
 * Measured, not guessed: the mean height of alef, lam, kaf and tah as a fraction of the em.
 * Kitab's letters fill 0.71 of theirs and Amiri's 0.77, so one `fontSize` lands as two
 * visibly different sizes; multiplying by these makes "Orta" mean one optical size whichever
 * face is chosen, which is what the setting claims to do.
 *
 * The numbers are ratios against **Şehrizad's 0.80**, which is no longer offered. Keep that
 * baseline rather than rebasing to 1.0 on a face that is: rebasing would resize every
 * reader's text without anyone having changed a setting.
 *
 * **Measure a new face rather than guessing its number.** Faces since dropped ranged far
 * wider than these two: Hüsrev's letters were a third of the em and needed 2.47×.
 */
export const arabicReaderFontScale: Record<keyof typeof arabicReaderFonts, number> = {
	naskh: 1.12,
	amiri: 1.04,
	madinah: 1.14
};
