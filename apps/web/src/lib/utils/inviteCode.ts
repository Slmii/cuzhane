/** Where the dash goes — the server's `formatInviteCode` splits at the same point. */
const INVITE_CODE_GROUP_LENGTH = 4;
/** The scheme matches `expo.scheme` in app.json. */
const APP_SCHEME = 'cuzhane://';

/**
 * **The one invite link is the QR code's.** `InviteQr` encodes this URL; a phone camera opens
 * the app on Gruplarım with the join sheet already looking the code up (`linking.ts` aliases
 * `groups/join/:inviteCode` onto that root). Nothing else emits or displays it — the code stays
 * the thing people read out and type, and there is no web fallback: the scheme resolves only
 * with the app installed. Pure, so the QR's geometry can be tested against it.
 */
export const inviteLink = (inviteCode: string): string => `${APP_SCHEME}groups/join/${inviteCode.replace(/-/g, '')}`;

/**
 * `HATM4K2P` -> `HATM-4K2P`. Codes are stored and typed bare; the dash exists only so a
 * code can be read aloud in two halves.
 *
 * The server formats the codes it sends, so this is for the one code the client holds
 * unformatted: the one somebody just typed, shown back to them when it finds nothing.
 */
export const formatInviteCode = (code: string): string =>
	code.length > INVITE_CODE_GROUP_LENGTH
		? `${code.slice(0, INVITE_CODE_GROUP_LENGTH)}-${code.slice(INVITE_CODE_GROUP_LENGTH)}`
		: code;
