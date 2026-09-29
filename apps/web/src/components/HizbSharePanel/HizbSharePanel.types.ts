import type { GroupBab } from '@/lib/types/domain';

export interface HizbSharePanelProps {
	groupId: string;
	/** The round in progress — a repeated portion's count is kept per round. */
	roundIndex: number;
	/** The viewer's share this round, pool claims included: the group's `myBabNumbers`. */
	partNumbers: number[];
	/**
	 * The board, for who has read what. Undefined while it loads — the rows are drawn from the
	 * share alone, and their checkboxes hold still until the board says what they are.
	 */
	babs: GroupBab[] | undefined;
	viewerUserId: string | null;
	/** "Oku" — and the checkbox of a portion whose repetitions aren't done yet. */
	onOpenPart: (partNumber: number) => void;
	onToggleRead: (partNumber: number, read: boolean) => void;
}
