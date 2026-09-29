import type { GroupMember, RoundBab, RoundDetail } from '@/lib/types/domain';
import { formatBabRange } from '@/lib/utils/babs';
import { requiredRepetitions } from '@/lib/utils/groupKinds';

/**
 * How a bab in a closed round reads on the grid.
 *
 * Five states, because two facts are shown at once: whether it was read, and whose it was.
 * The fill carries the first; the outline and the hatch carry the second.
 */
export type RoundCellState =
	/** Read by whoever owed it — once the round is closed, that is the ordinary case. */
	| 'read'
	/** Nobody read it, and it was not yours. */
	| 'missed'
	/** Nobody read it, and it was yours. */
	| 'missedMine'
	/** Yours, but another member covered it. */
	| 'takenByOther'
	/** Belonged to an empty seat, so it was never anyone's to miss. */
	| 'pool';

export const roundCellStates = (
	round: Pick<RoundDetail, 'babs'>,
	viewerUserId: string | null
): Record<number, RoundCellState> => {
	const states: Record<number, RoundCellState> = {};

	for (const bab of round.babs) {
		const isMine = viewerUserId !== null && bab.owedByUserId === viewerUserId;
		const wasRead = bab.readByUserId !== null;

		if (bab.isPool && !wasRead) {
			states[bab.number] = 'pool';
		} else if (!wasRead) {
			states[bab.number] = isMine ? 'missedMine' : 'missed';
		} else if (isMine && bab.readByUserId !== viewerUserId) {
			// The one case plain "read" would lose: it was yours, and someone stepped in.
			states[bab.number] = 'takenByOther';
		} else {
			states[bab.number] = 'read';
		}
	}

	return states;
};

/** Who covered which babs — phrased by the screen, which has the translations. */
export type RoundCover = {
	/** Empty for the viewer's own row, where the phrasing is "devraldığın" rather than a name. */
	byName: string;
	/**
	 * The coverer is the person reading the screen. Their own name in place of "sen" reads
	 * like a stranger did it, so the screen swaps in the second person.
	 */
	isViewer: boolean;
	babNumbers: number[];
};

export type RoundRow = {
	key: string;
	/** Empty on the pool row, which the screen labels with `t('pool')`. */
	name: string;
	/** Their photo, when they have one. Null on the pool row, which is nobody. */
	imageUrl: string | null;
	isViewer: boolean;
	isPool: boolean;
	/** What this person owed that round as runs — a Cevşen block "16–20", a hatim's "7, 22". */
	rangeLabel: string;
	/** Babs they owed that are still unread — what the row's action acts on. */
	outstanding: number[];
	/** How many they owed in total, so the screen can tell "some left" from "all of it". */
	owedCount: number;
	/** Which phrasing applies once nothing is outstanding. Null while some still is. */
	settledKey: 'noMisses' | 'transferred' | 'splitTaken' | null;
	/**
	 * Which shape the row's detail line takes. Decided here rather than in the screen so
	 * every branch is testable — the pool row in particular sits far enough down the list
	 * that it is awkward to confirm by eye.
	 *
	 * `settled` nothing left · `poolLeft` unowned, so it explains itself rather than listing
	 * numbers · `wholeBlock` none covered, so the block and the remainder are one span and
	 * printing both stutters · `partial` some covered, so the remainder genuinely narrows.
	 */
	detailKind: 'settled' | 'poolLeft' | 'wholeBlock' | 'partial';
	/** Babs of theirs that someone else covered, or — on your row — that you covered for others. */
	covered: RoundCover | null;
};

/*
 * A block partly covered by someone else is "sen üstlendin" only when *you* were that someone;
 * otherwise it is plainly done, and the accent line under the row names who stepped in.
 */
const settledKeyFor = (
	owed: RoundBab[],
	coveredByOthers: RoundBab[],
	viewerUserId: string | null
): RoundRow['settledKey'] => {
	if (coveredByOthers.length === 0) {
		return 'noMisses';
	}

	if (coveredByOthers.length === owed.length) {
		return 'splitTaken';
	}

	return viewerUserId !== null && coveredByOthers.every(bab => bab.readByUserId === viewerUserId)
		? 'transferred'
		: 'noMisses';
};

