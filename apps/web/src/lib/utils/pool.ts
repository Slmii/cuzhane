import type { PoolSlot, PoolSlotPart } from '@/lib/types/domain';

/**
 * A slot whose `takenBy*` fields follow its parts again: the first held part names the slot,
 * which is how `listPoolSlotsForUser` builds it on the server. Recomputed rather than patched,
 * so a portion taken or released in the middle of a block leaves the slot saying what the next
 * fetch will say.
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

/**
 * The cached pool with one Hizb portion taken by the viewer — the optimistic half of
 * `useTakePoolPart`.
 *
 * Only a portion nobody holds changes hands, which is the server's own conditional update: a
 * portion somebody already has stays theirs, the request comes back 409, and the rollback has
 * nothing to undo. The viewer's name and photo are left to the refetch, as `useTakePoolSlot`
 * leaves them — `takenByMe` is what a screen draws the viewer's claim from.
 */
export const withPoolPartTaken = (slots: PoolSlot[], number: number, viewerUserId: string): PoolSlot[] =>
	slots.map(slot => {
		const target = slot.parts.find(part => part.number === number);

		if (!target || target.takenByUserId !== null) {
			return slot;
		}

		return withParts(
			slot,
			slot.parts.map(part =>
				part === target
					? {
							...part,
							takenByDisplayName: null,
							takenByImageUrl: null,
							takenByMe: true,
							takenByUserId: viewerUserId
					  }
					: part
			)
		);
	});

/**
 * The cached pool with one of the viewer's portions handed back — the optimistic half of
 * `useReleasePoolPart`.
 *
 * The read comes off with the claim, as `releasePoolPartForUser` takes it off. Nobody else can
 * have read a portion the viewer holds — it is in no one's share, and marking a pool portion is
 * what claims it — so a read on it is the viewer's. Somebody else's portion is left as it is,
 * which is what the server does with a release of a portion the caller does not hold.
 */
export const withPoolPartReleased = (slots: PoolSlot[], number: number): PoolSlot[] =>
	slots.map(slot => {
		const target = slot.parts.find(part => part.number === number);

		if (!target || !target.takenByMe) {
			return slot;
		}

		return withParts(
			slot,
			slot.parts.map(part =>
				part === target
					? {
							...part,
							isRead: false,
							takenByDisplayName: null,
							takenByImageUrl: null,
							takenByMe: false,
							takenByUserId: null
					  }
					: part
			)
		);
	});
