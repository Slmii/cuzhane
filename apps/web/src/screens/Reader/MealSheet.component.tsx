import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { Ornament } from '@/components/ui/Ornament/Ornament.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import type { MealSheetProps } from './MealSheet.types';

/** The design's ornament size in a sheet header — its default, between inline and section-head. */
const ORNAMENT_SIZE = 26;

/**
 * The meaning of one invocation, opened by long-pressing it in the reader.
 *
 * **Turkish only.** The edition this text comes from publishes its meal in Turkish, Spanish,
 * Uzbek and Uzbek-Cyrillic — no English — so an English reader gets a line saying so rather
 * than a machine translation of scripture, which is exactly the thing the content rules here
 * forbid. The sheet still opens: being told why is more use than a long-press that does
 * nothing, and it points at the setting that would fix it.
 *
 * One invocation has no Turkish either — bab 44's ninth, where the edition's own two files
 * disagree about the line — and gets its own message for the same reason.
 *
 * No close button, per the app's sheet rules: the grabber, a drag and the backdrop dismiss
 * it. The design draws an × here; every other sheet in the app does without one, and one
 * sheet inventing a second convention is worse than differing from the mock.
 */
export const MealSheet = ({
	arabicFont,
	arabicFontSize,
	arabicText,
	babNumber,
	invocation,
	numerals,
	onClose
}: MealSheetProps) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();

	/*
	 * **The language gates the translation, not just the message.** Reading `invocation.tr`
	 * without checking first showed an English reader the Turkish — which is worse than
	 * showing nothing, because the sheet then looks like it worked.
	 */
	const body = language === 'tr' ? invocation?.tr ?? null : null;
	const message = language === 'tr' ? t('mealMissing') : t('mealUnsupported');

	return (
		<AppBottomSheet isVisible={invocation !== null} onClose={onClose} title={t('mealTitle')}>
			{invocation ? (
				<View style={styles.root}>
					<View style={styles.header}>
						{/*
						 * The app's own rosette — `ui/Ornament`, the mark that opens every bab —
						 * carrying this ayah's number.
						 *
						 * It was briefly the typeface's `U+06DD` instead, so that the sheet and the
						 * text beside it drew the same shape. That needs the mark and its digits in
						 * one right-to-left run to enclose, which a left-to-right header row does
						 * not give it, and it came out as a bare flourish with the number nowhere
						 * on it. The drawn rosette has no such dependency: it is a view, sets its
						 * own numeral, and is legal here because a header is not running text.
						 */}
						{/*
						 * Green, like the marks in the text and the one opening each bab. The
						 * design sets this one in the crimson `ornament` token, but that colour
						 * means the sübhâneke everywhere else in the reader — and this rosette
						 * stands for an ordinary numbered verse, which is the green.
						 */}
						<Ornament
							backgroundColor={theme.colors.surface}
							color={theme.colors.accent}
							n={invocation.n}
							numerals={numerals}
							size={ORNAMENT_SIZE}
						/>
						<Typography color={theme.colors.faintText} variant='mono'>
							{`${t('bab')} ${babNumber} · ${t('mealAyet')} ${invocation.n}`}
						</Typography>
					</View>

					<View
						style={[
							styles.card,
							{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
						]}
					>
						<Typography
							style={{
								fontFamily: arabicFont,
								fontSize: arabicFontSize,
								lineHeight: arabicFontSize * 1.95,
								writingDirection: 'rtl'
							}}
							textAlign='right'
						>
							{arabicText}
						</Typography>
						<View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
						{/* Muted when it is the app explaining itself rather than the text speaking. */}
						<Typography color={body ? theme.colors.text : theme.colors.subtext}>
							{body ?? message}
						</Typography>
					</View>
				</View>
			) : null}
		</AppBottomSheet>
	);
};

const styles = StyleSheet.create({
	card: {
		borderRadius: 16,
		borderWidth: 1,
		gap: 13,
		padding: 15
	},
	divider: {
		height: 1
	},
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	root: {
		gap: 12
	}
});
