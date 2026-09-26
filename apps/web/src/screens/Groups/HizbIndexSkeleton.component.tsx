import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { HIZB_WORKS } from '@/lib/content/hizbPortions';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { StyleSheet, View } from 'react-native';

/**
 * The Fihrist's cards before the board arrives: one closed card per work, each exactly the height
 * of the header it stands in for — `TitleText`'s line over the span's — so nothing moves when the
 * real ones land. The heading above is the screen's own and needs no stand-in.
 */
export const HizbIndexSkeleton = () => {
	const { t } = useTranslation();

	return (
		<>
			<SkeletonPulse style={styles.cards}>
				{HIZB_WORKS.map((work, index) => (
					<CardSurface isFlush key={work.key}>
						<View style={styles.header}>
							<View style={styles.headerCopy}>
								<View style={styles.titleLine}>
									{/* A spread of lengths, so the column doesn't read as a ruler. */}
									<Bone height={12} radius={6} width={`${44 + ((index * 17) % 30)}%`} />
								</View>
								<View style={styles.spanLine}>
									<Bone height={8} radius={4} tone='soft' width={64} />
								</View>
							</View>
							<Bone height={9} radius={4.5} tone='soft' width={24} />
						</View>
					</CardSurface>
				))}
			</SkeletonPulse>
			<SkeletonStatusRow label={t('loadingGroup')} />
		</>
	);
};

const styles = StyleSheet.create({
	// HZ2's gap between cards, the same the screen's list keeps.
	cards: {
		gap: 9
	},
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	headerCopy: {
		flex: 1,
		minWidth: 0
	},
	// `CaptionText`'s 17, two below the title as on the card.
	spanLine: {
		height: 17,
		justifyContent: 'center',
		marginTop: 2
	},
	// `TitleText`'s 22.
	titleLine: {
		height: 22,
		justifyContent: 'center'
	}
});
