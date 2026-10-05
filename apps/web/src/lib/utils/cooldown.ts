/**
 * Whole seconds left until `deadline` (epoch ms), rounded up, or 0 with none set.
 *
 * Measured against the wall clock rather than counted down by a timer: JavaScript timers stop
 * while the app is in the background, so a reader who goes to their mail app for the code would
 * otherwise come back to most of the wait still to go.
 */
export const secondsUntil = (deadline: number | null, now: number): number =>
	deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
