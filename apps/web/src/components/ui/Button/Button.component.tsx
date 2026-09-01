import { Icon } from '@/components/ui/Icon/Icon.component';
import { Typography } from '@/components/ui/Typography/Typography.component';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Image, Pressable, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { AppButtonProps, ButtonSize } from './Button.types';
import { GlassButton, hasSfSymbol, isGlassButtonAvailable } from './GlassButton';

const sizeStyleMap: Record<ButtonSize, ViewStyle> = {
	sm: {
		borderRadius: 11,
		minHeight: 36,
		paddingHorizontal: 15,
		paddingVertical: 9
	},
	md: {
		borderRadius: 13,
		minHeight: 46,
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	lg: {
		borderRadius: 15,
		minHeight: 54,
		paddingHorizontal: 18,
		paddingVertical: 17
	}
};

/**
 * A glyph with no label is a **circle**: a square box with a radius of half its side.
 *
 * The sizes above are shaped for a word — a rounded rectangle, padded either side of the label —
 * and a glyph dropped into one comes out as a rounded square slightly wider than it is tall,
 * which is what the create-group header showed on Android. iOS is not affected because a
 * label-less glass button already takes `buttonBorderShape('capsule')`, and a capsule around a
 * square box *is* a circle; this is the drawn path saying the same thing.
 *
 * Sides match each size's `minHeight`, so the two paths come out the same size as well as the
 * same shape. Applied after the inline block below, because that block writes `width` — an
 * explicit `undefined` there would otherwise erase the one set here.
 */
const iconOnlySizeStyleMap: Record<ButtonSize, ViewStyle> = {
	sm: { borderRadius: 18, height: 36, paddingHorizontal: 0, width: 36 },
	md: { borderRadius: 23, height: 46, paddingHorizontal: 0, width: 46 },
	lg: { borderRadius: 27, height: 54, paddingHorizontal: 0, width: 54 }
};

/**
 * **Mirrored as `LABEL_SIZE_BY_SIZE` in `GlassButton.tsx` — change both together.** A SwiftUI
 * `Text` is 17pt unless told otherwise, so the glass button has to be handed these or the same
 * button renders at two different sizes depending on the platform.
 */
const labelSizeStyleMap: Record<ButtonSize, TextStyle> = {
	sm: { fontSize: 12, lineHeight: 16 },
	md: { fontSize: 12.5, lineHeight: 17 },
	lg: { fontSize: 13.5, lineHeight: 18 }
};

/**
 * A shade above the label so the glyph reads as its equal, not as punctuation.
 *
 * **Mirrored as `ICON_SIZE_BY_SIZE` in `GlassButton.tsx` — change both together.** An SF Symbol
 * sizes off its label unless told otherwise, and the two buttons have to agree or the same
 * button looks like two different controls depending on the platform.
 */
const iconSizeMap: Record<ButtonSize, number> = {
	sm: 13,
	md: 14,
	lg: 15
};

export const AppButton = ({
	accessibilityLabel,
	disabled = false,
	fullWidth = true,
	icon,
	iconPosition = 'leading',
	imageIcon,
	isLoading = false,
	onPress,
	size = 'lg',
	style,
	systemIcon,
	title,
	variant = 'primary'
}: AppButtonProps) => {
	const { theme } = useThemeContext();

	/*
	 * **The one place that decides**, and it decides for every button in the app: glass where
	 * the platform has it, this drawn button where it doesn't. No call site carries a platform
	 * check, the way `ui/Switch` and `ui/SegmentedControl` already work.
	 *
	 * **An icon only disqualifies it if the glyph cannot come along.** Our set is traced SVG and
	 * a SwiftUI button wants an SF Symbol, so `GlassButton` keeps a map of the ones with a stock
	 * equivalent; an icon outside it sends the whole button back here, glyph intact. Losing a
	 * glyph is worse than losing a material, so the material is what gives way.
	 *
	 * **A hugging glass button must not be swapped for a different one.** Given a width by its
	 * parent a glass button simply fills it, but `fullWidth={false}` makes it a SwiftUI host that
	 * lays out natively and reports its own width back into the React Native tree a frame or two
	 * later. Mount a *new* one in place of another and that measurement starts from nothing: the
	 * pool screen's "Üstlen" becoming "↩ Geri al" spilled past the card's right edge and snapped
	 * back. Keeping one element in one place and changing its props re-measures without the
	 * remount, which is what that screen now does.
	 *
	 * `systemIcon` is glass-only and needs no gate here: it names a stock SF Symbol, which the
	 * drawn button below has no way to render and simply ignores.
	 *
	 * `isLoading` folds into `disabled` rather than being lost. This button never had a spinner —
	 * it dims to 0.45 and stops responding, and that dimming *is* the feedback — which is exactly
	 * what SwiftUI's own disabled state does.
	 */
	if (isGlassButtonAvailable && (icon === undefined || hasSfSymbol(icon))) {
		return (
			<GlassButton
				disabled={disabled || isLoading}
				{...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
				fullWidth={fullWidth}
				iconPosition={iconPosition}
				onPress={onPress}
				size={size}
				style={style}
				title={title}
				variant={variant}
				{...(icon === undefined ? {} : { icon })}
				{...(imageIcon === undefined ? {} : { imageIcon })}
				{...(systemIcon === undefined ? {} : { systemIcon })}
			/>
		);
	}

	const toneByVariant = {
		primary: {
			backgroundColor: theme.colors.primary,
			borderColor: theme.colors.primary,
			textColor: theme.colors.onPrimary
		},
		accent: {
			backgroundColor: theme.colors.accent,
			borderColor: theme.colors.accent,
			textColor: theme.colors.onAccent
		},
		accentOutline: {
			backgroundColor: theme.colors.transparent,
			borderColor: theme.colors.accent,
			textColor: theme.colors.accent
		},
		surface: {
			backgroundColor: theme.colors.surface,
			borderColor: theme.colors.borderStrong,
			textColor: theme.colors.text
		},
		danger: {
			backgroundColor: theme.colors.surface,
			borderColor: theme.colors.danger,
			textColor: theme.colors.danger
		},
		dangerFilled: {
			backgroundColor: theme.colors.danger,
			borderColor: theme.colors.danger,
			textColor: theme.colors.onDanger
		},
		ghost: {
			backgroundColor: theme.colors.transparent,
			borderColor: theme.colors.transparent,
			textColor: theme.colors.subtext
		}
	}[variant];

	/*
	 * One element, placed either side of the label. Artwork wins over an `icon` only in the
	 * sense that it is checked first — no caller passes both, and a brand mark is never
	 * something the icon set could stand in for.
	 */
	const drawnGlyph =
		imageIcon !== undefined ? (
			// `contain`, so a square mark keeps its aspect at whatever the size map says.
			<Image
				resizeMode='contain'
				source={imageIcon}
				style={{ height: iconSizeMap[size], width: iconSizeMap[size] }}
			/>
		) : icon !== undefined ? (
			<Icon color={toneByVariant.textColor} name={icon} size={iconSizeMap[size]} strokeWidth={1.9} />
		) : null;

	/* A glyph standing on its own, which is a circle rather than a padded rounded rectangle. A
	   button with neither a label nor a glyph keeps the ordinary box — there is nothing to
	   centre in a disc, and it is a caller's mistake rather than a shape to design for. */
	const isIconOnly = title === undefined && drawnGlyph !== null;

	return (
		<Pressable
			accessibilityLabel={accessibilityLabel ?? title}
			accessibilityRole='button'
			disabled={disabled || isLoading}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				sizeStyleMap[size],
				{
					backgroundColor: toneByVariant.backgroundColor,
					borderColor: toneByVariant.borderColor,
					opacity: disabled || isLoading ? 0.45 : pressed ? 0.86 : 1,
					// Every button in the design dips slightly on press.
					transform: [{ scale: pressed && !disabled && !isLoading ? 0.96 : 1 }],
					width: fullWidth ? '100%' : undefined
				},
				// After the block above, which writes `width` — see the note on the map.
				isIconOnly ? iconOnlySizeStyleMap[size] : null,
				style
			]}
		>
			{/*
			 * `isLoading` dims the button to 0.45 and blocks the press — that dimming *is* the
			 * feedback. There is deliberately no spinner: the app shows waiting as a skeleton
			 * or a sheet, and a spinner here would be the one place that still contradicted it.
			 * The label stays put so the button keeps its width and nothing reflows.
			 */}
			{/* The icon leads the label, in the label's own colour — the row's `gap` already
			    spaces it. A confirmation like "Yapıştırıldı" is a tick and a word, and the tick
			    has to be the icon set's, never a ✓ typed into the string. */}
			{drawnGlyph && iconPosition === 'leading' ? drawnGlyph : null}
			{/* Omitted entirely on a glyph-only button, rather than rendered empty: an empty
			    `Typography` still claims a line's height and would stretch the button. */}
			{title === undefined ? null : (
				<Typography color={toneByVariant.textColor} style={labelSizeStyleMap[size]} variant='bodyStrong'>
					{title}
				</Typography>
			)}
			{drawnGlyph && iconPosition === 'trailing' ? drawnGlyph : null}
		</Pressable>
	);
};

const styles = StyleSheet.create({
	button: {
		alignItems: 'center',
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 8,
		justifyContent: 'center'
	}
});
