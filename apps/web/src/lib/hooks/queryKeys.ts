import { GroupCycle } from '@/lib/types/domain';

export const groupQueryKeys = {
	root: () => ['groups'] as const,
	groups: () => [...groupQueryKeys.root(), 'list'] as const,
	groupById: (groupId: string) => [...groupQueryKeys.root(), 'detail', groupId] as const,
	discover: (search?: string, cycle?: GroupCycle) =>
		[...groupQueryKeys.root(), 'discover', search ?? '', cycle ?? ''] as const,
	members: (groupId: string) => [...groupQueryKeys.root(), 'members', groupId] as const,
	babs: (groupId: string) => [...groupQueryKeys.root(), 'babs', groupId] as const,
	pool: (groupId: string) => [...groupQueryKeys.root(), 'pool', groupId] as const,
	rounds: (groupId: string) => [...groupQueryKeys.root(), 'rounds', groupId] as const,
	round: (groupId: string, roundIndex: number) => [...groupQueryKeys.root(), 'rounds', groupId, roundIndex] as const,
	myProgress: (groupId: string) => [...groupQueryKeys.root(), 'my-progress', groupId] as const,
	/** Every repetition count cached for a group — the prefix `partRepetitions` extends. */
	repetitions: (groupId: string) => [...groupQueryKeys.root(), 'repetitions', groupId] as const,
	/**
	 * The viewer's count on one repeated part in one round. **Keyed by the round's number, always**
	 * — never by "the current one": a count is the round's own, so a key meaning "whatever round
	 * is open" would carry last round's nineteen into a round that has none, and would give the
	 * open round a second identity beside its number.
	 */
	partRepetitions: (groupId: string, babNumber: number, roundIndex: number) =>
		[...groupQueryKeys.repetitions(groupId), babNumber, roundIndex] as const,
	// No `previewByCode`: looking a code up is a mutation, not a cached query — nothing
	// should re-run it on its own, and there is nothing to invalidate.
	previewByGroup: (groupId: string) => [...groupQueryKeys.root(), 'preview-group', groupId] as const
} as const;

/**
 * Everything cached *about one group*, as opposed to the list it appears in.
 *
 * Leaving or deleting a group forfeits read access to all of it — the server answers 404 to
 * a non-member, on purpose, so a group's existence stays hidden. These keys are therefore
 * **dropped, never invalidated**: invalidating asks React Query to go and fetch a resource we
 * just gave up, and with the client's default `retry: 3` each one then spends seconds
 * re-asking before it will admit the 404.
 *
 * `rounds` covers `round(groupId, n)` too — it is a prefix of it, and React Query matches
 * keys by prefix — and `repetitions` covers every `partRepetitions` the same way.
 */
export const groupOwnedQueryKeys = (groupId: string) => [
	['groups', 'hizb-reading', groupId] as const,
	groupQueryKeys.groupById(groupId),
	groupQueryKeys.babs(groupId),
	groupQueryKeys.pool(groupId),
	groupQueryKeys.members(groupId),
	groupQueryKeys.rounds(groupId),
	groupQueryKeys.myProgress(groupId),
	groupQueryKeys.repetitions(groupId),
	groupQueryKeys.previewByGroup(groupId)
];

export const userSettingsQueryKeys = {
	root: () => ['user-settings'] as const,
	settings: () => [...userSettingsQueryKeys.root(), 'settings'] as const
} as const;

export const notificationQueryKeys = {
	root: () => ['notifications'] as const,
	list: () => [...notificationQueryKeys.root(), 'list'] as const,
	/** Its own key so Ana sayfa's bell can refetch a number without pulling the whole inbox. */
	unreadCount: () => [...notificationQueryKeys.root(), 'unread-count'] as const
} as const;

export const profileQueryKeys = {
	root: () => ['profile'] as const,
	stats: () => [...profileQueryKeys.root(), 'stats'] as const
} as const;

/**
 * Keys for the first-use tour's stand-in data. **A separate namespace on purpose**: the real
 * queries keep their own entries untouched while the tour runs, so nothing has to be refetched
 * or invalidated when it ends — the hooks simply go back to asking for the other key.
 */
export const tourDemoQueryKeys = {
	root: () => ['tourDemo'] as const,
	groups: () => [...tourDemoQueryKeys.root(), 'list'] as const,
	groupById: (groupId: string) => [...tourDemoQueryKeys.root(), 'detail', groupId] as const,
	babs: (groupId: string) => [...tourDemoQueryKeys.root(), 'babs', groupId] as const,
	rounds: (groupId: string) => [...tourDemoQueryKeys.root(), 'rounds', groupId] as const,
	myProgress: (groupId: string) => [...tourDemoQueryKeys.root(), 'my-progress', groupId] as const,
	stats: () => [...tourDemoQueryKeys.root(), 'stats'] as const,
	notifications: () => [...tourDemoQueryKeys.root(), 'notifications'] as const,
	unreadCount: () => [...tourDemoQueryKeys.root(), 'unreadCount'] as const
};
