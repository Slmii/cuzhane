import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLiveHintSeen, hasSeenLiveHint } from './liveHintSeen';

const store = new Map<string, string>();
let isFailing = false;

vi.mock('expo-secure-store', () => ({
	deleteItemAsync: async (key: string) => {
		if (isFailing) {
			throw new Error('keychain unavailable');
		}

		store.delete(key);
	},
	getItemAsync: async (key: string) => {
		if (isFailing) {
			throw new Error('keychain unavailable');
		}

		return store.get(key) ?? null;
	}
}));

describe('liveHintSeen', () => {
	beforeEach(() => {
		store.clear();
		isFailing = false;
	});

	it('reads the flag an earlier build left, and is gone once cleared', async () => {
		expect(await hasSeenLiveHint()).toBe(false);

		store.set('liveHintSeen', '1');
		expect(await hasSeenLiveHint()).toBe(true);

		await clearLiveHintSeen();
		expect(await hasSeenLiveHint()).toBe(false);
	});

	it('reads as unseen, and clears without throwing, when the store fails', async () => {
		store.set('liveHintSeen', '1');
		isFailing = true;

		await expect(clearLiveHintSeen()).resolves.toBeUndefined();
		expect(await hasSeenLiveHint()).toBe(false);
	});
});
