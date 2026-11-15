import { Icon } from '@/components/ui/Icon/Icon.component';
import { StyleSheet, View } from 'react-native';
import { LiveVoiceMeter } from './LiveVoiceMeter.component';
import type { LiveVoiceBadgeProps, LiveVoiceLeadProps } from './LiveVoice.types';

const METER_SIZE = 16;
const GLYPH_SIZE = 21;
const BADGE_SIZE = 22;
const BADGE_METER_SIZE = 10;
/** The set's least size — the design's 13 is drawn at 14. */
const BADGE_GLYPH_SIZE = 14;

/** The live bar's and the one-row strip's 38pt disc: the level meter while the voice works, a glyph otherwise. */
export const LiveVoiceLead = ({ background, color, lead, size = 38 }: LiveVoiceLeadProps) => (
	<View style={[styles.disc, { backgroundColor: background, borderRadius: size / 2, height: size, width: size }]}>
		{lead === 'meter' ? (
			<LiveVoiceMeter color={color} size={METER_SIZE} />
		) : (
			<Icon color={color} name={lead} size={GLYPH_SIZE} strokeWidth={1.6} />
		)}
	</View>
);

/**
 * The return strip's corner badge on its disc (lane E): the meter while the voice works, the pause
 * while it is paused, a speaker while there is a voice to listen to.
 */
export const LiveVoiceBadge = ({ badge, color, ink, isReader, ringColor }: LiveVoiceBadgeProps) => (
	<View style={[styles.badge, { backgroundColor: color, borderColor: ringColor }]}>
		{badge === 'meter' ? (
			<LiveVoiceMeter color={ink} size={BADGE_METER_SIZE} />
		) : (
			<Icon
				color={ink}
				name={badge === 'speaker' ? 'speaker' : isReader ? 'micPaused' : 'speakerPaused'}
				size={BADGE_GLYPH_SIZE}
				strokeWidth={1.6}
			/>
		)}
	</View>
);

const styles = StyleSheet.create({
	badge: {
		alignItems: 'center',
		borderRadius: BADGE_SIZE / 2,
		borderWidth: 2,
		bottom: -4,
		height: BADGE_SIZE,
		justifyContent: 'center',
		position: 'absolute',
		right: -5,
		width: BADGE_SIZE
	},
	disc: {
		alignItems: 'center',
		flexShrink: 0,
		justifyContent: 'center'
	}
});
