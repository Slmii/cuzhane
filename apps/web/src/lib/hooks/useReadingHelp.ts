import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	actOnReadingHelp,
	getReadingHelp,
	requestReadingHelp,
	type HelpAction,
	type HelpTarget
} from '@/api/readingHelp.api';
import { groupQueryKeys, profileQueryKeys } from './queryKeys';
import { useLiveRefetchInterval } from './useLiveRefetchInterval';
import { useIsTourDemo } from '@/components/Tour/Tour.context';
export const readingHelpKey = (groupId: string) => ['groups', 'reading-help', groupId] as const;
export const useReadingHelp = (groupId: string) => {
	const refetchInterval = useLiveRefetchInterval();
	const isDemo = useIsTourDemo();
	return useQuery({
		queryKey: readingHelpKey(groupId),
		queryFn: () => getReadingHelp(groupId),
		refetchInterval,
		enabled: !!groupId && !isDemo
	});
};
export const useRequestReadingHelp = (groupId: string) => {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (target: HelpTarget) => requestReadingHelp(groupId, target),
		onSettled: () => client.invalidateQueries({ queryKey: groupQueryKeys.root() })
	});
};
export const useActOnReadingHelp = (groupId: string) => {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: { id: string; action: HelpAction; version: number }) =>
			actOnReadingHelp(groupId, input.id, input.action, input.version),
		onSettled: async () => {
			await Promise.all([
				client.invalidateQueries({ queryKey: groupQueryKeys.root() }),
				client.invalidateQueries({ queryKey: profileQueryKeys.root() })
			]);
		}
	});
};
