import { describe, expect, it } from 'vitest';
import { secondsUntil } from './cooldown';

describe('secondsUntil', () => {
	it('is zero with no deadline set', () => {
		expect(secondsUntil(null, 1_000)).toBe(0);
	});

	it('rounds up, so the last second still shows as one', () => {
		expect(secondsUntil(61_000, 1_000)).toBe(60);
		expect(secondsUntil(61_000, 60_500)).toBe(1);
	});

	it('counts wall-clock time, so time spent in another app is already over', () => {
		// The code was sent, then the reader spent 90 seconds in their mail app.
		expect(secondsUntil(61_000, 91_000)).toBe(0);
	});
});
