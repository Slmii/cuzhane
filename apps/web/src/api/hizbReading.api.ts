import { wrapperApi } from './wrapper.api';
export type HizbAssignment = {
	id: string;
	/** The overall round this reading belongs to, 1-based, counted across leaves and rejoins. */
	round: number;
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
	/** The board's 33 this day touches — what "Kitaptan okudum" offers to tick. */
	boardPortions: number[];
	/** Of those, the ones marked read from the book on a day not finished yet. */
	readPortions: number[];
	/** How a finished day was read: in the app or from the book. */
	readFrom: 'APP' | 'BOOK' | null;
	completedAt: string | null;
};
export type HizbReadingState = {
	today: HizbAssignment | null;
	enrollment: {
		id: string;
		planDays: number;
		sequence: number;
		endDay: number | null;
		reason: string | null;
		removalDays: number | null;
		/** The day this enrollment began (group-local civil date). */
		joinedDate: string;
	} | null;
	/** The group's first day (group-local civil date). */
	startedDate: string;
	/** Back today after leaving or being removed, with the earlier history kept (S3b). */
	isReturnedToday: boolean;
	/** "Bu grupta hep kitaptan okuyorum": the book button leads on the day's card. */
	readsFromBook: boolean;
	assignments: HizbAssignment[];
	/** The round today's reading is in: its number, days read in it, and days come round (today included). */
	currentRound: { number: number; read: number; days: number } | null;
	/** Every unread day of the viewer's before today, newest first — the catch-up list. */
	missed: HizbAssignment[];
	/** Canonical text spans (`PLAN_SPANS` indexes) today's completed readings cover, group-wide. */
	coveredSpans: number[];
	/** The group's day before today, for "Geçen tur". Null on the group's first day. */
	previousDay: { date: string; covered: number; total: number; complete: boolean; coveredSpans: number[] } | null;
	nextCursor: string | null;
	missedCount: number;
	completedTraversals: number;
	coverage: { covered: number; total: number; complete: boolean };
	date: string;
	nextDayAt: string;
	/** Today first, then up to thirty days before it. */
	dailyHistory: { date: string; covered: number; total: number; complete: boolean }[];
	members: {
		id: string;
		displayName: string | null;
		planDays: number;
		portion: number;
		completed: boolean;
		/** Opened today and part-way, not yet read. */
		started: boolean;
		/** The viewer's own row. */
		isMe: boolean;
	}[];
};
export type HizbAssignmentPatch = {
	delailRepetitions?: number;
	istighfarRepetitions?: number;
	istighfarTarget?: number;
	version: number;
	read?: boolean;
	repetitions?: number;
	bookmark?: number;
	/** Read from the book: this day's board portions read so far; all of them finishes the day. */
	bookPortions?: number[];
};
/** "Tüm geçmiş" of a shared plan: the group's days, today first, thirty to a page. */
export type HizbHistoryDays = {
	days: { day: number; date: string; isToday: boolean; read: number; readers: number }[];
	/** Pass back as `before` for the next page; null when the group's first day is loaded. */
	nextBefore: number | null;
};
/** One day of the group's history: who owed which portion, and whether they read it. */
export type HizbHistoryDay = {
	day: number;
	date: string;
	isToday: boolean;
	members: (HizbReadingState['members'][number] & {
		/** No longer in the group: the name went with them. */
		hasLeft: boolean;
		/** The viewer's own reading of that day, to open; null on everyone else's. */
		assignmentId: string | null;
	})[];
};
export const getHizbHistoryDays = (groupId: string, before?: number) =>
	wrapperApi<HizbHistoryDays>(
		`/groups/${groupId}/reading/history${before === undefined ? '' : `?before=${before}`}`,
		{
			method: 'GET'
		}
	);
export const getHizbHistoryDay = (groupId: string, day: number) =>
	wrapperApi<HizbHistoryDay>(`/groups/${groupId}/reading/history/${day}`, { method: 'GET' });
export const getHizbReading = (groupId: string, cursor?: string) =>
	wrapperApi<HizbReadingState>(`/groups/${groupId}/reading${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
		method: 'GET'
	});
export const enrollHizbReading = (groupId: string, planDays: number) =>
	wrapperApi<HizbReadingState>(`/groups/${groupId}/reading/enroll`, {
		method: 'POST',
		body: JSON.stringify({ planDays })
	});
export const setHizbReadsFromBook = (groupId: string, readsFromBook: boolean) =>
	wrapperApi<{ readsFromBook: boolean }>(`/groups/${groupId}/reading/preferences`, {
		method: 'PATCH',
		body: JSON.stringify({ readsFromBook })
	});
export const getHizbAssignment = (groupId: string, id: string) =>
	wrapperApi<HizbAssignment>(`/groups/${groupId}/reading/assignments/${id}`, { method: 'GET' });
export const updateHizbAssignment = (groupId: string, id: string, patch: HizbAssignmentPatch) =>
	wrapperApi<HizbAssignment>(`/groups/${groupId}/reading/assignments/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(patch)
	});
