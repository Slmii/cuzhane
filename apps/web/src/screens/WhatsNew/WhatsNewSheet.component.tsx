import { ReleaseNoteItem } from '@/components/ReleaseNoteItem/ReleaseNoteItem.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CaptionText, EyebrowText, Header2 } from '@/components/ui/Typography/Typography.component';
import { CURRENT_RELEASE } from '@/lib/content/releaseNotes';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
	isVisible: boolean;
	onClose: () => void;
	onShowAll: () => void;
};

/**
 * P1 — "Neler yeni", shown once after an update.
 *
 * A sheet rather than a screen, and the design draws it as one: it interrupts whatever the reader
 * opened the app to do, so it has to be dismissible by dragging it away rather than by finding a
 * back button. `useWhatsNew` decides *whether* — this only draws it.
 */
export const WhatsNewSheet = ({ isVisible, onClose, onShowAll }: Props) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<AppBottomSheet isVisible={isVisible} onClose={onClose}>
			<View style={styles.sheet}>
				<View style={styles.heading}>
					{CURRENT_RELEASE.version === null ? null : (
						<EyebrowText color={theme.colors.accent}>
							{t('whatsNewEyebrow', {
								month: t(CURRENT_RELEASE.monthKey),
								version: CURRENT_RELEASE.version
							})}
						</EyebrowText>
					)}
					<Header2>{t('whatsNewTitle')}</Header2>
					<CaptionText color={theme.colors.subtext}>{t('whatsNewSub')}</CaptionText>
				</View>
				<View style={styles.entries}>
					{CURRENT_RELEASE.entries.map(entry => (
						<ReleaseNoteItem entry={entry} key={entry.titleKey} />
					))}
				</View>
				<View style={styles.actions}>
					<AppButton fullWidth onPress={onClose} title={t('whatsNewGotIt')} variant='accent' />
					<Pressable accessibilityRole='button' onPress={onShowAll} style={styles.olderLink}>
						<CaptionText color={theme.colors.faintText}>{t('whatsNewOlder')}</CaptionText>
					</Pressable>
				</View>
			</View>
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	actions: {
		gap: 8,
		paddingTop: 2
	},
	entries: {
		gap: 14
	},
	heading: {
		gap: 5,
		paddingTop: 4
	},
	olderLink: {
		alignItems: 'center',
		paddingVertical: 8
	},
	sheet: {
		gap: 16
	}
});
