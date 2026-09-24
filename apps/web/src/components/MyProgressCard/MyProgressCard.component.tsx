import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import type { MyProgressCardProps } from './MyProgressCard.types';

/**
 * "Senin ilerlemen" on the group screen (C7), the way in to F7.
 *
 * **A slim banner on the header's deep green, above the assigned card rather than below it.**
 * It was a full card with a progress ring, and it spent a card's worth of height saying two
 * numbers — on a screen that already stacks the rhythm card, the share, the closed round, the
 * pool and the hundred. One line in the one colour nothing else on the page uses reads as a
 * way *out* of the screen, which is what it is.
 *
 * The ring went with the height, and not only for room: it counted the seat's share while
 * "Sana atanan" below counts the share *plus* any block claimed out of the pool, so with a
 * claim the two disagreed on one screen. It could not simply add the claim either —
 * `GroupBab.assignedUserId` is wiped at every rollover, so past claims are unrecoverable.
 *
 * **No span on the line.** It read "· son 7 gün" and the numbers beside it were only that
 * window, which made the banner a partial answer to a question nobody asks partially: what
 * is outstanding is outstanding whenever it fell behind. The counts now cover every round
 * this member has been in; the strip on F7 is the one thing still showing a recent slice,
 * and its own heading says so.
 *
 * **Everything written here is fixed in both themes**, because the layer under it is deep
 * green in both. `onHeaderSurface` and `onHeaderSurfaceMissed` are the pair for that; `text`
 * or `missed` would put a near-black or a dark clay on dark green, which is the mistake
 * `TrailingCornerAction isOnHeaderSurface` exists to avoid on Ana sayfa.
 */
export const MyProgressCard = ({ isHatim = false, onPress, progress }: MyProgressCardProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	/** The quieter half of the line — everything that is a label rather than a number. */
	const muted = toAlphaColor(theme.colors.onHeaderSurface, 0.62);

	return (
		<CardSurface
			// It carries its own fill, so no glass: the material tints itself `surface` and
			// would wash the green out from under it.
			hasGlassSurface={false}
			onPress={onPress}
			style={[styles.banner, { backgroundColor: theme.colors.headerSurface }]}
		>
			<CaptionText color={theme.colors.onHeaderSurface} weight='semibold'>
				{t('myProgress')}
			</CaptionText>
			<View style={[styles.divider, { backgroundColor: muted }]} />
			<CaptionText color={muted} numberOfLines={1} style={styles.stats}>
				<CaptionText color={theme.colors.onHeaderSurfaceMissed} weight='semibold'>
					{progress.missedCount}
				</CaptionText>
				{` ${t('mpMissed')} · `}
				<CaptionText color={theme.colors.onHeaderSurface} weight='semibold'>
					{`${progress.ratePercent}%`}
				</CaptionText>
				{isHatim ? ` · ${t('qThisHatim', { n: progress.periods.length })}` : ` ${t('mpRate')}`}
			</CaptionText>
			<Icon color={theme.colors.onHeaderSurface} name='chevronRight' size={15} strokeWidth={1.8} />
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	banner: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	divider: {
		height: 11,
		width: 1
	},
	stats: {
		flex: 1,
		minWidth: 0
	}
});
