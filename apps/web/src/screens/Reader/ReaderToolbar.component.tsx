import { GlassCornerAction } from '@/components/ui/CornerAction/GlassCornerAction.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { TrailingCornerAction } from '@/navigation/TrailingCornerAction';
import { useLiveSessionState } from '@/lib/hooks/useLiveSession';
import type { LiveReadingKind } from '@/lib/types/domain';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

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
/**
 * How much wider the bar is with "Birlikte oku" than the back button across from it (measured on
 * iOS 26: a 44pt back disc against a 138pt capsule of three). The free readers pad their header's
 * end slot by this, so the eyebrow sits in the middle of the gap between the two rather than
 * crowding the capsule — centred on the screen, it was 116pt from the back button and 20pt from
 * the capsule.
 */
export const READ_TOGETHER_BAR_OVERHANG = 94;

type ReaderParams = {
	reader: { shouldOpenTextSize?: boolean; shouldOpenLive?: boolean } | undefined;
};

type ReaderNavigationProp = NativeStackNavigationProp<ReaderParams, 'reader'>;

/**
 * `liveKind` adds "Birlikte oku" for the free readers — the only ones a live reading runs in,
 * because they write nothing a follower's screen could disturb — naming the kind this reader reads
 * together. Like text size, it asks the screen to open its sheet through a param; the screen owns
 * the sheet.
 */
export const ReaderToolbar = ({ liveKind }: { liveKind?: LiveReadingKind }) => {
	const navigation = useNavigation<ReaderNavigationProp>();
	const session = useLiveSessionState();
	// Live for this reader: a session of its kind, not yet over — the app's, not this screen's.
	const isLive = liveKind !== undefined && session?.kind === liveKind && session.gone === null;
	const { t } = useTranslation();

	return (
		// No gap, as `GroupDetailToolbar` explains: each item is its own 44pt box.
		<View style={styles.actions}>
			{liveKind ? (
				<GlassCornerAction
					accessibilityLabel={t('liveTitle')}
					// The same element either way: a native control swaps its glyph, it is not remounted.
					assetName={isLive ? 'birlikte-oku-live-session-live' : 'birlikte-oku-live-session'}
					icon={isLive ? 'liveSessionLive' : 'liveSession'}
					isPulsing={isLive}
					onPress={() => navigation.setParams({ shouldOpenLive: true })}
					// The accent, not the bar's ink: the reader's one way to bring others in.
				/>
			) : null}
			<GlassCornerAction
				accessibilityLabel={t('textSize')}
				assetName='yazi-boyutu-text-size'
				icon='textSize'
				onPress={() => navigation.setParams({ shouldOpenTextSize: true })}
				tone='surface'
			/>
			<TrailingCornerAction />
		</View>
	);
};

const styles = StyleSheet.create({
	actions: {
		flexDirection: 'row'
	}
});