/**
 * Groups a round's babs into one row per person who owed some, plus a pool row.
 *
 * Rows are built from what each member *owed*, not what they read — which is the whole
 * point. A member who read nothing still gets a row, and whoever covered for them is named
 * on it rather than quietly absorbing the credit.
 */
export const roundRows = (
	round: Pick<RoundDetail, 'babs'>,
	members: Pick<GroupMember, 'userId' | 'displayName' | 'imageUrl'>[],
	viewerUserId: string | null
): RoundRow[] => {
	const nameByUserId = new Map(members.map(member => [member.userId, member.displayName]));
	const photoByUserId = new Map(members.map(member => [member.userId, member.imageUrl]));
	const owners = new Map<string, RoundBab[]>();
	const poolBabs: RoundBab[] = [];

	for (const bab of round.babs) {
		if (bab.owedByUserId === null) {
			poolBabs.push(bab);
			continue;
		}

		owners.set(bab.owedByUserId, [...(owners.get(bab.owedByUserId) ?? []), bab]);
	}

	// Babs that weren't yours which you read anyway — your row credits these to you rather
	// than letting them vanish into someone else's "covered" line.
	const takenByViewer =
		viewerUserId === null
			? []
			: round.babs.filter(bab => bab.owedByUserId !== viewerUserId && bab.readByUserId === viewerUserId);

	const rows: RoundRow[] = [];

	// Seat order, not "most outstanding first". Sorting by what's left re-ranks the list on
	// every tap, so the row you just acted on slides away and the next Üstlen lands on
	// somebody else's block. Order has to stay put while you work down it.
	const orderedOwnerIds = [
		...members.map(member => member.userId).filter(userId => owners.has(userId)),
		...[...owners.keys()].filter(userId => !members.some(member => member.userId === userId))
	];

	for (const userId of orderedOwnerIds) {
		const owed = owners.get(userId) as RoundBab[];
		const outstanding = owed.filter(bab => bab.readByUserId === null).map(bab => bab.number);
		const coveredByOthers = owed.filter(bab => bab.readByUserId !== null && bab.readByUserId !== userId);
		const isViewer = viewerUserId === userId;
		const covererId = coveredByOthers[0]?.readByUserId ?? null;

		const covered: RoundCover | null = isViewer
			? takenByViewer.length > 0
				? { byName: '', isViewer: true, babNumbers: takenByViewer.map(bab => bab.number) }
				: null
			: coveredByOthers.length > 0
			? {
					byName: covererId === null ? '' : nameByUserId.get(covererId) ?? '',
					isViewer: covererId !== null && covererId === viewerUserId,
					babNumbers: coveredByOthers.map(bab => bab.number)
			  }
			: null;

		rows.push({
			key: userId,
			name: nameByUserId.get(userId) ?? '',
			imageUrl: photoByUserId.get(userId) ?? null,
			isViewer,
			isPool: false,
			rangeLabel: formatBabRange(owed.map(bab => bab.number)),
			outstanding,
			owedCount: owed.length,
			settledKey: outstanding.length > 0 ? null : settledKeyFor(owed, coveredByOthers, viewerUserId),
			detailKind:
				outstanding.length === 0 ? 'settled' : outstanding.length === owed.length ? 'wholeBlock' : 'partial',
			covered
		});
	}

	if (poolBabs.length > 0) {
		const outstanding = poolBabs.filter(bab => bab.readByUserId === null).map(bab => bab.number);

		rows.push({
			key: 'pool',
			name: '',
			// The pool is nobody, so it keeps the generated mark rather than borrowing a face.
			imageUrl: null,
			isViewer: false,
			isPool: true,
			rangeLabel: formatBabRange(poolBabs.map(bab => bab.number)),
			outstanding,
			owedCount: poolBabs.length,
			// A settled pool block was covered by definition — nobody owed it. "Sen üstlendin"
			// only when you read all of it; anyone else in it makes it "hepsi devralındı".
			settledKey:
				outstanding.length > 0
					? null
					: viewerUserId !== null && poolBabs.every(bab => bab.readByUserId === viewerUserId)
					? 'transferred'
					: 'splitTaken',
			detailKind: outstanding.length === 0 ? 'settled' : 'poolLeft',
			covered: null
		});
	}

	return rows;
};

