import { AppButton } from '@/components/ui/Button/Button.component';
import { StepProgress } from '@/components/ui/StepProgress/StepProgress.component';
import { EyebrowText, Header1 } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import type { GroupKind } from '@/lib/types/domain';
import { StyleSheet, View } from 'react-native';

/**
 * **The first step is Q1 — what the group reads — and the flow is a different length after
 * it.** A Cevşen group is three steps and a hatim four.
 *
 * That is not an asymmetry for its own sake. A Cevşen group's cadence is two chips, which sit
 * under the seat picker on step 3 with room to spare, so a fourth step would have held one
 * control. A hatim needs three more questions of its own: how its cüz are handed out (QC2),
 * how long a round runs (QC3), and **which cüz the creator takes** (QC4) — the last of which
 * has no Cevşen counterpart at all, because a Cevşen share is derived from a seat and a
 * hatim's has to be chosen.
 *
 * A Hizb group is four: the book, its name, the reading plan (HZ's 7/15/33 days, or the seats),
 * and then either where a personal plan starts or when an idle member is released.
 *
 * The design numbers its frames from zero ("Adım 0 / 4" on Q1, up to QC4) because it drew
 * five; QC4 is out of scope. Steps are numbered from 1 here so the last one is always
 * "N / N" — a counter reading "3 / 4" on the final step says there is something after it.
 */
export type CreateGroupStep = 1 | 2 | 3 | 4 | 5;

/** Where each kind stops. Also the total the progress bar and the eyebrows count to. */
export const LAST_STEP_BY_KIND: Record<GroupKind, CreateGroupStep> = { CEVSEN: 3, HATIM: 5, HIZB: 4 };

/**
 * Where the flow stops. A Şahsi Cevşen or Kur'an reading is three steps whatever the book: the
 * book, its name, and how many days — no seats, cadence, rounds or cüz to pick.
 */
export const lastStepFor = (kind: GroupKind, isPersonal: boolean): CreateGroupStep =>
	isPersonal && kind !== 'HIZB' ? 3 : LAST_STEP_BY_KIND[kind];

interface CreateGroupStepHeaderProps {
	/**
	 * Blocks the forward action. Used only where a step's answer is not a form field and so
	 * cannot be validated into a message — QC4's picker, which has no control to hang one on.
	 */
	isNextDisabled?: boolean;
	/** What the group reads, chosen at step 1 — steps 3 and 4 are different questions for each. */
	kind: GroupKind;
	/** "Şahsi okuma" is on — a Cevşen or Kur'an reading of three steps (`lastStepFor`). */
	isPersonal?: boolean;
	/** Overrides the step's own title — a Hizb step whose question depends on an earlier answer. */
	titleKey?: StringKey;
	onBack: () => void;
	/** Validates the step and moves on; on the last one it creates the group. */
	onNext: () => void;
	step: CreateGroupStep;
}

const EYEBROW_KEY_BY_STEP: Record<GroupKind, Record<CreateGroupStep, StringKey>> = {
	// Steps 4 and 5 are unreachable for a Cevşen group; the keys are here to keep the record total.
	CEVSEN: { 1: 'step1of3', 2: 'step2of3', 3: 'step3of3', 4: 'step3of3', 5: 'step3of3' },
	HATIM: { 1: 'step1of5', 2: 'step2of5', 3: 'step3of5', 4: 'step4of5', 5: 'step5of5' },
	// Step 5 is unreachable for a Hizb group.
	HIZB: { 1: 'step1of4', 2: 'step2of4', 3: 'step3of4', 4: 'step4of4', 5: 'step4of4' }
};

/**
 * Steps 1 and 2 ask every kind the same thing. Steps 3 and 4 do not: a Cevşen group is asked
 * for seats and a cadence, a hatim for how its thirty cüz are handed out and how long a round
 * runs, a Hizb group for its reading plan — so the heading has to name the question actually on
 * screen.
 */
const TITLE_KEY_BY_STEP: Record<GroupKind, Record<CreateGroupStep, StringKey>> = {
	CEVSEN: { 1: 'qWhatRead', 2: 'stepDefine', 3: 'stepSpots', 4: 'stepCycle', 5: 'stepCycle' },
	HATIM: { 1: 'qWhatRead', 2: 'stepDefine', 3: 'qDistTitle', 4: 'qDurTitle', 5: 'qLobbyTitle' },
	// Step 4 is the inactivity question by default; a personal plan asks its start instead (`titleKey`).
	HIZB: { 1: 'qWhatRead', 2: 'stepDefine', 3: 'hpPlan', 4: 'hpInactivity', 5: 'hpInactivity' }
};

export const CreateGroupStepHeader = ({
	isNextDisabled = false,
	isPersonal = false,
	kind,
	onBack,
	onNext,
	step,
	titleKey
}: CreateGroupStepHeaderProps) => {
	const { t } = useTranslation();
	const lastStep = lastStepFor(kind, isPersonal);
	const isLastStep = step === lastStep;
	// A three-step flow counts as the Cevşen's does, whichever book it reads.
	const eyebrowKey = EYEBROW_KEY_BY_STEP[lastStep === 3 ? 'CEVSEN' : kind][step];
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
					disabled={isNextDisabled}
					fullWidth={false}
					icon={isLastStep ? 'check' : 'chevronRight'}
					onPress={onNext}
					variant='accent'
				/>
			</View>
			<StepProgress current={step} style={styles.progress} total={lastStep} />
			<EyebrowText style={styles.eyebrow}>{t(eyebrowKey)}</EyebrowText>
			<Header1>{t(titleKey ?? TITLE_KEY_BY_STEP[kind][step])}</Header1>
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
