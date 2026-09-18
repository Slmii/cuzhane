export interface CheckForUpdateOnLaunchProps {
	/**
	 * The check is over and the app may render — no update was waiting, one failed to arrive, or
	 * the deadline passed. **Not called when an update *is* ready**: the app reloads instead, and
	 * handing control back first would show the old bundle for the moment before it went.
	 */
	onComplete: (options?: { timedOut?: boolean }) => void;
	/** Ceiling on the wait, not a typical one. Defaults to `UPDATE_CHECK_TIMEOUT_MS`. */
	timeout?: number;
}
