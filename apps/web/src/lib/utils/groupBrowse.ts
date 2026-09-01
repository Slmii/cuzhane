import type { StringKey } from '@/lib/i18n/strings';
import type { GroupCycle, GroupStatus } from '@/lib/types/domain';

export type GroupSortKey = 'newest' | 'seats' | 'soon';

/** The design's filter sheet: "all" first, then the cadences. */
export const CYCLE_FILTER_OPTIONS: (GroupCycle | undefined)[] = [undefined, 'DAILY', 'WEEKLY'];

/** Order matches the sort sheet: newest, most seats free, starting soon. */
export const GROUP_SORT_OPTIONS: { key: GroupSortKey; labelKey: StringKey }[] = [
	{ key: 'newest', labelKey: 'sortNewest' },
	{ key: 'seats', labelKey: 'sortMostSeats' },
	{ key: 'soon', labelKey: 'sortStartingSoon' }
];

export const DEFAULT_GROUP_SORT: GroupSortKey = 'newest';

export type GroupBrowseState = {
	search: string;
	cycle: GroupCycle | undefined;
	isNotStartedOnly: boolean;
	hasSeatsOnly: boolean;
	sortKey: GroupSortKey;
};

export const emptyGroupBrowseState: GroupBrowseState = {
	cycle: undefined,
	hasSeatsOnly: false,
	isNotStartedOnly: false,
	search: '',
	sortKey: DEFAULT_GROUP_SORT
};

/** Anything narrowing the list — what decides whether "clear" is worth offering. */
export const isGroupBrowseNarrowed = (state: GroupBrowseState) =>
	state.cycle !== undefined || state.isNotStartedOnly || state.hasSeatsOnly || state.search.trim() !== '';

export const isGroupSortActive = (state: GroupBrowseState) => state.sortKey !== DEFAULT_GROUP_SORT;

/**
 * Whether the browse menu's "Temizle" has anything to undo: everything that menu sets — the
 * cadence, the two status filters **and the order**.
 *
 * Deliberately not the search box, which the clear leaves alone — the field is on screen showing
 * what it holds, so emptying it from the menu would undo something the reader can see and did not
 * ask about. It used to lean on `isGroupBrowseNarrowed`, which counts the search term, so with
 * only a search typed the row appeared and then did nothing at all.
 *
 * Distinct from `isGroupBrowseNarrowed` in the other direction too: that one asks whether the
 * *list* is narrowed, which is what the empty states need, and reordering narrows nothing.
 */
export const isGroupBrowseMenuActive = (state: GroupBrowseState) =>
	state.cycle !== undefined || state.isNotStartedOnly || state.hasSeatsOnly || isGroupSortActive(state);

/** The minimum a group must carry to be browsed. Both screens' rows satisfy it. */
type BrowsableGroup = {
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
 * Keşfet additionally narrows by cadence and search on the server; passing them again is a
 * no-op there and does the real work on Gruplarım, which fetches the whole shelf at once.
 */
export const applyGroupBrowse = <T extends BrowsableGroup>(groups: T[] | undefined, state: GroupBrowseState): T[] => {
	const query = state.search.trim().toLocaleLowerCase();

	const filtered = (groups ?? []).filter(group => {
		if (state.cycle !== undefined && group.cycle !== state.cycle) {
			return false;
		}

		if (state.isNotStartedOnly && group.status !== 'GATHERING') {
			return false;
		}

		if (state.hasSeatsOnly && group.spotsLeft <= 0) {
			return false;
		}

		return query === '' || group.name.toLocaleLowerCase().includes(query);
	});

	return [...filtered].sort((a, b) => {
		if (state.sortKey === 'seats') {
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
