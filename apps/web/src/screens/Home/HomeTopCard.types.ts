import type { ReactNode } from 'react';

export interface HomeTopCardProps {
	children: ReactNode;
	/** "Sıradaki" opens the reading from anywhere on the card; the others are not links. */
	onPress?: () => void;
}
