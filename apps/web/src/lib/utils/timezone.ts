/**
 * The device's IANA time zone, e.g. `Europe/Istanbul`.
 *
 * Sent with two requests: creating a group (it becomes the group's day, shared by every
 * member) and fetching profile stats (which bucket the streak and heatmap in the viewer's
 * own day). Resolved per call rather than cached so it follows the device across travel and
 * DST without needing a restart.
 *
 * Falls back to the server's default if the platform can't answer — older Hermes builds
 * without full ICU return an empty string rather than throwing.
 */
export const deviceTimeZone = (): string | undefined => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
	} catch {
		return undefined;
	}
};
