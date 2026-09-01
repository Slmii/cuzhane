import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
	SignIn: undefined;
	SignUp: undefined;
	ForgotPassword: undefined;
	/** Step 2 of the reset flow — the address is shown back to the user. */
	ResetCodeSent: { email: string };
	SetNewPassword: undefined;
};

/**
 * Screens pushed *inside* a tab rather than over it, so the tab bar stays visible.
 * The same set is registered in the Home, Groups and Discover stacks — a group can be
 * opened from any of the three, and each keeps its own back stack.
 */
export type TabDetailParamList = {
	/**
	 * Joining by code is a sheet (`JoinByCodeSheet`), not a route: with the shareable URL
	 * gone there is nothing to land on, so the flow opens over whichever screen you are on
	 * and its three steps live inside one surface.
	 *
	 * The read-only preview of a group tapped in Keşfet — frames 03b/03c/03f — is still a
	 * screen, because browsing genuinely is navigation.
	 */
	InvitePreview: { groupId: string };
	JoinedWelcome: { groupId: string };
	/**
	 * `sheet` asks the screen to open one of its sheets on arrival. It exists so the bar's
	 * actions can live in the navigator instead of a `setOptions` effect: a header registered
	 * in `options` is drawn on the first frame, but it is outside the screen and cannot reach
	 * its state. Same device as `shouldOpenJoinSheet`, and cleared on dismissal for the same
	 * reason — left set, the flag would reopen the sheet on the next render.
	 */
	GroupDetail: { groupId: string; sheet?: GroupDetailSheet };
	/**
	 * `shouldOpenTextSize` asks the reader to open its text-size sheet, for the same reason
	 * `GroupDetail.sheet` exists: the control lives in the navigator's bar, outside the screen
	 * that owns the sheet. Cleared on dismissal, or it would reopen on the next render.
	 */
	BabReader: { groupId: string; babNumber: number; shouldOpenTextSize?: boolean };
	Rounds: { groupId: string };
	RoundDetail: { groupId: string; roundIndex: number };
	/** Where a GATHERING group lives — the creator's start screen, or the member's wait. */
	Lobby: { groupId: string };
	/** Shown once, right after the owner opens day 1. */
	/** The share of the seats nobody took. */
	Pool: { groupId: string };
	/**
	 * B7 — the whole cevşen, read outside any group. **No params**: the bab is screen state,
	 * because a free read is a place you are rather than one you are sent to, and nothing —
	 * no notification, no invite, no link — ever needs to open a particular bab here.
	 */
	/** Free reading, outside any group. `shouldOpenTextSize` as on `BabReader`. */
	AllBabs: { shouldOpenTextSize?: boolean } | undefined;
};

export type GroupsScreenParams = { shouldOpenJoinSheet?: boolean } | undefined;

/** The sheets the group screen's bar can ask for. Not a route — each is `ui/BottomSheet`. */
export type GroupDetailSheet = 'manage' | 'members' | 'share';

/** The three tabs that own a stack accept a nested target. */
export type RootTabParamList = {
	Home: NavigatorScreenParams<TabDetailParamList & { Home: undefined }> | undefined;
	/**
	 * `shouldOpenJoinSheet` asks the Groups tab to open the join sheet on arrival: the flow
	 * is a sheet rather than a route, so it can't be navigated to — the tab that owns it is.
	 * The screen clears the flag once it has acted, so returning to the tab doesn't reopen it.
	 *
	 * **Nothing sets it at the moment.** Onboarding's "Davet kodum var" was its only caller,
	 * and the five-page tour has no such button — the join sheet is still reached from
	 * Gruplarım's key button and from the two empty states. Kept because it is the wiring any
	 * future "I have a code" entry point would need, not because something is using it.
	 */
	Groups: NavigatorScreenParams<TabDetailParamList & { Groups: GroupsScreenParams }> | undefined;
	Discover: NavigatorScreenParams<TabDetailParamList & { Discover: undefined }> | undefined;
	Reminders: undefined;
	Profile: undefined;
};

/**
 * What a screen inside a tab can navigate to: its own stack, a sibling tab, or a route
 * on the root stack. React Navigation resolves a name it doesn't own by walking up to
 * the parent navigator, so `CreateGroup` and `Tabs` are reachable from here too.
 */
export type TabStackParamList = RootTabParamList &
	TabDetailParamList & {
		Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
		CreateGroup: undefined;
	};

export type RootStackParamList = {
	Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
	Onboarding: undefined;
	CreateGroup: undefined;
};
