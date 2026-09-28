import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface MiniGridProps {
	/** Rendered once the grid has measured itself, with the size every cell should be. */
	children: (cellSize: number) => ReactNode;
	columns: number;
	gap: number;
	style?: StyleProp<ViewStyle>;
}
