import { babNumbersForRound, babNumbersForSlot, rangeForRound, rangeForSlot } from '@utils/babs';
import { partCountFor } from '@utils/groupKinds';
import { unitCountFor } from '@utils/units';
import type {
	CuzHolding,
	Group,
	GroupMember,
	GroupMember as GroupMemberModel,
	PrismaClient
} from '../generated/prisma/client';
import type { BabRange, GroupSplitMode } from './groupSerializers';

/*
 * **The unit plan, and the seat arithmetic it is built on.**
 *
 * The seat helpers below (`babNumbersInRound`, `poolBlocks` and the rest) were defined in
 * `groupSerializers` and are re-exported from there, so existing callers are unchanged. They
 * live here because the plan *is* their generalisation: a Cevşen group's answer to "whose
 * unit is this" is this arithmetic, and a hatim's is a stored row.
 */
/**
 * Only the fields the split actually depends on, so callers with a partial row can use it.
 * `kind` is one of them: it decides how many parts there are to split. Nothing on the board
 * records which block a seat reads — it is derived from the seat and the round, so a ROTATION
 * group's share moves without rewriting a row.
 */
type PlanShape = Pick<Group, 'spots' | 'splitMode' | 'kind'>;

/**
 * `FREE` is retired. The DB enum still carries it so existing rows stay readable, but
 * nothing can create one and it behaves as `FIXED` — a seat that never moves.
 */
export const toSplitMode = (splitMode: Group['splitMode']): GroupSplitMode =>
	splitMode === 'FLEXIBLE' ? 'FLEXIBLE' : splitMode === 'ROTATION' ? 'ROTATION' : 'FIXED';

/**
 * The round a group is actually on, or null while it is still gathering.
 *
 * Read from the column rather than recomputed, so a group that has fallen behind reports the
 * round it is showing. Callers put `ensureCurrentRound` in front of this to make the two agree.
 */
export const roundIndexFor = (group: Pick<Group, 'status' | 'startedAt' | 'roundIndex'>): number | null =>
	group.status === 'RUNNING' && group.startedAt ? group.roundIndex : null;

/**
 * The block a seat reads in a given round.
 *
 * **Exported for the same reason `shareBabNumbersToday` below is**: a caller asking what a
 * seat owed in a *past* round has to get the same answer the serializers give for the
 * present one, and the rule is not obvious enough to restate — ROTATION advances by a
 * whole seat per round, FIXED never moves, and a group still GATHERING has no round at
 * all. `my-progress` walks the window with this; a second copy of the three-line branch
 * would be a second thing to remember to change when the split rules move.
 */
export const babNumbersInRound = (group: PlanShape, slotIndex: number, roundIndex: number | null): number[] => {
	// A flexible group has no blocks: every part is taken one at a time out of the pool.
	if (group.splitMode === 'FLEXIBLE') {
		return [];
	}
	const partCount = partCountFor(group.kind);

	if (roundIndex === null) {
		// Still gathering: the seat's own block is what has been reserved for them.
		return babNumbersForSlot(slotIndex, group.spots, partCount);
	}

	return toSplitMode(group.splitMode) === 'ROTATION'
		? babNumbersForRound(slotIndex, group.spots, roundIndex, partCount)
		: babNumbersForSlot(slotIndex, group.spots, partCount);
};

export const rangeInRound = (group: PlanShape, slotIndex: number, roundIndex: number): BabRange | null => {
	if (group.splitMode === 'FLEXIBLE') {
		return null;
	}
	const partCount = partCountFor(group.kind);

	return toSplitMode(group.splitMode) === 'ROTATION'
		? rangeForRound(slotIndex, group.spots, roundIndex, partCount)
		: rangeForSlot(slotIndex, group.spots, partCount);
};

/**
 * The block a member reads today. Exported because the write paths need the same answer
 * the read paths give — "mark my whole share" has to target today's babs, and under
 * ROTATION those are not the babs carrying the member's `assignedUserId`.
 */
export const shareBabNumbersToday = (group: Group, members: GroupMemberModel[], viewerUserId: string): number[] => {
	const member = members.find(candidate => candidate.userId === viewerUserId);

	return member ? babNumbersInRound(group, member.slotIndex, roundIndexFor(group)) : [];
};

/** Seats nobody took. Their babs are the shared pool until someone takes them. */
export const poolSlotIndexes = (members: Pick<GroupMemberModel, 'slotIndex'>[], spots: number): number[] => {
	const taken = new Set(members.map(member => member.slotIndex));

	return Array.from({ length: spots }, (_, slot) => slot).filter(slot => !taken.has(slot));
};

