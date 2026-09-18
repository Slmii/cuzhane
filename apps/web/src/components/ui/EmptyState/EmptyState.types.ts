import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { StyleProp, ViewStyle } from 'react-native';

export interface EmptyStateProps {
	title: string;
	/**
	 * A glyph on a tinted disc above the title. The notification inbox's empty state is drawn
	 * this way; a list that is empty *inside a sheet* has no room for one and omits it.
	 */
	icon?: IconName;
	description?: string;
	actionLabel?: string;
	onAction?: () => void;
	style?: StyleProp<ViewStyle>;
}
