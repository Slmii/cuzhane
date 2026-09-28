import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/**
 * Three rounds, newest first, each holding a cüz or two — the open one carrying its note.
 * The widths are the cells' own 30pt squares; the open round's has the trailing "bugün".
 */
const ROUNDS = [
	{ cellCount: 1, hasNote: true },
	{ cellCount: 2, hasNote: false },
	{ cellCount: 1, hasNote: false }
] as const;
/** `HatimProgress`'s 30pt cell. */
const CELL_SIZE = 30;
/** Its 38pt missed tile, and a `sm` "Oku" beside it. */
const MISSED_TILE_SIZE = 38;
const BUTTON_HEIGHT = 36;

/**
 * Q6l · İlerleme yükleniyor — a hatim's record, below the screen's own header, which is known
 * before the data and stays drawn.
 *
 * **Our Q6, not the frame's.** The frame loads under three tiles and a card of rows with one
 * or two squares in each. The screen has the same three tiles and the per-round card, but also
 * its section headings, the three-swatch key under the card, and the "Kaçırılan cüzler" list
 * with an "Oku" on each row — all stubbed here, so the page fills in rather than grows. One
 * missed row is drawn: whether there are any is exactly what the data has not said yet.
 */
export const HatimProgressSkeleton = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<>
			<SkeletonPulse style={styles.stack}>
				<View style={styles.stats}>
					{[40, 20, 36].map(valueWidth => (
						<CardSurface isFlush key={valueWidth} style={styles.statTile}>
							<Bone height={20} radius={7} style={styles.statValue} width={valueWidth} />
							<Bone height={7} radius={3.5} style={styles.statLabel} tone='soft' width={52} />
						</CardSurface>
					))}
				</View>

				<View style={styles.sectionHead}>
					<Bone height={13} radius={6} style={styles.sectionTitle} width={112} />
					<Bone height={8} radius={4} tone='soft' width={70} />
				</View>

				<CardSurface isFlush>
					{ROUNDS.map((round, index) => (
						<View
							key={index}
							style={[
								styles.roundRow,
								index < ROUNDS.length - 1
									? {
											borderBottomColor: theme.colors.divider,
											borderBottomWidth: StyleSheet.hairlineWidth
									  }
									: null
							]}
						>
							<View style={styles.roundLabel}>
								<Bone height={8} radius={4} tone='soft' width={34} />
							</View>
							<View style={styles.cells}>
								{Array.from({ length: round.cellCount }, (_, cellIndex) => (
									<Bone height={CELL_SIZE} key={cellIndex} radius={8} width={CELL_SIZE} />
								))}
							</View>
							{round.hasNote ? <Bone height={8} radius={4} tone='soft' width={34} /> : null}
						</View>
					))}
				</CardSurface>

				<View style={styles.legend}>
					{[40, 58, 44].map(width => (
						<View key={width} style={styles.legendItem}>
							<Bone height={9} radius={3} width={9} />
							<Bone height={8} radius={4} tone='soft' width={width} />
						</View>
					))}
				</View>

				<View style={styles.sectionHead}>
					<Bone height={13} radius={6} style={styles.sectionTitle} width={124} />
				</View>

				<CardSurface style={styles.missedCard}>
					<Bone height={MISSED_TILE_SIZE} radius={11} width={MISSED_TILE_SIZE} />
					<View style={styles.missedCopy}>
						<Bone height={11} radius={5} style={styles.missedTitle} width='42%' />
						<Bone height={8} radius={4} style={styles.missedSub} tone='soft' width='78%' />
					</View>
					<Bone height={BUTTON_HEIGHT} radius={11} width={58} />
				</CardSurface>
			</SkeletonPulse>

			<SkeletonStatusRow label={t('loadingProgress')} />
		</>
	);
};

const styles = StyleSheet.create({
	cells: {
		flex: 1,
		flexDirection: 'row',
		gap: 5
	},
	legend: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 14
	},
	// Each entry sits on the caption's 17pt line.
	legendItem: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6,
		height: 17
	},
	// `HatimProgress`'s `missedCard`.
	missedCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 14,
		paddingVertical: 13
	},
	missedCopy: {
		flex: 1,
		minWidth: 0
	},
	// The caption's 17pt line under the copy's 2pt gap.
	missedSub: {
		marginBottom: 4.5,
		marginTop: 6.5
	},
	// Centred in `BodyStrongText`'s 18pt line.
	missedTitle: {
		marginVertical: 3.5
	},
	roundLabel: {
		width: 44
	},
	// `HatimProgress`'s `roundRow`, a cell tall.
	roundRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 12
	},
	sectionHead: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	// Centred in `TitleText`'s 22pt line, which sets the heading's height.
	sectionTitle: {
		marginVertical: 4.5
	},
	stack: {
		gap: 12
	},
	statLabel: {
		// `StatTile`'s 4 under the value, centred in the label's 14pt line.
		marginBottom: 3.5,
		marginTop: 7.5
	},
	statTile: {
		flex: 1,
		padding: 14
	},
	// Centred in `NumericText`'s 28pt line.
	statValue: {
		marginVertical: 4
	},
	stats: {
		flexDirection: 'row',
		gap: 8
	}
});
