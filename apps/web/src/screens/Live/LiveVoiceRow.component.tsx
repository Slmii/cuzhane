import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import { AppSwitch } from '@/components/ui/Switch/Switch.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useLiveVoice } from '@/lib/hooks/useLiveVoice';
import type { LivePerson } from '@/lib/types/domain';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import { liveVoice } from '@/lib/live/liveVoice';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

type Props = { people: LivePerson[] };

type RowLook = {
	sub: string;
	subColor: string;
	border: string;
	well: string;
	wellInk: string;
	icon: IconName;
	isOn: boolean;
};

/**
 * **"Sesimi aç"** — the reader's voice switch in the session sheet (Birlikte Oku Ses, lane B),
 * under the code. The whole row is the target; its line says what will happen and that nothing is
 * recorded, then, once on, how many listen.
 *
 * - The first time on, the system asks for the microphone — our words there are the permission
 *   text (`locales/*.json`). Refused, the switch stays off and the row explains, without blame,
 *   with one button: "Ayarları aç". Back from Settings, the switch can simply be tried again.
 * - Paused is sand, the switch too; unavailable is the row faded and still; a build without live
 *   voice has no row at all.
 */
export const LiveVoiceRow = ({ people }: Props) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const voice = useLiveVoice();
	const { colors } = theme;

	if (!voice.isSupported || voice.role !== 'reader') {
		return null;
	}

	const isUnavailable = voice.state === 'unavailable';
	const isDenied = voice.state === 'off' && voice.reason === 'microphone-refused';
	const listenerCount = people.filter(person => !person.isLeader && person.isListening === true).length;
	const listening =
		listenerCount > 0
			? t(pluralKey(language, listenerCount, 'liveVoiceListeningOne', 'liveVoiceListeningOther'), {
					count: listenerCount
			  })
			: t('liveVoiceListeningNone');

	const off = {
		border: colors.divider,
		isOn: false,
		subColor: colors.subtext,
		well: colors.liveVoiceWell,
		wellInk: colors.subtext
	};

	const look: RowLook =
		voice.state === 'paused'
			? {
					border: colors.liveStripWarnBorder,
					icon: 'micPaused',
					isOn: true,
					sub: t('liveVoiceRowPaused'),
					subColor: colors.liveStripWarnTitle,
					well: colors.liveStripWarn,
					wellInk: colors.liveStripWarnAccent
			  }
			: voice.state === 'listening' || voice.state === 'connecting'
			? {
					border: colors.liveStripBorder,
					icon: 'micOn',
					isOn: true,
					sub: `${t('liveVoiceOnTitle')} · ${listening}`,
					subColor: colors.liveStripAccent,
					well: colors.liveStrip,
					wellInk: colors.liveStripAccent
			  }
			: isUnavailable
			? { ...off, icon: 'micOff', sub: t('liveVoiceRowUnavailable') }
			: isDenied
			? { ...off, icon: 'mic', sub: t('liveVoiceRowDenied') }
			: { ...off, icon: 'mic', sub: t('liveVoiceRowOff') };

	const toggle = () => {
		if (look.isOn) {
			liveVoice.stop();
		} else {
			void liveVoice.start();
		}
	};

	return (
		<CardSurface hasGlassSurface={false} isFlush style={[styles.card, { borderColor: look.border }]}>
			<Pressable
				accessibilityHint={look.sub}
				accessibilityLabel={t('liveVoiceRowTitle')}
				accessibilityRole='switch'
				accessibilityState={{ checked: look.isOn, disabled: isUnavailable }}
				disabled={isUnavailable}
				onPress={toggle}
				style={[styles.row, isUnavailable ? styles.faded : null]}
			>
				<View style={[styles.well, { backgroundColor: look.well }]}>
					<Icon color={look.wellInk} name={look.icon} size={23} strokeWidth={1.6} />
				</View>
				<View style={styles.copy}>
					<Typography style={styles.title} weight='semibold'>
						{t('liveVoiceRowTitle')}
					</Typography>
					<CaptionText color={look.subColor} style={styles.sub}>
						{look.sub}
					</CaptionText>
				</View>
				{/* The row is the switch for a screen reader; this one is only drawn. */}
				<View accessibilityElementsHidden importantForAccessibility='no-hide-descendants'>
					<AppSwitch
						disabled={isUnavailable}
						onColor={voice.state === 'paused' ? colors.liveStripWarnAccent : colors.accent}
						onValueChange={toggle}
						value={look.isOn}
					/>
				</View>
			</Pressable>
			{isDenied ? (
				<View style={[styles.denied, { borderTopColor: colors.divider }]}>
					<Typography style={styles.deniedBody}>{t('liveVoiceDeniedBody')}</Typography>
					<AppButton
						onPress={() => void Linking.openSettings()}
						size='md'
						title={t('liveVoiceOpenSettings')}
						variant='surface'
					/>
				</View>
			) : null}
		</CardSurface>
	);
};

/* The design's measures (Birlikte Oku Ses, B1–B4). */
const styles = StyleSheet.create({
	card: {
		borderWidth: 1
	},
	copy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	denied: {
		borderTopWidth: 1,
		gap: 12,
		paddingBottom: 14,
		paddingHorizontal: 14,
		paddingTop: 13
	},
	deniedBody: {
		fontSize: 13.5,
		lineHeight: 20
	},
	faded: {
		opacity: 0.5
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		minHeight: 72,
		padding: 14
	},
	sub: {
		fontSize: 12.5,
		lineHeight: 17.5
	},
	title: {
		fontSize: 15,
		lineHeight: 19.5
	},
	well: {
		alignItems: 'center',
		borderRadius: 13,
		height: 44,
		justifyContent: 'center',
		width: 44
	}
});
