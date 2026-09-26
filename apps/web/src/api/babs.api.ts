import { wrapperApi } from '@/api/wrapper.api';
import { GroupBab } from '@/lib/types/domain';

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
