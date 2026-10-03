import type { LiveVoiceLook } from './liveVoiceLook';

export interface LiveVoiceMeterProps {
	color: string;
	/** The bars' height; their width and gap follow it, as the design draws them. */
	size: number;
}

export interface LiveVoiceLeadProps {
	lead: LiveVoiceLook['lead'];
	/** The glyph or the bars. */
	color: string;
	/** The disc behind them. */
	background: string;
	size?: number;
}

export interface LiveVoiceBadgeProps {
	badge: NonNullable<LiveVoiceLook['badge']>;
	/** Which pause it is: the reader's microphone or the listener's speaker. */
	isReader: boolean;
	/** The badge's fill — the tone's accent. */
	color: string;
	/** What is drawn on it — the tone's lead colour. */
	ink: string;
	/** The ring that sets it off the strip: the strip's own background. */
	ringColor: string;
}
