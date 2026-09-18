import { ReleaseNoteItem } from '@/components/ReleaseNoteItem/ReleaseNoteItem.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CaptionText, EyebrowText, FieldLabelText } from '@/components/ui/Typography/Typography.component';
import { CURRENT_RELEASE, EARLIER_RELEASES } from '@/lib/content/releaseNotes';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/**
 * P3 — the release notes, reached from Profil's version row and from P1's "Önceki sürümler".
 *
 * **It reads from the same table the sheet does**, so the two can never describe different
 * releases. The newest one is spelled out entry by entry with its "YENİ" tags; everything before
 * it is one line apiece, which is the design's own asymmetry — the current release is news, the
 * others are a record.
 */
export const ReleaseNotesScreen = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<ScreenContainer>
			<ScreenHeader
				{...(CURRENT_RELEASE.version === null
					? {}
					: {
							eyebrow: t('whatsNewEyebrow', {
								month: t(CURRENT_RELEASE.monthKey),
								version: CURRENT_RELEASE.version
							})
					  })}
				hasBackButton
				subtitle={t('whatsNewSub')}
				title={t('releaseNotesTitle')}
			/>
			<CardSurface style={styles.card}>
				{CURRENT_RELEASE.entries.map(entry => (
					<ReleaseNoteItem entry={entry} hasNewTag key={entry.titleKey} />
				))}
			</CardSurface>
			<View style={styles.earlier}>
				<FieldLabelText color={theme.colors.faintText}>{t('whatsNewOlder')}</FieldLabelText>
				{EARLIER_RELEASES.length === 0 ? (
					<CaptionText color={theme.colors.subtext}>{t('releaseNotesEmpty')}</CaptionText>
				) : (
					/*
					 * **A card per release, not one card of releases.** Each keeps its own entries
					 * rather than a summary line, so the separation has to be a surface — run
					 * together in one card, the eyebrow of the second release would read as another
					 * heading inside the first.
					 *
					 * No "YENİ" tags down here: everything in an earlier release was new once, so
					 * the tag would mark every line and distinguish nothing. It belongs to the
					 * release at the top of the screen.
					 */
					EARLIER_RELEASES.map(release => (
						<CardSurface key={release.version} style={styles.card}>
							{/* The eyebrow variant, not a body line: the string is written lowercase
							    like every other, and this is what maps the dotted i when it caps. */}
							<EyebrowText color={theme.colors.subtext}>
								{t('whatsNewEyebrow', { month: t(release.monthKey), version: release.version })}
							</EyebrowText>
							{release.entries.map(entry => (
								<ReleaseNoteItem entry={entry} key={entry.titleKey} />
							))}
						</CardSurface>
					))
				)}
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	card: {
		gap: 16
	},
	earlier: {
		gap: 8
	}
});
