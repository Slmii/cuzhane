import { StepProgress } from '@/components/ui/StepProgress/StepProgress.component';
import { EyebrowText, Header1 } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { BackLink } from '@/components/ui/BackLink/BackLink.component';
import type { StringKey } from '@/lib/i18n/strings';
import { StyleSheet, View } from 'react-native';

export type CreateGroupStep = 1 | 2 | 3;

interface CreateGroupStepHeaderProps {
	onBack: () => void;
	step: CreateGroupStep;
}

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

export const CreateGroupStepHeader = ({ onBack, step }: CreateGroupStepHeaderProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		// Opaque, because this is pinned: a sticky header is transparent by default, and the
		// form would scroll visibly through the title it is meant to stay under. The sheet's
		// own colour, so the join is invisible.
		<View style={[styles.container, { backgroundColor: theme.colors.sheet }]}>
			<BackLink onPress={onBack} style={styles.back} />
			<StepProgress current={step} style={styles.progress} total={3} />
			<EyebrowText style={styles.eyebrow}>{t(EYEBROW_KEY_BY_STEP[step])}</EyebrowText>
			<Header1>{t(TITLE_KEY_BY_STEP[step])}</Header1>
		</View>
	);
};

const styles = StyleSheet.create({
	back: {
		alignSelf: 'flex-start',
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
