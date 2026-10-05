import type { BabCellState } from '@/components/BabGrid/BabGrid.types';
import type { ChipTone } from '@/components/ui/Chip/Chip.types';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { StringKey } from '@/lib/i18n/strings';
import type {
	GroupBab,
	GroupCycle,
	GroupKind,
	GroupSplitMode,
	GroupSummary,
	GroupVisibility
} from '@/lib/types/domain';
import { babRuns, formatRun, rangeForRound, rangeForSlot } from '@/lib/utils/babs';
import { CYCLES_FOR_KIND } from '@/lib/utils/groupKinds';
import { unitLabelKey } from '@/lib/utils/units';

/** The cycles the create sheet offers a kind — the Hizb's month is not the Cevşen's to choose. */
export const cycleOptionsFor = (kind: GroupKind): readonly GroupCycle[] => CYCLES_FOR_KIND[kind];

/**
 * The cadence's name.
 *
 * **A full map, not `DAILY ? … : 'weekly'`.** That was complete while the only two values
 * were DAILY and WEEKLY, and it silently labelled a monthly hatim "Haftalık" and a one-off
 * the same — the shape of every other bug this feature has produced. `CUSTOM` is not a
 * cadence at all, so it borrows the "tek seferlik" wording rather than naming a rhythm.
 */
const CYCLE_LABEL_KEYS: Record<GroupCycle, StringKey> = {
	CUSTOM: 'qCustom',
	DAILY: 'daily',
	MONTHLY: 'monthly',
	WEEKLY: 'weekly'
};

export const cycleLabelKey = (cycle: GroupCycle): StringKey => CYCLE_LABEL_KEYS[cycle];

/**
 * The noun a count of parts takes — "20 bab", "30 cüz", "7 bölüm". Lowercase, for after a
 * number: "/ 100 bab", "32 bölüm". A Hizb group divides portions and a hatim cüz, not babs, and
 * saying "bab" there would name a unit the book is not cut into. Same as `unitLabelKey`.
 */
export const partUnitKey = (kind: GroupKind): StringKey => unitLabelKey(kind);

// A record, so a kind added to `GroupKind` fails the build until it has a name.
const PART_LABEL_KEYS: Record<GroupKind, StringKey> = { CEVSEN: 'bab', HATIM: 'cuzLabel', HIZB: 'portion' };

/** The same noun titling one part — "Bab 12", "Cüz 12", "Bölüm 19". */
export const partLabelKey = (kind: GroupKind): StringKey => PART_LABEL_KEYS[kind];

// The kind's own name — "Cevşen", "Kuran", "Hizbü'l-Hakaik". A record, for the same reason.
const KIND_LABEL_KEYS: Record<GroupKind, StringKey> = { CEVSEN: 'qCevsen', HATIM: 'qHatim', HIZB: 'kindHizb' };

/** What a group reads, by name — a card's badge, a filter row, a notification's heading. */
export const kindLabelKey = (kind: GroupKind): StringKey => KIND_LABEL_KEYS[kind];

/**
 * Whether a written range is a single part. `formatRun` and `formatBabRange` write one part as a
 * bare number — "19" — and anything more with a dash or a comma, so the string says it. The
 * server's push copy asks the same question the same way (`pushCopy.ts`), so a row in the inbox
 * and the push it mirrors agree about "portion" against "portions".
 */
export const isSinglePart = (range: string) => !/[–,]/.test(range);

/**
 * A set of Hizb portions with its noun, where the language puts it — "15–16. bölüm", "Portions
 * 15–16", "Portion 19". `parts` is already written (`formatBabRange`, `shareSlices`).
 */
export const hizbPartsLabel = (
	parts: string,
	t: (key: 'hizbParts' | 'hizbPartsOne', values: Record<string, string>) => string
) => t(isSinglePart(parts) ? 'hizbPartsOne' : 'hizbParts', { parts });

/** The plan screens' "Bölüm 11–13" / "Portions 11–13" / "Portion 19" — the noun first, counted. */
export const hizbPortionLabel = (
	portions: string,
	t: (key: 'hpPortionLabel' | 'hpPortionLabelMany', values: Record<string, string>) => string
) => t(isSinglePart(portions) ? 'hpPortionLabel' : 'hpPortionLabelMany', { portions });

export const visibilityLabelKey = (visibility: GroupVisibility): StringKey =>
	visibility === 'OPEN' ? 'open' : 'private';

