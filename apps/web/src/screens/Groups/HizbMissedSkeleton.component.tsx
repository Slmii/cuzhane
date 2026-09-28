import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeaderSkeleton } from '@/components/Skeleton/ScreenHeaderSkeleton.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** Enough cards to fill the screen under the heading. */
const ROW_COUNT = 5;

/**
 * T2 · Kaçırılan günler yükleniyor — `HizbMissedScreen` before its data: the same container and
 * list padding, its heading (the subtitle's count is the data's, so a bone), then the cards —
 * the date badge in its red, a title and description, and the "Oku" button.
 *
 * Every card is drawn with a description: most portions have one, and a card without is only
 * the badge's height anyway (48 sets every row), so nothing moves either way.
 */
export const HizbMissedSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<ScreenContainer contentContainerStyle={styles.flush} isScrollable={false}>
			<View style={styles.listContent}>
				<ScreenHeaderSkeleton
					eyebrow={t('hpMyProgress')}
					hasBackButton
					subtitleWidth='78%'
					title={t('hpMissedTitle')}
				/>
				<SkeletonPulse style={styles.rows}>
					{Array.from({ length: ROW_COUNT }, (_, index) => (
						<CardSurface key={index} style={styles.row}>
							{/* Every missed day's badge is this red, so it keeps its fill. */}
							<View style={[styles.dateBadge, { backgroundColor: theme.colors.missedSurface }]} />
							<View style={styles.copy}>
								{/* The title's 17pt line, then the description's 16 under a 2pt gap. */}
								<Bone height={9} radius={4.5} style={styles.title} width='58%' />
								<Bone height={8} radius={4} style={styles.desc} tone='soft' width='86%' />
							</View>
							<Bone height={36} radius={11} width={52} />
						</CardSurface>
					))}
				</SkeletonPulse>
				<SkeletonStatusRow label={t('loadingGroup')} />
			</View>
		</ScreenContainer>
	);
};

/* `HizbMissedScreen`'s own measures. */
const styles = StyleSheet.create({
	flush: { paddingHorizontal: 0 },
	listContent: { gap: 9, paddingBottom: 24, paddingHorizontal: 20, paddingTop: 8 },
	rows: { gap: 9 },
	row: { alignItems: 'center', flexDirection: 'row', gap: 13, paddingHorizontal: 16, paddingVertical: 14 },
	dateBadge: { borderRadius: 13, height: 48, width: 44 },
	copy: { flex: 1, minWidth: 0 },
	title: { marginVertical: 4 },
	desc: { marginBottom: 4, marginTop: 6 }
});
