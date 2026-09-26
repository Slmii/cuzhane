import type { GroupBab, GroupSummary, RoundDetail } from '@/lib/types/domain';

/**
 * The Hizb portion reader's decisions, apart from the screen so they can be tested as a table.
 *
 * Everything here answers one of three questions about a portion in the round being shown —
 * whose it is, what the one button under the text may do with it, and where the page arrows
 * go next — and none of it knows about queries, hooks or the text itself.
 */

/** Whose portion this is in the round shown: yours, the unclaimed pool's, or another member's. */
export type PortionOwnership = 'mine' | 'pool' | 'other';

/** The three lists the reader's strip draws and its chip reads — the same shape for either round. */
export type PortionShares = {
	myBabNumbers: number[];
	poolBabNumbers: number[];
	readBabNumbers: number[];
};

/**
 * The open round, from the group and its board.
 *
 * `myBabNumbers` is the share **and** anything volunteered for out of the pool, so a portion
 * the reader took an hour ago reads as theirs. `poolBabNumbers` is only the unclaimed part — a
 * claimed pool portion is somebody's work and is marked by them, not offered again.
 */
export const openRoundShares = (
	group: Pick<GroupSummary, 'myBabNumbers' | 'poolBabNumbers'>,
	babs: Pick<GroupBab, 'number' | 'readAt'>[]
): PortionShares => ({
	myBabNumbers: group.myBabNumbers,
	poolBabNumbers: group.poolBabNumbers,
	readBabNumbers: babs.filter(bab => bab.readAt !== null).map(bab => bab.number)
});

/**
 * A closed round, from its record. Who owed a portion that day is the round's own answer —
 * derived by the server from the rotation run backwards — and never today's share, which under
 * ROTATION hands the same portion to somebody else.
 *
 * `isPool` means the seat was empty that round, whether or not anybody has covered it since;
 * the read list is what says it is done.
 */
export const pastRoundShares = (round: Pick<RoundDetail, 'babs'>, viewerUserId: string | null): PortionShares => ({
	myBabNumbers: round.babs
		.filter(bab => viewerUserId !== null && bab.owedByUserId === viewerUserId)
		.map(bab => bab.number),
	poolBabNumbers: round.babs.filter(bab => bab.isPool).map(bab => bab.number),
	readBabNumbers: round.babs.filter(bab => bab.readByUserId !== null).map(bab => bab.number)
});

/** Three states and no fourth, in the order the chip checks them: a portion in your share is never "pool". */
export const portionOwnership = (
	partNumber: number,
	shares: Pick<PortionShares, 'myBabNumbers' | 'poolBabNumbers'>
): PortionOwnership =>
	shares.myBabNumbers.includes(partNumber) ? 'mine' : shares.poolBabNumbers.includes(partNumber) ? 'pool' : 'other';

/**
 * What the button does. `read` and `unread` are the open round's toggle, `takeAndRead` claims a
 * pool portion before marking it, `cover` fills a closed round's gap, and `none` is a button
 * that says why it cannot.
 */
export type PortionMarkAction = 'read' | 'unread' | 'takeAndRead' | 'cover' | 'none';

/** Why the button is disabled, when it is — each one has its own line above it. */
export type PortionMarkReason = 'notYours' | 'alreadyRead' | 'repetitions' | null;

export type PortionMarkInput = {
	ownership: PortionOwnership;
	/** A round that has already closed: marking it is the cover path, append-only. */
	isPastRound: boolean;
	/** Nobody has read it in the round shown — still to do in the open round, missed in a closed one. */
	isMissedInRound: boolean;
	/**
	 * Whether the read on it is the viewer's own. Only matters once it is read, in the open round:
	 * under ROTATION a portion can arrive in your share already read by whoever held it before,
	 * and only the reader may take a read back.
	 */
	isReadByViewer?: boolean;
	/** `requiredRepetitions` for the portion — 1 for all but Sekine. */
	required: number;
	/** The viewer's own count for the round shown. Ignored for a portion read once. */
	count: number;
};

export type PortionMarkDecision = { action: PortionMarkAction; isDisabled: boolean; reason: PortionMarkReason };

/**
 * The reader's one committing button, decided.
 *
 * **Covering is open to anyone's gap**, unlike the Cevşen reader, which covers only your own
 * block or the pool's. That is the Hizb round screen's rule — its rows offer "Üstlen" on any
 * member's missed portion — and Sekine, whose count lives here, reaches the reader from exactly
 * those rows; a button refusing what the row that opened it had just offered would be a dead end.
 *
 * **The count gates marking, never undoing.** The server refuses a read of a repeated portion
 * below its count (409) and never checks it on the way back, so a portion already marked stays
 * undoable whatever the counter says.
 */
