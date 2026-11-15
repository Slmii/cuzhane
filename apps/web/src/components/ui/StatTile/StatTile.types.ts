import type { StyleProp, ViewStyle } from 'react-native';

export type StatTileTone = 'default' | 'accent' | 'missed';

export interface StatTileProps {
	value: string | number;
	label: string;
	tone?: StatTileTone;
	style?: StyleProp<ViewStyle>;
	/** Forwarded to the underlying `CardSurface` — see `hasGlassSurface` there. */
	hasGlassSurface?: boolean;
}
