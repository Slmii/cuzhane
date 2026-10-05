import {
	getGroupMembers,
	joinGroup,
	joinGroupByCode,
	leaveGroup,
	previewGroupByCode,
	previewGroupById,
	removeGroupMember,
	type RemoveGroupMemberInput
} from '@/api/memberships.api';
import { useTranslation } from '@/lib/i18n/I18n.context';
import type { GroupSummary } from '@/lib/types/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { groupOwnedQueryKeys, groupQueryKeys } from './queryKeys';
import { useLiveRefetchInterval } from './useLiveRefetchInterval';

/**
 * Looking a code up is something the reader *does*, so it's a mutation rather than a
 * query. As a query it was `enabled` the moment an eighth character existed, which meant
 * typing the last character fired the request on its own — and "Grubu bul", disabled while
 * that automatic fetch was in flight, swallowed the first press. Only the second one, once
 * the stray request had settled, actually did anything.
 *
 * A mutation has no `enabled` to race: nothing runs until the button is pressed, `isPending`
 * describes that press and nothing else, and a 404 arrives as a rejection to catch.
 */
export const useLookupGroupByCode = () => useMutation({ mutationFn: (code: string) => previewGroupByCode(code) });

/**
 * The preview of a group about to be joined. **By the invite code when there is one:** the
 * server answers a private group's preview by id to members only, so a private hatim reached
 * with its code 404'd here and could not be joined at all.
 */
export const useGroupPreviewById = (groupId: string, inviteCode?: string) =>
	useQuery({
		queryKey: groupQueryKeys.previewByGroup(groupId),
		queryFn: () => (inviteCode ? previewGroupByCode(inviteCode) : previewGroupById(groupId)),
		enabled: !!groupId
	});

export const useJoinGroupByCode = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (code: string) => joinGroupByCode(code),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

export const useJoinGroup = () => {
	const queryClient = useQueryClient();

	return useMutation({
		// A bare group id still joins a Cevşen group; a hatim passes the cüz it is taking. With
		// an invite code the join goes by the code, the only way into a private group.
		mutationFn: ({
			cuzNumbers,
			groupId,
			inviteCode
		}: {
			cuzNumbers?: number[];
			groupId: string;
			inviteCode?: string;
		}) => (inviteCode ? joinGroupByCode(inviteCode, cuzNumbers) : joinGroup(groupId, cuzNumbers)),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};

/**
 * **Leaving is optimistic and the screen moves at once.** The caller navigates on the tap
 * rather than on the response, and this hook makes the cache agree with that immediately.
 *
 * It used to wait: navigation hung off `mutate`'s `onSuccess`, which React Query runs
 * *after* the hook's own `onSettled` — and that awaited an invalidation of the whole
 * `groups` root. So the moment leaving succeeded, every mounted query belonging to the group
 * just left refetched, each got its 404, and each retried three times with backoff. That is
 * the five seconds: about seven of them, spent re-asking for something we had deliberately
 * given up. The group screen was still mounted throughout, so it saw those errors and
 * flipped to "bir şeyler ters gitti" — and only then, once the retries finished, did the
 * navigation fire. The screen was reporting the cleanup, not the leaving, and the leaving
 * had worked the whole time.
 *
 * So: purge the group's own keys instead of invalidating them, and invalidate only the list.
 *
 * The shelf itself is the one thing written by hand, with the same cancel/snapshot/rollback
 * shape as `useSetBabRead`. Keşfet is a server-side query that excludes groups you belong to,
 * so the group reappears there on the invalidation below — guessing at that list locally
 * would mean reproducing its filters and sort in two places.
 */
export const useLeaveGroup = () => {
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	return useMutation({
		mutationFn: (groupId: string) => leaveGroup(groupId),
		onMutate: async (groupId: string) => {
			await queryClient.cancelQueries({ queryKey: groupQueryKeys.groups() });

			const previousGroups = queryClient.getQueryData<GroupSummary[]>(groupQueryKeys.groups());

			if (previousGroups) {
				queryClient.setQueryData<GroupSummary[]>(
					groupQueryKeys.groups(),
					previousGroups.filter(group => group.id !== groupId)
				);
			}

			return { previousGroups };
		},
		onSuccess: (_data, groupId) => {
			for (const queryKey of groupOwnedQueryKeys(groupId)) {
				queryClient.removeQueries({ queryKey });
			}
		},
		/*
		 * The rollback puts the card back — and says so.
		 *
		 * **The alert belongs here, not at the call site.** React Query discards `mutate`'s own
		 * callbacks when the component that called it unmounts, and leaving navigates away
		 * immediately, so an `onError` passed by the button would never fire. A hook-level one
		 * always does. Leaving failed silently once before, which is indistinguishable from the
		 * screen having ignored the tap — except that now you are also a screen away from the
		 * group that quietly came back.
		 */
		onError: (_error, _groupId, context) => {
			if (context?.previousGroups) {
				queryClient.setQueryData(groupQueryKeys.groups(), context.previousGroups);
			}
			Alert.alert(t('genericError'));
		},
		// The list only, and not awaited. Awaiting it held the caller's callbacks behind a
		// network round trip for no benefit — the list is already correct optimistically, and
		// this is only confirming it.
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: groupQueryKeys.groups() });
		}
	});
};

/**
 * `isEnabled` lets a caller that is currently invisible stop subscribing.
 *
 * The members sheet is the case: it stays mounted behind a closed `AppBottomSheet`, so
 * without this its query kept refetching in the background and every refetch rebuilt a row —
 * avatar, progress bar, the lot — for a surface nobody could see. Cached data survives, so
 * reopening is still instant after the first look.
 */
export const useGetGroupMembers = (groupId: string, isEnabled = true) => {
	const refetchInterval = useLiveRefetchInterval();
	return useQuery({
		queryKey: groupQueryKeys.members(groupId),
		queryFn: () => getGroupMembers(groupId),
		enabled: !!groupId && isEnabled,
		refetchInterval: isEnabled ? refetchInterval : false
	});
};

export const useRemoveGroupMember = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: RemoveGroupMemberInput) => removeGroupMember(input),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: groupQueryKeys.root() });
		}
	});
};
