import { AppButton } from '@/components/ui/Button/Button.component';
import { EyebrowText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import { TOUR_STEPS } from './tourSteps';

type TourStepCardProps = {
	onNext: () => void;
	onSkip: () => void;
	stepIndex: number;
};

/**
 * One stop. The card the spotlight talks through.
 *
 * **No arrow, because the card no longer sits beside what it describes.** The design draws one —
 * a 14pt box at 45°, whose softened tip a triangle could not give — and it belonged to a card
 * that took whichever side of the spotlight was free. The card is pinned to the bottom now (see
 * `TourOverlay`), so an arrow would point at a target half a screen away. The cut-out does that
 * job on its own.
 *
 * The dots are the step indicator rather than decoration — the active one is a 14pt pill and
 * the others are 5pt circles, so the row reads as position even for someone who does not read
 * the "Adım 3 / 15" beside it.
 */
export const TourStepCard = ({ onNext, onSkip, stepIndex }: TourStepCardProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const step = TOUR_STEPS[stepIndex];

	if (!step) {
		return null;
	}

	const isLast = stepIndex === TOUR_STEPS.length - 1;

	return (
		<View style={[styles.card, { backgroundColor: theme.colors.card }]}>
			<View style={styles.head}>
				<EyebrowText color={theme.colors.accent}>
					{t('tourStep', { a: stepIndex + 1, b: TOUR_STEPS.length })}
				</EyebrowText>
				<View style={styles.dots}>
					{TOUR_STEPS.map((_, index) => (
						<View
							key={index}
							style={[
								styles.dot,
								index === stepIndex
									? { backgroundColor: theme.colors.accent, width: 14 }
									: { backgroundColor: toAlphaColor(theme.colors.text, 0.16) }
							]}
						/>
					))}
				</View>
			</View>

			<Typography variant='header3'>{t(step.titleKey)}</Typography>
			<Typography color={toAlphaColor(theme.colors.text, 0.6)} style={styles.sub} variant='caption'>
				{t(step.bodyKey)}
			</Typography>

			<View style={styles.actions}>
				<Pressable accessibilityRole='button' onPress={onSkip} style={styles.skip}>
					<Typography color={toAlphaColor(theme.colors.text, 0.5)} variant='caption' weight='semibold'>
						{t('tourSkip')}
					</Typography>
				</Pressable>
				{/*
				 * **The width is declared here, not left to the button.** `fullWidth` defaults
				 * to true, and in this row that resolves to 100% of the row — the button
				 * overflowed and was squeezed into a sliver against the card's edge. Turning
				 * `fullWidth` off is the obvious fix and is worse: it hands the label to a
				 * SwiftUI host sized by `matchContents`, which reports 0×0 until its native
				 * view has laid out — the same trap the navigation bar's `Host` documents.
				 * A declared box, with the button filling it, is what that note prescribes.
				 * 120 rather than something tighter because the label is a translation:
				 * "Volgende" is half again as long as "Next".
				 */}
				<View style={styles.nextSlot}>
					<AppButton onPress={onNext} size='md' title={isLast ? t('tourDone') : t('tourNext')} />
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	actions: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between',
		marginTop: 14
	},
	card: {
		borderRadius: 18,
		elevation: 12,
		paddingBottom: 13,
		paddingHorizontal: 17,
		paddingTop: 15,
		shadowOffset: { height: 18, width: 0 },
		shadowOpacity: 0.28,
		shadowRadius: 22
	},
	dot: {
		borderRadius: 3,
		height: 5,
		width: 5
	},
	dots: {
		flexDirection: 'row',
		gap: 4
	},
	head: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 9
	},
	nextSlot: {
		flexShrink: 0,
		width: 120
	},
	skip: {
		paddingHorizontal: 2,
		paddingVertical: 8
	},
	sub: {
		marginTop: 7
	}
});
