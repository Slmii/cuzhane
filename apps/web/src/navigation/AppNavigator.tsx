import { useTranslation } from '@/lib/i18n/I18n.context';
import { appFonts } from '@/lib/theme/fonts';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useGetUserSettings } from '@/lib/hooks/useUserSettings';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { useProfileTabPhoto } from '@/navigation/useProfileTabPhoto';
import { AuthStackParamList, RootStackParamList, RootTabParamList, TabStackParamList } from '@/navigation/types';
import { ForgotPasswordScreen } from '@/screens/Auth/ForgotPasswordScreen.component';
import { SignInScreen } from '@/screens/Auth/SignInScreen.component';
import { ResetCodeSentScreen } from '@/screens/Auth/ResetCodeSentScreen.component';
import { SetNewPasswordScreen } from '@/screens/Auth/SetNewPasswordScreen.component';
import { SignUpScreen } from '@/screens/Auth/SignUpScreen.component';
import { CreateGroupScreen } from '@/screens/Groups/CreateGroupScreen.component';
import { GroupDetailScreen } from '@/screens/Groups/GroupDetailScreen.component';
import { LobbyScreen } from '@/screens/Groups/LobbyScreen.component';
import { RoundDetailScreen } from '@/screens/Groups/RoundDetailScreen.component';
import { RoundsScreen } from '@/screens/Groups/RoundsScreen.component';
import { PoolScreen } from '@/screens/Groups/PoolScreen.component';
import { GroupsScreen } from '@/screens/Groups/GroupsScreen.component';
import { DiscoverScreen } from '@/screens/Discover/DiscoverScreen.component';
import { HomeScreen } from '@/screens/Home/HomeScreen.component';
import { InvitePreviewScreen } from '@/screens/Join/InvitePreviewScreen.component';
import { JoinedWelcomeScreen } from '@/screens/Join/JoinedWelcomeScreen.component';
import { OnboardingScreen } from '@/screens/Onboarding/OnboardingScreen.component';
import { ProfileScreen } from '@/screens/Profile/ProfileScreen.component';
import { AllBabsScreen } from '@/screens/Reader/AllBabsScreen.component';
import { BabReaderScreen } from '@/screens/Reader/BabReaderScreen.component';
import { RemindersScreen } from '@/screens/Reminders/RemindersScreen.component';
import { useAuth, useUser } from '@clerk/expo';
import type { ComponentType } from 'react';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { useNavigationState, type NavigationState, type PartialState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import { ActivityIndicator, View, type ImageSourcePropType } from 'react-native';

/**
 * Screens the bar steps out of the way for.
 *
 * Empty at the moment: the reader used to be listed here on the grounds that reading should
 * be immersive, and it is being tried with the bar left in — it stacks directly under the
 * reader's own prev · Okudum · next bar, so the two are worth looking at together before
 * deciding. Put `'BabReader'` back to restore the immersive version.
 */
const TAB_BAR_HIDDEN_ROUTES = new Set<string>([]);

type AnyNavigationState = NavigationState | PartialState<NavigationState>;

/** Walks the focused route down through every nested navigator to the visible screen. */
const focusedRouteName = (state: AnyNavigationState | undefined): string | undefined => {
	let current: AnyNavigationState | undefined = state;
	let name: string | undefined;

	while (current) {
		const route = current.routes[current.index ?? current.routes.length - 1];

		if (!route) {
			break;
		}

		name = route.name;
		current = route.state;
	}

	return name;
};

/**
 * **The tab bar is the real UIKit one**, so on iOS 26 it is drawn in liquid glass by the
 * system — the float, the refraction over scrolling content and the selection pill are all the
 * OS, not us. That is the whole reason for using it over the JS bar.
 *
 * A native bar takes an `ImageSource` or an SF Symbol and cannot be handed a React element, so
 * `ui/Icon`'s SVGs — which every other surface renders directly — are the one thing that
 * cannot reach it. It borrowed the nearest SF Symbols for a while, which put the tab row in a
 * vocabulary the design system had never seen. These are the Icon Set's own glyphs instead,
 * rasterised by `scripts/build-tab-icons.mjs` and shipped as template images so iOS tints
 * them from the navigator's own colours.
 *
 * **Outlined at rest, filled when selected**, which is the Icon Set's rule for this row and
 * this row alone — "pasif çizgili, aktif dolgulu". It is also what a real UITabBar does, so
 * for once the platform and the design want the same thing.
 */
const TAB_ICONS: Record<keyof RootTabParamList, { active: ImageSourcePropType; resting: ImageSourcePropType }> = {
	Home: {
		active: require('@/assets/tabs/homeActive.png'),
		resting: require('@/assets/tabs/home.png')
	},
	Groups: {
		active: require('@/assets/tabs/groupsActive.png'),
		resting: require('@/assets/tabs/groups.png')
	},
	Discover: {
		active: require('@/assets/tabs/discoverActive.png'),
		resting: require('@/assets/tabs/discover.png')
	},
	Reminders: {
		active: require('@/assets/tabs/remindersActive.png'),
		resting: require('@/assets/tabs/reminders.png')
	},
	Profile: {
		active: require('@/assets/tabs/profileActive.png'),
		resting: require('@/assets/tabs/profile.png')
	}
};

const tabIcon =
	(name: keyof RootTabParamList) =>
	({ focused }: { focused: boolean }) =>
		focused ? TAB_ICONS[name].active : TAB_ICONS[name].resting;

/**
 * **Profile shows the reader's own photo when they have one**, per the Icon Set's note on
 * that tab: "Kişi. Avatar varsa ikon yerine 21 px avatar." The `person` glyph is the fallback
 * for an account with no picture, not the default.
 *
 * Two details make it work rather than look like a bug:
 *
 * - It renders in `original` mode. Every other icon here is a **template** image, which is
 *   what lets iOS tint it with the navigator's active colour — put a photograph through that
 *   and you get a flat green silhouette of a face.
 * - The URL carries a size. Clerk serves the original upload otherwise, which for a phone
 *   photo is a couple of megabytes fetched to fill 28 points.
 *
 * `hasImage` rather than `imageUrl`: Clerk always answers with a URL, generating a letter
 * avatar when there is no upload. That placeholder is a worse version of what `ui/Avatar`
 * already draws, and it is not what "has a photo" means here.
 */
const PROFILE_PHOTO_PIXELS = 84;

const sizedProfileUrl = (imageUrl: string) =>
	`${imageUrl}${
		imageUrl.includes('?') ? '&' : '?'
	}width=${PROFILE_PHOTO_PIXELS}&height=${PROFILE_PHOTO_PIXELS}&fit=crop`;

/**
 * The label has to be passed explicitly. A native tab falls back to the **screen title**,
 * which is the route name — so the bar came up reading "Home · Groups · Discover" in a Dutch
 * app. The old JS bar looked its label up from the strings table itself; this one is told.
 */
const TAB_LABEL_KEYS: Record<keyof RootTabParamList, StringKey> = {
	Home: 'home',
	Groups: 'groups',
	Discover: 'discover',
	Reminders: 'reminders',
	Profile: 'profile'
};

const Tab = createNativeBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
// One factory, reused for every tab: each `<TabStack.Navigator>` element below is its
// own independent navigator with its own history.
const TabStack = createNativeStackNavigator<TabStackParamList>();

const tabStackScreenOptions = { headerShown: false } as const;

/**
 * Screens a group can be opened into. Registered in every tab that can reach a group so
 * they push *inside* the tab — which is what keeps the bottom bar on screen.
 */
// Called per navigator rather than shared as one element: each stack needs its own
// `Screen` elements, otherwise only the first navigator to mount registers them.
const sharedTabScreens = () => (
	<>
		<TabStack.Screen name='GroupDetail' component={GroupDetailScreen} />
		<TabStack.Screen name='BabReader' component={BabReaderScreen} />
		<TabStack.Screen name='AllBabs' component={AllBabsScreen} />
		<TabStack.Screen name='Lobby' component={LobbyScreen} />
		<TabStack.Screen name='Pool' component={PoolScreen} />
		<TabStack.Screen name='Rounds' component={RoundsScreen} />
		<TabStack.Screen name='RoundDetail' component={RoundDetailScreen} />
		<TabStack.Screen name='InvitePreview' component={InvitePreviewScreen} />
		<TabStack.Screen name='JoinedWelcome' component={JoinedWelcomeScreen} options={{ gestureEnabled: false }} />
	</>
);

/**
 * **The native bar floats *over* the scene**, where the JS one was a sibling below it — so
 * screens have to inset themselves by its whole height or their last row sits behind the
 * glass. `useBottomTabBarHeight` only resolves inside a native tab screen, which is why this
 * wraps each tab rather than providing the value beside the navigator the way the JS bar
 * allowed.
 *
 * It publishes the **bare height**. What to do with it is the screen's business: scrolling
 * content adds `TAB_BAR_CONTENT_GAP` on top, while a screen placing a bar of its own against
 * it — the reader — uses the height alone and keeps its own padding symmetric.
 */
const withTabBarOffset = (Screen: ComponentType) => {
	const Wrapped = () => {
		const height = useBottomTabBarHeight();

		return (
			<TabBarOffsetContext.Provider value={height}>
				<Screen />
			</TabBarOffsetContext.Provider>
		);
	};

	return Wrapped;
};

const HomeTabStack = () => (
	<TabStack.Navigator screenOptions={tabStackScreenOptions}>
		<TabStack.Screen name='Home' component={HomeScreen} />
		{sharedTabScreens()}
	</TabStack.Navigator>
);

const GroupsTabStack = () => (
	<TabStack.Navigator screenOptions={tabStackScreenOptions}>
		<TabStack.Screen name='Groups' component={GroupsScreen} />
		{sharedTabScreens()}
	</TabStack.Navigator>
);

const DiscoverTabStack = () => (
	<TabStack.Navigator screenOptions={tabStackScreenOptions}>
		<TabStack.Screen name='Discover' component={DiscoverScreen} />
		{sharedTabScreens()}
	</TabStack.Navigator>
);

const HomeTab = withTabBarOffset(HomeTabStack);
const GroupsTab = withTabBarOffset(GroupsTabStack);
const DiscoverTab = withTabBarOffset(DiscoverTabStack);
const RemindersTab = withTabBarOffset(RemindersScreen);
const ProfileTab = withTabBarOffset(ProfileScreen);

// The route is a transparent shell; `AppBottomSheet` inside it draws the surface and
// owns the slide, backdrop and drag-to-dismiss, so every sheet in the app matches.
//
// `containedTransparentModal`, not `transparentModal`: the plain one presents a native
// modal *window* above the React Native root view, while `AppBottomSheet` portals its
// content to `BottomSheetModalProvider` — which lives in that root view. The sheet was
// therefore drawn underneath the native window, visible through it but unable to receive
// a single touch. The contained variant keeps the screen inside the RN hierarchy, so the
// portalled sheet lands above it and its fields and cards are tappable again.
const sheetRouteOptions = {
	presentation: 'containedTransparentModal' as const,
	animation: 'none' as const,
	gestureEnabled: false,
	headerShown: false
};

const TabsNavigator = () => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const { user } = useUser();
	// Sized down at the CDN — Clerk serves the original upload otherwise, which for a phone
	// photo is megabytes fetched to fill 28 points.
	const profilePhotoUrl = user?.hasImage ? sizedProfileUrl(user.imageUrl) : null;
	const { captureElement, uri: profilePhotoUri } = useProfileTabPhoto(profilePhotoUrl);

	const tabOptions = (name: keyof RootTabParamList) => {
		const base = { tabBarIcon: tabIcon(name), tabBarLabel: t(TAB_LABEL_KEYS[name]) };

		if (name !== 'Profile' || !profilePhotoUri) {
			return base;
		}

		/*
		 * **Profile stays in the row with the other four.** It was briefly detached into its
		 * own circle beside the capsule — `role: 'search'`, the slot Apple Music puts search in
		 * — and that is the only thing in the API that separates an item. It was dropped
		 * because the detached item is icon-only: iOS draws no title on it, so "Profiel"
		 * disappeared while the other four kept their labels. The role is also *search*
		 * semantically, which the account tab is not.
		 */
		return {
			...base,
			// The same photo either way — the bar's selection pill and tint already say which
			// tab you are on, and a face has no outlined and filled version of itself.
			tabBarIcon: () => ({ uri: profilePhotoUri }),
			tabBarIconRenderingMode: 'original' as const
		};
	};

	const isBarHidden = useNavigationState(state => {
		const name = focusedRouteName(state);
		return name !== undefined && TAB_BAR_HIDDEN_ROUTES.has(name);
	});

	/*
	 * The floor, for anything rendered outside a tab scene. Every tab's own component is
	 * wrapped in `withTabBarOffset`, which overrides this with the bar's measured height.
	 */
	return (
		<TabBarOffsetContext.Provider value={0}>
			{/* Off-screen, and only until the circular crop has been captured. */}
			{captureElement}
			<Tab.Navigator
				/*
				 * Translucent, which is what lets the system draw it in glass — opaque would
				 * flatten it back into a plain bar and there would be nothing to look at.
				 */
				translucent
				/*
				 * **The bar stays whole.** iOS 26 offers to shrink it to a single circular button
				 * on scroll-down, and it was tried — but this app's bar is the only way between
				 * five sections, and collapsed it says nothing about the other four. The design's
				 * rule that the bar stays visible on every screen is about being *available*, not
				 * merely present.
				 */
				minimizeBehavior='never'
				hapticFeedbackEnabled
				/*
				 * The design's own label: Manrope medium at 10, where the native bar defaults to the
				 * system face at ~12. That is also what buys the **spacing between items** — a native
				 * bar divides its width evenly and sizes the selected pill to its label, so with long
				 * Dutch words ("Ontdekken", "Herinnering") at 12pt the pill grew until it touched its
				 * neighbour's text. There is no item-spacing knob to reach for; the type is the lever.
				 */
				tabLabelStyle={{ fontFamily: appFonts.medium, fontSize: 10 }}
				tabBarActiveTintColor={theme.colors.accent}
				tabBarInactiveTintColor={theme.colors.subtext}
				// Hidden natively rather than by a zero-height sibling — there is no custom bar
				// left to collapse. `TAB_BAR_HIDDEN_ROUTES` is empty, so this is off today.
				tabBarHidden={isBarHidden}
				// Without it the scene wrapper does not fill, so a ScrollView inside grows to
				// its content height and has nothing left to scroll.
				screenOptions={{ lazy: false, sceneStyle: { flex: 1 } }}
			>
				<Tab.Screen name='Home' component={HomeTab} options={tabOptions('Home')} />
				<Tab.Screen name='Groups' component={GroupsTab} options={tabOptions('Groups')} />
				<Tab.Screen name='Discover' component={DiscoverTab} options={tabOptions('Discover')} />
				<Tab.Screen name='Reminders' component={RemindersTab} options={tabOptions('Reminders')} />
				<Tab.Screen name='Profile' component={ProfileTab} options={tabOptions('Profile')} />
			</Tab.Navigator>
		</TabBarOffsetContext.Provider>
	);
};

