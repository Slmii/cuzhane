import { HIZB_WORKS, type HizbWork } from '@/lib/content/hizbPortions';
import type { GroupBab, GroupDetail, GroupMember } from '@/lib/types/domain';
import { hizbBoardCells, type HizbBoardCell } from '@/lib/utils/groups';

/** One of the Fihrist's rows (HZ2): a portion, what the board says of it, and who has it. */
export type HizbIndexRow = HizbBoardCell & {
	/**
	 * Who holds the portion this round. Null for the viewer's own — the screen says "Sen" off
	 * `isMine` — for a pool portion nobody has claimed, and for a holder the member list cannot
	 * name, which it says nothing about rather than guessing.
	 */
	holderName: string | null;
};

/** One work's card: its portions in order, and how many of them the group has read. */
export type HizbIndexWork = {
	work: HizbWork;
	rows: HizbIndexRow[];
	readCount: number;
};

/**
 * The Fihrist, work by work.
 *
 * **Who holds a portion is derived, never read off a column** — the rule every other surface
 * keeps. A seat's portions this round are the member's `babNumbers`, which the server has
 * already rotated; a portion of an empty seat belongs to whoever volunteered for it out of the
 * pool, which is what `assignedUserId` means and all it means. So the pool is asked first
 * (`poolAllBabNumbers`, claimed parts included) and the seats second, and a claim stranded on a
 * portion some seat now holds is ignored the way the Havuz screen ignores it.
 *
 * The state and the ring are `hizbBoardCells`' own, so a row can never say "Okundu" beside a
 * tile the board would paint as taken.
 */
export const hizbIndexWorks = (
	babs: GroupBab[],
	group: Pick<GroupDetail, 'myBabNumbers' | 'poolAllBabNumbers' | 'poolBabNumbers'> & {
		members: Pick<GroupMember, 'babNumbers' | 'displayName' | 'userId'>[];
	}
): HizbIndexWork[] => {
	const cells = new Map(hizbBoardCells(babs, group).map(cell => [cell.number, cell]));
	const claimers = new Map(babs.map(bab => [bab.number, bab.assignedUserId]));
	const pool = new Set(group.poolAllBabNumbers);
	const nameByUserId = new Map(group.members.map(member => [member.userId, member.displayName]));
	const seatHolderByNumber = new Map(
		group.members.flatMap(member => member.babNumbers.map(number => [number, member.displayName] as const))
	);

	const holderOf = (cell: HizbBoardCell): string | null => {
		if (cell.isMine) {
			return null;
		}

		if (pool.has(cell.number)) {
			const claimer = claimers.get(cell.number) ?? null;

			return claimer === null ? null : nameByUserId.get(claimer) ?? null;
		}

		return seatHolderByNumber.get(cell.number) ?? null;
	};

	return HIZB_WORKS.map(work => {
		const rows: HizbIndexRow[] = [];

		for (let number = work.parts[0]; number <= work.parts[1]; number += 1) {
			const cell = cells.get(number);

			if (cell) {
				rows.push({ ...cell, holderName: holderOf(cell) });
			}
		}

		return { readCount: rows.filter(row => row.state === 'read').length, rows, work };
	});
};
