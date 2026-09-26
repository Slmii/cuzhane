import type { StringKey } from '@/lib/i18n/strings';
import type { GroupCycle, GroupSplitMode, GroupStatus } from '@/lib/types/domain';

export type GroupSortKey = 'newest' | 'seats' | 'soon';

/**
 * The design's filter sheet: "all" first, then the cadences — every one a group can have, the
 * Hizb's month included, since both screens browse both kinds.
 */
export const CYCLE_FILTER_OPTIONS: (GroupCycle | undefined)[] = [undefined, 'DAILY', 'WEEKLY', 'MONTHLY'];

/** Order matches the sort sheet: newest, most seats free, starting soon. */
export const GROUP_SORT_OPTIONS: { key: GroupSortKey; labelKey: StringKey }[] = [
	{ key: 'newest', labelKey: 'sortNewest' },
	{ key: 'seats', labelKey: 'sortMostSeats' },
	{ key: 'soon', labelKey: 'sortStartingSoon' }
];

export const DEFAULT_GROUP_SORT: GroupSortKey = 'newest';

export type GroupBrowseState = {
	cycle: GroupCycle | undefined;
	isNotStartedOnly: boolean;
	hasSeatsOnly: boolean;
	sortKey: GroupSortKey;
};

export const emptyGroupBrowseState: GroupBrowseState = {
	cycle: undefined,
	hasSeatsOnly: false,
	isNotStartedOnly: false,
	sortKey: DEFAULT_GROUP_SORT
};

/** Anything narrowing the list — what decides whether "clear" is worth offering. */
export const isGroupBrowseNarrowed = (state: GroupBrowseState) =>
	state.cycle !== undefined || state.isNotStartedOnly || state.hasSeatsOnly;

export const isGroupSortActive = (state: GroupBrowseState) => state.sortKey !== DEFAULT_GROUP_SORT;

/**
 * Whether the browse menu's "Temizle" has anything to undo: everything that menu sets — the
 * cadence, the two status filters **and the order**.
 *
 * Distinct from `isGroupBrowseNarrowed`: that one asks whether the *list* is narrowed, which is
 * what the empty states need, and reordering narrows nothing. (The per-screen search box that
 * once complicated this is gone — searching is the Ara tab's job now.)
 */
export const isGroupBrowseMenuActive = (state: GroupBrowseState) =>
	state.cycle !== undefined || state.isNotStartedOnly || state.hasSeatsOnly || isGroupSortActive(state);

/** The minimum a group must carry to be browsed. Both screens' rows satisfy it. */
type BrowsableGroup = {
	splitMode?: GroupSplitMode;
	name: string;
	cycle: GroupCycle;
	status: GroupStatus;
	spotsLeft: number;
	createdAt: string;
};

/**
 * One list, narrowed and ordered. Shared by Keşfet and Gruplarım so the two controls mean
 * exactly the same thing wherever they appear — a "Boş kontenjan" that filtered differently
 * between two screens would be the same word doing two jobs.
 *
 * Everything here answers off fields the rows already carry, so it costs no round trip.
 * Keşfet additionally narrows by cadence on the server; passing it again is a no-op there and
 * does the real work on Gruplarım, which fetches the whole shelf at once.
 */
export const applyGroupBrowse = <T extends BrowsableGroup>(groups: T[] | undefined, state: GroupBrowseState): T[] => {
	const filtered = (groups ?? []).filter(group => {
		if (state.cycle !== undefined && group.cycle !== state.cycle) {
			return false;
		}

		if (state.isNotStartedOnly && group.status !== 'GATHERING') {
			return false;
		}

		if (state.hasSeatsOnly && group.splitMode !== 'FLEXIBLE' && group.spotsLeft <= 0) {
			return false;
		}

		return true;
	});

	return [...filtered].sort((a, b) => {
		if (state.sortKey === 'seats') {
			if ((a.splitMode === 'FLEXIBLE') !== (b.splitMode === 'FLEXIBLE')) {
				return a.splitMode === 'FLEXIBLE' ? -1 : 1;
			}
			return b.spotsLeft - a.spotsLeft;
		}

		if (state.sortKey === 'soon') {
			// "Yakında başlıyor" — a gathering group starts when it fills, so the one with
			// fewest seats left is nearest to opening. Groups already running have no start
			// to wait for and sit below them.
			const aWaiting = a.status === 'GATHERING';
			const bWaiting = b.status === 'GATHERING';

			if (aWaiting !== bWaiting) {
				return aWaiting ? -1 : 1;
			}

			return a.spotsLeft - b.spotsLeft;
		}

		return Date.parse(b.createdAt) - Date.parse(a.createdAt);
	});
};
