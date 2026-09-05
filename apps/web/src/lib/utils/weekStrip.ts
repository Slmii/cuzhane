/** One square of H1's week strip. */
export type WeekDay = {
	/** `YYYY-MM-DD` in the reader's own calendar — the key `ProfileStats.last30Days` uses. */
	key: string;
	/** 0 = Monday. The label is formatted by the caller, which has the language. */
	weekdayIndex: number;
	date: Date;
	hasRead: boolean;
	isToday: boolean;
	/** Later this week: drawn faint, and never "missed". */
	isFuture: boolean;
};

const DAYS_IN_WEEK = 7;

/**
 * The date as the reader's calendar writes it, not as UTC does. `toISOString` would roll the
 * key back a day for anyone west of Greenwich in the evening — the same trap the server's
 * bucketing documents, on the other side of the wire.
 */
const localKey = (date: Date): string => {
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');

	return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * H1's seven squares: **this calendar week, Monday first**, not the last seven days. A strip
 * that ended today would put today on the right every day and never show the week taking
 * shape, which is the thing the design draws — the days still ahead sit there faint.
 *
 * Monday-first for every language: the design's own strip is Pzt–Paz, and TR and NL both start
 * there. Reading counts come from `ProfileStats.last30Days`, which is bucketed in the viewer's
 * zone server-side, so a day is "read" if its key is in there with a count.
 */
export const weekStrip = (days: readonly { date: string; count: number }[], today: Date): WeekDay[] => {
	const counts = new Map(days.map(entry => [entry.date, entry.count]));
	const todayKey = localKey(today);
	// `getDay` is Sunday-first; this shifts it so Monday is 0.
	const mondayOffset = (today.getDay() + 6) % DAYS_IN_WEEK;

	return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
		const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset + index);
		const key = localKey(date);

		return {
			date,
			hasRead: (counts.get(key) ?? 0) > 0,
			isFuture: key > todayKey,
			isToday: key === todayKey,
			key,
			weekdayIndex: index
		};
	});
};
