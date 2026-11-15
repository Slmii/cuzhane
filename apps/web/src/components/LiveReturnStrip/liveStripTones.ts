import { toAlphaColor, type AppTheme } from '@/lib/theme/tokens';
import type { LiveVoiceTone } from '@/components/LiveVoice/liveVoiceLook';
import type { LiveStripTone } from './liveReturnStrip';

export type ToneColors = {
	background: string;
	border: string;
	title: string;
	sub: string;
	lead: string;
	accent: string;
};

/**
 * The design's TONES, by token — see `liveStrip*` in `tokens.ts`. The return strip's, and live
 * voice's too (the bar, the strip, the accessory), which draws in the same three.
 */
export const toneColors = (theme: AppTheme, tone: LiveStripTone): ToneColors => {
	const { colors } = theme;

	switch (tone) {
		case 'live':
			return {
				accent: colors.liveStripAccent,
				background: colors.liveStrip,
				border: colors.liveStripBorder,
				lead: colors.liveStripLead,
				sub: colors.liveStripSub,
				title: colors.text
			};
		case 'warn':
			return {
				accent: colors.liveStripWarnAccent,
				background: colors.liveStripWarn,
				border: colors.liveStripWarnBorder,
				lead: colors.liveStripWarnLead,
				sub: colors.liveStripWarnSub,
				title: colors.liveStripWarnTitle
			};
		case 'calm':
		case 'done':
			return {
				accent: tone === 'calm' ? colors.liveStripQuietAccent : toAlphaColor(colors.text, 0.45),
				background: colors.liveStripQuiet,
				border: toAlphaColor(colors.text, 0.12),
				lead: colors.liveStripQuietLead,
				sub: colors.liveStripQuietSub,
				title: colors.text
			};
	}
};

/**
 * Live voice's tones (Birlikte Oku Ses, TONES): the strip's, except the calm accent — the
 * "sesini kapattı" glyph — which the voice design draws a shade stronger.
 */
export const voiceToneColors = (theme: AppTheme, tone: LiveVoiceTone): ToneColors =>
	tone === 'calm'
		? { ...toneColors(theme, 'calm'), accent: theme.colors.liveVoiceQuietAccent }
		: toneColors(theme, tone);