/**
 * The blocks nobody is reading this round — the shared pool.
 *
 * **The pool rotates with everything else.** An empty seat `e` doesn't leave *its own*
 * block uncovered; in round `r` it leaves the block that seat `e` would have been reading,
 * which is `(e + r) % spots`. Taking the standing block instead gets it wrong twice over:
 * that block is being read by whichever member rotated onto it (so two people are
 * authorised for the same bab), while the genuinely uncovered block appears nowhere and
 * cannot be reached at all — making a full board unattainable through the intended shares.
 *
 * A flexible group is all pool: every part is its own one-part block.
 */
export const poolBlocks = (
	group: PlanShape,
	members: Pick<GroupMemberModel, 'slotIndex'>[],
	roundIndex: number
): { slotIndex: number; babNumbers: number[] }[] =>
	group.splitMode === 'FLEXIBLE'
		? Array.from({ length: partCountFor(group.kind) }, (_, slotIndex) => ({
				slotIndex,
				babNumbers: [slotIndex + 1]
		  }))
		: poolSlotIndexes(members, group.spots).map(slotIndex => ({
				slotIndex,
				babNumbers: babNumbersInRound(group, slotIndex, roundIndex)
		  }));

/**
 * Flattened `poolBlocks`. Write paths check a claim against it: `assignedUserId` is only ever
 * "volunteered for this bab out of the pool, this round", and requiring the bab to sit in this
 * round's pool as well means a claim that somehow outlived its seat being empty can never
 * grant a read outside the rotated share.
 */
export const poolBabNumbers = (
	group: PlanShape,
	members: Pick<GroupMemberModel, 'slotIndex'>[],
	roundIndex: number
): number[] => poolBlocks(group, members, roundIndex).flatMap(block => block.babNumbers);

export interface UnitPlan {
	/** 100 for a Cevşen group, 30 for a hatim, 33 for a Hizb group. */
	unitCount: number;
	/** The units this member reads in the round the plan was built for. */
	unitsFor: (userId: string) => number[];
	/** Units nobody is reading this round — the shared pool. */
	poolUnits: number[];
	/** Who owes a unit this round, or `null` if it is in the pool. */
	holderOf: (unitNumber: number) => string | null;
}

type PlanGroup = Pick<Group, 'kind' | 'spots' | 'splitMode'>;
type PlanMember = Pick<GroupMember, 'slotIndex' | 'userId'>;
/**
 * `isLoan` rides along because the **havuz is not just what nobody holds**: a cüz borrowed
 * out of it this round is still part of it — it is what the Havuz row counts and what the
 * screen lists so it can be handed back. Without it the row vanished once the last free cüz
 * was borrowed, taking the only way to undo the loan with it.
 */
export type PlanHolding = Pick<CuzHolding, 'cuzNumber' | 'isLoan' | 'userId'>;

/**
 * Who reads what, this round — asked once, answered the same way for both reading types.
 *
 * **The seam.** A Cevşen group divides a hundred babs by *seat*: nothing stores who reads
 * what, and a share is derived from `slotIndex` plus the round (see the rotation rules in
 * CLAUDE.md). A hatim divides thirty cüz by *choice*: a member holds `7 · 22`, numbers that
 * are not contiguous, cannot be derived from anything, and change between rounds — so they
 * are stored, one `CuzHolding` row each. Neither rule can be expressed in the other's terms.
 *
 * What the two *do* share is the three questions every screen and every write path asks:
 * how many units are there, which of them are mine, and which belong to nobody. This
 * resolves those three against whichever group is in hand, so the services above can stop
 * branching on `kind` and stop reaching for the seat helpers directly.
 *
 * **Holdings are a required argument, not an optional one, and that is the point.** A hatim
 * resolved without them would report an empty share and an entirely free pool — wrong in the
 * quiet way, with no error anywhere. Making the parameter mandatory puts the compiler in
 * front of every call site instead. They are *not* an `include` on the group query: a
 * `CuzHolding` is keyed per round, so a group a year into daily rounds carries thousands of
 * rows, and a relation filter cannot reference `Group.roundIndex` from the same query.
 * `holdingsFor` below is the scoped read, one index lookup.
 */

