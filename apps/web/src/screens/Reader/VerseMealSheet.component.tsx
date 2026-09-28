import { AppButton } from '@/components/ui/Button/Button.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { suraNameFor } from '@/lib/content/cuz';
import { SAJDAH_SIGN, SAJDAH_VERSE_KEYS, verseText } from '@/lib/content/quran';
import { useVerseTranslation } from '@/lib/hooks/useVerseTranslation';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import { MealSheetView } from './MealSheetView.component';
import type { VerseMealSheetProps } from './VerseMealSheet.types';

/**
 * A Kuran verse's meal, opened by long-pressing any word of it — or its mark — in the typeset
 * reader. The layout is `MealSheetView`, the Cevşen's sheet; the meal is **fetched live** in the
 * interface language (`useVerseTranslation`), so the sheet says it is loading, and offers to try
 * again if it could not be had, rather than showing nothing.
 *
 * **A sajdah verse says so under the card**, in the gilt its band and mark wear on the page —
 * the verse is the one the edition marks with ۩ (`SAJDAH_VERSE_KEYS`).
 */
export const VerseMealSheet = ({ arabicFont, arabicFontSize, numerals, onClose, verseKey }: VerseMealSheetProps) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const translation = useVerseTranslation(verseKey);

	const [chapter = 0, ayah = 0] = (verseKey ?? '').split(':').map(Number);
	const isSajdah = verseKey !== null && SAJDAH_VERSE_KEYS.has(verseKey);

	const sajdahNote = isSajdah ? (
		<View style={[styles.sajdahNote, { backgroundColor: theme.colors.giltSoft, borderColor: theme.colors.gilt }]}>
			<Typography color={theme.colors.gilt} style={[styles.sajdahSign, { fontFamily: arabicFont }]}>
				{SAJDAH_SIGN}
			</Typography>
			<Typography style={styles.sajdahText}>{t('qSecdeNote')}</Typography>
		</View>
	) : null;
	const retry = translation.isError ? (
		<AppButton fullWidth={false} onPress={() => void translation.refetch()} title={t('retry')} variant='surface' />
	) : null;

	return (
		<MealSheetView
			arabicFont={arabicFont}
			arabicFontSize={arabicFontSize}
			arabicText={verseKey ? verseText(verseKey) : ''}
			credit={translation.data?.translator}
			footer={
				sajdahNote || retry ? (
					<View style={styles.footer}>
						{sajdahNote}
						{retry}
					</View>
				) : null
			}
			isVisible={verseKey !== null}
			meal={translation.data?.text ?? null}
			message={translation.isError ? t('qMealFailed') : t('qMealLoading')}
			number={ayah}
			numerals={numerals}
			onClose={onClose}
			ornamentColor={isSajdah ? theme.colors.gilt : theme.colors.accent}
			reference={`${suraNameFor(chapter, language)} · ${t('mealAyet')} ${ayah}`}
		/>
	);
};

const styles = StyleSheet.create({
	footer: {
		alignItems: 'flex-start',
		gap: 12
	},
	sajdahNote: {
		alignItems: 'center',
		alignSelf: 'stretch',
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 14,
		paddingVertical: 10
	},
	sajdahSign: {
		fontSize: 22,
		lineHeight: 32
	},
	sajdahText: {
		flex: 1
	}
});
