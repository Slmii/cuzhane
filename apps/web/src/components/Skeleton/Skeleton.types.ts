import type { StyleProp, ViewStyle } from 'react-native';

export type SkeletonPulseProps = {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
};

/**
 * The design draws its bones in two weights — a darker one for what will become a heading,
 * a number or a control, and a lighter one for supporting text. Keeping the distinction is
 * most of what makes a skeleton read as the shape of a specific screen rather than as grey
 * soup, so it is a prop rather than something each caller re-picks.
 */
export type BoneTone = 'soft' | 'strong';

export type BoneProps = {
	/** Corner radius; defaults to the 5 the lattice placeholder uses. */
	radius?: number;
	height?: number;
	style?: StyleProp<ViewStyle>;
	tone?: BoneTone;
	width?: number | `${number}%`;
};
