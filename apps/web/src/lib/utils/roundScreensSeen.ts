import * as SecureStore from 'expo-secure-store';

/**
 * Which once-a-round screens this member has already been shown, kept on the device.
 *
 * Two screens open a hatim group at most once per round: Q7, the celebration when the hatim is
 * completed, and QR1's "your cüz carried over" note under "Cüzler korunur". Without a memory of
 * having shown them, every visit for the rest of the round would open on the same screen.
 *
 * **On the device, like the reader bookmark**, by the product's own choice: a second phone or a
 * reinstall shows each screen once more, which is a small cost for no server state. **The
 * required pick never reads this** — whether a member must choose cüz is worked out from what
 * they hold, so clearing it can let nobody past the round-start screen.
 *
 * Best effort both ways: a failed read shows the screen again, a failed write shows it next time.
 */
export type RoundScreen = 'hatimComplete' | 'cuzCarried';

const STORAGE_KEY_PREFIX = 'roundScreenSeen.';

const storageKey = (screen: RoundScreen, userId: string, groupId: string, roundIndex: number) =>
	`${STORAGE_KEY_PREFIX}${screen}.${userId}.${groupId}.${roundIndex}`;

export const hasSeenRoundScreen = async (
	screen: RoundScreen,
	userId: string,
	groupId: string,
	roundIndex: number
): Promise<boolean> => {
	try {
		return (await SecureStore.getItemAsync(storageKey(screen, userId, groupId, roundIndex))) !== null;
	} catch {
		return false;
	}
};

export const markRoundScreenSeen = async (
	screen: RoundScreen,
	userId: string,
	groupId: string,
	roundIndex: number
): Promise<void> => {
	try {
		await SecureStore.setItemAsync(storageKey(screen, userId, groupId, roundIndex), '1');
	} catch {
		// See above: the screen shows once more next time.
	}
};
