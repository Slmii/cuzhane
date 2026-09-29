import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** Enough rows to fill the screen under the heading. */
const ROW_COUNT = 10;

/**
 * `HizbGroupHistoryScreen` before its data: its heading (both lines are constants, so real), then
 * the one card drawn row by row — the date, the day's count, and the chevron.
 */
export const HizbGroupHistorySkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<ScreenContainer contentContainerStyle={styles.flush} isScrollable={false}>
			<View style={styles.listContent}>
				<ScreenHeader hasBackButton subtitle={t('hpGroupHistorySubtitle')} title={t('hpHistoryTitle')} />
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
							<View style={styles.count}>
								<Bone height={9} radius={4.5} width={96} />
							</View>
							<Bone height={10} radius={5} tone='soft' width={8} />
						</View>
					))}
				</SkeletonPulse>
				<SkeletonStatusRow label={t('loadingRounds')} />
			</View>
		</ScreenContainer>
	);
};

/* `HizbGroupHistoryScreen`'s own measures. */
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
		paddingVertical: 14
	},
	rowFirst: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
	rowLast: {
		borderBottomLeftRadius: 18,
		borderBottomRightRadius: 18,
		borderBottomWidth: StyleSheet.hairlineWidth
	},
	date: { width: 52 },
	count: { flex: 1, minWidth: 0 }
});
