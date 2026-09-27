import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CUZ_CELL_RADIUS } from '@/components/CuzMap/CuzMap.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { CUZ_COUNT } from '@/lib/utils/units';
import { StyleSheet, View } from 'react-native';

/** The picker's own geometry — six across, gap 5; see `CuzMap`'s `picker` variant. */
const PICKER_COLUMNS = 6;
const PICKER_GAP = 5;
/** `CuzMapLegend`'s default three: taken, free and chosen. */
const LEGEND_COUNT = 3;

/**
 * QJ3 · Cüz seç, while the free cüz are read — for joining a hatim and for choosing again at a
 * new round, which share this screen.
 *
 * **No design frame**; this mirrors `PickCuzScreen` as it first draws: the heading and its line,
 * the map card with its count row, the thirty and their key, and the button at the foot. No
 * bones for the chosen-cüz card — nothing is chosen when the screen arrives, so the real one
 * isn't there either.
 *
 * It borrowed the invite preview's skeleton before, whose progress bar and seat grid resolved
 * into a heading and a thirty-cell picker: the page changed shape rather than filling in.
 */
export const PickCuzSkeleton = () => {
	const { theme } = useThemeContext();

	return (
		<View style={styles.root}>
			{/* One pulse for every bone, the button included. */}
			<SkeletonPulse style={styles.pulse}>
				<View>
					{/*
					 * `ScreenHeader`'s title and description, clear of the bar. The title is one
					 * line at this width and the description two, as "Boştakilere dokun…" runs.
					 */}
					<View style={styles.header}>
						<Bone height={24} radius={9} width='78%' />
						<View style={styles.headerCopy}>
							<Bone height={9} radius={4.5} tone='soft' width='100%' />
							<Bone height={9} radius={4.5} tone='soft' width='52%' />
						</View>
					</View>

					<CardSurface style={styles.mapCard}>
						<View style={styles.pickHead}>
							<Bone height={10} radius={5} width={78} />
							<Bone height={10} radius={5} tone='soft' width={34} />
						</View>
						{/*
						 * Percentage slots with the gap as padding inside them — six cells at a sixth
						 * plus a row `gap` overflow and wrap early. Plain views in the bone's tone, as
						 * `Bone` always sets a height and a cell is sized by its width.
						 */}
						<View style={styles.map}>
							{Array.from({ length: CUZ_COUNT }, (_, index) => (
								<View key={index} style={styles.mapSlot}>
									<View style={[styles.mapCell, { backgroundColor: theme.colors.secondary }]} />
								</View>
							))}
						</View>
						<View style={styles.legend}>
							{Array.from({ length: LEGEND_COUNT }, (_, index) => (
								<View key={index} style={styles.legendEntry}>
									<Bone height={11} radius={4} width={11} />
									<Bone height={8} radius={4} tone='soft' width={40} />
								</View>
							))}
						</View>
					</CardSurface>
				</View>

				<Bone height={54} radius={15} style={styles.button} width='100%' />
			</SkeletonPulse>
		</View>
	);
};

const styles = StyleSheet.create({
	button: {
		marginTop: 22
	},
	/*
	 * Clear of the navigator's back button and down to the card, as `ScreenHeader` is: 52 above
	 * the title, 18 under the description.
	 */
	header: {
		paddingBottom: 18,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	headerCopy: {
		gap: 6,
		marginTop: 9
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
	// The slots' padding puts half a gap outside the edge cells; this takes it back.
	map: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		margin: -PICKER_GAP / 2
	},
	mapCard: {
		padding: 16
	},
	mapCell: {
		aspectRatio: 1,
		borderRadius: CUZ_CELL_RADIUS,
		width: '100%'
	},
	mapSlot: {
		flexDirection: 'row',
		padding: PICKER_GAP / 2,
		width: `${100 / PICKER_COLUMNS}%`
	},
	pickHead: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12
	},
	/* Pushes the button to the foot, as the screen's own `content` style does. */
	pulse: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	root: {
		flexGrow: 1
	}
});
