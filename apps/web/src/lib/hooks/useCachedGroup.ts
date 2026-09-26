import type { GroupDetail, GroupInvitePreview, GroupKind, GroupStatus, GroupSummary } from '@/lib/types/domain';
import { useQueryClient } from '@tanstack/react-query';
import { groupQueryKeys } from './queryKeys';

/** What a skeleton needs to know about a group to draw the right shape. */
export type CachedGroupShape = { kind: GroupKind; status: GroupStatus };

/**
 * A group's kind and status before its own query has answered — for choosing which skeleton
 * to draw.
 *
 * A screen reached from a list already knows what it is opening: Gruplarım, Ana sayfa and
 * Keşfet all carry `kind` and `status` on every row, and an invite preview carries both too.
 * Asking the cache lets a Kur'an group load under the Kur'an group's bones rather than the
 * Cevşen's, and a group still gathering under the waiting screen's rather than the running one's.
 *
 * **Read once per render, not subscribed.** It only chooses a placeholder, and the real query
 * replaces that placeholder the moment it answers. `undefined` when nothing cached has heard of
 * the group — a cold deep link or a push — and the caller falls back to the screen's own default.
 */
export const useCachedGroup = (groupId: string): CachedGroupShape | undefined => {
	const queryClient = useQueryClient();

	const found =
		queryClient.getQueryData<GroupDetail>(groupQueryKeys.groupById(groupId)) ??
		queryClient.getQueryData<GroupInvitePreview>(groupQueryKeys.previewByGroup(groupId)) ??
		[
			queryClient.getQueryData<GroupSummary[]>(groupQueryKeys.groups()),
			// Every search and cadence Keşfet has asked for is its own entry — see `groupQueryKeys.discover`.
			...queryClient
				.getQueriesData<GroupSummary[]>({ queryKey: [...groupQueryKeys.root(), 'discover'] })
				.map(([, rows]) => rows)
		]
			.flatMap(rows => rows ?? [])
			.find(row => row.id === groupId);

	return found ? { kind: found.kind, status: found.status } : undefined;
};
