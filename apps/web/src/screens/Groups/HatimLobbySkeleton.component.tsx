import { CUZ_CELL_RADIUS } from '@/components/CuzMap/CuzMap.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { CUZ_COUNT } from '@/lib/utils/units';
import { StyleSheet, View } from 'react-native';
import { LobbyInviteSkeleton } from './LobbySkeleton.component';

/** `CuzMap`'s picker geometry — the lobby draws the thirty six across. */
const MAP_COLUMNS = 6;
const MAP_GAP = 5;
/** `CuzMapLegend`'s three keys: read, free, yours. */
const LEGEND_COUNT = 3;

/**
 * QC5l · Hatim lobisi yükleniyor — the creator's lobby for a hatim, before it arrives.
 *
 * **Our lobby, not the frame's.** The frame is three bones and a grid; this is what `LobbyScreen`
 * actually draws for a hatim, card for card, so the page fills in rather than rearranging:
 *
 * - **The fill card counts cüz, not people** — the taken count, the bar, then the thirty on
 *   `CuzMap`'s own six-across grid with its key under it, where the Cevşen lobby has seats.
 * - **The invite card carries the QR and "who is in"** — the plate, then the avatar row above
 *   the auto-start switch — which the frame predates. It is the Cevşen lobby's card, shared.
 * - **Başlat and its hint close the column**, as on the screen.
 */
export const HatimLobbySkeleton = () => {
	const { theme } = useThemeContext();

	return (
		<View>
			<SkeletonPulse style={styles.stack}>
				{/* The name and "sayım başlamadı" — the back control is the navigator's, above. */}
				<View style={styles.header}>
					<Bone height={22} radius={9} width={150} />
					<Bone height={9} radius={4.5} style={styles.subtitle} tone='soft' width={168} />
				</View>

				{/* KURUCU · TOPLANIYOR */}
				<View style={styles.stateRow}>
					<Bone height={9} radius={4.5} tone='soft' width={64} />
					<Bone height={22} radius={7} width={96} />
				</View>

				<CardSurface>
					<View style={styles.fillRow}>
						<Bone height={22} radius={7} width={28} />
						<Bone height={10} radius={5} tone='soft' width={96} />
						<Bone height={9} radius={4.5} style={styles.trailing} tone='soft' width={52} />
					</View>
					<Bone height={6} radius={3} style={styles.fillBar} width='100%' />

					{/*
					 * Explicit rows of `flex: 1` with the gap as padding, as `GridSkeleton` lays its
					 * lattice — six at a percentage each plus a row gap overflow and wrap early.
					 */}
					<View style={styles.map}>
						{Array.from({ length: CUZ_COUNT / MAP_COLUMNS }, (_, rowIndex) => (
							<View key={rowIndex} style={styles.mapRow}>
								{Array.from({ length: MAP_COLUMNS }, (_, cellIndex) => (
									<View key={cellIndex} style={styles.mapSlot}>
										{/* A plain view, not a `Bone`: its default height would override `aspectRatio`. */}
										<View style={[styles.mapCell, { backgroundColor: theme.colors.secondary }]} />
									</View>
								))}
							</View>
						))}
					</View>

					<View style={styles.legend}>
						{Array.from({ length: LEGEND_COUNT }, (_, index) => (
							<View key={index} style={styles.legendEntry}>
								<Bone height={11} radius={4} width={11} />
								<Bone height={8} radius={4} tone='soft' width={44} />
							</View>
						))}
					</View>

					{/* "Boş kalan cüz havuza gider…" — two lines of caption on a phone. */}
					<View style={styles.poolNote}>
						<Bone height={9} radius={4.5} tone='soft' width='92%' />
						<Bone height={9} radius={4.5} tone='soft' width='58%' />
					</View>
				</CardSurface>

				<LobbyInviteSkeleton />

				<Bone height={54} radius={15} width='100%' />
				<Bone height={9} radius={4.5} style={styles.startHint} tone='soft' width={236} />
			</SkeletonPulse>
		</View>
	);
};

const styles = StyleSheet.create({
	fillBar: {
		marginBottom: 13,
		marginTop: 10
	},
	// The height of the taken count's `NumericText` line, which the bones inside it are shorter than.
	fillRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		minHeight: 28
	},
	/*
	 * Clear of the navigator's back button, as `ScreenHeader` is on the screen this stands in
	 * for, with the heading block's own 18 underneath.
	 */
	header: {
		paddingBottom: 18,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	legend: {
		flexDirection: 'row',
		gap: 14,
		marginTop: 12
	},
	legendEntry: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	map: {
		// The slots' padding already spaces the cells; this pulls the outer half-gap back in.
		margin: -MAP_GAP / 2
	},
	mapCell: {
		aspectRatio: 1,
		borderRadius: CUZ_CELL_RADIUS,
		width: '100%'
	},
	mapRow: {
		flexDirection: 'row'
	},
	mapSlot: {
		flex: 1,
		flexDirection: 'row',
		padding: MAP_GAP / 2
	},
	poolNote: {
		gap: 6,
		marginTop: 12
	},
	/** The column's own 12 — `LobbyScreen` spaces its cards by `ScreenContainer`'s gap alone. */
	stack: {
		gap: 12
	},
	startHint: {
		alignSelf: 'center'
	},
	stateRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	subtitle: {
		marginTop: 9
	},
	trailing: {
		marginLeft: 'auto'
	}
});
