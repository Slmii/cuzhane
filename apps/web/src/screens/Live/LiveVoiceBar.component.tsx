import { LiveVoiceLead } from '@/components/LiveVoice/LiveVoiceLead.component';
import type { LiveVoiceLook } from '@/components/LiveVoice/liveVoiceLook';
import { voiceToneColors } from '@/components/LiveReturnStrip/liveStripTones';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useLiveVoiceAction } from '@/lib/hooks/useLiveVoice';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

type Props = {
	look: LiveVoiceLook;
	onOpenSheet: () => void;
};

const STATE_TRANSITION_MS = 350;

/**
 * The live bar's one height (the design's 66), shared with the plain `LiveBar`: a follower's bar
 * swaps between the two as the reader mutes and unmutes, so neither may grow — title and line
 * below stay one line each.
 */
export const LIVE_BAR_HEIGHT = 66;

/**
 * **The live bar while voice has something to say** (Birlikte Oku Ses, lanes C and D) — under
 * the reader's header, in the strip's tones: sage while the voice works, sand while it is paused,
 * grey for "sesini kapattı". The disc carries the level meter or the state's glyph; the button is
 * always labelled and 44pt — "Sesi kapat" for the reader, "Dinle" or "Durdur" for a follower —
 * and the rest of the bar opens the session's sheet, as the plain bar does.
 *
 * The colour eases between states over 350 ms on one flat style object.
 */
export const LiveVoiceBar = ({ look, onOpenSheet }: Props) => {
	const { theme } = useThemeContext();
	const onAction = useLiveVoiceAction();
	const tone = voiceToneColors(theme, look.tone);
	const { button } = look;

	return (
		<Animated.View
			style={{
				...styles.bar,
				backgroundColor: tone.background,
				borderBottomColor: tone.border,
				transitionDuration: STATE_TRANSITION_MS,
				transitionProperty: ['backgroundColor', 'borderBottomColor']
			}}
		>
			<Pressable
				accessibilityLabel={look.spoken}
				accessibilityRole='button'
				onPress={onOpenSheet}
				style={styles.tapArea}
			>
				<LiveVoiceLead background={tone.lead} color={tone.accent} lead={look.lead} />
				<View style={styles.copy}>
					<Typography color={tone.title} numberOfLines={1} style={styles.title} weight='semibold'>
						{look.title}
					</Typography>
					<CaptionText color={tone.sub} numberOfLines={1} style={styles.sub}>
						{look.sub}
					</CaptionText>
				</View>
			</Pressable>
			{button ? (
				<AppButton
					fullWidth={false}
					icon={button.icon}
					onPress={() => onAction(button.action)}
					size='md'
					title={button.label}
					variant={button.isPrimary ? 'primary' : 'surface'}
				/>
			) : null}
		</Animated.View>
	);
};

/* The design's measures (Birlikte Oku Ses, "Ölçü": the bar at least 66). */
const styles = StyleSheet.create({
	bar: {
		alignItems: 'center',
		borderBottomWidth: 1,
		flexDirection: 'row',
		gap: 12,
		height: LIVE_BAR_HEIGHT,
		paddingBottom: 10,
		paddingLeft: 14,
		paddingRight: 12,
		paddingTop: 10
	},
	copy: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	sub: {
		fontSize: 12.5,
		lineHeight: 17
	},
	tapArea: {
		alignItems: 'center',
		flex: 1,
		flexDirection: 'row',
		gap: 12
	},
	title: {
		fontSize: 14,
		lineHeight: 18
	}
});
