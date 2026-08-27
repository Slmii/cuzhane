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

export const userSettingsQueryKeys = {
	root: () => ['user-settings'] as const,
	settings: () => [...userSettingsQueryKeys.root(), 'settings'] as const
} as const;

export const profileQueryKeys = {
	root: () => ['profile'] as const,
	stats: () => [...profileQueryKeys.root(), 'stats'] as const
} as const;
