import type { HizbReadingState } from '@/api/hizbReading.api';
import { spansFor } from './hizbPlans';

export type PlanCellState = 'read' | 'partial' | 'pending' | 'empty';
/** All plans map onto the same 33 book portions; completion comes from the server's union. */
export const hizbPlanBoard = (
	members: HizbReadingState['members'],
	coveredSpans: number[],
	today: { planDays: number; portion: number } | null
) => {
	const covered = new Set(coveredSpans);
	const mine = new Set(today ? spansFor(today.planDays, today.portion) : []);
	const readers = members.map(member => ({ member, spans: new Set(spansFor(member.planDays, member.portion)) }));
	return Array.from({ length: 33 }, (_, index) => {
		const number = index + 1;
		const spans = spansFor(33, number);
		const count = spans.filter(span => covered.has(span)).length;
		const assigned = readers
			.filter(reader => spans.some(span => reader.spans.has(span)))
			.map(reader => reader.member);
		const state: PlanCellState =
			count === spans.length ? 'read' : count > 0 ? 'partial' : assigned.length ? 'pending' : 'empty';
		return { number, state, isMine: spans.some(span => mine.has(span)), readers: assigned };
	});
};
