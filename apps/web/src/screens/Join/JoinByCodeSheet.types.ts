export interface JoinByCodeSheetProps {
	isVisible: boolean;
	/** Fired on dismiss and after a successful join, once the sheet has cleared itself. */
	onClose: () => void;
	/**
	 * A code the sheet opens on and looks up at once, instead of waiting to be typed — what a
	 * scanned QR hands over. Dashes and case are forgiven, as when pasted.
	 */
	initialCode?: string;
}