/**
 * `roundIndex` is nullable for the same reason `babNumbersInRound` takes it that way: a
 * group still GATHERING has no round, and a seat's share there is its own standing block.
 *
 * **Only a hatim reads holdings.** A Hizb group is seat-based like the Cevşen (33 portions
 * split by `unitCountFor`), so it takes the seat branch; its pool of single portions and its
 * personal plans live in `pool.service` and `hizbReading.service`.
 * A gathering hatim has no holdings for a round that hasn't started either, so whatever
 * has been picked already is what it reports — which is exactly what QJ2's picker needs.
 */
export const resolveUnitPlan = ({
	group,
	holdings,
	members,
	roundIndex
}: {
	group: PlanGroup;
	holdings: PlanHolding[];
	members: PlanMember[];
	roundIndex: number | null;
}): UnitPlan => {
	const unitCount = unitCountFor(group);

	if (group.kind === 'HATIM') {
		const byNumber = new Map(holdings.map(holding => [holding.cuzNumber, holding.userId]));

		return {
			holderOf: unitNumber => byNumber.get(unitNumber) ?? null,
			poolUnits: Array.from({ length: unitCount }, (_, index) => index + 1).filter(
				cuzNumber => !byNumber.has(cuzNumber)
			),
			unitCount,
			unitsFor: userId => holdings.filter(holding => holding.userId === userId).map(holding => holding.cuzNumber)
		};
	}

	const slotByUnit = new Map<number, number>();

	for (const member of members) {
		for (const babNumber of babNumbersInRound(group, member.slotIndex, roundIndex)) {
			slotByUnit.set(babNumber, member.slotIndex);
		}
	}

	const userBySlot = new Map(members.map(member => [member.slotIndex, member.userId]));

	return {
		holderOf: unitNumber => {
			const slotIndex = slotByUnit.get(unitNumber);

			return slotIndex === undefined ? null : userBySlot.get(slotIndex) ?? null;
		},
		/*
		 * An empty seat leaves uncovered the block it would have been *reading*, which under
		 * ROTATION is not its own — `poolBabNumbers` is the one place that rule lives.
		 *
		 * **`?? 0`, not an empty pool.** A gathering group has no round, and every serializer
		 * that asks about its pool asks as of round 0 — the invite preview's "N babs free" is
		 * exactly that question, put to a group nobody has started. Answering `[]` here would
		 * have made a group with nineteen empty seats look fully covered.
		 */
		poolUnits: poolBabNumbers(group, members, roundIndex ?? 0),
		unitCount,
		unitsFor: userId => {
			const member = members.find(candidate => candidate.userId === userId);

			return member ? babNumbersInRound(group, member.slotIndex, roundIndex) : [];
		}
	};
};

/**
 * The holdings a plan needs, read on their own index.
 *
 * A Cevşen group never has any, so this answers `[]` without a query — the seam is meant to
 * cost the hundred nothing. Takes a client so it can run inside a caller's transaction,
 * where every read-state write already lives.
 */
/**
 * Holdings for a whole shelf of groups, in one query, keyed by group id.
 *
 * The list endpoints serialize twenty groups at a time, so asking per group would be twenty
 * round trips to answer a question most of them (every Cevşen group) don't have. Hatim
 * groups are selected out first, and a shelf with none does no query at all. Each group is
 * asked about **its own** current round, which is why the `where` is a list of pairs rather
 * than one `roundIndex`.
 */
export const holdingsByGroupFor = async (
	client: Pick<PrismaClient, 'cuzHolding'>,
	groups: Pick<Group, 'id' | 'kind' | 'roundIndex'>[]
): Promise<Map<string, PlanHolding[]>> => {
	const hatims = groups.filter(group => group.kind === 'HATIM');
	const byGroupId = new Map<string, PlanHolding[]>();

	if (hatims.length === 0) {
		return byGroupId;
	}

	const rows = await client.cuzHolding.findMany({
		select: { cuzNumber: true, groupId: true, isLoan: true, userId: true },
		where: { OR: hatims.map(group => ({ groupId: group.id, roundIndex: group.roundIndex })) }
	});

	for (const row of rows) {
		const existing = byGroupId.get(row.groupId);

		if (existing) {
			existing.push(row);
		} else {
			byGroupId.set(row.groupId, [row]);
		}
	}

	return byGroupId;
};

export const holdingsFor = async (
	client: Pick<PrismaClient, 'cuzHolding'>,
	group: Pick<Group, 'id' | 'kind'>,
	roundIndex: number
): Promise<PlanHolding[]> =>
	group.kind === 'HATIM'
		? client.cuzHolding.findMany({
				select: { cuzNumber: true, isLoan: true, userId: true },
				where: { groupId: group.id, roundIndex }
		  })
		: [];
