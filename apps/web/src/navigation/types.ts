import type { GroupKind } from '@/lib/types/domain';
import { NavigatorScreenParams } from '@react-navigation/native';

/** Why a hatim's round-start screen (QR1) is being shown — see `RoundStart`. */
export type RoundStartReason = 'pick' | 'carried';

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
	/** `inviteCode` when reached by a code or the QR (P4): a private group previews and joins by it. */
	InvitePreview: { groupId: string; inviteCode?: string };
	/**
	 * QJ3 — which cüz you are joining a hatim with. Pushed from the preview's CTA.
	 * `isRoundPick` reuses the same map for a member choosing again at a new round (QR1's
	 * "Farklı cüz seç"): it takes cüz for the round rather than joining.
	 */
	PickCuz: { groupId: string; isRoundPick?: boolean; inviteCode?: string };
	/**
	 * Q7 — the hatim of `roundIndex` is complete. `then` is set when a completed round is only
	 * seen after its boundary: the celebration comes first, then the new round's screen.
	 */
	HatimComplete: { groupId: string; roundIndex: number; then?: RoundStartReason };
	/**
	 * QR1 — a new round's opening screen. `pick`: the member holds no cüz and must choose or
	 * skip before the group opens. `carried`: "Cüzler korunur" brought their cüz over — shown
	 * once, for their information.
	 */
	RoundStart: { groupId: string; reason: RoundStartReason };
	/** Q4 — one cüz of a hatim: its state, its span, what is in it. */
	CuzDetail: { groupId: string; cuzNumber: number };
	/**
	 * Q5 — reading a cüz page by page. `page` is 1-based within the cüz and only seeds where it
	 * opens; the screen owns it from there. `shouldOpenTextSize` as on `BabReader`.
	 */
	CuzReader: { groupId: string; cuzNumber: number; page?: number; shouldOpenTextSize?: boolean };
	JoinedWelcome: { groupId: string };
	/**
	 * `sheet` asks the screen to open one of its sheets on arrival. It exists so the bar's
	 * actions can live in the navigator instead of a `setOptions` effect: a header registered
	 * in `options` is drawn on the first frame, but it is outside the screen and cannot reach
	 * its state. Same device as `shouldOpenJoinSheet`, and cleared on dismissal for the same
	 * reason — left set, the flag would reopen the sheet on the next render.
	 */
	/**
	 * `isJustJoined`: a members-choose Hizb group was just joined, so picking the plan opens O2
	 * (how it works) — set only by the join, and only while the account still wants to see it.
	 */
	GroupDetail: { groupId: string; sheet?: GroupDetailSheet; isJustJoined?: boolean };
	/** O1–O5 — how the group works, after joining. `isOverGroup` when pushed over its screen (O2). */
	GroupHowItWorks: { groupId: string; isOverGroup?: boolean };
	/**
	 * `shouldOpenTextSize` asks the reader to open its text-size sheet, for the same reason
	 * `GroupDetail.sheet` exists: the control lives in the navigator's bar, outside the screen
	 * that owns the sheet. Cleared on dismissal, or it would reopen on the next render.
	 */
	/**
	 * `roundIndex` puts the reader in **cover** mode: the bab belongs to a round that has
	 * already closed, and the action bar fills that gap rather than marking today's board.
	 * Absent on every ordinary push, which is the live round.
	 */
	BabReader: { groupId: string; babNumber: number; roundIndex?: number; shouldOpenTextSize?: boolean };
	Rounds: { groupId: string };
	MyProgress: { groupId: string };
	/** The Hatim duası in Hüsrev hattı — the same four pages whichever group opened it. */
	HatimDua: undefined;
	RoundDetail: { groupId: string; roundIndex: number };
	/** Where a GATHERING group lives — the creator's start screen, or the member's wait. */
	Lobby: { groupId: string };
	/** Shown once, right after the owner opens day 1. */
	/**
	 * The share of the seats nobody took. `kind` picks the screen — a Cevşen block at a time or a
	 * Hizb portion at a time — and travels with the route because a group's kind never changes,
	 * so it can't go stale, and the right screen is drawn without waiting on the group's query.
	 * Optional: the hatim screens (and a cold open) arrive without it, and the group's own kind
	 * wins once known — see `PoolScreen`.
	 */
	Pool: { groupId: string; kind?: GroupKind };
	/** HZ2 — a Hizb group's portions, work by work, from the board's "Fihrist ›"; a row opens `HizbReader`. */
	HizbIndex: { groupId: string };
	/**
	 * B7 — the whole cevşen, read outside any group. **No params**: the bab is screen state,
	 * because a free read is a place you are rather than one you are sent to, and nothing —
	 * no notification, no invite, no link — ever needs to open a particular bab here.
	 */
	/**
	 * Free reading, outside any group. `shouldOpenTextSize` as on `BabReader`. `babNumber` is
	 * the one exception to "no params": search lands here on a bab it found, and that is a
	 * place you are sent to. It only seeds the cursor; the screen owns it from there.
	 */
	/*
	 * A live reading is the app's (`lib/live/liveSession`), not the route's: the reader attaches to
	 * it while focused. `shouldOpenLive` opens its sheet from the bar, as `shouldOpenTextSize` does;
	 * `liveNotFoundCode` is the join screen's one-shot "that code found nothing" (E5).
	 */
	AllBabs:
		| { shouldOpenTextSize?: boolean; babNumber?: number; shouldOpenLive?: boolean; liveNotFoundCode?: string }
		| undefined;
	/**
	 * The free Mushaf — the Kur'an read outside any group, as `AllBabs` is the Cevşen. The same
	 * "no params" rule: the cüz and page are screen state, and `cuzNumber` only seeds the cursor.
	 */
	Mushaf:
		| {
				shouldOpenTextSize?: boolean;
				cuzNumber?: number;
				page?: number;
				verseKey?: string;
				shouldOpenLive?: boolean;
		  }
		| undefined;
	/** A live reading's code, from a link or from "Davet kodum var": looked up, then its reader opened. */
	LiveJoin: { code: string };
	/**
	 * The account screen lost its tab to search (K2) and is pushed from the avatar at the right
	 * end of every tab root's bar — inside that tab, so back returns to where it was opened.
	 */
	/**
	 * P4 — the notification settings, reached by the gear on the inbox and by Profil's own row.
	 * It was the bell tab's root screen until the inbox took that place.
	 */
	Reminders: undefined;
	/** P3 — the release notes, pushed from Profil's version row and from P1's sheet. */
	ReleaseNotes: undefined;
	/** The Hizb-ül Hakaik's table of contents, from a row on Profil; a row opens `HizbReader`. */
	HizbSections: undefined;
	/**
	 * The Hizb-ül Hakaik. `sectionIndex` is free reading, one section of `HIZB_SECTIONS` from
	 * the list on Profil. `groupId` + `partNumber` is a Hizb group's portion, read and marked
	 * there (`HizbPortionReader`). `roundIndex` below the group's puts it in cover mode for that
	 * closed round; the open round **omits it**, and the reader treats the open round's own index
	 * exactly as no index, so a caller holding one may pass it. `shouldOpenTextSize` as on
	 * `BabReader`, in either shape.
	 */
	HizbPlanReader: { groupId: string; assignmentId: string; shouldOpenTextSize?: boolean };
	/** A personal-plan group's missed days, newest first — opened from "Senin ilerlemen" (T2). */
	HizbMissed: { groupId: string };
	/** A personal-plan group's history: every reading of the viewer's, newest first — from the rounds card (T3). */
	HizbPlanHistory: { groupId: string };
	/** A personal-plan group's day in full: today's 33, yesterday, the last 30 days (T4). */
	/** A personal-plan group's readers today (T5), or on `day` (a group day number) from "Tüm geçmiş". */
	HizbReaders: { groupId: string; day?: number };
	/** A shared plan's "Tüm geçmiş": the group's days, newest first, each opening its readers. */
	HizbGroupHistory: { groupId: string };
	HizbReader:
		| { sectionIndex: number; shouldOpenTextSize?: boolean }
		| { groupId: string; partNumber: number; roundIndex?: number; shouldOpenTextSize?: boolean };
	Profile: undefined;
	/** Android only: search is pushed from the bar's magnifier rather than being a tab. */
	Search: undefined;
};

