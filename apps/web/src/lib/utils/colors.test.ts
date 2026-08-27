import { describe, expect, it } from 'vitest';
import { flattenColor } from './colors';
import { darkTheme, lightTheme } from '@/lib/theme/tokens';

describe('flattenColor', () => {
	it('leaves an opaque hex alone', () => {
		expect(flattenColor('#3E6B5C', '#FFFFFF')).toBe('#3e6b5c');
	});

	it('expands shorthand hex', () => {
		expect(flattenColor('#abc', '#FFFFFF')).toBe('#aabbcc');
	});

	it('composites a translucent rgba onto its backdrop', () => {
		// Half of black over white is mid grey, whichever direction you read it.
		expect(flattenColor('rgba(0,0,0,0.5)', '#FFFFFF')).toBe('#808080');
	});

	it('treats rgb() as fully opaque', () => {
		expect(flattenColor('rgb(62,107,92)', '#FFFFFF')).toBe('#3e6b5c');
	});

	it('falls back to the backdrop rather than throwing on an unreadable colour', () => {
		expect(flattenColor('papayawhip', '#FFFFFF')).toBe('#ffffff');
	});

	/**
	 * The reason this helper exists: DiceBear validates its colours against
	 * `transparent|[0-9a-f]{3}|[0-9a-f]{6}` and throws on anything else, so every token
	 * the Avatar can reach has to come out of here as hex — in both themes.
	 */
	it('renders every avatar token as hex in both themes', () => {
		const tokens = (theme: typeof lightTheme) => [
			theme.colors.accent,
			theme.colors.accentSoft,
			theme.colors.accentMuted,
			theme.colors.accentText,
			theme.colors.sand,
			theme.colors.sandText,
			theme.colors.subtext,
			theme.colors.surface,
			theme.colors.surfaceMuted
		];

		for (const theme of [lightTheme, darkTheme]) {
			for (const token of tokens(theme)) {
				expect(flattenColor(token, theme.colors.background)).toMatch(/^#[\da-f]{6}$/);
			}
		}
	});
});
