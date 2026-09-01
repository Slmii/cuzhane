import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

/**
 * `accentOutline` is the accent hairline over no fill — the round detail's "Üstlen",
 * which sits beside a filled "Okudum" and must read as the lesser of the two claims.
 */
/**
 * `danger` is the outlined destructive button; `dangerFilled` is the same colour as a fill —
 * the design uses the filled one where leaving or deleting *is* the screen's action rather than
 * one option among several.
 */
export type ButtonVariant = 'primary' | 'accent' | 'accentOutline' | 'surface' | 'danger' | 'dangerFilled' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface AppButtonBaseProps {
	onPress: () => void;
	/**
	 * What a screen reader announces instead of the label. For a button whose word only makes
	 * sense beside something else — an "Oku" in a list of groups, where the row it belongs to is
	 * the missing half of the sentence.
	 */
	accessibilityLabel?: string;
	/**
	 * Optional glyph before the label — the tick on a "copied" / "pasted" confirmation.
	 * Hidden while loading, since the spinner replaces the whole content.
	 */
	icon?: IconName;
	/**
	 * A stock SF Symbol, for a glyph that exists **only** on the platform — Apple's logo on the
	 * sign-in button being the case this was added for.
	 *
	 * Deliberately not an `IconName`. Our set is exhaustive (`GLYPHS` is a
	 * `Record<IconName, Glyph>`), so a name added there must be drawn as well, and Apple's mark
	 * is not ours to draw. It therefore renders on the glass path and nowhere else: the drawn
	 * button ignores this, and the label carries the button on its own. `icon` wins if both are
	 * given, since ours is the one that works everywhere.
	 */
	systemIcon?: SFSymbol;
	/**
	 * Artwork beside the label, for a mark that is neither ours nor Apple's — Google's
	 * four-colour G on the sign-in button being the case this was added for.
	 *
	 * Neither `icon` nor `systemIcon` can carry it: our set is stroke-only and inherits
	 * `currentColor`, and an SF Symbol is a single-colour template. A brand mark has to stay a
	 * picture, so it ships as a PNG and renders unchanged on both paths.
	 */
	imageIcon?: ImageSourcePropType;
	/**
	 * Which side of the label the glyph sits on. Leading by default, because a glyph usually
	 * qualifies the word it precedes — a tick before "Kopyalandı". `trailing` is for the few
	 * where the icon points at what happens next rather than labelling it: "Sonraki ›" reads
	 * backwards with the chevron in front of it.
	 */
	iconPosition?: 'leading' | 'trailing';
	variant?: ButtonVariant;
	size?: ButtonSize;
	style?: StyleProp<ViewStyle>;
	disabled?: boolean;
	fullWidth?: boolean;
	isLoading?: boolean;
}

/**
 * A button with a word on it, which is nearly all of them.
 */
type LabelledButtonProps = AppButtonBaseProps & { title: string };

/**
 * **A button that is only a glyph** — the reader's ± one bab arrows, which sit either side of
 * "Okudum" and have no room for a word.
 *
 * The union exists to make the accessible name unskippable: with no `title` there is nothing for
 * `accessibilityLabel` to fall back to, so it is required here and optional above. `icon` is
 * required for the same reason in reverse — a button with neither a label nor a glyph would
 * render as an empty box.
 *
 * Whether it can still be glass is decided as it is for any other icon: `GlassButton` carries a
 * map of the glyphs with an SF Symbol, and one outside it sends the whole button to the drawn
 * path. Both chevrons are in that map.
 */
type GlyphOnlyButtonProps = AppButtonBaseProps & {
	title?: undefined;
	icon: IconName;
	accessibilityLabel: string;
};

export type AppButtonProps = LabelledButtonProps | GlyphOnlyButtonProps;
