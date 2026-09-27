import type { GroupMember, RoundBab, RoundDetail } from '@/lib/types/domain';
import { formatBabRange } from '@/lib/utils/babs';

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
