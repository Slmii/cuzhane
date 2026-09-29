import { wrapperApi } from '@/api/wrapper.api';
import { GroupBab, PartRepetitions } from '@/lib/types/domain';

export type SetBabReadInput = {
	groupId: string;
	babNumber: number;
	read: boolean;
};

export const getBabs = async (groupId: string) => wrapperApi<GroupBab[]>(`/babs/${groupId}`, { method: 'GET' });

export const setBabRead = async ({ groupId, babNumber, read }: SetBabReadInput) =>
	wrapperApi<GroupBab>(`/babs/${groupId}/${babNumber}/read`, {
		method: 'PATCH',
		body: JSON.stringify({ read })
	});

export type SetRepetitionsInput = {
	groupId: string;
	babNumber: number;
	/** Where the reader is, absolutely — never an increment, so a retried request can't count twice. */
	count: number;
	/**
	 * Which round's count — `group.roundIndex` for the open one. Always sent: the server takes any
	 * round up to the current, and naming it keeps a tap made just before midnight in its round.
	 */
	roundIndex: number;
	/**
	 * `roundIndex` is meant to be the round in progress, and the server answers 409 if it has
	 * closed since — the reader's group still naming yesterday's round for a moment after midnight.
	 * Left off when counting a closed round on purpose, to cover it.
	 */
	isOpenRound?: boolean;
};

/**
 * The caller's count on a part that is repeated before it counts — only such parts (the Hizb's
 * Sekine); anything else is a 400. Always for a named round, like the write.
 */
export const getRepetitions = async (groupId: string, babNumber: number, roundIndex: number) =>
	wrapperApi<PartRepetitions>(`/babs/${groupId}/${babNumber}/repetitions?roundIndex=${roundIndex}`, {
		method: 'GET'
	});

export const setRepetitions = async ({ groupId, babNumber, count, isOpenRound, roundIndex }: SetRepetitionsInput) =>
	wrapperApi<PartRepetitions>(`/babs/${groupId}/${babNumber}/repetitions`, {
		method: 'PUT',
		body: JSON.stringify({ count, isOpenRound, roundIndex })
	});
