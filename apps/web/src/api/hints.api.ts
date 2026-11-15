import { wrapperApi } from '@/api/wrapper.api';
import type { HintsState } from '@/lib/types/domain';

export const getHints = async () => wrapperApi<HintsState>('/hints', { method: 'GET' });

/** Records hints as seen — 1 to 20 ids at a time. */
export const markHintsSeen = async (ids: string[]) =>
	wrapperApi<HintsState>('/hints/seen', {
		method: 'POST',
		body: JSON.stringify({ ids })
	});

/** Brings every hint back except the welcome. */
export const resetHints = async () => wrapperApi<HintsState>('/hints/reset', { method: 'POST' });
