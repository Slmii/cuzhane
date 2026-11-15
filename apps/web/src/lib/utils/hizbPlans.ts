/** Persisted assignments follow these divisions; a change to them migrates the data (see `hizb_32_portions`). Mirrored server/web. */
export const PLAN_VERSION = 1;
export const PLAN_DAYS = [7, 15, 32] as const;
export type PlanDays = (typeof PLAN_DAYS)[number];
export type PlanAnchor = readonly [number, number, number, number];
export const PLAN_STARTS: Record<PlanDays, readonly PlanAnchor[]> = {
	'7': [
		[0, 0, 0, 0],
		[7, 18, 0, 0],
		[7, 78, 0, 0],
		[9, 0, 0, 0],
		[11, 0, 0, 0],
		[14, 48, 1, 0],
		[16, 0, 0, 0]
	],
	'15': [
		[0, 0, 0, 0],
		[4, 0, 0, 0],
		[7, 18, 0, 0],
		[7, 38, 0, 0],
		[7, 58, 0, 0],
		[7, 78, 0, 0],
		[8, 0, 8, 2],
		[8, 0, 23, 4],
		[10, 0, 0, 0],
		[11, 0, 0, 0],
		[14, 0, 0, 0],
		[14, 30, 0, 0],
		[15, 0, 0, 0],
		[16, 0, 0, 0],
		[16, 28, 3, 0]
	],
	'32': [
		[0, 0, 0, 0],
		[2, 0, 0, 0],
		[4, 0, 0, 0],
		[7, 0, 0, 0],
		[7, 18, 0, 0],
		[7, 38, 0, 0],
		[7, 58, 0, 0],
		[7, 78, 0, 0],
		[8, 0, 0, 0],
		[8, 0, 8, 2],
		[8, 0, 12, 9],
		[8, 0, 19, 0],
		[8, 0, 23, 4],
		[9, 0, 0, 0],
		[9, 4, 0, 0],
		[9, 7, 0, 0],
		[9, 14, 0, 0],
		[9, 18, 0, 0],
		[10, 0, 0, 0],
		[11, 0, 0, 0],
		[14, 0, 0, 0],
		[14, 15, 0, 0],
		[14, 30, 0, 0],
		[14, 48, 1, 0],
		[15, 0, 0, 0],
		[16, 0, 0, 0],
		[16, 6, 0, 0],
		[16, 16, 0, 0],
		[16, 27, 0, 0],
		[16, 28, 3, 0],
		[16, 28, 9, 0],
		[16, 28, 15, 0]
	]
};
const compare = (a: PlanAnchor, b: PlanAnchor) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3];
export const PLAN_SPANS = [
	...new Map(
		Object.values(PLAN_STARTS)
			.flat()
			.map(a => [a.join(','), a])
	).values()
].sort(compare);
export const isPlanDays = (days: number): days is PlanDays => PLAN_DAYS.some(value => value === days);
export const startsFor = (days: number) => {
	if (!isPlanDays(days)) {
		throw new RangeError('Unknown Hizb plan');
	}
	return PLAN_STARTS[days];
};
export const spansFor = (days: number, portion: number): number[] => {
	const starts = startsFor(days);
	if (!Number.isInteger(portion) || portion < 1 || portion > days) {
		throw new RangeError('Unknown Hizb portion');
	}
	const start = starts[portion - 1]!;
	const end = starts[portion];
	return PLAN_SPANS.flatMap((anchor, i) =>
		compare(anchor, start) >= 0 && (!end || compare(anchor, end) < 0) ? [i] : []
	);
};
export const hasSekine = (days: number, portion: number) => spansFor(days, portion).some(i => PLAN_SPANS[i]![0] === 10);
export const portionForDay = (days: number, sequence: number, dayIndex: number) => {
	startsFor(days);
	return ((((sequence + dayIndex) % days) + days) % days) + 1;
};
export const coverageFor = (reads: { planDays: number; portion: number }[]) => {
	const covered = new Set(reads.flatMap(read => spansFor(read.planDays, read.portion))).size;
	return { covered, total: PLAN_SPANS.length, complete: covered === PLAN_SPANS.length };
};

export const hasIstighfar = (days: number, portion: number) =>
	spansFor(days, portion).some(i => PLAN_SPANS[i]![0] === 0);

/** The salawat in Delail section 9, block 1, line 0 ends at the printed ٣ marker. */
export const hasDelailRepetition = (days: number, portion: number) => {
	spansFor(days, portion); // Validate the plan and portion, as other repetition rules do.
	const starts = startsFor(days);
	const point: PlanAnchor = [9, 1, 0, 0];
	const end = starts[portion];
	return compare(point, starts[portion - 1]!) >= 0 && (!end || compare(point, end) < 0);
};
