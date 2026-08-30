import { RootStackParamList, TabDetailParamList } from '@/navigation/types';
import type { LinkingOptions, PathConfigMap } from '@react-navigation/native';

/**
 * Every tab that owns a stack registers the same detail screens, so they share one path
 * map. A link resolves into whichever tab is named in the URL.
 */
const detailPaths: PathConfigMap<TabDetailParamList> = {
	JoinedWelcome: 'welcome/:groupId',
	GroupDetail: 'groups/:groupId',
	BabReader: {
		path: 'groups/:groupId/babs/:babNumber',
		// Same reason as `roundIndex` below, and it bites harder here: the reader looks the
		// bab up in the member's share by identity, so a string `"85"` is not found among
		// numbers and the rail counts it as a bab beyond the share.
		parse: { babNumber: Number }
	},
	// No path. B7 keeps its bab in screen state rather than params — there is nothing to
	// address, and a bare `babs` route would only ever land on bab 1.
	Rounds: 'groups/:groupId/rounds',
	RoundDetail: {
		path: 'groups/:groupId/rounds/:roundIndex',
		// Path segments arrive as strings; the screen and its query key both key off a
		// number, and `round(groupId, '3')` would cache separately from `round(groupId, 3)`.
		parse: { roundIndex: Number }
	}
};

/**
 * There is deliberately **no invite path here.** An invitation is a code and nothing else
 * — it's typed into the join sheet, not followed — so `join/:code` was removed along with
 * the shareable URL rather than left as a second, unadvertised way in. Adding one back
 * would reintroduce the link the design just got rid of.
 *
 * What remains is in-app navigation the OS can hand back to us. The scheme matches
 * `expo.scheme` in app.json.
 */
export const linking: LinkingOptions<RootStackParamList> = {
	// The custom scheme only. `https://cuzhane.app` was here to catch invite links; with
	// those gone it claimed a domain the app has no `associatedDomains` entry for, so it
	// could never have resolved anyway.
	prefixes: ['cuzhane://'],
	config: {
		screens: {
			Tabs: {
				screens: {
					Home: { path: 'home', screens: detailPaths },
					Groups: { path: 'groups', screens: detailPaths },
					Discover: { path: 'discover', screens: detailPaths },
					Reminders: 'reminders',
					Profile: 'profile'
				}
			},
			Onboarding: 'onboarding',
			CreateGroup: 'groups/new'
		}
	}
};
