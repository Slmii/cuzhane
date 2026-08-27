import { wrapperApi } from '@/api/wrapper.api';
import type { RoundDetail, RoundSummary } from '@/lib/types/domain';

export const getRounds = async (groupId: string) =>
	wrapperApi<RoundSummary[]>(`/groups/${groupId}/rounds`, { method: 'GET' });

export const getRoundDetail = async (groupId: string, roundIndex: number) =>
	wrapperApi<RoundDetail>(`/groups/${groupId}/rounds/${roundIndex}`, { method: 'GET' });

export type CoverBabsInput = {
	groupId: string;
	roundIndex: number;
	/** The whole outstanding block for that row — one act, not one per bab. */
	babNumbers: number[];
};

/**
 * "Üstlen" on someone else's block, "Okudum" on your own — the same write either way. The
 * round it belongs to is closed, so this adds the read the round never had rather than
 * changing anything that is already recorded.
 */
export const coverBabs = async ({ babNumbers, groupId, roundIndex }: CoverBabsInput) =>
	wrapperApi<RoundDetail>(`/groups/${groupId}/rounds/${roundIndex}/cover`, {
		method: 'POST',
		body: JSON.stringify({ babNumbers })
	});
