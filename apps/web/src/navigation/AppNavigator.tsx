import { useGetUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { HasTabBarContext, TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { AuthStackParamList, RootStackParamList, RootTabParamList, TabStackParamList } from '@/navigation/types';
import { useProfileTabPhoto } from '@/navigation/useProfileTabPhoto';
import { ForgotPasswordScreen } from '@/screens/Auth/ForgotPasswordScreen.component';
import { ResetCodeSentScreen } from '@/screens/Auth/ResetCodeSentScreen.component';
import { SetNewPasswordScreen } from '@/screens/Auth/SetNewPasswordScreen.component';
import { SignInScreen } from '@/screens/Auth/SignInScreen.component';
import { SignUpScreen } from '@/screens/Auth/SignUpScreen.component';
import { DiscoverScreen } from '@/screens/Discover/DiscoverScreen.component';
import { CreateGroupScreen } from '@/screens/Groups/CreateGroupScreen.component';
import { GroupDetailScreen } from '@/screens/Groups/GroupDetailScreen.component';
import { GroupDetailToolbar } from '@/screens/Groups/GroupDetailToolbar.component';
import { GroupsScreen } from '@/screens/Groups/GroupsScreen.component';
import { GroupBrowseProvider } from '@/components/GroupBrowseBar/GroupBrowse.context';
import { GroupBrowseMenu } from '@/components/GroupBrowseBar/GroupBrowseMenu.component';
import { GroupsToolbar } from '@/screens/Groups/GroupsToolbar.component';
import { LobbyScreen } from '@/screens/Groups/LobbyScreen.component';
import { PoolScreen } from '@/screens/Groups/PoolScreen.component';
import { RoundDetailScreen } from '@/screens/Groups/RoundDetailScreen.component';
import { RoundsScreen } from '@/screens/Groups/RoundsScreen.component';
import { HomeScreen } from '@/screens/Home/HomeScreen.component';
import { InvitePreviewScreen } from '@/screens/Join/InvitePreviewScreen.component';
import { JoinedWelcomeScreen } from '@/screens/Join/JoinedWelcomeScreen.component';
import { OnboardingScreen } from '@/screens/Onboarding/OnboardingScreen.component';
import { ProfileScreen } from '@/screens/Profile/ProfileScreen.component';
import { AllBabsScreen } from '@/screens/Reader/AllBabsScreen.component';
import { BabReaderScreen } from '@/screens/Reader/BabReaderScreen.component';
import { ReaderToolbar } from '@/screens/Reader/ReaderToolbar.component';
import { RemindersScreen } from '@/screens/Reminders/RemindersScreen.component';
import { createNativeBottomTabNavigator, type NativeBottomTabNavigationProp } from '@bottom-tabs/react-navigation';
import { useAuth, useUser } from '@clerk/expo';
import {
	StackActions,
	useNavigationState,
	type NavigationState,
	type PartialState,
	type RouteProp
} from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { ComponentType } from 'react';
import { ActivityIndicator, Platform, View, type ImageSourcePropType } from 'react-native';
import { useBottomTabBarHeight } from 'react-native-bottom-tabs';

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

/**
 * **A tab returns to its own root when you leave it, and when you tap it again.**
 *
 * This is what `popToTopOnBlur` did on the JS bar, and it went quietly when the bar became a
 * native one — the option belongs to `@react-navigation/bottom-tabs` and the native navigator
 * has no equivalent. Without it a tab remembers wherever you were: press Ana sayfa while
 * reading in "Tüm bablar" and nothing happens, because that screen *is* the Home tab's current
 * screen. Switch away and back and it is still there.
 *
 * Two triggers, and they answer different complaints. `tabPress` covers tapping the tab you
 * are already on, which everywhere else on the phone means "take me to the top". `blur`
 * restores the documented behaviour: leaving a tab resets it, so coming back to Gruplarım
 * lands on the list rather than inside the group you last opened.
 *
 * The pop is dispatched at the tab's **nested** stack by naming its key as the action target —
 * dispatching on the tab navigator alone would do nothing, since it owns no stack history.
 *
 * **All three conditions below are load-bearing, and the last one is why this warned.** A tab
 * sitting at its own root has a nested stack with a single route and nothing to pop, and
 * dispatching `POP_TO_TOP` at it anyway logs "The action 'POP_TO_TOP' was not handled by any
 * navigator" — on every tab press, since most presses are on a tab already at its root. Guarding
 * on the index keeps the dispatch for the case that has somewhere to go. The `type` check is the
 * matching half: a tab that is a plain screen rather than a stack has no nested state at all, and
 * `state.key` alone would happily name a navigator that cannot handle the action.
 *
 * These are the same three conditions `@react-navigation/bottom-tabs` applies for
 * `popToTopOnBlur`, which is the behaviour this is standing in for.
 */
const resetTabStack = <RouteName extends keyof RootTabParamList>({
	navigation,
	route
}: {
	navigation: NativeBottomTabNavigationProp<RootTabParamList, RouteName>;
	route: RouteProp<RootTabParamList, RouteName>;
}) => {
	const popToTop = () => {
		const tabRoute = navigation.getState().routes.find(entry => entry.key === route.key);
		const nested = tabRoute?.state;

		if (nested?.type !== 'stack' || nested.key === undefined) {
			return;
		}

		const index = nested.index ?? nested.routes.length - 1;

		if (index > 0) {
			navigation.dispatch({ ...StackActions.popToTop(), target: nested.key });
		}
	};

	return { blur: popToTop, tabPress: popToTop };
};

const Tab = createNativeBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
// One factory, reused for every tab: each `<TabStack.Navigator>` element below is its
// own independent navigator with its own history.
const TabStack = createNativeStackNavigator<TabStackParamList>();

const tabStackScreenOptions = { headerShown: false } as const;

/**
 * **The platform's own back control, and nothing else of a header.** Every pushed screen whose
 * back means "back" carries this; `ScreenHeader`'s `hasBackButton` reserves the band it floats
 * in. The exceptions are noted where they are registered.
 *
 * Every part of this is load-bearing:
 *
 * - `headerTransparent` leaves the screen drawing to its own top edge. Without it the native bar
 *   takes a band of its own and pushes the reader's header down by its height.
 * - `headerTitle: ''` because the screen already heads itself — `ScreenTitle` is the app's one
 *   way of naming a screen, and a native title beside it would be the name said twice.
 * - `headerBackButtonDisplayMode: 'minimal'` gives the bare chevron. iOS labels the back button
 *   with the *previous* screen's title by default, and no route in this app sets one, so the
 *   default would render an empty word next to the arrow.
 * - `headerBackTitle: ''` is the same instruction for the older API, which the native stack still
 *   reads on some versions.
 *
 * On iOS 26 the control comes back as Liquid Glass with no asking; on Android it is the material
 * arrow. That platform-by-platform correctness is why every pushed screen takes it, and why
 * the drawn "‹ Geri" link it replaced no longer exists.
 */
/**
 * **A bar that carries controls and nothing else.** Shared by every screen whose header is the
 * platform's rather than the screen's, so the four decisions below are made once:
 *
 * - `headerTransparent` leaves the screen drawing to its own top edge. Without it the native bar
 *   claims a band of its own and pushes the screen's heading down by its height.
 * - `headerTitle: ''` because the screen already heads itself — `ScreenTitle` is the app's one
 *   way of naming a screen, and a native title beside it would be the name said twice.
 * - `headerShadowVisible: false` — nothing to divide, since the bar has no surface of its own.
 * - `scrollEdgeEffects: { top: 'hidden' }`. iOS 26 otherwise fades the top of the content under
 *   the bar, an effect meant to keep a *bar's* content legible over a scrolling page. These bars
 *   are empty, so it has nothing to protect and only veils the screen's own title. A screen that
 *   does put content in its bar turns it back on for itself — the group screen does.
 */
const barOnlyScreenOptions: NativeStackNavigationOptions = {
	headerShadowVisible: false,
	headerShown: true,
	headerTitle: '',
	headerTransparent: true,
	scrollEdgeEffects: { top: 'hidden' }
};

/**
 * The bar with the platform's back control in it — every pushed screen whose back means "back".
 * `ScreenHeader`'s `hasBackButton` reserves the band it floats in.
 *
 * `headerBackButtonDisplayMode: 'minimal'` gives the bare chevron: iOS labels back with the
 * *previous* screen's title, and no route here sets one, so the default renders an empty word
 * beside the arrow. `headerBackTitle` says the same thing to the older API, which the native
 * stack still reads on some versions.
 */
const nativeBackScreenOptions: NativeStackNavigationOptions = {
	...barOnlyScreenOptions,
	headerBackButtonDisplayMode: 'minimal',
	headerBackTitle: ''
};

/**
 * The same bar on a **tab root**, which has nothing beneath it to go back to — so the control is
 * off and the bar carries only that screen's own actions. Unusual here: every other root draws
 * its heading and no bar at all.
 */
const rootToolbarScreenOptions: NativeStackNavigationOptions = {
	...barOnlyScreenOptions,
	headerBackVisible: false
};

/**
 * Screens a group can be opened into. Registered in every tab that can reach a group so
 * they push *inside* the tab — which is what keeps the bottom bar on screen.
 */
// Called per navigator rather than shared as one element: each stack needs its own
// `Screen` elements, otherwise only the first navigator to mount registers them.
const sharedTabScreens = () => (
	<>
		{/*
		 * `headerRight` is registered here rather than set from the screen's own effect, so the
		 * actions are drawn with the first frame instead of a commit later — see
		 * `GroupDetailToolbar`.
		 *
		 * `scrollEdgeEffects` is on for this screen, where the app-wide default hides it. The
		 * effect blurs whatever passes under the bar, and here things genuinely do: nothing
		 * paints an opaque band beneath it. It is hidden elsewhere because an empty bar over an
		 * opaque heading had nothing to protect and only veiled the screen's own title.
		 */}
		<TabStack.Screen
			name='GroupDetail'
			component={GroupDetailScreen}
			options={{
				...nativeBackScreenOptions,
				headerRight: () => <GroupDetailToolbar />,
				scrollEdgeEffects: { top: 'automatic' }
			}}
		/>
		{/*
		 * The text-size control belongs in the bar, not in the reader's own header row: that row
		 * sits in the band this transparent header draws over, so a button there was unreachable.
		 */}
		<TabStack.Screen
			name='BabReader'
			component={BabReaderScreen}
			options={{ ...nativeBackScreenOptions, headerRight: () => <ReaderToolbar /> }}
		/>
		{/* Free reading carries the same text-size control as the group reader, for the same
		    reason — see the note on `BabReader` above. */}
		<TabStack.Screen
			name='AllBabs'
			component={AllBabsScreen}
			options={{ ...nativeBackScreenOptions, headerRight: () => <ReaderToolbar /> }}
		/>
		<TabStack.Screen name='Lobby' component={LobbyScreen} options={nativeBackScreenOptions} />
		<TabStack.Screen name='Pool' component={PoolScreen} options={nativeBackScreenOptions} />
		<TabStack.Screen name='Rounds' component={RoundsScreen} options={nativeBackScreenOptions} />
		<TabStack.Screen name='RoundDetail' component={RoundDetailScreen} options={nativeBackScreenOptions} />
		{/*
		 * The native back button like every other pushed screen. It was the exception while its
		 * heading carried a labelled "‹ Keşfet" link, on the reasoning that the label said where
		 * you were going — but this screen is only ever pushed from Keşfet (it is deliberately
		 * absent from `linking.ts`, since an invitation is a code and never a URL), so back is
		 * the only place it goes and the chevron already says so.
		 */}
		<TabStack.Screen name='InvitePreview' component={InvitePreviewScreen} options={nativeBackScreenOptions} />
		{/*
		 * **It needs the back button like any other pushed screen.** Gruplarım navigates here for
		 * a member whose group is still gathering, and that is a push onto the shelf — with no
		 * control in the bar there was no way out of it but the tab bar. The join flow reaches it
		 * with `replace`, so back there lands on whatever preceded the flow rather than re-entering
		 * it, which is why one button serves both.
		 *
		 * The swipe goes with it: a screen that shows a back control and refuses the gesture is
		 * the odd one out on iOS, and the gesture was only ever off to protect the join flow that
		 * `replace` had already left behind.
		 */}
		<TabStack.Screen name='JoinedWelcome' component={JoinedWelcomeScreen} options={nativeBackScreenOptions} />
	</>
);

/**
 * **How much of the scene the tab bar covers — which is the bar's height on iOS and nothing on
 * Android.** `useBottomTabBarHeight` only resolves inside a native tab screen, which is why this
 * wraps each tab rather than providing the value beside the navigator the way the JS bar allowed.
 *
 * On iOS the native bar floats *over* the scene, where the JS one was a sibling below it, so a
 * screen must inset itself by the whole height or its last row sits behind the glass.
 *
 * **Android lays the scene out above the bar instead.** `react-native-bottom-tabs` puts the
 * screens in a `layoutHolder` and the `BottomNavigationView` beneath it as siblings, so the scene
 * already ends where the bar begins. Publishing the height there reserved it a second time: a
 * band of dead background above the bar on every screen, and — on a screen whose list lives
 * inside the padded `View` rather than scrolling through it, like Keşfet — a list clipped well
 * short of the bottom, because that padding shortens the list's frame rather than its content.
 *
 * It publishes the **bare height**. What to do with it is the screen's business: scrolling
 * content adds `TAB_BAR_CONTENT_GAP` on top, while a screen placing a bar of its own against
 * it — the reader — uses the height alone and keeps its own padding symmetric. Zero also tells
 * `ScreenContainer` to take the `bottom` safe-area edge itself, which is right on Android for
 * the same reason: nothing else is covering that edge.
 */
const withTabBarOffset = (Screen: ComponentType) => {
	const Wrapped = () => {
		const height = useBottomTabBarHeight();
		const coveredHeight = Platform.OS === 'ios' ? height : 0;

		return (
			<HasTabBarContext.Provider value>
				<TabBarOffsetContext.Provider value={coveredHeight}>
					<Screen />
				</TabBarOffsetContext.Provider>
			</HasTabBarContext.Provider>
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

/*
 * The provider wraps the navigator so that Gruplarım and its **header** — which the navigator
 * renders, outside the screen — narrow one shelf. Scoped to this stack rather than the app:
 * Keşfet browses the catalogue with the same controls and must not inherit the shelf's state.
 */
const GroupsTabStack = () => (
	<GroupBrowseProvider>
		<TabStack.Navigator screenOptions={tabStackScreenOptions}>
			{/*
			 * A tab root with a header, which is unusual here — every other root draws its own
			 * heading and nothing else. This one carries its whole-screen actions in the bar
			 * instead, so they sit in the platform's own glass row. No back button: nothing is
			 * beneath a tab's root to go back to.
			 *
			 * `headerRight` is registered here rather than set from the screen's own effect, so the
			 * bar is populated on the first frame instead of a commit later — see `GroupsToolbar`.
			 */}
			<TabStack.Screen
				name='Groups'
				component={GroupsScreen}
				options={{ ...rootToolbarScreenOptions, headerRight: () => <GroupsToolbar /> }}
			/>
			{sharedTabScreens()}
		</TabStack.Navigator>
	</GroupBrowseProvider>
);

/*
 * Its own provider, deliberately not shared with Gruplarım's: the same menu narrows both, and a
 * cadence chosen while browsing the catalogue must not follow you back to your own shelf.
 */
const DiscoverTabStack = () => (
	<GroupBrowseProvider>
		<TabStack.Navigator screenOptions={tabStackScreenOptions}>
			{/* A bar for the browse menu, the same arrangement Gruplarım uses — see `GroupsToolbar`. */}
			<TabStack.Screen
				name='Discover'
				component={DiscoverScreen}
				options={{ ...rootToolbarScreenOptions, headerRight: () => <GroupBrowseMenu /> }}
			/>
			{sharedTabScreens()}
		</TabStack.Navigator>
	</GroupBrowseProvider>
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
				<Tab.Screen name='Home' component={HomeTab} listeners={resetTabStack} options={tabOptions('Home')} />
				<Tab.Screen
					name='Groups'
					component={GroupsTab}
					listeners={resetTabStack}
					options={tabOptions('Groups')}
				/>
				<Tab.Screen
					name='Discover'
					component={DiscoverTab}
					listeners={resetTabStack}
					options={tabOptions('Discover')}
				/>
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
		<AuthStack.Screen name='SignUp' component={SignUpScreen} options={nativeBackScreenOptions} />
		<AuthStack.Screen name='ForgotPassword' component={ForgotPasswordScreen} options={nativeBackScreenOptions} />
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
