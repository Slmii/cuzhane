/** Where the dash goes — the server's `formatInviteCode` splits at the same point. */
const INVITE_CODE_GROUP_LENGTH = 4;

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
