import type { AppTheme } from '@/lib/theme/tokens';

/** A cell's three colours: its fill, its outline, and the ink of the number on it. */
export type CellTone = {
	backgroundColor: string;
	borderColor: string;
	labelColor: string;
};

/**
 * The tones every numbered board in the app shares, so the same state is the same colour
 * whether it is drawn over a hundred babs or thirty cüz.
 *
 * **`sandText`, not `faintText`, on an unclaimed cell** — this is the one worth having in a
 * single place. The unclaimed fill is a tan, and a pale grey numeral on it is barely
 * legible; `PoolGrid` recorded that in a comment and fixed it locally, and the cüz map was
 * then written from scratch and made the identical mistake. A shared table is what stops the
 * third board making it again.
 */
export const unclaimedTone = (theme: AppTheme): CellTone => ({
	backgroundColor: theme.colors.poolFree,
	borderColor: theme.colors.poolFree,
	labelColor: theme.colors.sandText
});

/**
 * Yours: solid accent, ringed in `text`.
 *
 * The ring is the design's own `0 0 0 1.5px #1C1D1A`, and it is on **every** cüz map in the
 * export — the lobby's, the picker's and the group map's — as well as on the pool board's
 * "sen üstlendin". It reads as a held cell rather than merely a dark one, which matters most
 * on the picker, where the fill beside it is the same green at another depth.
 */
export const mineTone = (theme: AppTheme): CellTone => ({
	backgroundColor: theme.colors.accent,
	borderColor: theme.colors.text,
	labelColor: theme.colors.onAccent
});

/**
 * Somebody else holds it, on one of the **thirty-cell cüz maps** — the soft green.
 *
 * Distinct from `takenTone` below on purpose, and the design is consistent about it across
 * every cüz map (QJ1, QJ2, QJ3, the lobby): a cüz map has only two or three states and no
 * unread-but-claimed middle to express, so "held" and "read" are told apart by *depth* of
 * the same green rather than by green against grey. The hundred-bab pool board keeps the
 * neutral panel, where a claim genuinely is a different kind of thing from a read.
 */
export const heldTone = (theme: AppTheme): CellTone => ({
	backgroundColor: theme.colors.babReadByOthers,
	borderColor: theme.colors.babReadByOthers,
	labelColor: theme.colors.babOthersText
});

/**
 * Somebody else has it and has not read it yet — a quiet panel, because a claim nobody has
 * acted on is the least eventful thing on a board. The hundred-bab boards' version of
 * `heldTone`; see the note there for why the two differ.
 */
export const takenTone = (theme: AppTheme): CellTone => ({
	backgroundColor: theme.colors.surfaceMuted,
	borderColor: theme.colors.border,
	labelColor: theme.colors.faintText
});

/**
 * Read — by anybody. The **deep** green, `babReadByMe`, not the pale `babReadByOthers`
 * wash: on a join preview a finished cüz is the board's one piece of good news, and the
 * pale one sat a shade off the neutral `taken` panel beside it rather than reading as done.
 *
 * Deliberately not split into read-by-me and read-by-them: the one surface drawing this is
 * the join preview, where the viewer is not a member yet and every read is somebody else's.
 * `onAccent` for the numeral, the pairing the hundred-bab board uses on the same fill.
 */
export const readTone = (theme: AppTheme): CellTone => ({
	backgroundColor: theme.colors.babReadByMe,
	borderColor: theme.colors.babReadByMe,
	labelColor: theme.colors.onAccent
});
