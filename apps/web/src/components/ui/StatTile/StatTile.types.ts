import type { StyleProp, ViewStyle } from 'react-native';

export type StatTileTone = 'default' | 'accent';

export interface StatTileProps {
	value: string | number;
	label: string;
	tone?: StatTileTone;
	style?: StyleProp<ViewStyle>;
}
