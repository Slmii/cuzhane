export interface JoinByCodeSheetProps {
	isVisible: boolean;
	/**
	 * The "+" menu's "Birlikte okumaya katıl": the same eight cells, asking only for a live
	 * reading's code, which goes straight to `LiveJoin` — no group lookup, no group preview.
	 */
	isLiveOnly?: boolean;
	/** Fired on dismiss and after a successful join, once the sheet has cleared itself. */
	onClose: () => void;
	/**
	 * A code the sheet opens on and looks up at once, instead of waiting to be typed — what a
	 * scanned QR hands over. Dashes and case are forgiven, as when pasted.
	 */
	initialCode?: string;
}
