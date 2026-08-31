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
 * keys by prefix.
 */
export const groupOwnedQueryKeys = (groupId: string) => [
	groupQueryKeys.groupById(groupId),
	groupQueryKeys.babs(groupId),
	groupQueryKeys.pool(groupId),
	groupQueryKeys.members(groupId),
	groupQueryKeys.rounds(groupId),
	groupQueryKeys.previewByGroup(groupId)
];

export const userSettingsQueryKeys = {
	root: () => ['user-settings'] as const,
	settings: () => [...userSettingsQueryKeys.root(), 'settings'] as const
} as const;

export const profileQueryKeys = {
	root: () => ['profile'] as const,
	stats: () => [...profileQueryKeys.root(), 'stats'] as const
} as const;