/**
 * A round's dates as HZ4 writes them, in the group's zone and the app's language: "20–26 Eyl"
 * inside one month, "30 Ağu – 5 Eyl" across two — which is every MONTHLY round, "20 Eyl – 19 Eki"
 * — and a single date for a DAILY one.
 *
 * `endsAt` is the next round's first instant, so the last day is the moment before it, read in
 * the zone. Subtracting a day instead would land on the wrong date across a DST change.
 *
 * Built from `formatToParts` rather than `formatRange`, which Hermes does not have: inside one
 * month the day becomes the span and the month is said once, wherever the language puts it —
 * "20–26 Eyl", "Sep 20–26".
 */
export const roundDateRange = (startedAt: string, endsAt: string, locale: string, timeZone: string): string => {
	const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone });
	const first = new Date(startedAt);
	const last = new Date(new Date(endsAt).getTime() - 1);
	const firstParts = format.formatToParts(first);
	const lastParts = format.formatToParts(last);
	const valueOf = (parts: Intl.DateTimeFormatPart[], type: 'day' | 'month') =>
		parts.find(part => part.type === type)?.value;
	const lastDay = valueOf(lastParts, 'day');

	if (valueOf(firstParts, 'month') !== valueOf(lastParts, 'month')) {
		return `${format.format(first)} – ${format.format(last)}`;
	}

	if (valueOf(firstParts, 'day') === lastDay) {
		return format.format(first);
	}

	return firstParts.map(part => (part.type === 'day' ? `${part.value}–${lastDay}` : part.value)).join('');
};

/**
 * "16", "16 ve 24", "16, 24 ve 31" — commas, and the language's own word before the last. Not
 * `Intl.ListFormat`, which Hermes does not have either.
 */
export const joinWithAnd = (items: (string | number)[], and: string): string => {
	const words = items.map(String);

	if (words.length <= 1) {
		return words[0] ?? '';
	}

	return `${words.slice(0, -1).join(', ')} ${and} ${words[words.length - 1]}`;
};

/** Up to this many of a closed round's missed portions are named on its HZ4 card; past it, counted. */
const MISSED_PORTIONS_NAMED = 3;

type MissedNoteKey =
	| 'listAnd'
	| 'roundMissedPartsHizb'
	| 'roundMissedPartsHizbOne'
	| 'roundMissedCountHizb'
	| 'roundMissedCountHizbOne';

/**
 * The clay line under a closed Hizb round on Turlar: "16, 24 ve 31 okunmadı", or "5 bölüm okunmadı"
 * once there are more than three. Null for a round that missed nothing.
 *
 * `numbers` is `RoundSummary.missedPartNumbers`. Null, or numbers that disagree with the count,
 * falls back to counting rather than naming the wrong ones.
 */
export const hizbMissedNote = (
	{ count, numbers }: { count: number; numbers: number[] | null },
	t: (key: MissedNoteKey, values?: Record<string, string | number>) => string
): string | null => {
	if (count <= 0) {
		return null;
	}

	if (numbers !== null && numbers.length === count && count <= MISSED_PORTIONS_NAMED) {
		const parts = joinWithAnd(
			[...numbers].sort((a, b) => a - b),
			t('listAnd')
		);

		return t(count === 1 ? 'roundMissedPartsHizbOne' : 'roundMissedPartsHizb', { parts });
	}

	return t(count === 1 ? 'roundMissedCountHizbOne' : 'roundMissedCountHizb', { count });
};

/**
 * A portion of a closed Hizb round (HZ5). The Cevşen's five states fold the viewer into the fill;
 * the Hizb's lattices draw "yours" as a ring over whatever the fill is, so here that is a flag and
 * the fill answers one question — what became of the portion.
 */
