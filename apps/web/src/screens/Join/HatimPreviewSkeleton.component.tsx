import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { CUZ_COUNT } from '@/lib/utils/units';
import { StyleSheet, View } from 'react-native';

/** The compact map's own geometry — ten across at a 4pt radius, gap 3; see `CuzMap`. */
const MAP_COLUMNS = 10;
/** `CuzMapLegend` over a map with free cüz left: read, taken, free. */
const LEGEND_COUNT = 3;
/**
 * The rules card of a running hatim: the cap, what happens at the boundary, the round's end
 * (two lines, both clocks) and who made it. `null` marks the two-line row.
 */
const RULE_VALUE_WIDTHS = [48, 72, null, 64] as const;

/**
 * QJ1l · Hatim önizleme yükleniyor.
 *
 * Mirrors `InvitePreviewScreen`'s hatim branch in its running state (QJ1) — the chip row, the
 * name, the cüz map card, the rules card, the note under it, the member count and the button.
 * Running rather than gathering for the reason `InvitePreviewSkeleton` gives: nothing knows the
 * status until the preview this stands in for has arrived.
 *
 * **Departs from the frame where the screen already has.** QJ1l heads with an eyebrow and a row
 * of three stat tiles, and draws the thirty six across; the preview has no tiles — the map card
 * *is* the count — and reports with the compact map, ten across. The frame's list card is the
 * rules card here, row for row.
 */
export const HatimPreviewSkeleton = () => {
	const { theme } = useThemeContext();
	const divider = theme.colors.divider;

	return (
		<View style={styles.root}>
			{/* One pulse for every bone, the button included. */}
			<SkeletonPulse style={styles.pulse}>
				<View>
					{/* Kind, status, cadence — the screen's own three chips, clear of the bar. */}
					<View style={[styles.chipRow, styles.chipRowUnderBar]}>
						<Bone height={20} radius={6} width={46} />
						<Bone height={20} radius={6} tone='soft' width={62} />
						<Bone height={20} radius={6} tone='soft' width={54} />
					</View>

					<Bone height={24} radius={9} width='58%' />
					<Bone height={9} radius={4.5} style={styles.subtitle} tone='soft' width={138} />

					<CardSurface style={styles.mapCard}>
						<View style={styles.mapHead}>
							<View style={styles.mapCount}>
								<Bone height={22} radius={7} width={26} />
								<Bone height={8} radius={4} tone='soft' width={58} />
							</View>
							<Bone height={8} radius={4} tone='soft' width={64} />
						</View>
						{/*
						 * Percentage slots with the gap as padding inside them, as `GroupDetailSkeleton`
						 * lays its pool out: ten cells at `10%` plus a row `gap` overflow and wrap a
						 * column early. Not `MiniGrid` either — it waits a frame for a measurement, and
						 * the point of a skeleton is to hold the height from the first one.
						 *
						 * The cells are plain views in the bone's tone rather than `Bone`s: a cell is
						 * sized by its width, and `Bone` always sets a height, which beats `aspectRatio`.
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

					<CardSurface isFlush style={styles.rulesCard}>
						{RULE_VALUE_WIDTHS.map((valueWidth, index) => (
							<View
								key={index}
								style={[
									styles.ruleRow,
									index < RULE_VALUE_WIDTHS.length - 1
										? { borderBottomColor: divider, borderBottomWidth: StyleSheet.hairlineWidth }
										: null
								]}
							>
								<Bone height={9} radius={4.5} tone='soft' width={index === 2 ? 92 : 70} />
								{valueWidth === null ? (
									// The round's end: the group's clock over the reader's own.
									<View style={styles.ruleValue}>
										<Bone height={9} radius={4.5} width={104} />
										<Bone height={9} radius={4.5} tone='soft' width={82} />
									</View>
								) : (
									<Bone height={9} radius={4.5} width={valueWidth} />
								)}
							</View>
						))}
					</CardSurface>

					<View style={styles.note}>
						<Bone height={8} radius={4} tone='soft' width='100%' />
						<Bone height={8} radius={4} tone='soft' width='66%' />
					</View>

					{/* The member count: the seat stack's three overlapping discs, then its line. */}
					<View style={styles.membersRow}>
						<Bone height={22} radius={11} width={52} />
						<Bone height={9} radius={4.5} tone='soft' width={118} />
					</View>
				</View>

				<Bone height={54} radius={15} style={styles.button} width='100%' />
			</SkeletonPulse>
		</View>
	);
};

const styles = StyleSheet.create({
	chipRow: {
		flexDirection: 'row',
		gap: 6,
		marginBottom: 10
	},
	/* The same band `InvitePreviewScreen` reserves — see `SCREEN_TITLE_PADDING_UNDER_BAR`. */
	chipRowUnderBar: {
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	button: {
		marginTop: 22
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
		flexDirection: 'row',
		flexWrap: 'wrap',
		// The slots' padding puts half a gap outside the edge cells; this takes it back, so the
		// cells land where `CuzMap`'s do (14 above, 12 to the legend, flush at the sides).
		marginBottom: -1.5,
		marginHorizontal: -1.5,
		marginTop: 12.5
	},
	mapCard: {
		marginTop: 20,
		padding: 17
	},
	mapCell: {
		aspectRatio: 1,
		borderRadius: 4,
		width: '100%'
	},
	mapCount: {
		alignItems: 'flex-end',
		flexDirection: 'row',
		gap: 6
	},
	mapHead: {
		alignItems: 'flex-end',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	},
	mapSlot: {
		flexDirection: 'row',
		padding: 1.5,
		width: `${100 / MAP_COLUMNS}%`
	},
	membersRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9,
		marginTop: 16
	},
	note: {
		gap: 7,
		marginTop: 13
	},
	/* Pushes the button to the foot, as the screen's own `content` style does. */
	pulse: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	root: {
		flexGrow: 1
	},
	ruleRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	ruleValue: {
		alignItems: 'flex-end',
		gap: 6
	},
	rulesCard: {
		marginTop: 11
	},
	subtitle: {
		marginTop: 9
	}
});
