/**
 * Each reading's colours, as the design gives them: the wash its section and card sit on, the
 * hairlines around its card (`edge`) and its section (`rim`), the ink its eyebrow, unit and glyph
 * tile take, and the tint behind a tick.
 * Sage for the Cevşen, sand for the Kur'an, rose for the Hizb — the same three the app uses.
 */
export type KindKey = 'cevsen' | 'hatim' | 'hizb';

export const KIND_TONES: Record<KindKey, { wash: string; edge: string; rim: string; ink: string; tick: string }> = {
	cevsen: { edge: 'rgba(62, 107, 92, 0.16)', rim: 'rgba(62, 107, 92, 0.14)', ink: '#3E6B5C', tick: '#CFE0D6', wash: '#E6EEE9' },
	hatim: { edge: 'rgba(110, 91, 62, 0.16)', rim: 'rgba(110, 91, 62, 0.14)', ink: '#6E5B3E', tick: '#E6DCC8', wash: '#F0EBE2' },
	hizb: { edge: 'rgba(138, 74, 67, 0.16)', rim: 'rgba(138, 74, 67, 0.14)', ink: '#8A4A43', tick: '#EBD5D0', wash: '#F3E8E5' }
};
