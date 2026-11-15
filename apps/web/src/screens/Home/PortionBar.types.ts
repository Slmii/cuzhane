export interface PortionBarProps {
	/** One segment per unit, the first `filled` of them in the accent. */
	segments?: { total: number; filled: number };
	/** A single bar filled to this share (0–1) — used when `segments` is absent. */
	fraction?: number;
}