export const visibilityChipTone = (visibility: GroupVisibility): ChipTone =>
	visibility === 'OPEN' ? 'accent' : 'sand';

/**
 * The glyph that goes with that label. "Açık" and "Özel" are the same length in the same
 * small caps and differ by their colour alone; a globe against a padlock is the difference
 * you can read without stopping.
 */
export const visibilityIcon = (visibility: GroupVisibility): IconName => (visibility === 'OPEN' ? 'globe' : 'lock');

/** The long form, for a card subtitle: "Sabit paylaşım". */
export const splitModeLabelKey = (splitMode: GroupSplitMode): StringKey =>
	splitMode === 'FLEXIBLE' ? 'planFlexible' : splitMode === 'FIXED' ? 'fixedSplit' : 'planRotation';

/** Whether a card names the split mode: a hatim's cüz are held, not divided by seat, so it has none. */
export const showsSplitMode = (kind: GroupKind) => kind !== 'HATIM';

/**
 * Turlar's subtitle: what closing a round does. A hatim and a Hizb group have their own lines;
 * a Cevşen group's depends on how it divides the babs. Seats move on by a whole share in a
 * ROTATION group (never a fixed number of babs), stay put in a FIXED one, and a FLEXIBLE group's
 * claims last one round.
 */
export const roundsSubtitleKey = (kind: GroupKind, splitMode: GroupSplitMode): StringKey =>
	kind === 'HIZB'
		? 'roundsSubHizb'
		: kind === 'HATIM'
		? 'roundsSubCuz'
		: splitMode === 'FIXED'
		? 'roundsSubFixed'
		: splitMode === 'FLEXIBLE'
		? 'roundsSubFlexible'
		: 'roundsSub';

/**
 * The create flow's waiting copy, by what is being made. The create flow only makes Hizb plan
 * groups, which have no portions to divide, and a reading of your own has no invite code.
 */
export const creatingCopy = ({
	isFlexible,
	isPersonal,
	kind
}: {
	isFlexible: boolean;
	isPersonal: boolean;
	kind: GroupKind;
}): { sub: StringKey; step: StringKey; showsCode: boolean } =>
	isPersonal
		? { sub: 'creatingPersonalSub', step: 'creatingStepPlan', showsCode: false }
		: kind === 'HIZB'
		? { sub: 'creatingPlanSub', step: 'creatingStepPlan', showsCode: true }
		: kind === 'HATIM'
		? { sub: 'creatingCuzSub', step: 'creatingStepCuz', showsCode: true }
		: isFlexible
		? { sub: 'creatingFlexibleSub', step: 'creatingFlexibleParts', showsCode: true }
		: { sub: 'creatingSub', step: 'creatingStepBabs', showsCode: true };

/** The short form used wherever the plan sits inline beside a range. */
export const planLabelKey = (splitMode: GroupSplitMode): StringKey =>
	splitMode === 'FLEXIBLE' ? 'planFlexible' : splitMode === 'FIXED' ? 'planFixed' : 'planRotation';

export type BabCellContext = {
	viewerUserId: string | null;
	/** The viewer's share this round (rotated share + anything they volunteered for). */
	myBabNumbers: Set<number>;
	/** Babs nobody is reading this round and nobody has volunteered for. */
	poolBabNumbers: Set<number>;
};

/**
 * Collapses a bab's read state and this round's share into the tones the board uses.
 *
 * `assignedUserId` no longer means "owns this seat's block" — it only records a pool
 * volunteer for the current round, and who reads which block is otherwise derived from
 * seat + round and never stored. So this reads the derived share the server already
 * computed (`myBabNumbers` / `poolBabNumbers`) instead of the raw assignment field.
 */
export const babCellState = (bab: GroupBab, context: BabCellContext): BabCellState => {
	const { viewerUserId, myBabNumbers, poolBabNumbers } = context;
	const isRead = bab.readAt !== null;

	if (isRead) {
		return viewerUserId !== null && bab.readByUserId === viewerUserId ? 'readByMe' : 'readByOthers';
	}

	if (myBabNumbers.has(bab.number)) {
		return 'mineUnread';
	}

	if (poolBabNumbers.has(bab.number)) {
		return 'pool';
	}

	return 'takenByOthers';
};

