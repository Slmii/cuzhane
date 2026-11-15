import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { Bone, SkeletonPulse } from '@/components/Skeleton/Skeleton.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';

/** Rows in the cüz card — a typical share; the real card has one per cüz held. */
const CUZ_ROW_COUNT = 2;
/** "Aynısı", "Yeni seç", "Bu turu geç" — the most the pick ever offers. */
const OPTION_COUNT = 3;

type RoundStartSkeletonProps = {
	/** A required pick (`reason: 'pick'`) offers the choices; a carried-over note has none. */
	isPick: boolean;
};

/**
 * QR1 · Yeni tur — the round-start screen before its group, record and havuz arrive.
 *
 * It has no design frame. It stood behind the *group* screen's bones, which described a page
 * this one never becomes — a countdown, a board — so the whole screen rearranged itself when
 * the answer landed. This draws `RoundStartScreen`'s own column instead: the heading with its
 * "Tur N" eyebrow, the sage-headed card of cüz, then — for a pick — the option cards, and the
 * one button **at the foot**, where the screen's `content` style pins it. The caller lays this
 * out with that same style, so the button bone sits where the real one will.
 *
 * The card's head keeps its sage and tints its bones from the accent, the way the group
 * screen's "Cüzlerin" stand-in does: it is the one band of colour on the page.
 */
export const RoundStartSkeleton = ({ isPick }: RoundStartSkeletonProps) => {
	const { theme } = useThemeContext();
	const accentInk = (alpha: number) => ({ backgroundColor: toAlphaColor(theme.colors.accent, alpha) });

	return (
		<View style={styles.root}>
			{/* One pulse for every bone, the button included. */}
			<SkeletonPulse style={styles.pulse}>
				<View style={styles.body}>
					{/* "Tur 4", the title and its two-line explanation. */}
					<View style={styles.header}>
						<Bone height={9} radius={4.5} style={styles.eyebrow} tone='soft' width={46} />
						<Bone height={22} radius={9} width={164} />
						<Bone height={9} radius={4.5} style={styles.subtitle} tone='soft' width='88%' />
						<Bone height={9} radius={4.5} style={styles.subtitleSecond} tone='soft' width='54%' />
					</View>

					<CardSurface isFlush>
						<View style={[styles.cardHead, { backgroundColor: theme.colors.accentSoft }]}>
							<View style={[styles.cardHeadLabel, accentInk(0.18)]} />
							<View style={[styles.cardHeadMeta, accentInk(0.14)]} />
						</View>
						{Array.from({ length: CUZ_ROW_COUNT }, (_, index) => (
							<View
								key={index}
								style={[
									styles.cuzRow,
									index > 0
										? {
												borderTopColor: theme.colors.divider,
												borderTopWidth: StyleSheet.hairlineWidth
										  }
										: null
								]}
							>
								<Bone height={34} radius={10} width={34} />
								<View style={styles.cuzCopy}>
									<Bone height={10} radius={5} width='44%' />
									<Bone height={8} radius={4} tone='soft' width='62%' />
								</View>
							</View>
						))}
					</CardSurface>

					{isPick ? (
						<View style={styles.options}>
							{Array.from({ length: OPTION_COUNT }, (_, index) => (
								<CardSurface key={index} hasGlassSurface={false} style={styles.option}>
									<Bone height={11} radius={5} width='46%' />
									<Bone height={8} radius={4} tone='soft' width='78%' />
								</CardSurface>
							))}
						</View>
					) : null}
				</View>

				{/* The foot's one button, with the screen's `footer` 22 of air above it. */}
				<Bone height={54} radius={15} style={styles.button} width='100%' />
			</SkeletonPulse>
		</View>
	);
};

const styles = StyleSheet.create({
	/** `RoundStartScreen` spaces its column by 12. */
	body: {
		gap: 12
	},
	button: {
		marginTop: 22
	},
	cardHead: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	cardHeadLabel: {
		borderRadius: 4.5,
		height: 9,
		width: 104
	},
	cardHeadMeta: {
		borderRadius: 4.5,
		height: 9,
		width: 52
	},
	cuzCopy: {
		flex: 1,
		gap: 7,
		minWidth: 0
	},
	cuzRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	eyebrow: {
		marginBottom: 10
	},
	/*
	 * Clear of the navigator's back button, as `ScreenHeader` is on the real screen, with the
	 * heading block's 18 underneath.
	 */
	header: {
		paddingBottom: 18,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	},
	// `OptionCard`'s own padding and outline, flat — the cards are controls, and controls stay flat.
	option: {
		gap: 8,
		padding: 16
	},
	options: {
		gap: 9
	},
	/* Pushes the button to the foot, as the screen's own `content` style does. */
	pulse: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	root: {
		flexGrow: 1
	},
	subtitle: {
		marginTop: 10
	},
	subtitleSecond: {
		marginTop: 6
	}
});
