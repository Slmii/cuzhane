import type { StyleProp, ViewStyle } from 'react-native';

export interface AvatarStackPerson {
	name: string;
	/** Their own photo, when they have one — it wins over the generated face, as on `Avatar`. */
	imageUrl: string | null;
}

export interface AvatarStackProps {
	people: AvatarStackPerson[];
	max?: number;
	size?: number;
	style?: StyleProp<ViewStyle>;
}
