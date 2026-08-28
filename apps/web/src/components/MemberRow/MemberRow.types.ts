import type { StyleProp, ViewStyle } from 'react-native';

export interface MemberRowProps {
	name: string;
	/** The member's own photo, when they have one. Falls back to the generated avatar. */
	imageUrl?: string | null;
	/** "you" / "owner" pill next to the name. */
	tag?: string;
	rangeLabel: string;
	percent: number;
	cheerLabel?: string;
	isCheered?: boolean;
	onCheer?: () => void;
	/** Only supplied to the owner, and never for their own row. */
	onRemove?: () => void;
	style?: StyleProp<ViewStyle>;
}