export const toBabCells = (
	babs: GroupBab[],
	context: { viewerUserId: string | null; myBabNumbers: number[]; poolBabNumbers: number[] }
) => {
	const cellContext: BabCellContext = {
		viewerUserId: context.viewerUserId,
		myBabNumbers: new Set(context.myBabNumbers),
		poolBabNumbers: new Set(context.poolBabNumbers)
	};

	return babs.map(bab => ({ number: bab.number, state: babCellState(bab, cellContext) }));
};

/**
 * A pool bab's state on the Havuz board — four, not three.
 *
 * `takenByOthers` used to cover a whole claimed block whether or not any of it had been
 * read, so a block someone had taken and finished looked identical to one they had taken and
 * not started. Splitting the read half off is what lets the board show progress inside
 * somebody else's claim.
 *
 * Your own claim stays a single state: on this board the useful fact is that the block is
 * yours, and your reading progress is on the row beneath it and all over the group screen.
 */
export type PoolCellState = 'open' | 'takenByMe' | 'takenByOthers' | 'takenByOthersRead';

export type PoolCell = {
	number: number;
	state: PoolCellState;
	/**
	 * Which pool slot this bab belongs to. Optional because it exists only to time the
	 * üstlen sweep: the fill is staggered by a cell's position *inside its own block*, so
	 * claiming babs 27–39 sweeps those thirteen and leaves the rest of the pool alone.
	 * Without it every cell would be timed from the start of the whole pool and a late
	 * block would still be filling seconds after the tap.
	 */
	slotIndex?: number;
};

/**
 * The whole pool, claimed parts included — what the Havuz card draws.
 *
 * Membership comes from `poolAllBabNumbers`, which the server derives from the empty seats,
 * and never from `assignedUserId`. Inferring it — "a bab with a claim on it is a pool bab" —
 * held only while a claim could not outlive its seat being empty, and a claim stranded on a
 * seat somebody has since joined put babs on this card that the Havuz screen correctly left
 * out. One pool, two boards, thirteen babs apart.
 *
 * `GroupSummary.poolBabNumbers` is a different list: only the part nobody has taken, because
 * the 100-bab board needs it that way — a block someone volunteered for is that person's
 * work now, not an offer, so it must not keep wearing the hatch there.
 */
export const toPoolCells = (
	babs: GroupBab[],
	context: { viewerUserId: string | null; poolAllBabNumbers: number[] }
): PoolCell[] => {
	const poolNumbers = new Set(context.poolAllBabNumbers);

	return babs
		.flatMap<PoolCell>(bab => {
			if (!poolNumbers.has(bab.number)) {
				return [];
			}

			if (bab.assignedUserId === null) {
				return [{ number: bab.number, state: 'open' }];
			}

			const isMine = context.viewerUserId !== null && bab.assignedUserId === context.viewerUserId;

			if (isMine) {
				return [{ number: bab.number, state: 'takenByMe' }];
			}

			return [{ number: bab.number, state: bab.readAt !== null ? 'takenByOthersRead' : 'takenByOthers' }];
		})
		.sort((a, b) => a.number - b.number);
};

/**
 * The gap between one cell lighting up and the next — **zero: the block changes all at once.**
 *
 * `pool-fill.html` sets `--fill-step` at 70ms and this ran at 70, then 50, then 18. Every one
 * of them read as sluggish, and the reason is arithmetic rather than frame rate: a 13-bab
 * block is twelve steps before its *last* cell even begins, so at 70ms the sweep was still
 * starting cells 840ms after the tap and the 300ms fade then ran on top of that. The claim
 * finished well over a second after the finger left. Measured frame gaps were fine
 * throughout — the animation was never dropping frames, it was just long.
 *
 * At zero every cell in the block eases together and the whole thing is over in the 300ms
 * the fade itself takes.
 *
 * **`staggerWithinRuns` still runs and now returns all zeros**, which also makes the reversed
 * drain a no-op — undoing a claim used to empty the block last-cell-first. That machinery is
 * left in place rather than deleted, because it is one constant away from working again if
 * the sweep is ever wanted back.
 */
export const FILL_STEP_MS = 0;

/**
 * Per-cell delays that sweep each *run* of a grid left to right.
 *
 * `pool-fill.html` stages the üstlen fill by a cell's index inside the block being claimed,
 * not inside the whole grid — claiming babs 27–39 has to repaint those thirteen and leave
 * the rest alone. Timed from the start of the grid instead, a late block would still be
 * filling seconds after the tap.
 *
 * Callers pass whatever identifies a block: the slot index where it is known, otherwise the
 * cell's state, since a block is always claimed whole and therefore shares one state.
 * Cells whose colour did not change transition to the value they already hold, so a delay
 * on them costs nothing.
 */
