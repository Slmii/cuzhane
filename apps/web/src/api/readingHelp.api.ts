import { wrapperApi } from './wrapper.api';
export type HelpTarget = { assignmentId: string } | { roundIndex: number };
export type HelpAction = 'claim' | 'release' | 'cancel' | 'complete';
export type ReadingHelp = {
	id: string;
	version: number;
	assignmentId: string | null;
	roundIndex: number | null;
	babNumbers: number[];
	remainingNumbers: number[];
	kind: 'CEVSEN' | 'HIZB';
	planDays: number | null;
	portion: number | null;
	date: string | null;
	mine: boolean;
	takenByMe: boolean;
	claimed: boolean;
	completed: boolean;
	requesterName: string | null;
};
export const getReadingHelp = (groupId: string) =>
	wrapperApi<ReadingHelp[]>(`/groups/${groupId}/reading-help`, { method: 'GET' });
export const requestReadingHelp = (groupId: string, target: HelpTarget) =>
	wrapperApi<ReadingHelp>(`/groups/${groupId}/reading-help`, { method: 'POST', body: JSON.stringify(target) });
export const actOnReadingHelp = (groupId: string, id: string, action: HelpAction, version: number) =>
	wrapperApi<{ success: true }>(`/groups/${groupId}/reading-help/${id}`, {
		method: 'PATCH',
		body: JSON.stringify({ action, version })
	});
