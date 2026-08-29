import { Bone } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** `skCells` — the spots picker's seats, at the count the frame draws. */
const SEAT_COUNT = 12;
const MEMBER_ROW_COUNT = 4;

/**
 * D6/D8/D10 · Önizleme yükleniyor.
 *
 * The design draws three of these — devam eden, başlamamış and dolu — because on the canvas
 * each one sits in front of the preview it loads. **The app can only have one.** The
 * skeleton renders while the group is still being fetched, which is precisely the moment
 * nothing knows whether it is running, unstarted or full; choosing between the three would
 * need the answer the screen is waiting for.
 *
 * D6 is the one modelled here: the three differ only in bone widths and padding, and the
 * running variant is both the commonest and the tallest, so it is the one whose height is
 * worth reserving.
 */
export const InvitePreviewSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;

	return (
		<View>
			<Bone height={9} radius={4.5} style={styles.eyebrow} tone='soft' width={62} />

			<View style={styles.chipRow}>
				<Bone height={20} radius={6} width={62} />
				<Bone height={20} radius={6} tone='soft' width={52} />
			</View>

			<Bone height={22} radius={9} width={182} />
			<Bone height={9} radius={4.5} style={styles.subtitle} tone='soft' width={138} />

			{/* Progress card. */}
			<CardSurface style={styles.progressCard}>
				<View style={styles.spread}>
					<Bone height={8} radius={4} tone='soft' width={86} />
					<Bone height={9} radius={4.5} tone='soft' width={54} />
				</View>
				<Bone height={7} radius={4} style={styles.progressBar} width='100%' />
				<Bone height={8} radius={4} tone='soft' width={166} />
			</CardSurface>

			{/* Seats card. */}
			<CardSurface style={styles.seatsCard}>
				<View style={[styles.spread, styles.seatsHeader]}>
					<Bone height={8} radius={4} tone='soft' width={104} />
					<Bone height={9} radius={4.5} tone='soft' width={62} />
				</View>
				<View style={styles.seatGrid}>
					{Array.from({ length: SEAT_COUNT }, (_, index) => (
						<Bone key={index} height={26} radius={8} width={34} />
					))}
				</View>
				<View style={styles.seatsCopy}>
					<Bone height={8} radius={4} tone='soft' width='100%' />
					<Bone height={8} radius={4} tone='soft' width='72%' />
				</View>
			</CardSurface>

			{/* The detail rows — cycle, split, timezone and so on. */}
			<CardSurface isFlush style={styles.detailCard}>
				{Array.from({ length: MEMBER_ROW_COUNT }, (_, index) => (
					<View
						key={index}
						style={[
							styles.detailRow,
							index === MEMBER_ROW_COUNT - 1 ? null : { borderBottomColor: divider, borderBottomWidth: 1 }
						]}
					>
						<Bone height={9} radius={4.5} tone='soft' width={64} />
						<Bone height={9} radius={4.5} width={52} />
					</View>
				))}
			</CardSurface>

			<SkeletonStatusRow label={t('loadingPreview')} />
		</View>
	);
};

const styles = StyleSheet.create({
	chipRow: {
		flexDirection: 'row',
		gap: 6,
		marginBottom: 10
	},
	detailCard: {
		marginTop: 11
	},
	detailRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	eyebrow: {
		marginBottom: 14
	},
	progressBar: {
		marginBottom: 9,
		marginTop: 12
	},
	progressCard: {
		marginTop: 20,
		padding: 17
	},
	seatGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6
	},
	seatsCard: {
		marginTop: 11,
		padding: 17
	},
	seatsCopy: {
		gap: 7,
		marginTop: 13
	},
	seatsHeader: {
		marginBottom: 12
	},
	spread: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	},
	subtitle: {
		marginTop: 9
	}
});