export const staggerWithinRuns = (
	runKeys: (string | number)[],
	stepMs = FILL_STEP_MS,
	/**
	 * Runs to sweep the other way — the last cell first, back toward the start.
	 *
	 * Undoing a claim drains the block exactly as it filled, reversed, which is what makes
	 * the two read as one action and its undo rather than as two separate fills. Same step,
	 * opposite direction.
	 */
	reversedKeys?: ReadonlySet<string | number>
): number[] => {
	const delays: number[] = [];
	let runStart = 0;

	runKeys.forEach((key, index) => {
		if (index === 0 || runKeys[index - 1] !== key) {
			runStart = index;
		}

		delays.push((index - runStart) * stepMs);
	});

	if (reversedKeys === undefined || reversedKeys.size === 0) {
		return delays;
	}

	// Flipping each reversed run in place keeps the run's own span — the last cell inherits
	// the delay the first would have had, so the block still finishes when it always did.
	let start = 0;

	runKeys.forEach((key, index) => {
		const isRunEnd = index === runKeys.length - 1 || runKeys[index + 1] !== key;

		if (!isRunEnd) {
			return;
		}

		if (reversedKeys.has(key)) {
			for (let offset = 0; offset <= (index - start) / 2; offset += 1) {
				const head = start + offset;
				const tail = index - offset;
				const swap = delays[head] as number;

				delays[head] = delays[tail] as number;
				delays[tail] = swap;
			}
		}

		start = index + 1;
	});

	return delays;
};

export type ShareSlices = {
	/** The stretch to put front and centre — the one holding the next bab still owed. */
	current: string;
	/** How many other stretches the reader holds. Zero for the ordinary single range. */
	moreCount: number;
};

/**
 * A share as design 01g states it: one slice large, and a count of the rest.
 *
 * Ranges stopped being a single stretch once the pool arrived — volunteering for a block
 * hands you a second, unconnected range, and a reader can end a round holding several. Set
 * out in full they run to "1–13, 27–39, 66–78", which wraps to three lines in the ring and
 * pushes the group screen's heading to double height while saying nothing about what to
 * read next.
 *
 * The slice shown is the one holding `nextBabNumber` — where the reader actually is, not
 * simply the lowest number they own. A finished share has no next bab and falls back to the
 * first, because by then the question is what they read, not what is left.
 */
export const shareSlices = (babNumbers: number[], nextBabNumber: number | null): ShareSlices => {
	const runs = babRuns(babNumbers);
	const found =
		nextBabNumber === null ? -1 : runs.findIndex(run => nextBabNumber >= run.start && nextBabNumber <= run.end);
	const current = runs[found === -1 ? 0 : found];

	return current === undefined
		? { current: '—', moreCount: 0 }
		: { current: formatRun(current), moreCount: runs.length - 1 };
};

/**
 * A portion's state on the Hizb board (HZ1) — three, and a ring on top.
 *
 * The Cevşen board splits a read by *who* read it; this one asks only what the group has done
 * with each portion this round: read, held by someone (a seat's block, or a pool portion
 * somebody volunteered for), or still sitting in the pool with nobody on it. Whether it is the
 * viewer's is a separate fact, because it is drawn as a separate mark — a ring over whichever of
 * the three it is.
 */
/** `unread` is a personal-plan group's: no holders and no pool, only read or not yet. */
export type HizbBoardCellState = 'read' | 'taken' | 'pool' | 'unread';

export type HizbBoardCell = {
	number: number;
	state: HizbBoardCellState;
	/** In the viewer's share this round, their own pool claims included — the ring. */
	isMine: boolean;
};

/**
 * The Hizb board's cells, in portion order.
 *
 * "Mine" is the server's `myBabNumbers`, which already carries the viewer's pool claims, so a
 * claimed pool portion wears the ring as their own seat's do. The pool is `poolBabNumbers` —
 * the unclaimed part, as on the Cevşen board — and a portion that arrives on the board with a
 * name on it is taken whatever that list says: the two come from different queries, and a
 * claim landing on the board before the group refetches must not keep wearing the hatch.
 */
