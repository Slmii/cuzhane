import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { BodyText, DisplayText, Header1, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { RootStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const STEP_KEYS: { number: string; key: StringKey }[] = [
	{ number: '1', key: 'ob1' },
	{ number: '2', key: 'ob2' },
	{ number: '3', key: 'ob3' }
];

export const OnboardingScreen = ({ navigation }: Props) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const updateUserSettings = useUpdateUserSettings();

	const handleStart = () => {
		updateUserSettings.mutate({ hasSeenOnboarding: true });
		navigation.replace('Tabs');
	};

	const handleHaveCode = () => {
		// Joining by code is a sheet, not a route, so there is nothing to navigate *to*.
		// Land on the tab that owns it and ask it to open on arrival.
		updateUserSettings.mutate({ hasSeenOnboarding: true });
		navigation.replace('Tabs', {
			screen: 'Groups',
			params: { screen: 'Groups', params: { shouldOpenJoinSheet: true } }
		});
	};

	return (
		<ScreenContainer contentContainerStyle={styles.content} isScrollable>
			<View>
				<View style={styles.hero}>
					<DisplayText color={theme.colors.accent} style={styles.numeral} textAlign='center'>
						١٠٠
					</DisplayText>
					<Header1 style={styles.title} textAlign='center'>
						{t('obTitle')}
					</Header1>
					<BodyText color={theme.colors.subtext} style={styles.sub} textAlign='center'>
						{t('obSub')}
					</BodyText>
				</View>
				<View style={styles.steps}>
					{STEP_KEYS.map(step => (
						<CardSurface key={step.key} style={styles.stepCard}>
							<View
								style={[
									styles.badge,
									{ backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.md - 3 }
								]}
							>
								<Typography color={theme.colors.accent} variant='title'>
									{step.number}
								</Typography>
							</View>
							<BodyText style={styles.stepCopy}>{t(step.key)}</BodyText>
						</CardSurface>
					))}
				</View>
			</View>
			<View style={styles.footer}>
				<AppButton onPress={handleStart} title={t('start')} />
				<AppButton onPress={handleHaveCode} title={t('haveCode')} variant='ghost' />
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	badge: {
		alignItems: 'center',
		flex: 0,
		height: 30,
		justifyContent: 'center',
		width: 30
	},
	content: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	footer: {
		gap: 10,
		marginTop: 28
	},
	hero: {
		paddingBottom: 34,
		paddingTop: 20
	},
	numeral: {
		marginBottom: 16
	},
	stepCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13
	},
	stepCopy: {
		flex: 1
	},
	steps: {
		gap: 9
	},
	sub: {
		alignSelf: 'center',
		marginTop: 14,
		maxWidth: 272
	},
	title: {
		fontSize: 31,
		lineHeight: 36,
		marginTop: 0
	}
});
