import { wrapperApi } from '@/api/wrapper.api';
import { GroupBab, PartRepetitions } from '@/lib/types/domain';

export type SetBabReadInput = {
	groupId: string;
	babNumber: number;
	read: boolean;
};

export const getBabs = async (groupId: string) => wrapperApi<GroupBab[]>(`/babs/${groupId}`, { method: 'GET' });

export type SetAllBabsReadInput = {
	groupId: string;
	read: boolean;
};

export const setBabRead = async ({ groupId, babNumber, read }: SetBabReadInput) =>
	wrapperApi<GroupBab>(`/babs/${groupId}/${babNumber}/read`, {
		method: 'PATCH',
		body: JSON.stringify({ read })
	});

/** Marks every bab assigned to the caller in one request; returns the whole board. */
export const setAllBabsRead = async ({ groupId, read }: SetAllBabsReadInput) =>
	wrapperApi<GroupBab[]>(`/babs/${groupId}/read-all`, {
		method: 'PATCH',
		body: JSON.stringify({ read })
	});

export type SetRepetitionsInput = {
	groupId: string;
	babNumber: number;
	/** Where the reader is, absolutely — never an increment, so a retried request can't count twice. */
	count: number;
	/** A closed round's count, for covering it. Omitted means the round in progress. */
	roundIndex?: number;
};

/**
 * The caller's count on a part that is repeated before it counts — only such parts (the Hizb's
 * Sekine); anything else is a 400. `roundIndex` reads a closed round's count.
 */
export const getRepetitions = async (groupId: string, babNumber: number, roundIndex?: number) =>
	wrapperApi<PartRepetitions>(
		`/babs/${groupId}/${babNumber}/repetitions${roundIndex === undefined ? '' : `?roundIndex=${roundIndex}`}`,
		{ method: 'GET' }
	);

export const setRepetitions = async ({ groupId, babNumber, count, roundIndex }: SetRepetitionsInput) =>
	wrapperApi<PartRepetitions>(`/babs/${groupId}/${babNumber}/repetitions`, {
		method: 'PUT',
		body: JSON.stringify(roundIndex === undefined ? { count } : { count, roundIndex })
	});
