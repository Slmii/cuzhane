import * as Haptics from 'expo-haptics';

/**
 * A reader's committing action gets a tap back: Okudum in the Cevşen, "Yerimi işaretle" in the
 * Kuran.
 *
 * `impactAsync`, not `notificationAsync`: the success notification is a three-beat pattern
 * meant for the end of something, and a share can run to forty babs. Undoing is deliberately
 * silent — a correction shouldn't feel like an achievement.
 *
 * Swallowed rather than awaited. Haptics are unavailable on web and on a device with the
 * system setting off, where this rejects; a reading screen must not care.
 */
export const tapBack = () => {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
};

/** A lighter tap for a control that only takes you somewhere, like the sajdah mark. */
export const tapLight = () => {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};
