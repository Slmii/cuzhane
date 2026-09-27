import { getGatedInitialURL, subscribeGated } from '@/navigation/linkGate';
import { RootStackParamList, RootTabParamList, TabDetailParamList } from '@/navigation/types';
import type { LinkingOptions, PathConfigMap } from '@react-navigation/native';
import { Platform } from 'react-native';

/**
 * Every tab that owns a stack registers the same detail screens, so they share one path
 * map. A link resolves into whichever tab is named in the URL.
 */
const detailPaths: PathConfigMap<TabDetailParamList> = {
	Profile: 'profile',
	// Pushed search exists only on Android; on iOS the same URL would resolve two ways (a
	// missing nested route on a cold start, the tab on a warm one), so the path isn't declared there.
	...(Platform.OS === 'android' ? { Search: 'search' } : {}),
	JoinedWelcome: 'welcome/:groupId',
	GroupDetail: 'groups/:groupId',
	// Q4. Parsed for the same reason `babNumber` below is: the screen finds the cüz among
	// the member's holdings by identity, and a string "22" is not among numbers.
	CuzReader: {
		path: 'groups/:groupId/cuz/:cuzNumber/read',
		parse: { cuzNumber: Number, page: Number }
	},
	CuzDetail: {
		path: 'groups/:groupId/cuz/:cuzNumber',
		parse: { cuzNumber: Number }
	},
	BabReader: {
		path: 'groups/:groupId/babs/:babNumber',
		// Same reason as `roundIndex` below, and it bites harder here: the reader looks the
		// bab up in the member's share by identity, so a string `"85"` is not found among
		// numbers and the rail counts it as a bab beyond the share.
		parse: { babNumber: Number, roundIndex: Number }
	},
	// No path. B7 keeps its bab in screen state rather than params — there is nothing to
	// address, and a bare `babs` route would only ever land on bab 1.
	Rounds: 'groups/:groupId/rounds',
	MyProgress: 'groups/:groupId/progress',
	RoundDetail: {
		path: 'groups/:groupId/rounds/:roundIndex',
		// Path segments arrive as strings; the screen and its query key both key off a
		// number, and `round(groupId, '3')` would cache separately from `round(groupId, 3)`.
		parse: { roundIndex: Number }
	}
};

/*
 * **The one invite link is the QR code's** — `inviteLink` in `utils/inviteCode.ts`, which the
 * Gruplarım root's `join/:inviteCode` alias below receives. An alias of the root rather than a
 * screen of its own, so the join sheet keeps being a sheet.
 */

// Android's Profil tab has `Profile` as its root, so its nested paths must not name it again
// (that gave the root the path `profile/profile`).
const { Profile: _profileTabRoot, ...pushedFromProfilePaths } = detailPaths;

/**
 * A tab's nested config: its root at the tab's own path, the pushed screens under it, and the
 * root as `initialRouteName` — without that, a cold-start link into a pushed screen builds a
 * stack holding only that screen, and back leaves the app instead of landing on the tab's root.
 * `rootAliases` are further paths that land on the root, with params (the QR's `join/:inviteCode`).
 *
 * Cast by hand: `PathConfigMap` infers a nested navigator's route names through
 * `NavigatorScreenParams`, and for these intersection param lists the inference comes back
 * empty, which typed `initialRouteName` as `never`. The shape is the library's own; only the
 * name check is bypassed.
 */
const tabLink = <Root extends keyof RootTabParamList>(
	path: string,
	root: Root,
	screens: PathConfigMap<TabDetailParamList>,
	rootAliases: string[] = []
): NonNullable<PathConfigMap<RootTabParamList>[Root]> =>
	({
		path,
		initialRouteName: root,
		screens: { ...screens, [root]: { path: '', alias: rootAliases } }
	} as unknown as NonNullable<PathConfigMap<RootTabParamList>[Root]>);

export const linking: LinkingOptions<RootStackParamList> = {
	// The custom scheme only. `https://cuzhane.app` was here to catch invite links; with
	// those gone it claimed a domain the app has no `associatedDomains` entry for, so it
	// could never have resolved anyway.
	prefixes: ['cuzhane://'],
	// Held back until the tab navigator is mounted — see `linkGate`.
	getInitialURL: getGatedInitialURL,
	subscribe: subscribeGated,
	config: {
		screens: {
			Tabs: {
				screens: {
					Home: tabLink('home', 'Home', detailPaths),
					Groups: tabLink('groups', 'Groups', detailPaths, ['join/:inviteCode']),
					Discover: tabLink('discover', 'Discover', detailPaths),
					Notifications: tabLink('notifications', 'Notifications', detailPaths),
					// The fifth tab differs by platform — see `TrailingCornerAction`.
					...(Platform.OS === 'ios'
						? { Search: tabLink('search', 'Search', detailPaths) }
						: { Profile: tabLink('profile', 'Profile', pushedFromProfilePaths) })
				}
			},
			Onboarding: 'onboarding',
			CreateGroup: 'groups/new'
		}
	}
};
