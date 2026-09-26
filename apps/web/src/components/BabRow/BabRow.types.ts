import type { StyleProp, ViewStyle } from 'react-native';

export interface BabRowProps {
	title: string;
	subtitle: string;
	isRead: boolean;
	/**
	 * Read, but by **somebody else** — so the tick is a fact about the group rather than a
	 * control you own.
	 *
	 * A bab in your share can already be read by whoever held that block on an earlier
	 * rotation day, and the server refuses an undo from anyone but the reader. Without this
	 * the row drew your own ticked checkbox over their work and offered a toggle that
	 * silently did nothing. Marked and not pressable instead.
	 */
	isReadByOthers?: boolean;
	onToggle: () => void;
	/**
	 * Read out after the checkbox's label — for a row whose box does something other than tick,
	 * such as the Hizb's Sekine opening the reader until its repetitions are in.
	 */
	accessibilityHint?: string;
	onOpen: () => void;
	openLabel: string;
	style?: StyleProp<ViewStyle>;
}
