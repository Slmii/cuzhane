import { AppButton } from '@/components/ui/Button/Button.component';
import { StepProgress } from '@/components/ui/StepProgress/StepProgress.component';
import { EyebrowText, Header1 } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { StyleSheet, View } from 'react-native';

export type CreateGroupStep = 1 | 2 | 3 | 4;

interface CreateGroupStepHeaderProps {
	onBack: () => void;
	/** Validates the step and moves on; on the last one it creates the group. */
	onNext: () => void;
	step: CreateGroupStep;
}

/** The step after which there is nothing left to fill in. */
export const LAST_STEP: CreateGroupStep = 4;

/**
 * Which book, then the group's name, then how the book is shared, then how often. The kind comes
 * first because the two steps after the name depend on it: the sizes, the plan's unit and the
 * cycles on offer are all the kind's own.
 */
const TITLE_KEY_BY_STEP: Record<CreateGroupStep, StringKey> = {
	1: 'stepKind',
	2: 'stepDefine',
	3: 'stepSpots',
	4: 'stepCycle'
};

export const CreateGroupStepHeader = ({ onBack, onNext, step }: CreateGroupStepHeaderProps) => {
	const { t } = useTranslation();
	const isLastStep = step === LAST_STEP;
	const isFirstStep = step === 1;

	return (
		<View style={styles.container}>
			<View style={styles.controls}>
				{/*
				 * **Step 1 closes; the rest go back.** `onBack` dismisses the sheet on the first
				 * step and steps back on the others, so a chevron there promised a screen behind
				 * this one that does not exist. The glyph now says which of the two it is.
				 */}
				<AppButton
					accessibilityLabel={isFirstStep ? t('close') : t('back')}
					fullWidth={false}
					icon={isFirstStep ? 'close' : 'chevronLeft'}
					onPress={onBack}
					variant='surface'
				/>
				{/*
				 * The tick is the icon set's own `tamam-check`, not Apple's `checkmark` — the
				 * glyph a reader has already seen on every "Kopyalandı" and on the board. It is
				 * drawn wider than a stock chevron, so this button comes out a little wider than
				 * the one opposite; pinning both to a square is what evens them if that matters.
				 */}
				<AppButton
					accessibilityLabel={isLastStep ? t('createGroup') : t('next')}
					fullWidth={false}
					icon={isLastStep ? 'check' : 'chevronRight'}
					onPress={onNext}
					variant='accent'
				/>
			</View>
			<StepProgress current={step} style={styles.progress} total={LAST_STEP} />
			<EyebrowText style={styles.eyebrow}>{t('stepOfTotal', { step, total: LAST_STEP })}</EyebrowText>
			<Header1>{t(TITLE_KEY_BY_STEP[step])}</Header1>
		</View>
	);
};

const styles = StyleSheet.create({
	/** The two glyphs at either end of the row, with the progress bar beneath them. */
	controls: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12
	},
	container: {
		paddingBottom: 8,
		paddingTop: 6
	},
	eyebrow: {
		marginBottom: 7
	},
	progress: {
		marginBottom: 14
	}
});
