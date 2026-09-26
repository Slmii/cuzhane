import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { HIZB_WORKS } from '@/lib/content/hizbPortions';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';
import { HIZB_CELL_RADIUS, HIZB_CELL_SIZE, hizbBoardLayout } from './HizbBoard.component';
import type { HizbBoardSkeletonProps } from './HizbBoard.types';
import { hizbLegendLayout } from './HizbLegend.component';

/** The legend's four entries. */
const LEGEND_COUNT = 4;

/**
 * The Hizb board before its cells arrive, in the board's own frame: every work's row with as
 * many cells as the work has portions, so the stand-in is the board's exact height and the
 * page under it does not move when the real one lands. The work names are bones rather than
 * text — they would be real, but a row of names beside grey squares reads as a board that
 * loaded empty.
 */
export const HizbBoardSkeleton = ({ style }: HizbBoardSkeletonProps) => {
	const { theme } = useThemeContext();

	return (
		<CardSurface isFlush style={style}>
			<SkeletonPulse>
				<View style={[hizbBoardLayout.header, { borderBottomColor: theme.colors.divider }]}>
					{/* The heading's own line height, so the band is as tall as the one it stands in for. */}
					<View style={styles.titleLine}>
						<Bone height={12} radius={6} width={128} />
					</View>
				</View>
				<View style={hizbBoardLayout.body}>
					{HIZB_WORKS.map((work, index) => (
						<View key={work.key} style={hizbBoardLayout.row}>
							<View style={hizbBoardLayout.rowTitle}>
								{/* A spread of lengths, so the column doesn't read as a ruler. */}
								<Bone height={8} radius={4} tone='soft' width={`${46 + ((index * 17) % 34)}%`} />
							</View>
							<View style={hizbBoardLayout.cells}>
								{Array.from({ length: work.parts[1] - work.parts[0] + 1 }, (_, cellIndex) => (
									<Bone
										height={HIZB_CELL_SIZE}
										key={cellIndex}
										radius={HIZB_CELL_RADIUS}
										width={HIZB_CELL_SIZE}
									/>
								))}
							</View>
						</View>
					))}
					<View style={hizbLegendLayout.legend}>
						{Array.from({ length: LEGEND_COUNT }, (_, index) => (
							<View key={index} style={hizbLegendLayout.legendEntry}>
								<Bone height={11} radius={3} width={11} />
								<Bone height={8} radius={4} tone='soft' width={46} />
							</View>
						))}
					</View>
				</View>
			</SkeletonPulse>
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	// `TitleText`'s 22.
	titleLine: {
		height: 22,
		justifyContent: 'center'
	}
});
