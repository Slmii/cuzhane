export interface JoinByCodeSheetProps {
	isVisible: boolean;
	/** Fired on dismiss and after a successful join, once the sheet has cleared itself. */
	onClose: () => void;
}
