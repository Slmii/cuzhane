import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** `SpotsGrid`'s own column count, so the placeholder tiles the same way. */
const SPOT_COLUMNS = 10;
const SPOT_COUNT = 20;

/**
 * The creator's lobby, before the group arrives.
 *
 * **This is C6, not D13.** The design's "Lobi yükleniyor" frame precedes D14 *Katıldın* —
 * it is the waiting *member's* screen, which in this app is `JoinedWelcome`. The creator's
 * lobby is a left-aligned stack of cards with a spots grid and a Başlat button, and a
 * centred spinner-led skeleton in front of it described a screen that never arrived.
 */
export const LobbySkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View>
			<SkeletonPulse>
				{/* Back row, name and the "sayım başlamadı" line. */}
				<View style={styles.header}>
					<Bone height={12} radius={5} style={styles.back} width={46} />
					<Bone height={22} radius={9} width={128} />
					<Bone height={9} radius={4.5} style={styles.subtitle} tone='soft' width={168} />
				</View>

				{/* KURUCU · TOPLANIYOR */}
				<View style={styles.stateRow}>
					<Bone height={9} radius={4.5} tone='soft' width={64} />
					<Bone height={22} radius={7} width={96} />
				</View>

				<CardSurface style={styles.fillCard}>
					<View style={styles.fillRow}>
						<Bone height={22} radius={7} width={22} />
						<Bone height={10} radius={5} tone='soft' width={86} />
						<Bone height={9} radius={4.5} style={styles.openSpots} tone='soft' width={104} />
					</View>
					<Bone height={6} radius={3} style={styles.fillBar} width='100%' />

					{/* The seats, at the grid's real 10 columns. */}
					<View style={styles.spotsGrid}>
						{Array.from({ length: SPOT_COUNT }, (_, index) => (
							<View key={index} style={styles.spotSlot}>
								<Bone height={undefined} radius={4} style={styles.spotCell} />
							</View>
						))}
					</View>

					<Bone height={9} radius={4.5} style={styles.poolNote} tone='soft' width='92%' />
				</CardSurface>

				<CardSurface isFlush style={styles.inviteCard}>
					<View style={[styles.inviteBlock, { borderBottomColor: theme.colors.border }]}>
						<Bone height={9} radius={4.5} style={styles.inviteLabel} tone='soft' width={78} />
						<View style={styles.inviteRow}>
							<Bone height={20} radius={7} style={styles.inviteValue} />
							<Bone height={34} radius={11} width={112} />
						</View>
					</View>
					<View style={styles.toggleRow}>
						<View style={styles.toggleCopy}>
							<Bone height={12} radius={5} width={186} />
							<Bone height={9} radius={4.5} tone='soft' width={214} />
						</View>
						<Bone height={22} radius={11} width={38} />
					</View>
				</CardSurface>

				<Bone height={52} radius={15} style={styles.startButton} width='100%' />
				<Bone height={9} radius={4.5} style={styles.startHint} tone='soft' width={236} />
			</SkeletonPulse>

			<SkeletonStatusRow label={t('loadingLobby')} />
		</View>
	);
};

const styles = StyleSheet.create({
	back: {
		marginBottom: 14
	},
	fillBar: {
		marginBottom: 13,
		marginTop: 10
	},
	fillCard: {
		marginBottom: 11
	},
	fillRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8
	},
	header: {
		paddingBottom: 16,
		paddingTop: 4
	},
	inviteBlock: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		padding: 15
	},
	inviteCard: {
		marginBottom: 11
	},
	inviteLabel: {
		marginBottom: 7
	},
	inviteRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	inviteValue: {
		flex: 1
	},
	openSpots: {
		marginLeft: 'auto'
	},
	poolNote: {
		marginTop: 12
	},
	spotCell: {
		aspectRatio: 1,
		width: '100%'
	},
	spotsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap'
	},
	// Percentage slots with the gap as padding inside them — ten cells at `10%` plus a row
	// `gap` overflow and wrap a column early.
	spotSlot: {
		flexDirection: 'row',
		padding: 1.5,
		width: `${100 / SPOT_COLUMNS}%`
	},
	startButton: {
		marginTop: 2
	},
	startHint: {
		alignSelf: 'center',
		marginTop: 11
	},
	stateRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12
	},
	subtitle: {
		marginTop: 9
	},
	toggleCopy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	toggleRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		padding: 15
	}
});
