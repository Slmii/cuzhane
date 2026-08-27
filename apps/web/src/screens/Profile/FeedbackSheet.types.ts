export interface FeedbackSheetProps {
	isVisible: boolean;
	onClose: () => void;
	/**
	 * What the build knows about itself. Sent with every message and never shown in the
	 * form — the design removed the diagnostics toggle precisely because attaching them
	 * was never a choice worth putting to the sender.
	 */
	appVersion?: string;
	platform?: string;
	locale?: string;
}
