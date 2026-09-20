import { wrapperApi } from '@/api/wrapper.api';
import type { MyProgress, RoundDetail, RoundSummary } from '@/lib/types/domain';

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

/**
 * This member's own record over the last few rounds — the card on the group screen and the
 * F7 screen it opens.
 *
 * No parameters: the server sizes the window from the group's cycle, so a client cannot ask
 * for a span that disagrees with the heading it is about to draw.
 */
export const getMyProgress = async (groupId: string) =>
	wrapperApi<MyProgress>(`/groups/${groupId}/my-progress`, { method: 'GET' });
