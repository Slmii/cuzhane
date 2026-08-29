import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/**
 * The design's `skRowsTwo` — two cards, not a screenful. A placeholder list only has to
 * establish that cards are coming and roughly how tall they are; filling the viewport with
 * bones overstates how much is on its way and makes the real list feel shorter when it
 * lands.
 */
const CARD_COUNT = 2;

/**
 * The loading stand-in for a list of `GroupCard`s — the D1 (Gruplarım) and D3 (Keşfet)
 * frames are the same skeleton, so the two screens share it rather than each drawing their
 * own and drifting.
 *
 * One pulse wraps the whole list, never one per card: the mapper count is what costs, and a
 * loading screen is on precisely while the app is already busy.
 */
export const GroupCardSkeleton = ({ count = CARD_COUNT, statusLabel }: { count?: number; statusLabel: string }) => {
	const { theme } = useThemeContext();

	return (
		<View>
			<SkeletonPulse style={styles.list}>
				{Array.from({ length: count }, (_, index) => (
					<CardSurface key={index} style={styles.card}>
						{/* Title and subtitle, against the two stacked status chips. */}
						<View style={styles.headerRow}>
							<View style={styles.headerCopy}>
								<Bone height={15} radius={7} width={118} />
								<Bone height={8} radius={4} tone='soft' width={88} />
							</View>
							<View style={styles.headerBadges}>
								<Bone height={18} radius={6} width={48} />
								<Bone height={18} radius={6} tone='soft' width={58} />
							</View>
						</View>

						{/* The range chip beside its caption. */}
						<View style={styles.rangeRow}>
							<Bone height={22} radius={7} width={42} />
							<Bone height={9} radius={4.5} tone='soft' width={62} />
						</View>

						<Bone height={6} radius={3} style={styles.bar} width='100%' />

						<View style={styles.metaRow}>
							<Bone height={8} radius={4} tone='soft' width={104} />
							<Bone height={8} radius={4} tone='soft' width={56} />
						</View>

						<View style={[styles.footerRow, { borderTopColor: theme.colors.divider }]}>
							<View style={styles.footerCopy}>
								<Bone height={9} radius={4.5} width={86} />
								<Bone height={8} radius={4} tone='soft' width={62} />
							</View>
							<Bone height={38} radius={11} width={82} />
						</View>
					</CardSurface>
				))}
			</SkeletonPulse>

			{/* Outside the pulse: the one thing here that should stay legible, not breathe. */}
			<SkeletonStatusRow label={statusLabel} />
		</View>
	);
};

const styles = StyleSheet.create({
	bar: {
		marginBottom: 16
	},
	card: {
		padding: 18
	},
	footerCopy: {
		gap: 5
	},
	footerRow: {
		alignItems: 'center',
		borderTopWidth: 1,
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between',
		paddingTop: 14
	},
	headerBadges: {
		alignItems: 'flex-end',
		gap: 5
	},
	headerCopy: {
		gap: 7
	},
	headerRow: {
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		marginBottom: 14
	},
	list: {
		gap: 12
	},
	metaRow: {
		flexDirection: 'row',
		gap: 7,
		marginBottom: 14
	},
	rangeRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 7,
		marginBottom: 8
	}
});