const AuthNavigator = () => (
	// No native header: 01B and 01C draw the design's inline "‹ Geri" through
	// `ScreenHeader`, and a transparent native one put a second, round back button on top
	// of it. 01A and 01D have no back affordance at all — the first is the root and the
	// second offers "Girişe dön" instead.
	<AuthStack.Navigator screenOptions={{ headerShown: false }}>
		<AuthStack.Screen name='SignIn' component={SignInScreen} />
		<AuthStack.Screen name='SignUp' component={SignUpScreen} />
		<AuthStack.Screen name='ForgotPassword' component={ForgotPasswordScreen} />
		<AuthStack.Screen name='ResetCodeSent' component={ResetCodeSentScreen} />
		{/* The reset lands here signed in, so going back would strand a completed attempt. */}
		<AuthStack.Screen name='SetNewPassword' component={SetNewPasswordScreen} options={{ gestureEnabled: false }} />
	</AuthStack.Navigator>
);

const FullScreenLoader = () => {
	const { theme } = useThemeContext();

	return (
		<View
			style={{
				alignItems: 'center',
				backgroundColor: theme.colors.background,
				flex: 1,
				justifyContent: 'center'
			}}
		>
			<ActivityIndicator color={theme.colors.accent} size='large' />
		</View>
	);
};

export const AppNavigator = () => {
	const { isLoaded, isSignedIn } = useAuth();
	const { data: settings, isPending: isSettingsPending } = useGetUserSettings();

	if (!isLoaded) {
		return <FullScreenLoader />;
	}

	if (!isSignedIn) {
		return <AuthNavigator />;
	}

	// Hold the stack until settings resolve — mounting Tabs first and then swapping
	// the initial route would flash the group list behind the onboarding screen.
	if (isSettingsPending) {
		return <FullScreenLoader />;
	}

	return (
		<Stack.Navigator
			initialRouteName={settings?.hasSeenOnboarding === false ? 'Onboarding' : 'Tabs'}
			screenOptions={{ headerShown: false }}
		>
			<Stack.Screen name='Onboarding' component={OnboardingScreen} options={{ gestureEnabled: false }} />
			<Stack.Screen name='Tabs' component={TabsNavigator} />
			<Stack.Group screenOptions={sheetRouteOptions}>
				<Stack.Screen name='CreateGroup' component={CreateGroupScreen} />
			</Stack.Group>
		</Stack.Navigator>
	);
};
