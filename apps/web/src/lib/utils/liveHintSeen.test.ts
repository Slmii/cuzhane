import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasSeenLiveHint, markLiveHintSeen } from './liveHintSeen';

const store = new Map<string, string>();
let isFailing = false;

vi.mock('expo-secure-store', () => ({
	getItemAsync: async (key: string) => {
		if (isFailing) {
			throw new Error('keychain unavailable');
		}

		return store.get(key) ?? null;
	},
	setItemAsync: async (key: string, value: string) => {
		if (isFailing) {
			throw new Error('keychain unavailable');
		}

		store.set(key, value);
	}
}));

describe('liveHintSeen', () => {
	beforeEach(() => {
		store.clear();
		isFailing = false;
	});

	it('is unseen on a new phone, and seen once marked', async () => {
		expect(await hasSeenLiveHint()).toBe(false);

		await markLiveHintSeen();

		expect(await hasSeenLiveHint()).toBe(true);
	});

	it('reads as unseen, and marks without throwing, when the store fails', async () => {
		isFailing = true;

		await expect(markLiveHintSeen()).resolves.toBeUndefined();
		expect(await hasSeenLiveHint()).toBe(false);
	});
});
