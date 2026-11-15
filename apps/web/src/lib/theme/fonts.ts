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
	 * KFGQPC Uthman Taha Naskh, from the King Fahd Complex — the face the Risale-i Nur library
	 * sets the Cevşen in, and **the reader's default**. Bundled **unmodified**, which its
	 * licence requires: free to use, copy and distribute, never to sell, modify or alter. That
	 * rules out subsetting it, so the whole 260KB ships.
	 *
	 * It is the default because of one mark. The subscript alef is this edition's own long î,
	 * 549 of them across seventy babs, and this face draws it as the narrow upright stroke it
	 * should be: 0.080 × 0.254 em, which is the reference every other face here was measured
	 * against.
	 *
	 * **It replaced KFGQPC Uthmanic Script HAFS as the default**, because that face draws the
	 * same mark 0.304 × 0.210 em — wider than it is tall, and in two pieces.
	 *
	 * **It lacks two characters the Kuran uses**: `U+0671`, the alef wasla — the alef of
	 * ٱللَّه, 13,483 times in 4,798 of the 6,236 ayahs — and `U+06DE`, the rub el hizb mark.
	 * iOS borrows both from a system face, and a borrowed glyph takes no part in this face's
	 * mark positioning, so the harakah on and around it sit wrong. Fine for the Cevşen, whose
	 * Ottoman orthography has neither; not for a cüz.
	 */
	uthman: 'UthmanTahaNaskh_400Regular'
	/*
	 * KFGQPC Uthmanic Script HAFS ("Medine Mushafı") was offered for the Kuran and removed
	 * before release. It was the only face cut for the King Fahd Complex's own encoding, so the
	 * bundled text carried every word twice to feed it; with it gone the text is Unicode only.
	 */
	/*
	 * Hüsrev Hattı was tried here as two fonts, Arabic and Ottoman cuts, and dropped: both
	 * leaned on thirty-seven private `zz` features that only their publisher's app applies, and
	 * without them the marks sat wrong. The Kuran reader shows the Hüsrev mushaf as page images
	 * instead — see `ReaderTextFont`.
	 */
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
	// Alef, lam, kaf and tah average 0.698 em in this face.
	uthman: 1.15
};
