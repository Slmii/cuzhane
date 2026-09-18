import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { BodyText, Header1, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { markOnboardedThisLaunch } from '@/lib/utils/onboardingLaunch';
import type { StringKey } from '@/lib/i18n/strings';
import { useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { CreateGroupArt, PoolGridArt, ReminderArt, RoundRecordArt, ShelfFillingArt } from './OnboardingPages.component';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

type Page = {
	Art: () => React.JSX.Element;
	subKey: StringKey;
	titleKey: StringKey;
};

/** The design's `transition: width .3s ease` on the page dots. */
const DOT_TRANSITION_MS = 300;

const PAGES: Page[] = [
	{ Art: ShelfFillingArt, titleKey: 'ob1Title', subKey: 'ob1Sub' },
	{ Art: CreateGroupArt, titleKey: 'ob2Title', subKey: 'ob2Sub' },
	{ Art: PoolGridArt, titleKey: 'ob3Title', subKey: 'ob3Sub' },
	{ Art: ReminderArt, titleKey: 'ob4Title', subKey: 'ob4Sub' },
	{ Art: RoundRecordArt, titleKey: 'ob5Title', subKey: 'ob5Sub' }
];

/**
 * A1 · the five-page tour.
 *
 * One page at a time rather than a scroller: each page is a claim about the app, and the
 * dots are a promise about how many are left. A pager that could be flung past three of them
 * would make the count a lie.
 *
 * Only the last page commits — every other page's primary action advances. "Atla" is on
 * every page but the last, where the primary button *is* the finish.
 */
export const OnboardingScreen = ({ navigation }: Props) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const updateUserSettings = useUpdateUserSettings();
	const isReducedMotion = useReducedMotion();
	const [pageIndex, setPageIndex] = useState(0);

	const page = PAGES[pageIndex] ?? PAGES[0];
	const isLastPage = pageIndex === PAGES.length - 1;

	const finish = () => {
		/*
		 * Replayed from the dev trigger, this screen sits on top of an app that has already
		 * been used — `goBack` returns there. Reached as the first route, there is nothing
		 * behind it, so it replaces itself with the tabs.
		 */
		updateUserSettings.mutate({ hasSeenOnboarding: true });
		// Passing through here is the only thing that separates a brand-new account from an
		// existing reader who has not finished the tour — see `onboardingLaunch`.
		markOnboardedThisLaunch();

		if (navigation.canGoBack()) {
			navigation.goBack();
			return;
		}

		navigation.replace('Tabs');
	};

	const advance = () => (isLastPage ? finish() : setPageIndex(current => current + 1));

	return (
		<ScreenContainer contentContainerStyle={styles.content} isScrollable>
			<View>
				<View style={styles.header}>
					<Typography style={styles.wordmark}>Cüzhane</Typography>
					<Typography color={theme.colors.faintText} style={styles.step}>
						{t('obStepOf', { step: pageIndex + 1, total: PAGES.length })}
					</Typography>
				</View>

				{/*
				 * Keyed on the page, so the art mounts fresh and its entrance runs again —
				 * without the key React would reuse the node and the illustration would simply
				 * swap contents mid-animation.
				 */}
				<Animated.View
					entering={isReducedMotion ? undefined : FadeIn.duration(220)}
					exiting={isReducedMotion ? undefined : FadeOut.duration(120)}
					key={pageIndex}
				>
					<View
						style={[
							styles.artCard,
							{ backgroundColor: toAlphaColor(theme.colors.text, 0.04), borderColor: theme.colors.border }
						]}
					>
						<page.Art />
					</View>

					<View style={styles.copy}>
						<Header1 style={styles.title}>{t(page.titleKey)}</Header1>
						<BodyText color={theme.colors.subtext} style={styles.sub}>
							{t(page.subKey)}
						</BodyText>
					</View>
				</Animated.View>
			</View>

			<View style={styles.footer}>
				<View style={styles.dots}>
					{PAGES.map((item, index) => {
						const isActive = index === pageIndex;

						return (
							<Animated.View
								key={item.titleKey}
								/*
								 * One flat style object, not a style array: Reanimated only sees the
								 * transition properties when they sit alongside the values they
								 * animate. Declared as a transition rather than driven by a mapper
								 * for the reason `CellGrid` documents — five of these would be five
								 * animated styles for what the UI thread can interpolate itself.
								 */
								style={{
									backgroundColor: isActive
										? theme.colors.accent
										: toAlphaColor(theme.colors.text, 0.16),
									borderRadius: 3,
									height: 6,
									transitionDuration: DOT_TRANSITION_MS,
									transitionProperty: ['width', 'backgroundColor'],
									transitionTimingFunction: 'ease',
									width: isActive ? 18 : 6
								}}
							/>
						);
					})}
				</View>

				<View style={styles.actions}>
					<AppButton onPress={advance} title={isLastPage ? t('start') : t('obNext')} />
					{/* The last page's primary action already finishes; a skip beside it would be
					    two buttons for one outcome. */}
					{isLastPage ? null : (
						<Pressable
							accessibilityRole='button'
							onPress={finish}
							style={({ pressed }) => [styles.skip, { opacity: pressed ? 0.6 : 1 }]}
						>
							<Typography color={theme.colors.subtext} style={styles.skipLabel}>
								{t('obSkip')}
							</Typography>
						</Pressable>
					)}
				</View>
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	actions: {
		gap: 8
	},
	artCard: {
		borderRadius: 20,
		borderWidth: 1,
		padding: 18
	},
	content: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	copy: {
		paddingTop: 24
	},
	dots: {
		flexDirection: 'row',
		gap: 6,
		justifyContent: 'center'
	},
	footer: {
		gap: 14,
		marginTop: 24
	},
	header: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingBottom: 24,
		paddingTop: 8
	},
	skip: {
		alignItems: 'center',
		paddingVertical: 4
	},
	skipLabel: {
		fontSize: 12.5,
		fontWeight: '600'
	},
	step: {
		fontSize: 10,
		fontWeight: '500',
		letterSpacing: 1.4,
		textTransform: 'uppercase'
	},
	sub: {
		fontSize: 13,
		lineHeight: 21,
		marginTop: 11,
		maxWidth: 288
	},
	title: {
		fontSize: 26,
		lineHeight: 31,
		maxWidth: 280
	},
	wordmark: {
		fontSize: 15,
		lineHeight: 15
	}
});
