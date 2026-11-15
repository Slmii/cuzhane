import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { SkeletonSpinner } from '@/components/Skeleton/SkeletonSpinner.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, View } from 'react-native';

/** Two rows: most joiners take one or two cüz, and two reserves the height without overshooting. */
const CUZ_ROW_COUNT = 2;

/**
 * QJ4 · Katıldın — cüzlerin hazır, while the group is still being read.
 *
 * **Its own skeleton because the card is a different thing.** A Cevşen joiner is handed a range
 * — one numeral in the display face, which is what `JoinedWelcomeSkeleton` stands in for — while
 * a hatim joiner is handed cüz, one row each: the number in an accent tile and the suras it
 * spans. And the footer holds one button, not two, because a hatim offers no reminder (see
 * `JoinedWelcomeScreen`), so the Cevşen skeleton's second bone was a control that never arrives.
 *
 * **The running state only**, as QJ4 is. A hatim still gathering waits with the hatched range
 * card and two buttons, which is the Cevşen shape too — `JoinedWelcomeScreen` picks this one
 * only when the cached group says it is a running hatim.
 */
export const HatimJoinedSkeleton = () => {
	const { theme } = useThemeContext();

	return (
		<View style={styles.root}>
			{/* The hero's 66pt circle, turning — the same arrival `JoinedWelcomeSkeleton` draws. */}
			<View style={styles.spinner}>
				<SkeletonSpinner size={66} thickness={3} />
			</View>

			{/* One pulse for every bone, the button at the foot included. */}
			<SkeletonPulse style={styles.pulse}>
				<View>
					<Bone height={24} radius={9} style={styles.title} width={214} />
					<View style={styles.subtitle}>
						<Bone height={9} radius={4.5} tone='soft' width={236} />
						<Bone height={9} radius={4.5} tone='soft' width={168} />
					</View>

					<CardSurface style={styles.rangeCard}>
						<Bone height={8} radius={4} style={styles.eyebrow} tone='soft' width={92} />
						<View style={styles.cuzRows}>
							{Array.from({ length: CUZ_ROW_COUNT }, (_, index) => (
								<View
									key={index}
									style={[
										styles.cuzRow,
										{ backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md }
									]}
								>
									<Bone height={44} radius={theme.radius.sm} width={44} />
									<Bone height={9} radius={4.5} tone='soft' width='56%' />
								</View>
							))}
						</View>
						{/* The round's end: its line, then the reader's own clock under it. */}
						<View style={[styles.roundEnd, { borderTopColor: theme.colors.divider }]}>
							<Bone height={9} radius={4.5} tone='soft' width={168} />
							<Bone height={9} radius={4.5} width={112} />
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
	cuzRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		padding: 8
	},
	cuzRows: {
		gap: 8,
		marginTop: 14
	},
	eyebrow: {
		alignSelf: 'center'
	},
	/* Pushes the button to the foot, as the screen's own `content` style does. */
	pulse: {
		flex: 1,
		justifyContent: 'space-between'
	},
	/* `JoinedWelcomeScreen`'s own card: 28 under the copy, 22 of padding. */
	rangeCard: {
		marginTop: 28,
		padding: 22
	},
	roundEnd: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: 8,
		marginTop: 16,
		paddingTop: 13
	},
	/* The 64 the screen's hero starts at, clear of the navigator's back button. */
	root: {
		flex: 1,
		paddingBottom: 30,
		paddingTop: 64
	},
	spinner: {
		alignItems: 'center'
	},
	subtitle: {
		alignItems: 'center',
		gap: 8,
		marginTop: 12
	},
	title: {
		alignSelf: 'center',
		marginTop: 22
	}
});