export const canMarkPortion = ({
	count,
	isMissedInRound,
	isPastRound,
	isReadByViewer = false,
	ownership,
	required
}: PortionMarkInput): PortionMarkDecision => {
	const isShort = required > 1 && count < required;
	const gated = (action: PortionMarkAction): PortionMarkDecision => ({
		action,
		isDisabled: isShort,
		reason: isShort ? 'repetitions' : null
	});

	if (isPastRound) {
		return isMissedInRound ? gated('cover') : { action: 'none', isDisabled: true, reason: 'alreadyRead' };
	}

	if (ownership === 'other') {
		return { action: 'none', isDisabled: true, reason: 'notYours' };
	}

	if (!isMissedInRound) {
		return ownership === 'mine' && isReadByViewer
			? { action: 'unread', isDisabled: false, reason: null }
			: { action: 'none', isDisabled: true, reason: 'alreadyRead' };
	}

	return gated(ownership === 'pool' ? 'takeAndRead' : 'read');
};

/**
 * Whether the Sekine counter is drawn: only where the viewer could mark the portion, now or once
 * the nineteen are in. Another member's Sekine is theirs to count, and a gap somebody has
 * already filled has nothing left to count towards.
 */
export const countsRepetitions = (decision: PortionMarkDecision, required: number) =>
	required > 1 && decision.action !== 'none';

/** Where the reader is: a portion, and the block of it on screen, 0-based. */
export type HizbPage = { partNumber: number; blockIndex: number };

/**
 * One page turn, forwards or back — or `undefined` at either end of the book.
 *
 * **The arrows turn pages, and a page turn crosses portions.** Within a portion they walk its
 * blocks; past its last block they open the next portion at its first, and back from its first
 * they open the previous one at its **last** — the page that comes before, as a book turns. The
 * strip is the way to jump by portion; this is the way to read straight on.
 *
 * `blockCountOf` is asked only about the portion being entered, so a caller can compute it
 * lazily.
 */
export const stepHizbPage = (
	page: HizbPage,
	direction: 1 | -1,
	partCount: number,
	blockCountOf: (partNumber: number) => number
): HizbPage | undefined => {
	const { blockIndex, partNumber } = page;

	if (direction === 1) {
		if (blockIndex < blockCountOf(partNumber) - 1) {
			return { blockIndex: blockIndex + 1, partNumber };
		}

		return partNumber < partCount ? { blockIndex: 0, partNumber: partNumber + 1 } : undefined;
	}

	if (blockIndex > 0) {
		return { blockIndex: blockIndex - 1, partNumber };
	}

	return partNumber > 1
		? { blockIndex: Math.max(0, blockCountOf(partNumber - 1) - 1), partNumber: partNumber - 1 }
		: undefined;
};

/** Which write failed — the one thing that decides what the line above the button says. */
export type PortionMarkStep = 'read' | 'take' | 'cover' | 'count';

/**
 * A failed write, named for the reader.
 *
 * - `taken`: somebody else got there first — the pool portion was claimed, or the gap was
 *   covered. Not a failure of theirs, and not worth retrying.
 * - `repetitions`: the server's count is short of what the screen showed — a write still on its
 *   way, or one that never arrived. Only a repeated portion can be refused for it.
 * - `roundMoved`: a count meant for the open round arrived after that round had closed. The only
 *   409 a count write has: the server refuses it rather than file it under a round nobody is
 *   reading any more, and the screen has to fetch the group to learn which round is open now.
 * - `failed`: anything else, a dropped connection most likely.
 *
 * A 409 on a repeated portion's cover is ambiguous — short of nineteen, or already covered —
 * and reads as `repetitions`. The refetch that follows settles it: covered, the button reads
 * "Okundu" and the screen stops showing the line.
 */
export const markFailureKind = (
	status: number | null,
	{ isRepeated, step }: { isRepeated: boolean; step: PortionMarkStep }
): 'taken' | 'repetitions' | 'roundMoved' | 'failed' => {
	if (status !== 409) {
		return 'failed';
	}

	if (step === 'count') {
		return 'roundMoved';
	}

	if (step === 'take') {
		return 'taken';
	}

	if (isRepeated) {
		return 'repetitions';
	}

	return step === 'cover' ? 'taken' : 'failed';
};
