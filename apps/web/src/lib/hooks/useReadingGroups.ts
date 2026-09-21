import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	completeReadingAssignment,
	createReadingGroup,
	getReadingGroup,
	getReadingGroups,
	joinReadingGroup,
	leaveReadingGroup
} from '@/api/readingGroups.api';
import { useLiveRefetchInterval } from './useLiveRefetchInterval';

export const readingKeys = {
	root: ['reading-groups'] as const,
	detail: (id: string) => ['reading-groups', id] as const
};
export const useReadingGroups = () =>
	useQuery({ queryKey: readingKeys.root, queryFn: getReadingGroups, refetchInterval: useLiveRefetchInterval() });
export const useReadingGroup = (id: string) =>
	useQuery({
		queryKey: readingKeys.detail(id),
		queryFn: () => getReadingGroup(id),
		refetchInterval: useLiveRefetchInterval()
	});
export const useCreateReadingGroup = () => {
	const client = useQueryClient();
	return useMutation({
		mutationFn: createReadingGroup,
		onSuccess: async group => {
			client.setQueryData(readingKeys.detail(group.id), group);
			await client.invalidateQueries({ queryKey: readingKeys.root });
		}
	});
};
export const useJoinReadingGroup = () => {
	const client = useQueryClient();
	return useMutation({
		mutationFn: joinReadingGroup,
		onSuccess: async group => {
			client.setQueryData(readingKeys.detail(group.id), group);
			await client.invalidateQueries({ queryKey: readingKeys.root });
		}
	});
};
export const useLeaveReadingGroup = () => {
	const client = useQueryClient();
	return useMutation({
		mutationFn: leaveReadingGroup,
		onSuccess: async () => {
			await client.invalidateQueries({ queryKey: readingKeys.root });
		}
	});
};
export const useCompleteReadingAssignment = () => {
	const client = useQueryClient();
	return useMutation({
		mutationFn: ({ groupId, assignmentId }: { groupId: string; assignmentId: string }) =>
			completeReadingAssignment(groupId, assignmentId),
		onSuccess: async group => {
			client.setQueryData(readingKeys.detail(group.id), group);
			await client.invalidateQueries({ queryKey: readingKeys.root });
		}
	});
};
