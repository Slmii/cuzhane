import { describe, expect, it } from 'vitest';
import { legPosition, nextLegStart, stepsFor, TOUR_STEPS } from './tourSteps';

describe('the tour’s run', () => {
	it('walks every part for "Hepsi": the start, the three kinds and the close', () => {
		const run = stepsFor('all');

		expect(run).toHaveLength(11);
		expect(run.map(step => step.leg)).toEqual([
			'start',
			'start',
			'start',
			'cevsen',
			'cevsen',
			'cevsen',
			'quran',
			'quran',
			'hizb',
			'hizb',
			'end'
		]);
		expect(run[0]?.kind).toBe('intro');
		expect(run.at(-1)?.kind).toBe('closing');
	});

	it('runs only that part for one kind — no start, no close', () => {
		expect(stepsFor('quran').map(step => step.leg)).toEqual(['quran', 'quran']);
		expect(stepsFor('hizb').every(step => step.kind === 'spot')).toBe(true);
	});

	it('numbers a stop within its own part', () => {
		const run = stepsFor('all');

		expect(legPosition(run, 1)).toEqual({ leg: 'start', n: 2, of: 3 });
		expect(legPosition(run, 5)).toEqual({ leg: 'cevsen', n: 3, of: 3 });
		expect(legPosition(run, 10)).toEqual({ leg: 'end', n: 1, of: 1 });
	});

	it('skips to the next part’s first stop, and past the last part to the end of the run', () => {
		const all = stepsFor('all');

		expect(nextLegStart(all, 3)).toBe(6);
		expect(nextLegStart(all, 8)).toBe(10);
		expect(nextLegStart(stepsFor('cevsen'), 0)).toBe(3);
	});

	it('points every stop but the two bookend cards at something on its screen', () => {
		expect(TOUR_STEPS.filter(step => step.kind === 'spot').every(step => step.target !== undefined)).toBe(true);
		expect(TOUR_STEPS.filter(step => step.kind !== 'spot').every(step => step.target === undefined)).toBe(true);
	});
});
