import { AppButton } from '@/components/ui/Button/Button.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import { TOUR_LEG_LABEL, type TourLeg, type TourStep } from './tourSteps';

/** Where the card's arrow sits: which edge, and how far from the card's left. */
export type TourArrow = { edge: 'top' | 'bottom'; left: number };

type TourStepCardProps = {
	step: TourStep;
	/** The stop's place in its part — "BAŞLANGIÇ · 2/3". */
	position: { leg: TourLeg; n: number; of: number };
	/** Null when the card cannot sit beside its target and is pinned low instead. */
	arrow: TourArrow | null;
	/** Absent on the run's first stop, where there is nothing behind to go back to. */
	onBack?: () => void;
	onNext: () => void;
	/** "Bu bölümü geç" — only a kind's part has one. */
	onSkipPart?: () => void;
	/** "Turu geç", in the same place, on the stops that have no part to skip. */
	onSkipTour?: () => void;
};

/**
 * One stop (section T): the card the spotlight talks through, beside what it describes.
 *
 * **The arrow is back.** The card used to be pinned to the bottom of the screen, where an arrow
 * would have pointed at a target half a screen away. Section T places it beside its target —
 * below when there is room, above when not — and the arrow is what joins the two. A 14pt square
 * turned 45° with softened corners, as the design draws it; a triangle could not give the tip.
 *
 * "Örnek" on every stop is the tour saying, each time, that what is on screen is a sample: the
 * first card says it once, and a reader who skimmed it would otherwise take the groups for theirs.
 *
 * **The way out is a link on the card, not a pill in the corner.** The design also floats "Turu
 * geç" at the top right, where it covered the bar a stop can point at (T3's +). The card's left
 * corner carries one link instead: "Bu bölümü geç" in a kind's part, "Turu geç" elsewhere.
 */
export const TourStepCard = ({ arrow, onBack, onNext, onSkipPart, onSkipTour, position, step }: TourStepCardProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const link = onSkipPart
		? { label: t('tourSkipPart'), onPress: onSkipPart }
		: onSkipTour
		? { label: t('tourSkip'), onPress: onSkipTour }
		: null;

	return (
		<View style={[styles.card, { backgroundColor: theme.colors.card }]}>
			{arrow ? (
				<View
					style={[
						styles.arrow,
						arrow.edge === 'top' ? styles.arrowTop : styles.arrowBottom,
						{ backgroundColor: theme.colors.card, left: arrow.left }
					]}
				/>
			) : null}
			<View style={styles.head}>
				<Typography color={theme.colors.accent} style={styles.leg} weight='medium'>
					{`${t(TOUR_LEG_LABEL[position.leg])} · ${position.n}/${position.of}`}
				</Typography>
				<View style={[styles.sample, { backgroundColor: theme.colors.sand }]}>
					<Typography
						color={theme.colors.sandText}
						numberOfLines={1}
						style={styles.sampleLabel}
						weight='semibold'
					>
						{t('tourSample')}
					</Typography>
				</View>
			</View>

			<Typography style={styles.title} variant='header3' weight='regular'>
				{t(step.titleKey)}
			</Typography>
			<Typography color={toAlphaColor(theme.colors.text, 0.62)} style={styles.body} variant='caption'>
				{t(step.bodyKey)}
			</Typography>

			<View style={styles.actions}>
				{link ? (
					<Pressable accessibilityRole='button' onPress={link.onPress} style={styles.link}>
						<Typography
							color={toAlphaColor(theme.colors.text, 0.5)}
							style={styles.linkLabel}
							weight='semibold'
						>
							{link.label}
						</Typography>
					</Pressable>
				) : null}
				<View style={styles.spacer} />
				{onBack ? (
					<AppButton fullWidth={false} onPress={onBack} size='sm' title={t('tourBack')} variant='surface' />
				) : null}
				<AppButton fullWidth={false} onPress={onNext} size='sm' title={t('tourNext')} variant='primary' />
			</View>
		</View>
	);
};

/* The design's measures, one to one (section T). */
const styles = StyleSheet.create({
	actions: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		marginTop: 14
	},
	arrow: {
		borderRadius: 3,
		height: 14,
		position: 'absolute',
		transform: [{ rotate: '45deg' }],
		width: 14
	},
	arrowBottom: {
		bottom: -6
	},
	arrowTop: {
		top: -6
	},
	body: {
		fontSize: 13,
		lineHeight: 19.5,
		marginTop: 6
	},
	card: {
		borderRadius: 18,
		elevation: 12,
		paddingBottom: 14,
		paddingHorizontal: 17,
		paddingTop: 15,
		shadowOffset: { height: 18, width: 0 },
		shadowOpacity: 0.28,
		shadowRadius: 22
	},
	head: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between',
		marginBottom: 9
	},
	leg: {
		fontSize: 10,
		letterSpacing: 1.2,
		lineHeight: 14,
		textTransform: 'uppercase'
	},
	link: {
		paddingVertical: 10
	},
	linkLabel: {
		fontSize: 12,
		lineHeight: 16
	},
	sample: {
		borderRadius: 6,
		paddingHorizontal: 7,
		paddingVertical: 3
	},
	sampleLabel: {
		fontSize: 9.5,
		letterSpacing: 0.57,
		lineHeight: 12,
		textTransform: 'uppercase'
	},
	spacer: {
		flex: 1
	},
	title: {
		lineHeight: 23
	}
});
