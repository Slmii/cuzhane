import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { StyleSheet, View } from 'react-native';

/** Two buckets' worth — enough to hold the shape without pretending to know the count. */
const ROW_WIDTHS = [186, 168, 196] as const;

/** P2 before its rows arrive: the heading, a bucket label, and rows at the real row's metrics. */
export const NotificationsSkeleton = () => {
	const { t } = useTranslation();

	return (
		<View>
			<SkeletonPulse style={styles.stack}>
				<View style={styles.header}>
					<Bone height={20} radius={9} width={146} />
				</View>
				<Bone height={9} radius={4.5} tone='soft' width={62} />
				{ROW_WIDTHS.map((bodyWidth, index) => (
					<View key={index} style={styles.row}>
						<Bone height={34} radius={11} width={34} />
						<View style={styles.copy}>
							<Bone height={12} radius={5} width={158} />
							<Bone height={8} radius={4} tone='soft' width={bodyWidth} />
						</View>
					</View>
				))}
			</SkeletonPulse>

			<SkeletonStatusRow label={t('notifInboxTitle')} />
		</View>
	);
};

const styles = StyleSheet.create({
	copy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	header: {
		paddingBottom: 18,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	// `NotificationRow`'s own metrics, so nothing shifts as the list lands.
	row: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 13,
		paddingVertical: 12
	},
	stack: {
		gap: 6
	}
});