export const hizbBoardCells = (
	babs: GroupBab[],
	group: Pick<GroupSummary, 'myBabNumbers' | 'poolBabNumbers'>
): HizbBoardCell[] => {
	const mine = new Set(group.myBabNumbers);
	const pool = new Set(group.poolBabNumbers);

	return [...babs]
		.sort((a, b) => a.number - b.number)
		.map(bab => ({
			isMine: mine.has(bab.number),
			number: bab.number,
			state: bab.readAt !== null ? 'read' : pool.has(bab.number) && bab.assignedUserId === null ? 'pool' : 'taken'
		}));
};

/**
 * The accent tile on the Hizb's "Bu tur bölümün" panel, as HZ1 writes it: one or two portions
 * by number — "7", "15 · 16" — and past two, how many. A Hizb share is short and often broken
 * (a seat's block plus a pool portion or two), so "15 · 16 · 24" is spelled out nowhere; the
 * rows under the tile name every one of them.
 */
export const hizbShareLabel = (partNumbers: number[], unit: string): string => {
	if (partNumbers.length === 0) {
		return '—';
	}

	return partNumbers.length <= 2 ? partNumbers.join(' · ') : `${partNumbers.length} ${unit}`;
};

/** Placeholder board for the loading state so the card doesn't jump when data lands — one cell per part. */
export const emptyBabCells = (total: number) =>
	Array.from({ length: total }, (_, index) => ({ number: index + 1, state: 'open' as BabCellState }));

/** One round of the create sheet's plan preview: the range a seat reads, and where it sits in the text. */
export type PlanPreviewRow = {
	/** 0-based. Also the row's React key, so a bar keeps its identity while `spots` moves. */
	roundIndex: number;
	start: number;
	end: number;
	/** How much of the whole text comes before the range, 0–100 — where the bar starts. */
	offset: number;
	/** How much of the whole text the range covers, 0–100. */
	width: number;
	/** The range never moves — FIXED, or a lone seat — so the row is "every round", not round n. */
	isEveryRound: boolean;
};

/**
 * Whether a seat reads a different range from one round to the next: ROTATION with somebody to
 * rotate past. A lone seat under ROTATION (the Hizb allows one) holds the whole book every round,
 * which is FIXED in all but name — the preview's caption and its row both say so from here, so
 * the two cannot disagree.
 */
export const movesEachRound = (splitMode: GroupSplitMode, spots: number) => splitMode === 'ROTATION' && spots > 1;

/** The narrowest and widest a Hizb lobby's seat row gets. */
const HIZB_SEAT_COLUMNS_MIN = 8;
const HIZB_SEAT_COLUMNS_MAX = 11;

/**
 * How many columns the Hizb lobby's seat lattice (HC4) lays its seats out in: ten up to ten
 * seats — the Cevşen lobby's row — and past that as few rows as eleven columns allow, evened
 * out across them, but never narrower than eight. HC4 draws sixteen as two rows of eight and
 * the full 32 comes out as three of eleven; the floor is what keeps a cell from ballooning
 * where evening out alone would halve the width (twelve seats as two rows of six).
 */
export const hizbSeatColumns = (spots: number) =>
	spots <= 10 ? 10 : Math.max(HIZB_SEAT_COLUMNS_MIN, Math.ceil(spots / Math.ceil(spots / HIZB_SEAT_COLUMNS_MAX)));

/**
 * What `PlanPreview` draws. Under ROTATION, the first `maxRounds` rounds of one seat — never more
 * rounds than there are seats, because after `spots` of them the seat is back where it began.
 * Under FIXED, the one range it holds every round. Percentages of `partCount`, so a bar reads as
 * a position on the whole book, the hundred babs or the Hizb's 32 portions alike.
 */
export const planPreviewRows = ({
	maxRounds,
	partCount,
	slotIndex,
	splitMode,
	spots
}: {
	maxRounds: number;
	partCount: number;
	slotIndex: number;
	splitMode: GroupSplitMode;
	spots: number;
}): PlanPreviewRow[] => {
	const moves = movesEachRound(splitMode, spots);
	const roundCount = moves ? Math.min(maxRounds, spots) : 1;

	return Array.from({ length: roundCount }, (_, roundIndex) =>
		moves ? rangeForRound(slotIndex, spots, roundIndex, partCount) : rangeForSlot(slotIndex, spots, partCount)
	).flatMap((range, roundIndex) =>
		range
			? [
					{
						end: range.end,
						isEveryRound: !moves,
						offset: ((range.start - 1) / partCount) * 100,
						roundIndex,
						start: range.start,
						width: ((range.end - range.start + 1) / partCount) * 100
					}
			  ]
			: []
	);
};
