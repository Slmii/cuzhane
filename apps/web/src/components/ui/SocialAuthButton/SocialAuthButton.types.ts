import { ButtonVariant } from '@/components/ui/Button/Button.types';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

export interface SocialAuthButtonProps {
	label: string;
	onPress: () => void;
	/** Half-width variant used on the sign-up screen's side-by-side row. */
	isCompact?: boolean;
	isLoading?: boolean;
	variant?: ButtonVariant;
	/**
	 * A stock SF Symbol beside the label, on the platforms that have one. Apple's `apple.logo`
	 * is the only mark of the two that exists as a symbol — Google's is four-colour artwork —
	 * so this is named per call site rather than derived from a provider.
	 */
	systemIcon?: SFSymbol;
	/** Brand artwork beside the label — Google's four-colour G. See `AppButton`'s own prop. */
	imageIcon?: ImageSourcePropType;
	style?: StyleProp<ViewStyle>;
}
