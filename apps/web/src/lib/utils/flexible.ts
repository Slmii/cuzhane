import type { PoolSlotPart } from '@/lib/types/domain';

export const flexiblePortionState = (part: Pick<PoolSlotPart, 'isRead' | 'takenByMe' | 'takenByUserId'>) => {
	if (part.isRead) {
		return 'read';
	}
	if (part.takenByMe) {
		return 'mine';
	}
	return part.takenByUserId === null ? 'available' : 'claimed';
};
