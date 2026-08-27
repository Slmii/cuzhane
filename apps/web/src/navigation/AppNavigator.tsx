import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useGetUserSettings } from '@/lib/hooks/useUserSettings';
import { BottomNavBar } from '@/navigation/BottomNavBar.component';
import { TabBarOffsetContext } from '@/navigation/TabBarOffsetContext';
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
import { BabReaderScreen } from '@/screens/Reader/BabReaderScreen.component';
import { RemindersScreen } from '@/screens/Reminders/RemindersScreen.component';
import { useAuth } from '@clerk/expo';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigationState, type NavigationState, type PartialState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

/**
 * The bottom bar is a sibling *below* the scene, not an overlay, so the scene is
 * already inset by its height — screens only need a little air above it, matching the
 * design's `.sc` bottom padding. Reserving the bar's height here again is what left a
 * screenful of dead space under long content.
 */
const TAB_BAR_CONTENT_GAP = 18;

/** The reader is meant to be immersive, so the bar steps out of its way. */
const TAB_BAR_HIDDEN_ROUTES = new Set<string>(['BabReader']);

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

const Tab = createBottomTabNavigator<RootTabParamList>();
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
		<TabStack.Screen name='Lobby' component={LobbyScreen} />
		<TabStack.Screen name='Pool' component={PoolScreen} />
		<TabStack.Screen name='Rounds' component={RoundsScreen} />
		<TabStack.Screen name='RoundDetail' component={RoundDetailScreen} />
		<TabStack.Screen name='InvitePreview' component={InvitePreviewScreen} />
		<TabStack.Screen name='JoinedWelcome' component={JoinedWelcomeScreen} options={{ gestureEnabled: false }} />
	</>
);

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
	const isBarHidden = useNavigationState(state => {
		const name = focusedRouteName(state);
		return name !== undefined && TAB_BAR_HIDDEN_ROUTES.has(name);
	});
	// Screens pad their content by this much; a hidden bar has to zero it out too, or
	// the reader keeps a strip of dead space at the bottom.
	const tabBarOffset = isBarHidden ? 0 : TAB_BAR_CONTENT_GAP;

	return (
		<TabBarOffsetContext.Provider value={tabBarOffset}>
			<Tab.Navigator
				backBehavior='order'
				detachInactiveScreens={false}
				screenOptions={{
					animation: 'shift',
					freezeOnBlur: false,
					headerShown: false,
					lazy: false,
					// Each tab owns its history, so without this a tab you left deep inside a
					// group would still be showing that group when you came back to it.
					// The pop is dispatched once the tab transition has finished, so it happens
					// off-screen; tabs that aren't stacks (Reminders, Profile) ignore it.
					popToTopOnBlur: true,
					tabBarStyle: { display: 'none' }
				}}
				// Kept mounted and *collapsed*, never unmounted. Returning `null` here removed
				// the bar the instant the reader was navigated to, which reflowed the screen
				// being pushed away — you saw its card corner flash in the freed space while
				// the reader was still sliding over it. A zero-height bar frees exactly the
				// same room without the sibling below it ever leaving the tree.
				tabBar={props => <BottomNavBar {...props} isCollapsed={isBarHidden} />}
			>
				<Tab.Screen name='Home' component={HomeTabStack} />
				<Tab.Screen name='Groups' component={GroupsTabStack} />
				<Tab.Screen name='Discover' component={DiscoverTabStack} />
				<Tab.Screen name='Reminders' component={RemindersScreen} />
				<Tab.Screen name='Profile' component={ProfileScreen} />
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
