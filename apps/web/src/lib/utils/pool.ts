import type { PoolSlot, PoolSlotPart } from '@/lib/types/domain';
import type { HizbBoardCell } from '@/lib/utils/groups';

/**
 * The optimistic halves of the four pool writes — a whole slot or one Hizb portion, taken or
 * handed back. **All four go through `changeParts`**, so a slot's parts and its slot-level
 * fields always move together: a whole-slot take that left the parts looking free would have a
 * portion write, arriving before the refetch, rebuild the slot from those stale parts and wipe
 * the claim.
 */

/**
 * A slot whose `takenBy*` and read fields follow its parts again: the first held part names the
 * slot, which is how `listPoolSlotsForUser` builds it on the server. Recomputed rather than
 * patched, so a portion taken or released in the middle of a block leaves the slot saying what
 * the next fetch will say.
 */
const withParts = (slot: PoolSlot, parts: PoolSlotPart[]): PoolSlot => {
	const holder = parts.find(part => part.takenByUserId !== null);
	const read = parts.filter(part => part.isRead).map(part => part.number);

	return {
		...slot,
		parts,
		readBabNumbers: read,
		readCount: read.length,
		takenByDisplayName: holder?.takenByDisplayName ?? null,
		takenByImageUrl: holder?.takenByImageUrl ?? null,
		takenByMe: holder?.takenByMe ?? false,
		takenByUserId: holder?.takenByUserId ?? null
	};
};

/** Applies `change` to every part `select` picks; a slot with nothing picked is returned as it was. */
const changeParts = (
	slots: PoolSlot[],
	select: (part: PoolSlotPart, slot: PoolSlot) => boolean,
	change: (part: PoolSlotPart) => PoolSlotPart
): PoolSlot[] =>
	slots.map(slot =>
		slot.parts.some(part => select(part, slot))
			? withParts(
					slot,
					slot.parts.map(part => (select(part, slot) ? change(part) : part))
			  )
			: slot
	);

/**
 * A part the viewer now holds. Their name and photo are left to the refetch, as they always
 * were — `takenByMe` is what a screen draws the viewer's claim from.
 */
const heldBy =
	(viewerUserId: string) =>
	(part: PoolSlotPart): PoolSlotPart => ({
		...part,
		takenByDisplayName: null,
		takenByImageUrl: null,
		takenByMe: true,
		takenByUserId: viewerUserId
	});

/**
 * A part handed back, and the read with it — both release paths take the caller's read off
 * along with the claim. Nobody else can have read a part the viewer holds: it is in no one's
 * share, and marking a pool part is what claims it, so a read on it is the viewer's.
 */
const handedBack = (part: PoolSlotPart): PoolSlotPart => ({
	...part,
	isRead: false,
	takenByDisplayName: null,
	takenByImageUrl: null,
	takenByMe: false,
	takenByUserId: null
});

// Only a free part changes hands, which is the server's own conditional update: a part somebody
// already holds stays theirs, the write comes back 409, and the rollback has nothing to undo.
const isFree = (part: PoolSlotPart) => part.takenByUserId === null;
// Only the caller's own claim comes off; a release of somebody else's is left as it is.
const isMine = (part: PoolSlotPart) => part.takenByMe;

/**
 * `useTakePoolSlot`: the slot's free parts become the viewer's. "Whole" means whatever of it is
 * still free — in a Hizb block somebody may already hold a portion — exactly as
 * `takePoolSlotForUser` claims it.
 */
export const withPoolSlotTaken = (slots: PoolSlot[], slotIndex: number, viewerUserId: string): PoolSlot[] =>
	changeParts(slots, (part, slot) => slot.slotIndex === slotIndex && isFree(part), heldBy(viewerUserId));

/** `useReleasePoolSlot`: every part of the slot the viewer holds goes back, with their reads. */
export const withPoolSlotReleased = (slots: PoolSlot[], slotIndex: number): PoolSlot[] =>
	changeParts(slots, (part, slot) => slot.slotIndex === slotIndex && isMine(part), handedBack);

/** `useTakePoolPart`: one free Hizb portion becomes the viewer's. */
export const withPoolPartTaken = (slots: PoolSlot[], number: number, viewerUserId: string): PoolSlot[] =>
	changeParts(slots, part => part.number === number && isFree(part), heldBy(viewerUserId));

/** `useReleasePoolPart`: one of the viewer's portions goes back, with their read of it. */
export const withPoolPartReleased = (slots: PoolSlot[], number: number): PoolSlot[] =>
	changeParts(slots, part => part.number === number && isMine(part), handedBack);

/**
 * The Havuz lattice (HZ3): the whole book as the board draws it, with every pool portion read
 * off the pool query instead.
 *
 * The pool cache is the one the take and release write optimistically; the board and the group
 * catch up only on the refetch. Drawn from the board alone, a portion taken here would sit
 * hatched for a round trip and then fill — so the pool's parts win wherever they speak, and the
 * cell changes colour on the tap. Everything outside the pool is the seats', and stays the
 * board's.
 */
export const hizbPoolCells = (cells: HizbBoardCell[], slots: PoolSlot[]): HizbBoardCell[] => {
	const parts = new Map(slots.flatMap(slot => slot.parts.map(part => [part.number, part] as const)));

	return cells.map(cell => {
		const part = parts.get(cell.number);

		return part === undefined
			? cell
			: {
					isMine: part.takenByMe,
					number: cell.number,
					state: part.isRead ? 'read' : part.takenByUserId === null ? 'pool' : 'taken'
			  };
	});
};

/** A row of HZ3's list: a portion on offer, or one the viewer has just taken and can hand back. */
export type HizbPoolRow = { number: number; isMine: boolean };

/**
 * HZ3's list, in portion order: every portion still free, and the ones the viewer took in this
 * session, which stay in the row they were taken from — with "Geri al" where "Üstlen" was —
 * rather than jumping out of the list under the thumb that took them.
 *
 * A claim from before this session is not a row. It is the viewer's work now, other members can
 * see it, and the board above already rings it.
 */
export const hizbPoolRows = (slots: PoolSlot[], takenHere: ReadonlySet<number>): HizbPoolRow[] =>
	slots
		.flatMap(slot => slot.parts)
		.filter(part => part.takenByUserId === null || (part.takenByMe && takenHere.has(part.number)))
		.map(part => ({ isMine: part.takenByMe, number: part.number }))
		.sort((a, b) => a.number - b.number);
