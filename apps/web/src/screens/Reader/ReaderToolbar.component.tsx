import { GlassCornerAction } from '@/components/ui/CornerAction/GlassCornerAction.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * The reader's one whole-screen action: the size of the text.
 *
 * **It used to be an "Aa" chip in the screen's own header row, and it had stopped working.** That
 * row sits exactly where the navigator's transparent header does, and a transparent header is
 * still a view above the scene — so every tap in that band went to the header instead of to the
 * button under it. The row's left slot was already empty and commented "the back control is the
 * navigator's"; this is the same realisation applied to the other end of it.
 *
 * In the bar it is also the platform's own control, and it stops competing with the eyebrow
 * between them for a corner the header had already claimed.
 *
 * **One component for both reading screens** — the group reader and Tüm bablar, which had the
 * same chip in the same dead corner. Typed against the one param they share rather than either
 * route, since `setParams` targets whichever is current and the toolbar needs to know no more
 * than that.
 */
type ReaderNavigationProp = NativeStackNavigationProp<{ reader: { shouldOpenTextSize?: boolean } }, 'reader'>;

export const ReaderToolbar = () => {
	const navigation = useNavigation<ReaderNavigationProp>();
	const { t } = useTranslation();

	return (
		<GlassCornerAction
			accessibilityLabel={t('textSize')}
			assetName='yazi-boyutu-text-size'
			icon='textSize'
			onPress={() => navigation.setParams({ shouldOpenTextSize: true })}
			tone='surface'
		/>
	);
};
