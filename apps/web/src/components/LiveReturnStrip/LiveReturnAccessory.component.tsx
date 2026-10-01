import { Icon } from '@/components/ui/Icon/Icon.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useLiveSessionState } from '@/lib/hooks/useLiveSession';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { liveSession } from '@/lib/live/liveSession';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useSecondsLeft } from '@/screens/Live/LiveBar.component';
import { Ripple } from '@/components/ui/Ripple/Ripple.component';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { describeLiveStrip, hasLiveStrip } from './liveReturnStrip';
import { liveReturnSlot } from './liveReturnSlot';

/**
 * The return strip as iOS 26's tab-bar accessory (see `liveReturnSlot`): the strip's own words
 * (`describeLiveStrip`) in the one row the system gives — who or how many, where, and "Dön ›".
 * The system draws the glass capsule around it and keeps it still across every screen and tab,
 * like the bar it belongs to. The whole row is the tap; ended, the tap puts the session away.
 */
export const LiveReturnAccessory = () => {
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
	const state = useLiveSessionState();
	const secondsLeft = useSecondsLeft(
		state && state.role === 'follower' && state.status === 'away' && state.gone === null ? state.awaySince : null
	);

	if (!hasLiveStrip(state)) {
		return null;
	}

	const look = describeLiveStrip(state, secondsLeft, t, language);
	const accent = look.tone === 'warn' ? theme.colors.liveStripWarnAccent : theme.colors.accent;

	return (
		<Pressable
			accessibilityHint={look.isEnded ? t('liveReturnDismissHint') : t('liveReturnHint')}
			accessibilityLabel={`${look.title}, ${look.sub}`}
			accessibilityRole='button'
			onPress={() => (look.isEnded ? liveSession.leave() : liveReturnSlot.get().onReturn())}
			style={styles.row}
		>
			<View style={styles.leadBox}>
				{/* The live ripple round the disc, as on the reader's Birlikte button: 30pt to 42pt in a 48pt row. */}
				{look.isPulsing ? <Ripple color={accent} maxScale={1.4} size={30} /> : null}
				<View style={[styles.lead, { backgroundColor: toAlphaColor(accent, 0.14) }]}>
					{look.lead === 'spinner' ? (
						<ActivityIndicator color={accent} size='small' />
					) : look.lead === 'initials' ? (
						<Typography color={accent} style={styles.initials} weight='semibold'>
							{look.initials}
						</Typography>
					) : (
						<Icon
							color={accent}
							name={look.isEnded ? 'liveSession' : 'liveSessionTinted'}
							size={17}
							strokeWidth={1.8}
						/>
					)}
				</View>
			</View>
			<View style={styles.copy}>
				<Typography numberOfLines={1} style={styles.title} weight='semibold'>
					{look.title}
				</Typography>
				<Typography color={toAlphaColor(theme.colors.text, 0.62)} numberOfLines={1} style={styles.sub}>
					{look.sub}
				</Typography>
			</View>
			<View style={styles.action}>
				<Typography style={styles.actionLabel} weight='semibold'>
					{look.isEnded ? t('liveTeachOk') : t('liveReturnGoShort')}
				</Typography>
				{look.isEnded ? null : <Icon color={theme.colors.text} name='chevronRight' size={14} strokeWidth={2} />}
			</View>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	action: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 2
	},
	actionLabel: {
		fontSize: 13.5
	},
	copy: {
		flex: 1,
		minWidth: 0
	},
	initials: {
		fontSize: 11.5
	},
	lead: {
		alignItems: 'center',
		borderRadius: 15,
		height: 30,
		justifyContent: 'center',
		width: 30
	},
	leadBox: {
		height: 30,
		width: 30
	},
	row: {
		alignItems: 'center',
		flex: 1,
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 14
	},
	sub: {
		fontSize: 11.5,
		lineHeight: 15
	},
	title: {
		fontSize: 13.5,
		lineHeight: 17
	}
});
