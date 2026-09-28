import type { HizbBoardCell } from '@/lib/utils/groups';
import { spansFor } from '@/lib/utils/hizbPlans';

/** The board is always the 33 portions, whatever plans the members read on. */
const BOARD_PORTIONS = 33;

/**
 * A personal-plan group's day as the Hizb board's 33 cells.
 *
 * Coverage arrives as canonical text spans, because a 7- or 15-day reading covers several of
 * the 33 at once. A portion is read once every span of it is covered — by anyone, on any plan —
 * and it is yours when today's reading touches it, which puts the ring on each cell a longer
 * portion spans.
 */
export const planBoardCells = (
	coveredSpans: readonly number[],
	today: { planDays: number; portion: number } | null
): HizbBoardCell[] => {
	const covered = new Set(coveredSpans);
	const mine = new Set(today ? spansFor(today.planDays, today.portion) : []);

	return Array.from({ length: BOARD_PORTIONS }, (_, index) => {
		const spans = spansFor(BOARD_PORTIONS, index + 1);

		return {
			isMine: spans.some(span => mine.has(span)),
			number: index + 1,
			state: spans.every(span => covered.has(span)) ? 'read' : 'unread'
		};
	});
};

/** How many of the 33 a day left unread — "Geçen tur"'s number. */
export const unreadPortionCount = (coveredSpans: readonly number[]): number =>
	planBoardCells(coveredSpans, null).filter(cell => cell.state !== 'read').length;

/** Which of the 33 a plan's portion covers — one for a 33-day plan, several for a 7- or 15-day one. */
export const boardPortionsOf = (planDays: number, portion: number): number[] =>
	planBoardCells([], { planDays, portion })
		.filter(cell => cell.isMine)
		.map(cell => cell.number);
