import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { StyleSheet, View } from 'react-native';

/**
 * The Reminders screen, before its settings arrive: the time card, the toggle row and the
 * notification preview.
 *
 * The screen title is real and sits outside this — it is a constant, not something the
 * request supplies — so only the three cards are stubbed.
 */
export const RemindersSkeleton = () => {
	const { t } = useTranslation();

	return (
		<View>
			<SkeletonPulse style={styles.stack}>
				{/* The big centred clock. */}
				<CardSurface style={styles.timeCard}>
					<Bone height={9} radius={4.5} tone='soft' width={64} />
					<Bone height={40} radius={12} width={148} />
					<Bone height={8} radius={4} tone='soft' width={128} />
				</CardSurface>

				<CardSurface style={styles.toggleCard}>
					<View style={styles.toggleCopy}>
						<Bone height={12} radius={5} width={132} />
						<Bone height={8} radius={4} tone='soft' width={186} />
					</View>
					<Bone height={22} radius={11} width={38} />
				</CardSurface>

				<Bone height={9} radius={4.5} tone='soft' width={72} />

				<CardSurface style={styles.previewCard}>
					<Bone height={30} radius={9} width={30} />
					<View style={styles.previewCopy}>
						<Bone height={11} radius={5} width={118} />
						<Bone height={8} radius={4} tone='soft' width='86%' />
					</View>
				</CardSurface>
			</SkeletonPulse>

			<SkeletonStatusRow label={t('loadingReminders')} />
		</View>
	);
};

const styles = StyleSheet.create({
	previewCard: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 12
	},
	previewCopy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	stack: {
		gap: 12
	},
	timeCard: {
		alignItems: 'center',
		gap: 11,
		paddingVertical: 20
	},
	toggleCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 14
	},
	toggleCopy: {
		flex: 1,
		gap: 8,
		minWidth: 0
	}
});
