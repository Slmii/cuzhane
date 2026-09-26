import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import { BodyText, Header1, Typography } from '@/components/ui/Typography/Typography.component';
import { useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { markOnboardedThisLaunch } from '@/lib/utils/onboardingLaunch';
import type { RootStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;
type Page = { icon: IconName; titleKey: StringKey; subKey: StringKey };

// Only the essentials: advanced features remain in the optional app tour.
const PAGES: Page[] = [
	{ icon: 'members', titleKey: 'ob1Title', subKey: 'ob1Sub' },
	{ icon: 'key', titleKey: 'ob2Title', subKey: 'ob2Sub' },
	{ icon: 'book', titleKey: 'ob3Title', subKey: 'ob3Sub' },
	{ icon: 'check', titleKey: 'ob5Title', subKey: 'ob5Sub' }
];

/** A quiet introduction, also reachable from Home and Profile. Nothing advances automatically. */
export const OnboardingScreen = ({ navigation }: Props) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const updateUserSettings = useUpdateUserSettings();
	const [pageIndex, setPageIndex] = useState(0);
	const page = PAGES[pageIndex] ?? PAGES[0];
	const isLastPage = pageIndex === PAGES.length - 1;

	const finish = () => {
		// Reopening help must not change account settings or first-launch behaviour.
		if (navigation.canGoBack()) {
			navigation.goBack();
			return;
		}
		updateUserSettings.mutate({ hasSeenOnboarding: true });
		markOnboardedThisLaunch();
		navigation.replace('Tabs');
	};

	return (
		<ScreenContainer key={pageIndex} contentContainerStyle={styles.content} isScrollable>
			<View style={styles.main}>
				<Typography color={theme.colors.subtext} weight='semibold'>
					{t('quickStartTitle')}
				</Typography>
				<View
					accessibilityLiveRegion='polite'
					accessible
					accessibilityLabel={t('obStepOf', { step: pageIndex + 1, total: PAGES.length })}
				>
					<Typography color={theme.colors.subtext} style={styles.step}>
						{t('obStepOf', { step: pageIndex + 1, total: PAGES.length })}
					</Typography>
				</View>
				<View style={styles.dots} accessibilityElementsHidden importantForAccessibility='no-hide-descendants'>
					{PAGES.map((item, index) => (
						<View
							key={item.titleKey}
							style={[
								styles.dot,
								{ backgroundColor: index <= pageIndex ? theme.colors.accent : theme.colors.border }
							]}
						/>
					))}
				</View>
				<View
					style={[styles.symbol, { backgroundColor: theme.colors.accentSoft }]}
					accessibilityElementsHidden
					importantForAccessibility='no-hide-descendants'
				>
					<Icon name={page.icon} color={theme.colors.accent} size={36} />
				</View>
				<View key={pageIndex} accessibilityLiveRegion='polite'>
					<Header1 style={styles.title}>{t(page.titleKey)}</Header1>
					<BodyText color={theme.colors.subtext} style={styles.sub}>
						{t(page.subKey)}
					</BodyText>
				</View>
			</View>
			<View style={styles.footer}>
				<Typography color={theme.colors.subtext} style={styles.reassurance}>
					{t(isLastPage ? 'quickStartReplayHint' : 'quickStartPace')}
				</Typography>
				<AppButton
					onPress={() =>
						isLastPage ? finish() : setPageIndex(current => Math.min(PAGES.length - 1, current + 1))
					}
					title={t(isLastPage ? 'quickStartFinish' : 'obNext')}
					size='lg'
				/>
				<View style={styles.secondaryActions}>
					{pageIndex > 0 && (
						<Pressable
							accessibilityRole='button'
							onPress={() => setPageIndex(current => Math.max(0, current - 1))}
							style={styles.secondary}
						>
							<Typography color={theme.colors.subtext}>{t('tourBack')}</Typography>
						</Pressable>
					)}
					{!isLastPage && (
						<Pressable accessibilityRole='button' onPress={finish} style={styles.secondary}>
							<Typography color={theme.colors.subtext}>{t('quickStartLater')}</Typography>
						</Pressable>
					)}
				</View>
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	content: { flexGrow: 1, justifyContent: 'space-between' },
	main: { paddingTop: 16 },
	step: { fontSize: 14, marginTop: 16 },
	dots: { flexDirection: 'row', gap: 8, marginTop: 10 },
	dot: { flex: 1, height: 4, borderRadius: 2 },
	symbol: {
		alignItems: 'center',
		justifyContent: 'center',
		width: 76,
		height: 76,
		borderRadius: 20,
		marginTop: 32,
		marginBottom: 24
	},
	title: { fontSize: 28, lineHeight: 36 },
	sub: { fontSize: 17, lineHeight: 27, marginTop: 16 },
	footer: { gap: 14, marginTop: 32 },
	reassurance: { fontSize: 14, lineHeight: 22 },
	secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
	secondary: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12 }
});
