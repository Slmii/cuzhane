import type { StyleProp, ViewStyle } from 'react-native';

export interface CuzPickerProps {
	/** Cüz somebody else already holds — untappable. Empty while creating a group. */
	takenNumbers: number[];
	/** The viewer's current selection. */
	selectedNumbers: number[];
	/** Null when there is no cap, which is QC2's default. */
	maxSelectable: number | null;
	onToggle: (cuzNumber: number) => void;
	style?: StyleProp<ViewStyle>;
}
