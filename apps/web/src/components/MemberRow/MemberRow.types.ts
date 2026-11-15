import type { StyleProp, ViewStyle } from 'react-native';

/**
 * The remove affordance is a glyph with no label, so `AppButton` requires an
 * `accessibilityLabel` for it — and this pair is what carries that requirement out to the
 * caller instead of letting the row invent an empty string. Either both are given or neither is.
 */
export type MemberRowRemoveProps =
	| { onRemove?: undefined; removeLabel?: undefined }
	| { onRemove: () => void; removeLabel: string };

export type MemberRowProps = MemberRowRemoveProps & {
	name: string;
	/** The member's own photo, when they have one. Falls back to the generated avatar. */
	imageUrl?: string | null;
	/** A name hidden by the group: a lock in the avatar's place, as on the readers screen. */
	isAnonymous?: boolean;
	/** "you" / "owner" pill next to the name. */
	tag?: string;
	rangeLabel: string;
	percent: number;
	cheerLabel?: string;
	isCheered?: boolean;
	onCheer?: () => void;
	style?: StyleProp<ViewStyle>;
};
