import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { MealSheetProps } from './MealSheet.types';
import { MealSheetView } from './MealSheetView.component';

/**
 * The meaning of one Cevşen invocation, opened by long-pressing its mark in the reader. The
 * layout is `MealSheetView`, shared with the Kuran's verses.
 *
 * **Turkish only.** The edition this text comes from publishes its meal in Turkish, Spanish,
 * Uzbek and Uzbek-Cyrillic — no English — so an English reader gets a line saying so rather
 * than a machine translation of scripture, which is exactly the thing the content rules here
 * forbid. The sheet still opens: being told why is more use than a long-press that does
 * nothing, and it points at the setting that would fix it.
 *
 * One invocation has no Turkish either — bab 44's ninth, where the edition's own two files
 * disagree about the line — and gets its own message for the same reason.
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
	const meal = language === 'tr' ? invocation?.tr ?? null : null;
	const message = language === 'tr' ? t('mealMissing') : t('mealUnsupported');

	return (
		<MealSheetView
			arabicFont={arabicFont}
			arabicFontSize={arabicFontSize}
			arabicText={arabicText}
			isVisible={invocation !== null}
			meal={meal}
			message={message}
			number={invocation?.n ?? 0}
			numerals={numerals}
			onClose={onClose}
			/*
			 * Green, like the marks in the text and the one opening each bab. The design sets this
			 * one in the crimson `ornament` token, but that colour means the sübhâneke everywhere
			 * else in the reader — and this rosette stands for an ordinary numbered verse.
			 */
			ornamentColor={theme.colors.accent}
			reference={`${t('bab')} ${babNumber} · ${t('mealAyet')} ${invocation?.n ?? ''}`}
		/>
	);
};
