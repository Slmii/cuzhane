import { getReadingPlaces, type ReadingPlacePatch } from '@/api/groups.api';
import type { ReadingPlaces } from '@/lib/types/domain';
import { applyPlacePatch, queueReadingPlaceSave } from '@/lib/utils/readingPlaces';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { groupQueryKeys } from './queryKeys';

const readingPlacesQuery = (groupId: string) => ({
	queryKey: groupQueryKeys.readingPlaces(groupId),
	queryFn: () => getReadingPlaces(groupId)
});

/**
 * The viewer's places in a board group's round — see `readingPlaces`. Never asked for a personal
 * plan, which keeps its place on the plan reading.
 */
export const useGetReadingPlaces = (groupId: string, isEnabled = true) =>
	useQuery({ ...readingPlacesQuery(groupId), enabled: !!groupId && isEnabled });

/** The same for several groups at once — Ana sayfa's cüz progress. */
export const useGetReadingPlacesFor = (groupIds: readonly string[]) =>
	useQueries({
		queries: groupIds.map(groupId => ({ ...readingPlacesQuery(groupId), enabled: !!groupId }))
	});

/**
 * Saves a place: into the cache at once, so whatever shows it next has it, and to the server in
 * the background. Fire and forget — a failure leaves the device's own copy to stand in.
 */
export const useSaveReadingPlace = () => {
	const queryClient = useQueryClient();

	return useCallback(
		(groupId: string, roundIndex: number, unitNumber: number, patch: ReadingPlacePatch) => {
			queryClient.setQueryData<ReadingPlaces>(groupQueryKeys.readingPlaces(groupId), cached =>
				applyPlacePatch(cached, roundIndex, unitNumber, patch)
			);
			void queueReadingPlaceSave({ groupId, patch, unitNumber });
		},
		[queryClient]
	);
};
