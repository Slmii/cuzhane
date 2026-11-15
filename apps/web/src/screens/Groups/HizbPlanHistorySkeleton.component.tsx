import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeaderSkeleton } from '@/components/Skeleton/ScreenHeaderSkeleton.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** Enough rows to fill the screen under the heading. */
const ROW_COUNT = 10;

/**
 * T3 · Geçmiş yükleniyor — `HizbPlanHistoryScreen` before its data: the same container and list
 * padding, its heading (the round in the subtitle is the data's, so a bone), then the one card
 * drawn row by row — the date, the portion and its work, and the row's trailing mark.
 *
 * The first row is today, so it carries the "Oku" button's 36pt; the rest carry the read chip's
 * 27pt (5 + 17 + 5), since most of a history is read. That is the real screen's commonest shape.
 */
export const HizbPlanHistorySkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<ScreenContainer contentContainerStyle={styles.flush} isScrollable={false}>
			<View style={styles.listContent}>
				<ScreenHeaderSkeleton hasBackButton subtitleWidth='44%' title={t('hpHistoryTitle')} />
				<SkeletonPulse>
					{Array.from({ length: ROW_COUNT }, (_, index) => (
						<View
							key={index}
							style={[
								styles.row,
								{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
								index === 0
									? [styles.rowFirst, { borderTopColor: theme.colors.border }]
									: { borderTopColor: theme.colors.divider },
								index === ROW_COUNT - 1 ? styles.rowLast : null
							]}
						>
							<View style={styles.date}>
								<Bone height={8} radius={4} tone='soft' width={40} />
							</View>
							<View style={styles.title}>
								<Bone height={9} radius={4.5} width='70%' />
							</View>
							{index === 0 ? (
								<Bone height={36} radius={11} width={52} />
							) : (
								<Bone height={27} radius={7} tone='soft' width={76} />
							)}
						</View>
					))}
				</SkeletonPulse>
				<SkeletonStatusRow label={t('loadingRounds')} />
			</View>
		</ScreenContainer>
	);
};

/* `HizbPlanHistoryScreen`'s own measures. */
const styles = StyleSheet.create({
	flush: { paddingHorizontal: 0 },
	listContent: { paddingBottom: 24, paddingHorizontal: 20, paddingTop: 8 },
	row: {
		alignItems: 'center',
		borderLeftWidth: StyleSheet.hairlineWidth,
		borderRightWidth: StyleSheet.hairlineWidth,
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 10
	},
	rowFirst: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 12 },
	rowLast: {
		borderBottomLeftRadius: 18,
		borderBottomRightRadius: 18,
		borderBottomWidth: StyleSheet.hairlineWidth,
		paddingBottom: 12
	},
	date: { width: 52 },
	title: { flex: 1, minWidth: 0 }
});