export type HizbRoundCellState =
	/** Read by whoever owed it. */
	| 'read'
	/** Owed, and nobody read it. */
	| 'missed'
	/** Read by somebody other than its owner — a cover, or a pool portion someone took. */
	| 'taken'
	/** An empty seat's portion that nobody took, so it was never anyone's to miss. */
	| 'pool';

export type HizbRoundCell = {
	number: number;
	state: HizbRoundCellState;
	/** Owed by the viewer that round — the ring, over a read or a missed fill alike. */
	isMine: boolean;
};

/**
 * How many members still owe something from a round — the server's `missedPeopleCount`, counted
 * from the parts in hand so an optimistic cover moves it on the tap. The pool is nobody's.
 */
export const missedPeopleCount = (round: Pick<RoundDetail, 'babs'>): number =>
	new Set(
		round.babs.filter(bab => bab.readByUserId === null && bab.owedByUserId !== null).map(bab => bab.owedByUserId)
	).size;

/** The round's portions in order, as HZ5's lattice draws them. */
export const hizbRoundCells = (round: Pick<RoundDetail, 'babs'>, viewerUserId: string | null): HizbRoundCell[] =>
	[...round.babs]
		.sort((a, b) => a.number - b.number)
		.map(bab => ({
			isMine: viewerUserId !== null && bab.owedByUserId === viewerUserId,
			number: bab.number,
			state:
				bab.readByUserId === null
					? bab.isPool
						? 'pool'
						: 'missed'
					: bab.readByUserId === bab.owedByUserId
					? 'read'
					: 'taken'
		}));

/**
 * What a row's button does.
 *
 * `cover` is the Cevşen's one write — everything outstanding that can simply be marked, in one
 * act. `read` is Sekine: a portion that counts only after its repetitions, which only the reader
 * keeps, so its button opens the reader on that round rather than marking anything.
 */
export type HizbRoundAction = { kind: 'cover'; partNumbers: number[] } | { kind: 'read'; partNumber: number };

export type HizbRoundRow = RoundRow & {
	/** Every portion the row owed, as the design writes them — "15–16", "19", or "5, 31" for a pool of two seats. */
	partsLabel: string;
	action: HizbRoundAction | null;
};

/**
 * The portions that can be covered in one write come first; a portion that must be repeated waits
 * until they are done, so a block holding Sekine is two taps — the rest, then the reader — and
 * neither tap does something the button did not say.
 */
export const hizbRoundAction = (outstanding: number[]): HizbRoundAction | null => {
	const direct = outstanding.filter(number => requiredRepetitions('HIZB', number) <= 1);

	if (direct.length > 0) {
		return { kind: 'cover', partNumbers: direct };
	}

	const repeated = outstanding[0];

	return repeated === undefined ? null : { kind: 'read', partNumber: repeated };
};

/**
 * HZ5's "Eksik kalanlar": `roundRows`, narrowed to the rows with something still outstanding.
 *
 * Thirty-three seats can mean thirty-three rows, and the screen is titled for what was missed. A
 * row the viewer settled on this visit stays (`keptKeys`) as its settled self: the list is in seat
 * order so that acting on a row leaves the next one where it was, and a row vanishing under the
 * finger would move them all.
 */
export const hizbRoundRows = (
	round: Pick<RoundDetail, 'babs'>,
	members: Pick<GroupMember, 'userId' | 'displayName' | 'imageUrl'>[],
	viewerUserId: string | null,
	keptKeys: ReadonlySet<string>
): HizbRoundRow[] =>
	roundRows(round, members, viewerUserId)
		.filter(row => row.outstanding.length > 0 || keptKeys.has(row.key))
		.map(row => ({
			...row,
			action: hizbRoundAction(row.outstanding),
			partsLabel: formatBabRange(
				round.babs
					.filter(bab => (row.isPool ? bab.owedByUserId === null : bab.owedByUserId === row.key))
					.map(bab => bab.number)
			)
		}));
