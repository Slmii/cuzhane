import { Icon } from '@/components/ui/Icon/Icon.component';
import { BodyStrongText, CaptionText, EyebrowText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { ReleaseNoteItemProps } from './ReleaseNoteItem.types';

/**
 * One line of a release's notes — the tinted tile, the title, the sentence (design P1 and P3).
 *
 * The same row in both places, because they are the same content: the sheet is the newest
 * release's entries, the screen is those plus the ones before. Only the "YENİ" tag differs, and
 * it is a prop rather than two components.
 */
export const ReleaseNoteItem = ({ entry, hasNewTag = false }: ReleaseNoteItemProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View style={styles.item}>
			<View style={[styles.tile, { backgroundColor: theme.colors.accentSoft }]}>
				<Icon color={theme.colors.accent} name={entry.icon} size={18} strokeWidth={1.8} />
			</View>
			<View style={styles.copy}>
				<View style={styles.titleRow}>
					<BodyStrongText>{t(entry.titleKey)}</BodyStrongText>
					{hasNewTag && entry.isNew ? (
						<View style={[styles.tag, { backgroundColor: theme.colors.accentSoft }]}>
							<EyebrowText color={theme.colors.accent}>{t('releaseNotesNew')}</EyebrowText>
						</View>
					) : null}
				</View>
				<CaptionText color={theme.colors.subtext}>{t(entry.bodyKey)}</CaptionText>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	copy: {
		flex: 1,
		gap: 3,
		minWidth: 0
	},
	item: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 13
	},
	tag: {
		borderRadius: 6,
		paddingHorizontal: 6,
		paddingVertical: 2
	},
	tile: {
		alignItems: 'center',
		borderRadius: 12,
		height: 38,
		justifyContent: 'center',
		width: 38
	},
	titleRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8
	}
});
