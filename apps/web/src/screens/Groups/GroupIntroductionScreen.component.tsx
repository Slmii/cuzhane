import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { BodyText, CaptionText, Header1, Header3 } from '@/components/ui/Typography/Typography.component';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { groupIntroductionDestination, groupIntroductionSteps } from '@/lib/utils/groupIntroduction';
import type { TabStackParamList } from '@/navigation/types';
import { JoinedWelcomeSkeleton } from '@/screens/Join/JoinedWelcomeSkeleton.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'GroupIntroduction'>;

/** Only entered after a successful create/join, never when reopening an existing group. */
export const GroupIntroductionScreen = ({ navigation, route }: Props) => {
	const { groupId, source } = route.params;
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const group = useGetGroupById(groupId);
	const [showExplainer, setShowExplainer] = useState(false);

	if (group.isLoading) {
		return (
			<ScreenContainer>
				<JoinedWelcomeSkeleton />
			</ScreenContainer>
		);
	}
	if (group.isError || !group.data) {
		return <ErrorState queries={[group]} />;
	}

	const detail = group.data;
	const finish = () => navigation.replace(groupIntroductionDestination(source, detail.status), { groupId });

	return (
		<ScreenContainer contentContainerStyle={styles.content} isScrollable>
			<View style={styles.body}>
				<CaptionText color={theme.colors.accent} weight='semibold'>
					{detail.name}
				</CaptionText>
				<Header1>{t(showExplainer ? 'introGuideTitle' : 'introQuestion')}</Header1>
				<BodyText color={theme.colors.subtext}>
					{t(showExplainer ? (detail.kind === 'HIZB' ? 'introHizb' : 'introCevsen') : 'introQuestionHint')}
				</BodyText>
				{showExplainer
					? groupIntroductionSteps(detail, source).map((step, index) => (
							<CardSurface key={step.title} style={styles.card}>
								<CaptionText color={theme.colors.accent}>
									{t('obStepOf', { step: index + 1, total: 3 })}
								</CaptionText>
								<Header3>{t(step.title)}</Header3>
								<BodyText color={theme.colors.subtext}>
									{t(step.body, { readAction: t('iRead') })}
								</BodyText>
							</CardSurface>
					  ))
					: null}
			</View>
			<View style={styles.actions}>
				{showExplainer ? (
					<AppButton onPress={finish} title={t('introContinue')} />
				) : (
					<>
						<AppButton onPress={() => setShowExplainer(true)} title={t('introYes')} />
						<AppButton onPress={finish} title={t('introNo')} variant='ghost' />
					</>
				)}
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	content: { flexGrow: 1, justifyContent: 'space-between' },
	body: { gap: 16, paddingTop: 24 },
	card: { gap: 8 },
	actions: { gap: 10, marginTop: 24 }
});
