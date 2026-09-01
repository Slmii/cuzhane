import { AppButton } from '@/components/ui/Button/Button.component';
import { StyleSheet } from 'react-native';
import type { SocialAuthButtonProps } from './SocialAuthButton.types';

/**
 * Sign in with Google or Apple — an `AppButton`, so it takes the platform's glass where there
 * is one and the drawn button everywhere else, exactly like every other button in the app.
 *
 * **The brand marks are gone for now, and that is a real cost.** Both Google's and Apple's
 * sign-in guidelines call for their mark on the button, and neither could survive the move:
 * `AppButton`'s `icon` takes an `IconName` from our own set, which is stroke-only and inherits
 * `currentColor`, while Google's G is four-colour artwork and Apple's is `U+F8FF`, a font glyph
 * with no drawing behind it. Putting them back means teaching the icon set about brand artwork —
 * or dropping to a hand-rolled button again, which is what this used to be.
 *
 * `surface` by default, so neither reads as the primary of the pair — Apple's near-black fill
 * went with the marks, and the side-by-side compact row on the sign-up screen already implied
 * two of equal weight. A caller can override it.
 *
 * Apple's mark is back on the platforms that can draw it, as `systemIcon='apple.logo'` from the
 * call site: it is a stock SF Symbol, so it needs none of our own artwork. Google has no
 * equivalent and stays wordmark-only.
 */
export const SocialAuthButton = ({
	isCompact = false,
	isLoading = false,
	label,
	variant = 'surface',
	onPress,
	style,
	systemIcon,
	imageIcon
}: SocialAuthButtonProps) => (
	<AppButton
		/*
		 * **Always full width, compact included** — it is `flex: 1` that makes the compact pair
		 * half a row each, not the button hugging its label.
		 *
		 * `fullWidth={false}` was wrong here and visibly so: it makes a glass button measure its
		 * own width and report it back, which overrides the `flex: 1` beside it — so the two sat
		 * as small pills floating in the middle of the row instead of filling it. Full width
		 * takes the width the parent gives, which is exactly half the row minus the gap.
		 */
		fullWidth
		isLoading={isLoading}
		onPress={onPress}
		style={[isCompact ? styles.compact : null, style]}
		title={label}
		variant={variant}
		{...(imageIcon === undefined ? {} : { imageIcon })}
		{...(systemIcon === undefined ? {} : { systemIcon })}
	/>
);

const styles = StyleSheet.create({
	compact: {
		flex: 1
	}
});
