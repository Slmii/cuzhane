import { wrapperApi } from './wrapper.api';
export type HizbAssignment = {
	canEdit?: boolean;
	completedByOther?: boolean;
	id: string;
	day: number;
	date: string;
	planDays: number;
	planVersion: number;
	portion: number;
	traversal: number;
	repetitions: number;
	delailRepetitions: number;
	requiresDelailRepetition: boolean;
	istighfarRepetitions: number;
	istighfarTarget: number;
	requiresIstighfar: boolean;
	version: number;
	bookmark: number;
	requiresSekine: boolean;
	completedAt: string | null;
};
export type HizbReadingState = {
	today: HizbAssignment | null;
	/** Optional during deployment against older servers. */
	upcoming?: HizbAssignment[];
	enrollment: {
		id: string;
		planDays: number;
		sequence: number;
		endDay: number | null;
		reason: string | null;
		removalDays: number | null;
	} | null;
	assignments: HizbAssignment[];
	nextCursor: string | null;
	missedCount: number;
	completedTraversals: number;
	personalProgress?: { day: number; total: number; completed: number } | null;
	oldestMissedId?: string | null;
	/** Optional while the API update rolls out; never infer coverage from active members alone. */
	coveredSpans?: number[];
	coverage: { covered: number; total: number; complete: boolean };
	date: string;
	nextDayAt: string;
	dailyHistory: { date: string; covered: number; total: number; complete: boolean }[];
	members: { id: string; displayName: string | null; planDays: number; portion: number; completed: boolean }[];
};
export type HizbAssignmentPatch = {
	delailRepetitions?: number;
	istighfarRepetitions?: number;
	istighfarTarget?: number;
	version: number;
	read?: boolean;
	repetitions?: number;
	bookmark?: number;
};
export const getHizbReading = (groupId: string, cursor?: string) =>
	wrapperApi<HizbReadingState>(`/groups/${groupId}/reading${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
		method: 'GET'
	});
export const enrollHizbReading = (groupId: string, planDays: number) =>
	wrapperApi<HizbReadingState>(`/groups/${groupId}/reading/enroll`, {
		method: 'POST',
		body: JSON.stringify({ planDays })
	});
export const getHizbAssignment = (groupId: string, id: string) =>
	wrapperApi<HizbAssignment>(`/groups/${groupId}/reading/assignments/${id}`, { method: 'GET' });
export const updateHizbAssignment = (groupId: string, id: string, patch: HizbAssignmentPatch) =>
	wrapperApi<HizbAssignment>(`/groups/${groupId}/reading/assignments/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(patch)
	});
