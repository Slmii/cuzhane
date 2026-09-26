import { HizbPlanReader } from '@/screens/Hizb/HizbPlanReader.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { SplashScreen as AnimatedSplash } from '@/screens/Splash/SplashScreen.component';
import { userSettingsQueryKeys } from '@/lib/hooks/queryKeys';
import { useGetUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { StringKey } from '@/lib/i18n/strings';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { HasTabBarContext, TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
import { setLinkGateReady } from '@/navigation/linkGate';
import { forceTabBarHidden, useForcedTabBarHidden } from '@/navigation/tabBarVisibility';
import { AuthStackParamList, RootStackParamList, RootTabParamList, TabStackParamList } from '@/navigation/types';
import { TrailingCornerAction } from '@/navigation/TrailingCornerAction';
import { ForgotPasswordScreen } from '@/screens/Auth/ForgotPasswordScreen.component';
import { ResetCodeSentScreen } from '@/screens/Auth/ResetCodeSentScreen.component';
import { SetNewPasswordScreen } from '@/screens/Auth/SetNewPasswordScreen.component';
import { SignInScreen } from '@/screens/Auth/SignInScreen.component';
import { SignUpScreen } from '@/screens/Auth/SignUpScreen.component';
import { DiscoverScreen } from '@/screens/Discover/DiscoverScreen.component';
import { DiscoverToolbar } from '@/screens/Discover/DiscoverToolbar.component';
import { CreateGroupScreen } from '@/screens/Groups/CreateGroupScreen.component';
import { GroupDetailScreen } from '@/screens/Groups/GroupDetailScreen.component';
import { GroupDetailToolbar } from '@/screens/Groups/GroupDetailToolbar.component';
import { GroupsScreen } from '@/screens/Groups/GroupsScreen.component';
import { GroupBrowseProvider } from '@/components/GroupBrowseBar/GroupBrowse.context';
import { GroupsToolbar } from '@/screens/Groups/GroupsToolbar.component';
import { HizbIndexScreen } from '@/screens/Groups/HizbIndexScreen.component';
import { LobbyScreen } from '@/screens/Groups/LobbyScreen.component';
import { PoolScreen } from '@/screens/Groups/PoolScreen.component';
import { RoundDetailScreen } from '@/screens/Groups/RoundDetailScreen.component';
import { MyProgressScreen } from '@/screens/Groups/MyProgressScreen.component';
import { GroupIntroductionScreen } from '@/screens/Groups/GroupIntroductionScreen.component';
import { RoundsScreen } from '@/screens/Groups/RoundsScreen.component';
import { HomeScreen } from '@/screens/Home/HomeScreen.component';
import { HomeSkeleton } from '@/screens/Home/HomeSkeleton.component';
import { InvitePreviewScreen } from '@/screens/Join/InvitePreviewScreen.component';
import { JoinedWelcomeScreen } from '@/screens/Join/JoinedWelcomeScreen.component';
import { OnboardingScreen } from '@/screens/Onboarding/OnboardingScreen.component';
import { ProfileScreen } from '@/screens/Profile/ProfileScreen.component';
import { NotificationsScreen } from '@/screens/Notifications/NotificationsScreen.component';
import { NotificationSettingsToolbar } from '@/navigation/NotificationSettingsToolbar';
import { useUnreadNotificationCount } from '@/lib/hooks/useNotifications';
import { ReleaseNotesScreen } from '@/screens/WhatsNew/ReleaseNotesScreen.component';
import { HizbReaderScreen } from '@/screens/Hizb/HizbReaderScreen.component';
import { HizbSectionsScreen } from '@/screens/Hizb/HizbSectionsScreen.component';
import { AllBabsScreen } from '@/screens/Reader/AllBabsScreen.component';
import { BabReaderScreen } from '@/screens/Reader/BabReaderScreen.component';
import { ReaderToolbar } from '@/screens/Reader/ReaderToolbar.component';
import { RemindersScreen } from '@/screens/Reminders/RemindersScreen.component';
import { SearchScreen } from '@/screens/Search/SearchScreen.component';
import { createNativeBottomTabNavigator, type NativeBottomTabNavigationProp } from '@bottom-tabs/react-navigation';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import {
	StackActions,
	useNavigationState,
	type NavigationState,
	type PartialState,
	type RouteProp
} from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Platform, type ImageSourcePropType } from 'react-native';
import { useBottomTabBarHeight, type AppleIcon } from 'react-native-bottom-tabs';

/**
 * Screens the bar steps out of the way for.
 *
 * `Search` is the one entry: K2's search mode *replaces* the bar with the glass field and
 * Kapat, so the native bar goes while that tab is focused and comes back with Kapat. The
 * reader used to be listed here on the grounds that reading should be immersive, and it is
 * being tried with the bar left in — it stacks directly under the reader's own prev · Okudum ·
 * next bar, so the two are worth looking at together before deciding. Put `'BabReader'`
 * back to restore the immersive version.
 */
const TAB_BAR_HIDDEN_ROUTES = new Set<string>(['Search']);

type AnyNavigationState = NavigationState | PartialState<NavigationState>;

/** Walks the focused route down through every nested navigator to the visible screen. */
export const focusedRouteName = (state: AnyNavigationState | undefined): string | undefined => {
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
 * How long after the tab switch the bar is asked back. The switch is a single frame; this only
 * has to clear it, and stay short enough that the bar's own slide reads as part of the same gesture.
 */
const TAB_BAR_UNHIDE_DELAY_MS = 120;

/**
 * **Hide at once, show a beat later.** The native bar has two hiding mechanisms stacked on top
 * of each other: a UIKit `isHidden` toggle that snaps, and a per-page SwiftUI toolbar modifier
 * that animates. Flip the flag in the same commit as the tab change — which is what leaving
 * search does — and the bar snapped in with Ana sayfa, faded *out* as SwiftUI reconciled the
 * page that was still hiding it, then faded in again. Recorded at 12fps: shown, gone, shown.
 * Letting the selection settle first leaves SwiftUI one transition to play. Hiding has no such
 * problem — a bar that vanishes at once is what search mode wants anyway.
 */
const useSettledTabBarHidden = (shouldHide: boolean) => {
	const [previousShouldHide, setPreviousShouldHide] = useState(shouldHide);
	// The bar stays hidden past the flag dropping, until the timer below lets it go.
	const [isLingering, setIsLingering] = useState(false);

	// Adjusted during render rather than from an effect — the React-sanctioned shape, and what
	// keeps `react-hooks/set-state-in-effect` quiet.
	if (previousShouldHide !== shouldHide) {
		setPreviousShouldHide(shouldHide);
		setIsLingering(!shouldHide);
	}

	useEffect(() => {
		if (!isLingering) {
			return;
		}

		const handle = setTimeout(() => setIsLingering(false), TAB_BAR_UNHIDE_DELAY_MS);

		return () => clearTimeout(handle);
	}, [isLingering]);

	return shouldHide || isLingering;
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
type TabIconSource = ImageSourcePropType | AppleIcon;

/**
 * **The search tab wears Apple's own magnifier on iOS.** With `role: 'search'` the bar draws a
 * detached circle, and the glyph the platform puts in that circle everywhere else is
 * `magnifyingglass`; a rasterised copy of ours beside it read as a lookalike. The library only
 * takes a *system* symbol there (no custom catalog names), so the icon set's drawing still ships
 * as a PNG for Android, where the search tab is an ordinary fifth tab.
 */
const SEARCH_TAB_ICON: TabIconSource =
	Platform.OS === 'ios' ? { sfSymbol: 'magnifyingglass' } : require('@/assets/tabs/search.png');
const SEARCH_TAB_ICON_ACTIVE: TabIconSource =
	Platform.OS === 'ios' ? { sfSymbol: 'magnifyingglass' } : require('@/assets/tabs/searchActive.png');

const TAB_ICONS: Record<keyof RootTabParamList, { active: TabIconSource; resting: TabIconSource }> = {
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
	// The same bell artwork it always was — the tab behind it is the inbox now, which is what
	// a bell in a tab bar reads as anyway. See `RootTabParamList.Notifications`.
	Notifications: {
		active: require('@/assets/tabs/remindersActive.png'),
		resting: require('@/assets/tabs/reminders.png')
	},
	Search: {
		active: SEARCH_TAB_ICON_ACTIVE,
		resting: SEARCH_TAB_ICON
	},
	// Android's fifth tab — see `TrailingCornerAction` for why the platforms swap the two.
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
 * The label has to be passed explicitly. A native tab falls back to the **screen title**,
 * which is the route name — so the bar came up reading "Home · Groups · Discover" in a Dutch
 * app. The old JS bar looked its label up from the strings table itself; this one is told.
 */
const TAB_LABEL_KEYS: Record<keyof RootTabParamList, StringKey> = {
	Home: 'home',
	Groups: 'groups',
	Discover: 'discover',
	Notifications: 'notifTabLabel',
	Search: 'search',
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
 * **A cancelled swipe-back must give the bar back.** The search screen asks for the bar to hide
 * the moment a pop starts revealing it (`tabBarVisibility`), and withdraws that on blur. A
 * swipe the user lets snap back never commits, so the search screen is never focused and never
 * blurs — UIKit skips the disappear callbacks for a cancelled interactive pop — and the flag
 * would stay up over the result screen. The dismissing screen does report the cancel, and a
 * navigator's `screenListeners` hears every screen, so every tab stack withdraws it here.
 * Harmless when search *is* focused: the route-based flag keeps the bar hidden on its own.
 */
const tabStackScreenListeners = {
	gestureCancel: () => forceTabBarHidden(false)
};

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
 * A pushed screen with nothing of its own in the bar: back on the left, the account on the
 * right, which is where it sits on every screen. Screens with their own actions (the group
 * screen, the readers) put the account at the end of their toolbar rows instead.
 */
const pushedScreenOptions: NativeStackNavigationOptions = {
	...nativeBackScreenOptions,
	headerRight: () => <TrailingCornerAction />
};

/**
 * Screens a group can be opened into. Registered in every tab that can reach a group so
 * they push *inside* the tab — which is what keeps the bottom bar on screen.
 */
// Called per navigator rather than shared as one element: each stack needs its own
// `Screen` elements, otherwise only the first navigator to mount registers them.
// `isProfileRoot`: Android's Profil tab already has `Profile` as its root, and a navigator
// cannot register the same name twice.
const sharedTabScreens = ({ isProfileRoot = false }: { isProfileRoot?: boolean } = {}) => (
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
		<TabStack.Screen name='Lobby' component={LobbyScreen} options={pushedScreenOptions} />
		<TabStack.Screen name='Pool' component={PoolScreen} options={pushedScreenOptions} />
		<TabStack.Screen name='HizbIndex' component={HizbIndexScreen} options={pushedScreenOptions} />
		<TabStack.Screen name='Rounds' component={RoundsScreen} options={pushedScreenOptions} />
		<TabStack.Screen name='MyProgress' component={MyProgressScreen} options={pushedScreenOptions} />
		<TabStack.Screen name='RoundDetail' component={RoundDetailScreen} options={pushedScreenOptions} />
		{/*
		 * The native back button like every other pushed screen. It was the exception while its
		 * heading carried a labelled "‹ Keşfet" link, on the reasoning that the label said where
		 * you were going — but this screen is only ever pushed from Keşfet (it is deliberately
		 * absent from `linking.ts`, since an invitation is a code and never a URL), so back is
		 * the only place it goes and the chevron already says so.
		 */}
		<TabStack.Screen name='InvitePreview' component={InvitePreviewScreen} options={pushedScreenOptions} />
		<TabStack.Screen name='GroupIntroduction' component={GroupIntroductionScreen} options={pushedScreenOptions} />
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
		<TabStack.Screen name='JoinedWelcome' component={JoinedWelcomeScreen} options={pushedScreenOptions} />
		{/* Pushed from the account item at the right end of every bar on iOS — see `TrailingCornerAction`. */}
		{isProfileRoot ? null : (
			<TabStack.Screen name='Profile' component={ProfileScreen} options={nativeBackScreenOptions} />
		)}
		{/*
		 * On Android search is pushed from the bar's magnifier rather than being a tab, so the
		 * screen is registered in every stack. It heads itself and closes with its ×, hence no
		 * header; `TAB_BAR_HIDDEN_ROUTES` still steps the bar aside for it by route name.
		 */}
		{/*
		 * P4. It was this app's fourth *tab* until the inbox took that place; it is reached from
		 * the gear on the inbox and from Profil's own row, and is registered in every stack so
		 * both of those push it inside whichever tab the reader is in.
		 */}
		<TabStack.Screen name='Reminders' component={RemindersScreen} options={pushedScreenOptions} />
		<TabStack.Screen name='ReleaseNotes' component={ReleaseNotesScreen} options={nativeBackScreenOptions} />
		<TabStack.Screen name='HizbPlanReader' component={HizbPlanReader} options={nativeBackScreenOptions} />
		<TabStack.Screen name='HizbSections' component={HizbSectionsScreen} options={nativeBackScreenOptions} />
		<TabStack.Screen
			name='HizbReader'
			component={HizbReaderScreen}
			options={{ ...nativeBackScreenOptions, headerRight: () => <ReaderToolbar /> }}
		/>
		{Platform.OS === 'android' ? <TabStack.Screen name='Search' component={SearchScreen} /> : null}
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
	<TabStack.Navigator screenListeners={tabStackScreenListeners} screenOptions={tabStackScreenOptions}>
		{/*
		 * The bar floats over H1's coloured top layer, which is where the design puts the account
		 * anyway — beside the greeting rather than under it. Same item as every other tab root:
		 * the photo on iOS, search on Android.
		 */}
		<TabStack.Screen
			name='Home'
			component={HomeScreen}
			options={{
				...rootToolbarScreenOptions,
				// The one bar that is not over the page: the glyphs follow H1's layer, not the theme.
				// The bell rides along inside `TrailingCornerAction`, as it does on every bar.
				headerRight: () => <TrailingCornerAction isOnHeaderSurface />
			}}
		/>
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
		<TabStack.Navigator screenListeners={tabStackScreenListeners} screenOptions={tabStackScreenOptions}>
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
		<TabStack.Navigator screenListeners={tabStackScreenListeners} screenOptions={tabStackScreenOptions}>
			{/* A bar for the browse menu and the account, the same arrangement Gruplarım uses. */}
			<TabStack.Screen
				name='Discover'
				component={DiscoverScreen}
				options={{ ...rootToolbarScreenOptions, headerRight: () => <DiscoverToolbar /> }}
			/>
			{sharedTabScreens()}
		</TabStack.Navigator>
	</GroupBrowseProvider>
);

/*
 * The bell tab: P2's inbox at the root, its settings one push in.
 *
 * The gear is the only thing in this bar that is not on every other one — it opens P4, the
 * screen this tab used to *be*. Registered here in `options` rather than from the screen, like
 * every other bar in this file.
 */
const NotificationsTabStack = () => (
	<TabStack.Navigator screenListeners={tabStackScreenListeners} screenOptions={tabStackScreenOptions}>
		<TabStack.Screen
			name='Notifications'
			component={NotificationsScreen}
			options={{ ...rootToolbarScreenOptions, headerRight: () => <NotificationSettingsToolbar /> }}
		/>
		{sharedTabScreens()}
	</TabStack.Navigator>
);

/*
 * Search is a stack so that a result pushes *over* the search: back returns to the query and
 * its results rather than to another tab's list, and the bar — hidden for `Search` alone —
 * comes back for the pushed screen. The bar carries the account like every other tab root;
 * the screen heads itself and closes with its ×.
 */
const SearchTabStack = () => (
	<TabStack.Navigator screenListeners={tabStackScreenListeners} screenOptions={tabStackScreenOptions}>
		<TabStack.Screen
			name='Search'
			component={SearchScreen}
			options={{ ...rootToolbarScreenOptions, headerRight: () => <TrailingCornerAction /> }}
		/>
		{sharedTabScreens()}
	</TabStack.Navigator>
);

const HomeTab = withTabBarOffset(HomeTabStack);
const GroupsTab = withTabBarOffset(GroupsTabStack);
const DiscoverTab = withTabBarOffset(DiscoverTabStack);
const NotificationsTab = withTabBarOffset(NotificationsTabStack);
const SearchTab = withTabBarOffset(SearchTabStack);

// Android only: Profil as a tab root, with the bar's magnifier like every other root.
const ProfileTabStack = () => (
	<TabStack.Navigator screenListeners={tabStackScreenListeners} screenOptions={tabStackScreenOptions}>
		<TabStack.Screen
			name='Profile'
			component={ProfileScreen}
			options={{ ...rootToolbarScreenOptions, headerRight: () => <TrailingCornerAction /> }}
		/>
		{sharedTabScreens({ isProfileRoot: true })}
	</TabStack.Navigator>
);
const ProfileTab = withTabBarOffset(ProfileTabStack);

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

	// The tabs are up: a link that arrived signed out or on Onboarding can be followed now.
	useEffect(() => {
		setLinkGateReady(true);

		return () => setLinkGateReady(false);
	}, []);

	const { data: unreadCount = 0 } = useUnreadNotificationCount();

	const tabOptions = (name: keyof RootTabParamList) => ({
		tabBarIcon: tabIcon(name),
		tabBarLabel: t(TAB_LABEL_KEYS[name])
	});

	/*
	 * **The unread count is the platform's own tab badge**, not a mark of ours. It replaced a
	 * hand-drawn dot on the bar glyph, which is the thing a tab bar already does natively and
	 * better — and a number says how much is waiting where a dot only says "something".
	 *
	 * Capped at 99, because the pill grows with its text and a four-digit badge would push the
	 * label out from under its icon. An inbox that far behind is "lots" either way.
	 */
	const unreadBadge = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : undefined;
	const notificationsTabOptions = {
		...tabOptions('Notifications'),
		...(unreadBadge === undefined ? {} : { tabBarBadge: unreadBadge })
	};

	const shouldHideBar = useNavigationState(state => {
		const name = focusedRouteName(state);
		return name !== undefined && TAB_BAR_HIDDEN_ROUTES.has(name);
	});
	const isSettledHidden = useSettledTabBarHidden(shouldHideBar);
	// Raised by the search screen as a pop starts revealing it — see `tabBarVisibility`.
	const isForcedHidden = useForcedTabBarHidden();
	const isBarHidden = isSettledHidden || isForcedHidden;

	/*
	 * The floor, for anything rendered outside a tab scene. Every tab's own component is
	 * wrapped in `withTabBarOffset`, which overrides this with the bar's measured height.
	 */
	return (
		<TabBarOffsetContext.Provider value={0}>
			<Tab.Navigator
				/*
				 * "Back" on a tab means the tab you came from, which is what Kapat on the search
				 * screen does: it leaves search and lands where you were, bar restored.
				 */
				backBehavior='history'
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
				// left to collapse. Search mode is the one thing that hides it.
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
				<Tab.Screen
					name='Notifications'
					component={NotificationsTab}
					listeners={resetTabStack}
					options={notificationsTabOptions}
				/>
				{/*
				 * **The search tab is iOS 26's own detached search button** — `role: 'search'` is
				 * the slot Apple Music puts search in, a circle beside the capsule, icon-only. K2
				 * gave it the fifth slot in place of Profil, which moved to Ana sayfa's header.
				 * The label still goes in for Android, which draws it as an ordinary fifth tab.
				 */}
				{Platform.OS === 'ios' ? (
					<Tab.Screen
						name='Search'
						component={SearchTab}
						listeners={resetTabStack}
						options={{ ...tabOptions('Search'), role: 'search' }}
					/>
				) : (
					/*
					 * Material keeps the navigation bar for destinations and puts search in the
					 * top bar, so Android swaps the two: Profil is the fifth tab here and search is
					 * `TrailingCornerAction` at the right end of every bar, pushing `Search`
					 * inside the current tab.
					 */
					<Tab.Screen
						name='Profile'
						component={ProfileTab}
						listeners={resetTabStack}
						options={tabOptions('Profile')}
					/>
				)}
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

/**
 * The gap between the native splash and the first screen — Clerk resolving, then the settings
 * that decide whether this account has seen the tour.
 *
 * **The app's own splash, not a second thing that looks like it.** `AppRoot` shows
 * `SplashScreen` over the navigator for a fixed two seconds; if the account's settings take
 * longer than that, the timer unmounts it and whatever the navigator is holding becomes
 * visible. Drawing a bare mark here meant the reader saw the splash, then a still, plainer
 * imitation of it — two loading screens in a row for one launch.
 *
 * Rendering the same component means there is nothing to notice: both mount at launch, so the
 * one underneath has already played its entrance by the time the one above it goes, and the
 * hand-over is invisible. It is also, unavoidably, the same screen after sign-in, where there
 * was never a splash to continue.
 */
const SplashHold = () => <AnimatedSplash />;

export const AppNavigator = () => {
	const { isLoaded, isSignedIn } = useAuth();
	// The whole query, not just its data: `ErrorState` refetches it from the failure branch
	// below, so it needs the object rather than a snapshot of it.
	const settingsQuery = useGetUserSettings();
	const { data: settings, isError: hasSettingsError, isPending: isSettingsPending } = settingsQuery;

	/*
	 * **A failure collected while signed out must not survive into the session.** This query
	 * runs from the moment the navigator mounts, which is before anyone has signed in, so its
	 * first attempt is a token-less 401 — and TanStack keeps that error. The gate below checks
	 * `isSignedIn` first, so the error is invisible on the auth screens and then lands in front
	 * of a reader who has just signed in successfully. It looked Google-specific because the
	 * default three retries span roughly seven seconds: email and Apple land inside that window
	 * and one retry succeeds, while a first Google sign-in — browser, account picker, consent —
	 * routinely outlasts it, so the query has already settled into a cached error.
	 *
	 * Resetting on the transition is what makes the timing irrelevant. The previous result
	 * belongs to a different identity (nobody), so it is discarded rather than reasoned about,
	 * and the refetch that follows carries a token.
	 *
	 * **Note what this deliberately does not do.** Gating the query on `isSignedIn` is the
	 * obvious alternative and it was shipped once: it moves the first request to the instant
	 * Clerk flips signed-in, before a JWT can be minted, and `wrapper.api.ts` answers a missing
	 * token by calling the handler that **signs the reader out** — `useAuthTokenSync` only
	 * returns early while `isSignedIn` is false. Firing this query while signed out is exactly
	 * what keeps that 401 harmless. Leave it running.
	 */
	const queryClient = useQueryClient();
	const wasSignedIn = useRef(isSignedIn);

	useEffect(() => {
		const hasJustSignedIn = isSignedIn === true && wasSignedIn.current !== true;

		wasSignedIn.current = isSignedIn;

		if (hasJustSignedIn) {
			void queryClient.resetQueries({ queryKey: userSettingsQueryKeys.settings() });
		}
	}, [isSignedIn, queryClient]);

	/*
	 * **Has this account's settings ever arrived?** The splash below is right on a cold start
	 * and wrong on the way out: signing out clears the query cache a frame or two before Clerk
	 * reports the session gone, so the gate briefly sees "signed in, settings pending" and put
	 * the splash up on the way to the sign-in screen. Once settings have resolved even once,
	 * a pending query is a transition rather than a launch, and the right thing to draw is
	 * nothing at all for those few frames.
	 */
	// State adjusted during render rather than a ref, which is the React-sanctioned shape and
	// what `useSettledTabBarHidden` above already does — reading a ref while rendering is what
	// the lint rule refuses.
	const [hasEverSettled, setHasEverSettled] = useState(false);

	if (settings !== undefined && !hasEverSettled) {
		setHasEverSettled(true);
	}

	/*
	 * **Did this session pass through the sign-in screens?** It is what separates the three
	 * things the wait below used to look identical for: a cold start (a launch — the splash
	 * belongs), signing out (on its way to the auth screens — draw nothing), and signing in
	 * (on its way to Ana sayfa — draw Ana sayfa's own skeleton, which is what the reader is
	 * about to get). Only signing in can have shown the auth navigator first.
	 */
	const [hasShownAuth, setHasShownAuth] = useState(false);

	if (isLoaded && !isSignedIn && !hasShownAuth) {
		setHasShownAuth(true);
	}

	/*
	 * **The splash belongs to a launch, and nothing else.** Clerk drops `isLoaded` while it
	 * signs out too, so this branch — not the settings one below — is what put the splash in
	 * front of the sign-in screen on the way out. Once anything has resolved in this session
	 * we are not launching, and the honest thing to draw for those few frames is nothing.
	 */
	if (!isLoaded) {
		return hasEverSettled || hasShownAuth ? null : <SplashHold />;
	}

	if (!isSignedIn) {
		return <AuthNavigator />;
	}

	// Hold the stack until settings resolve — mounting Tabs first and then swapping
	// the initial route would flash the group list behind the onboarding screen.
	if (isSettingsPending) {
		if (hasShownAuth) {
			return <HomeSkeleton />;
		}

		return hasEverSettled ? null : <SplashHold />;
	}

	/*
	 * **The gate needs a way out, not just a way to wait.** Holding the splash was the only
	 * behaviour here, so an unreachable API left the app on the mark indefinitely: no error, no
	 * retry, nothing to distinguish it from a hang — and this gate runs before any screen
	 * exists, so it is the one place an outage is most visible and was the one place with no
	 * answer for it. `ErrorState` is what every other screen shows, down to the retry and the
	 * HTTP status; it draws its own `ScreenContainer` and touches no navigation, so it renders
	 * here in place of the navigator exactly as `SplashHold` does.
	 */
	if (hasSettingsError) {
		return <ErrorState queries={[settingsQuery]} />;
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
