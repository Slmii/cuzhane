import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { ReaderSettings } from '@/screens/Reader/ReaderSettings.component';
import type { ReaderSettingsProps } from '@/screens/Reader/ReaderSettings.types';

/**
 * The reader's text-size sheet, presented by both reading screens — they render the same sheet
 * from the same route param, and had it written out twice.
 *
 * **It stays open as you pick.** Every control shows its result in the sheet's own preview, so
 * closing on the first tap would take the comparison away at the moment it became useful. The old
 * text-size sheet closed on pick because there was nothing to compare.
 *
 * **Tall enough to hit Android's partial detent.** A preview, a slider, two numeral cards and
 * three typeface cards run past half the viewport, which is where a natively presented sheet
 * stops there — it opens at that detent and cuts the rest off. This is the sheet that found the
 * limit; `ui/BottomSheet` carries the reasoning and the list of the others.
 */
interface TextSizeSheetProps extends ReaderSettingsProps {
	isVisible: boolean;
	onClose: () => void;
}

export const TextSizeSheet = ({ isVisible, onChange, onClose, settings }: TextSizeSheetProps) => {
	const { t } = useTranslation();

	return (
		<AppBottomSheet
			description={t('readerSettingsHint')}
			isVisible={isVisible}
			onClose={onClose}
			title={t('readerSettings')}
		>
			<ReaderSettings onChange={onChange} settings={settings} />
		</AppBottomSheet>
	);
};
