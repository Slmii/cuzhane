import { Bone } from '@/components/Skeleton/Skeleton.component';
import { SkeletonSpinner } from '@/components/Skeleton/SkeletonSpinner.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { StyleSheet, View } from 'react-native';

/** `SVG_SIZE` in `DockRing` — the ring the arc is drawn on. */
const RING_SIZE = 204;
/** Enough rows to reach the fold; the real list is however many groups the reader has. */
const ROW_COUNT = 6;

/**
 * Ana ekran yükleniyor.
 *
 * Modelled on what Home actually renders, not on the B5 frame — the screen has moved on
 * since that was drawn. Four lines stack above the ring (eyebrow, group name, "senin payın",
 * range) with the total pill at the right, the core holds **two** lines rather than three,
 * and there is no dash row: those were removed from the design and never came back.
 *
 * The ring is a live spinner and everything around it is still. That is the whole
 * performance story of these frames — one animated node carries the motion instead of a
 * shimmer or a pulse repainting every placeholder. Don't add a breathing wrapper here.
 */
export const HomeSkeleton = () => {
	const { t } = useTranslation();

	return (
		<View style={styles.root}>
			{/* The 72/128 pill, parked at the right on the eyebrow's line. */}
			<Bone height={26} radius={9} style={styles.totalChip} tone='soft' width={62} />

			<View style={styles.hero}>
				{/* HALKADA */}
				<Bone height={8} radius={4} tone='soft' width={62} />
				{/* The group's name. */}
				<Bone height={15} radius={7} style={styles.heroName} width={132} />
				{/* Senin payın */}
				<Bone height={9} radius={4.5} style={styles.heroCaption} tone='soft' width={76} />
				{/* The range itself — the biggest thing on the screen. */}
				<Bone height={24} radius={8} style={styles.heroRange} width={104} />
			</View>

			<View style={styles.ringRow}>
				<SkeletonSpinner size={RING_SIZE} />
				{/* Two lines, matching the core: the count with its unit, then the action. */}
				<View pointerEvents='none' style={styles.ringCore}>
					<Bone height={22} radius={7} width={62} />
					<Bone height={11} radius={5} tone='soft' width={96} />
				</View>
			</View>

			<CardSurface style={styles.summary}>
				<View style={styles.summaryRow}>
					<Bone height={9} radius={4.5} width={92} />
					<Bone height={8} radius={4} tone='soft' width={74} />
				</View>
				<Bone height={6} radius={3} width='100%' />
			</CardSurface>

			<View style={styles.listHeader}>
				<Bone height={8} radius={4} tone='soft' width={56} />
				<Bone height={8} radius={4} tone='soft' width={82} />
			</View>

			{/* Five columns: accent bar, range, name, progress, count. */}
			<CardSurface isFlush style={styles.list}>
				{Array.from({ length: ROW_COUNT }, (_, index) => (
					<View key={index} style={styles.row}>
						<Bone height={20} radius={3} width={5} />
						<Bone height={8} radius={4} tone='soft' width={56} />
						<Bone height={9} radius={4.5} style={styles.rowName} />
						<Bone height={5} radius={3} width={50} />
						<Bone height={8} radius={4} tone='soft' width={34} />
					</View>
				))}
			</CardSurface>

			<SkeletonStatusRow label={t('loadingHome')} />
		</View>
	);
};

const styles = StyleSheet.create({
	hero: {
		alignItems: 'center',
		paddingTop: 6
	},
	heroCaption: {
		marginTop: 14
	},
	heroName: {
		marginTop: 9
	},
	heroRange: {
		marginTop: 10
	},
	list: {
		paddingVertical: 4
	},
	listHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 8,
		marginTop: 16
	},
	ringCore: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		gap: 10,
		justifyContent: 'center'
	},
	ringRow: {
		alignItems: 'center',
		paddingBottom: 4,
		paddingTop: 18
	},
	root: {
		flex: 1,
		paddingHorizontal: 20,
		paddingTop: 2
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 14,
		paddingVertical: 9
	},
	rowName: {
		flex: 1,
		minWidth: 0
	},
	summary: {
		gap: 9,
		marginTop: 16,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	summaryRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	totalChip: {
		position: 'absolute',
		right: 20,
		top: 6,
		zIndex: 1
	}
});
