import type { StyleProp, ViewStyle } from 'react-native';

export interface BackLinkProps {
	/**
	 * Overrides the default "Geri". The join previews name where the link goes ("Keşfet")
	 * because they can be opened cold from an invite link, where "back" would be a lie.
	 */
	label?: string;
	onPress: () => void;
	style?: StyleProp<ViewStyle>;
}
