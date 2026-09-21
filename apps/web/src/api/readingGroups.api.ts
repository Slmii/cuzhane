import { wrapperApi } from './wrapper.api';

export type ReadingCadence = 'WEEKLY' | 'MONTHLY';
export type ReadingAssignment = {
	id: string;
	cycleId: string;
	ordinal: number;
	partIndex: number;
	rotationStep: number;
	assignedAt: string;
	completedAt: string | null;
	status: 'pending' | 'completed';
};
export type PersonalReadingCycle = {
	id: string;
	index: number;
	startedAt: string;
	endsAt: string;
	completedAt: string | null;
	completedParts: number;
	nextAssignmentAt: string | null;
	assignments: ReadingAssignment[];
};
export type ReadingMembership = {
	id: string;
	joinSequence: number;
	rotationOffset: number;
	joinedStep: number;
	joinedAt: string;
	leftAt: string | null;
	active: boolean;
	completedCycles: number;
	cycles: PersonalReadingCycle[];
};
export type ReadingGroupDetail = {
	asOf: string;
	id: string;
	name: string;
	planKey: string;
	numberOfParts: number;
	cadence: ReadingCadence;
	timezone: string;
	startedAt: string;
	inviteCode: string;
	rotationStep: number;
	members: Array<{
		id: string;
		userId: string;
		displayName: string;
		joinSequence: number;
		rotationOffset: number;
		joinedAt: string;
		currentPartIndex: number | null;
	}>;
	myMemberships: ReadingMembership[];
	collective: { completedParts: number; fullReadings: number; remainderParts: number };
};
export type ReadingGroupSummary = Pick<ReadingGroupDetail, 'id' | 'name' | 'cadence' | 'numberOfParts'> & {
	memberships: Array<{ active: boolean }>;
};
const base = '/reading-groups';
export const getReadingGroups = () => wrapperApi<ReadingGroupSummary[]>(base, { method: 'GET' });
export const getReadingGroup = (id: string) =>
	wrapperApi<ReadingGroupDetail>(`${base}/${encodeURIComponent(id)}`, { method: 'GET' });
export const createReadingGroup = (input: { name: string; cadence: ReadingCadence; timezone: string }) =>
	wrapperApi<ReadingGroupDetail>(base, { method: 'POST', body: JSON.stringify(input) });
export const joinReadingGroup = (inviteCode: string) =>
	wrapperApi<ReadingGroupDetail>(`${base}/join`, { method: 'POST', body: JSON.stringify({ inviteCode }) });
export const leaveReadingGroup = (id: string) =>
	wrapperApi<{ success: true }>(`${base}/${encodeURIComponent(id)}/leave`, { method: 'POST' });
export const completeReadingAssignment = (groupId: string, assignmentId: string) =>
	wrapperApi<ReadingGroupDetail>(
		`${base}/${encodeURIComponent(groupId)}/assignments/${encodeURIComponent(assignmentId)}/complete`,
		{ method: 'POST' }
	);
