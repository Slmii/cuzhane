import { AppButton } from '@/components/ui/Button/Button.component';
import { StepProgress } from '@/components/ui/StepProgress/StepProgress.component';
import { EyebrowText, Header1 } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { StyleSheet, View } from 'react-native';

export type CreateGroupStep = 1 | 2 | 3;

interface CreateGroupStepHeaderProps {
	onBack: () => void;
	/** Validates the step and moves on; on the last one it creates the group. */
	onNext: () => void;
	step: CreateGroupStep;
}

/** The step after which there is nothing left to fill in. */
const LAST_STEP: CreateGroupStep = 3;

const EYEBROW_KEY_BY_STEP: Record<CreateGroupStep, StringKey> = {
	1: 'step1of3',
	2: 'step2of3',
	3: 'step3of3'
};

const TITLE_KEY_BY_STEP: Record<CreateGroupStep, StringKey> = {
	1: 'stepDefine',
	2: 'stepSpots',
	3: 'stepCycle'
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
			<StepProgress current={step} style={styles.progress} total={3} />
			<EyebrowText style={styles.eyebrow}>{t(EYEBROW_KEY_BY_STEP[step])}</EyebrowText>
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
