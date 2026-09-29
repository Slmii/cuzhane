import type { ReactNode } from 'react';

export interface RepetitionBoxProps {
	/** The repeated text; tapping it counts one. */
	children: ReactNode;
	count: number;
	/** How many make the reading markable. */
	target: number;
	/** The highest count the box goes to — the target itself, unless the target can change. */
	max: number;
	disabled: boolean;
	/** Called with the **absolute** count, so a retried write never counts one recitation twice. */
	onCountChange: (next: number) => void;
	/** The istighfar's "Kaç kez?" row and its 1–100 sheet. Only the reader's own target has one. */
	onTargetChange?: (next: number) => void;
	/** A line under the buttons — that a free reading's count is not saved. */
	note?: string;
}
