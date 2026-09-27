import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCuzPagesRead, recordCuzPagesRead } from './cuzPagesRead';

// An in-memory store whose reads take a moment, so two writes overlap the way quick taps do.
const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
	getItemAsync: async (key: string) => {
		const value = store.get(key) ?? null;

		await new Promise(resolve => setTimeout(resolve, 5));

		return value;
	},
	setItemAsync: async (key: string, value: string) => {
		store.set(key, value);
	}
}));

describe('cuzPagesRead', () => {
	beforeEach(() => store.clear());

	it('keeps the higher count when two turns overlap', async () => {
		void recordCuzPagesRead('u', 'g', 7, 0, 'text', 5);
		void recordCuzPagesRead('u', 'g', 7, 0, 'text', 4);

		expect(await readCuzPagesRead('u', 'g', 7, 0, 'text')).toBe(5);
	});

	it('reads after a write still in flight', async () => {
		void recordCuzPagesRead('u', 'g', 7, 0, 'text', 3);

		expect(await readCuzPagesRead('u', 'g', 7, 0, 'text')).toBe(3);
	});

	it('starts a new round from nothing', async () => {
		await recordCuzPagesRead('u', 'g', 7, 0, 'text', 12);

		expect(await readCuzPagesRead('u', 'g', 7, 1, 'text')).toBe(0);
	});
});
