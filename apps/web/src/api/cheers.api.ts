import { wrapperApi } from '@/api/wrapper.api';

export type ToggleCheerInput = {
	groupId: string;
	toUserId: string;
};

export const toggleCheer = async ({ groupId, toUserId }: ToggleCheerInput) =>
	wrapperApi<{ cheered: boolean }>(`/cheers/${groupId}`, {
		method: 'POST',
		body: JSON.stringify({ toUserId })
	});
