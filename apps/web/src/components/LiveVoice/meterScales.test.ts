import { describe, expect, it } from 'vitest';
import { METER_REST, meterScales } from './meterScales';

describe('meterScales', () => {
	it('rests every bar low in silence', () => {
		expect(meterScales(0, 0)).toEqual([METER_REST, METER_REST, METER_REST, METER_REST]);
		expect(meterScales(0, 777)).toEqual([METER_REST, METER_REST, METER_REST, METER_REST]);
	});

	it('lifts the bars with the voice, each its own way, never past full height', () => {
		const quiet = meterScales(0.3, 500);
		const loud = meterScales(0.8, 500);

		loud.forEach((scale, index) => {
			expect(scale).toBeGreaterThan(quiet[index] ?? 1);
			expect(scale).toBeLessThanOrEqual(1);
		});
		expect(new Set(loud.map(scale => scale.toFixed(3))).size).toBe(4);
		expect(meterScales(1, 0).every(scale => scale <= 1)).toBe(true);
	});

	it('sways a steady voice on each bar’s own cycle', () => {
		const at = (ms: number) => meterScales(0.6, ms);

		expect(at(0)).not.toEqual(at(300));
		// The first bar's cycle is 1.05 s: it comes back to the same height.
		expect(at(0)[0]).toBeCloseTo(at(1050)[0] ?? 0);
	});
});
