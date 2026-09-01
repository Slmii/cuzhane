import { Bone } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** `skCells4` — four closed rounds beneath the open one. */
const PAST_ROUND_COUNT = 4;

/**
 * F2 · Turlar yükleniyor.
 *
 * The open round keeps its accent border while loading. It is the only structural
 * difference between the two kinds of card here, and without it the list would resolve from
 * "five identical cards" into "one highlighted and four not", which reads as the layout
 * changing rather than filling in.
 */
export const RoundsSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View>
			{/* No eyebrow bone: `ScreenHeader` reserves no eyebrow row, so one here made the
			    block taller than the header replacing it. */}
			<View style={styles.header}>
				<View style={styles.headerRow}>
					<Bone height={20} radius={9} width={126} />
					<Bone height={20} radius={6} width={62} />
				</View>
				<View style={styles.headerCopy}>
					<Bone height={8} radius={4} tone='soft' width='100%' />
					<Bone height={8} radius={4} tone='soft' width='64%' />
				</View>
			</View>

			<CardSurface style={[styles.openCard, { borderColor: theme.colors.accent }]}>
				<View style={styles.openHeader}>
					<View style={styles.openHeaderCopy}>
						<Bone height={14} radius={6} width={92} />
						<Bone height={8} radius={4} tone='soft' width={126} />
					</View>
					<Bone height={20} radius={6} width={56} />
				</View>
				<View style={styles.openMeta}>
					<Bone height={22} radius={7} width={42} />
					<Bone height={9} radius={4.5} tone='soft' width={62} />
					<Bone height={8} radius={4} style={styles.openMetaTrailing} tone='soft' width={52} />
				</View>
				<Bone height={6} radius={3} width='100%' />
			</CardSurface>

			<View style={styles.pastList}>
				{Array.from({ length: PAST_ROUND_COUNT }, (_, index) => (
					<CardSurface key={index} style={styles.pastCard}>
						<View style={styles.pastHeader}>
							<View style={styles.pastHeaderCopy}>
								<Bone height={9} radius={4.5} width={74} />
								<Bone height={8} radius={4} tone='soft' width={104} />
							</View>
							<Bone height={18} radius={6} tone='soft' width={52} />
						</View>
						<View style={styles.pastMeta}>
							<Bone height={5} radius={3} style={styles.pastBar} />
							<Bone height={8} radius={4} tone='soft' width={44} />
						</View>
					</CardSurface>
				))}
			</View>

			<SkeletonStatusRow label={t('loadingRounds')} />
		</View>
	);
};

const styles = StyleSheet.create({
	/*
	 * Clear of the navigator's back button, exactly as `ScreenHeader` is on the screen this
	 * stands in for. Without it the skeleton's own title bone sat under the floating control
	 * — and a stand-in that starts in a different place than the real thing defeats the point
	 * of having one.
	 */
	header: {
		paddingBottom: 16,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	headerCopy: {
		gap: 7
	},
	headerRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		marginBottom: 9
	},
	openCard: {
		borderWidth: 1,
		marginBottom: 12,
		padding: 16
	},
	openHeader: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		marginBottom: 12
	},
	openHeaderCopy: {
		gap: 7
	},
	openMeta: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 7,
		marginBottom: 9
	},
	openMetaTrailing: {
		marginLeft: 'auto'
	},
	pastBar: {
		flex: 1
	},
	pastCard: {
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	pastHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		marginBottom: 10
	},
	pastHeaderCopy: {
		gap: 6
	},
	pastList: {
		gap: 9
	},
	pastMeta: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	}
});