/** `inviteCode` arrives from the QR's link (`groups/join/:inviteCode`) and opens the join sheet on that code. */
export type GroupsScreenParams =
	| { shouldOpenJoinSheet?: boolean; inviteCode?: string; shouldOpenLiveJoinSheet?: boolean }
	| undefined;

/** The sheets the group screen's bar can ask for. Not a route — each is `ui/BottomSheet`. */
export type GroupDetailSheet = 'manage' | 'members' | 'share';

/** Every tab owns a stack and accepts a nested target. */
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
	/**
	 * **The bell tab is the inbox, and it used to be the reminder settings.** The glyph has
	 * always been a bell; what sat behind it was a screen of switches, which is what a bell
	 * least resembles. Section P then put a second bell in the top bar for the inbox proper and
	 * the two collided. The tab now holds P2 and the settings moved one level in, behind the
	 * gear in its bar — which is where the design's own map puts them ("P2 dişli → P4").
	 */
	Notifications: NavigatorScreenParams<TabDetailParamList & { Notifications: undefined }> | undefined;
	/**
	 * The search tab (K2): iOS 26's detached search button, opening one live screen. A stack
	 * too, so a result pushes over the search and back returns to it with the query still in.
	 */
	Search: NavigatorScreenParams<TabDetailParamList & { Search: undefined }> | undefined;
	/** Android's fifth tab, where iOS has search — see `TrailingCornerAction`. */
	Profile: NavigatorScreenParams<TabDetailParamList & { Profile: undefined }> | undefined;
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
