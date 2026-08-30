import { useTranslation } from '@/lib/i18n/I18n.context';
import { appFonts } from '@/lib/theme/fonts';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { StyleSheet, Text, TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { ShortcutTextProps, TypographyProps, TypographyVariant, TypographyWeight } from './Typography.types';

/** Exported so a reserved-but-empty eyebrow slot can match a real one exactly. */
export const EYEBROW_LINE_HEIGHT = 14;

const variantStyleMap: Record<TypographyVariant, TextStyle> = {
	display: {
		fontSize: 40,
		lineHeight: 42
	},
	header1: {
		fontSize: 27,
		letterSpacing: -0.27,
		lineHeight: 31
	},
	header2: {
		fontSize: 23,
		letterSpacing: -0.2,
		lineHeight: 28
	},
	header3: {
		fontSize: 19,
		lineHeight: 24
	},
	title: {
		fontSize: 17,
		lineHeight: 22
	},
	numeric: {
		fontSize: 25,
		lineHeight: 28
	},
	eyebrow: {
		fontSize: 11,
		letterSpacing: 1.1,
		lineHeight: EYEBROW_LINE_HEIGHT,
		textTransform: 'uppercase'
	},
	fieldLabel: {
		fontSize: 11,
		letterSpacing: 0.55,
		lineHeight: 15,
		textTransform: 'uppercase'
	},
	body: {
		fontSize: 13.5,
		lineHeight: 21
	},
	bodyStrong: {
		fontSize: 13,
		lineHeight: 18
	},
	caption: {
		fontSize: 12,
		lineHeight: 17
	},
	stat: {
		fontSize: 10,
		letterSpacing: 0.6,
		lineHeight: 14,
		textTransform: 'uppercase'
	},
	mono: {
		fontSize: 11,
		lineHeight: 16
	}
};

// Newsreader carries every numeral and heading — it's what gives the design its
// "printed page" feel. Everything else is Manrope, and labels-as-data are mono.
const headingVariantSet = new Set<TypographyVariant>(['display', 'header1', 'header2', 'header3', 'title', 'numeric']);

const defaultWeightMap: Record<TypographyVariant, TypographyWeight> = {
	display: 'regular',
	header1: 'regular',
	header2: 'regular',
	header3: 'medium',
	title: 'medium',
	numeric: 'regular',
	eyebrow: 'medium',
	fieldLabel: 'semibold',
	body: 'regular',
	bodyStrong: 'semibold',
	caption: 'regular',
	stat: 'medium',
	mono: 'medium'
};

const weightStyleMap: Record<TypographyWeight, TextStyle> = {
	regular: { fontFamily: appFonts.regular },
	medium: { fontFamily: appFonts.medium },
	semibold: { fontFamily: appFonts.semibold },
	bold: { fontFamily: appFonts.bold }
};

// Newsreader ships 400/500/600 only — bold falls back to semibold rather than
// letting the platform synthesise a fake weight.
const headingWeightStyleMap: Record<TypographyWeight, TextStyle> = {
	regular: { fontFamily: appFonts.headingRegular },
	medium: { fontFamily: appFonts.headingMedium },
	semibold: { fontFamily: appFonts.headingSemibold },
	bold: { fontFamily: appFonts.headingSemibold }
};

const monoWeightStyleMap: Record<TypographyWeight, TextStyle> = {
	regular: { fontFamily: appFonts.mono },
	medium: { fontFamily: appFonts.monoMedium },
	semibold: { fontFamily: appFonts.monoMedium },
	bold: { fontFamily: appFonts.monoMedium }
};

const resolveFamilyStyle = (variant: TypographyVariant, weight: TypographyWeight) => {
	if (variant === 'mono') {
		return monoWeightStyleMap[weight];
	}

	return headingVariantSet.has(variant) ? headingWeightStyleMap[weight] : weightStyleMap[weight];
};

/**
 * `textTransform: 'uppercase'` uses the platform's default casing, which maps Turkish
 * "i" to "I" instead of "İ" — "kişi" comes out as "KIŞI". Pre-mapping the dotted i
 * fixes that and leaves the rest to the platform (dotless "ı" already uppercases to
 * "I", and the mapping is idempotent on text that is already uppercase).
 *
 * Only applied when the text is genuinely being uppercased: callers such as the tab
 * bar reuse an uppercase variant but override `textTransform` back to `none`, and
 * rewriting their lowercase "ı" would corrupt the label.
 */
const toTurkishUppercase = (value: string) => value.replace(/i/g, 'İ');

export const Typography = ({
	children,
	color,
	isAnimated,
	numberOfLines,
	onLongPress,
	style,
	suppressHighlighting,
	textAlign,
	variant = 'body',
	weight
}: TypographyProps) => {
	const { theme } = useThemeContext();
	const { language } = useTranslation();
	const resolvedWeight = weight ?? defaultWeightMap[variant];
	const overrideTransform = (StyleSheet.flatten(style) as TextStyle | undefined)?.textTransform;
	const isUppercased = (overrideTransform ?? variantStyleMap[variant].textTransform) === 'uppercase';
	const content =
		language === 'tr' && isUppercased && typeof children === 'string' ? toTurkishUppercase(children) : children;

	const composed = [
		styles.base,
		variantStyleMap[variant],
		resolveFamilyStyle(variant, resolvedWeight),
		{ color: color ?? theme.colors.text },
		textAlign ? { textAlign } : null,
		style
	];

	/*
	 * Animated text is opt-in and flattened. Reanimated reads CSS transition properties off
	 * the style object itself, so inside the array above they are only unknown keys — and a
	 * plain `Text` is not an animated component, so they would be inert either way.
	 */
	if (isAnimated) {
		return (
			<Animated.Text
				numberOfLines={numberOfLines}
				onLongPress={onLongPress}
				style={StyleSheet.flatten(composed)}
				suppressHighlighting={suppressHighlighting}
			>
				{content}
			</Animated.Text>
		);
	}

	return (
		<Text
			numberOfLines={numberOfLines}
			onLongPress={onLongPress}
			style={composed}
			suppressHighlighting={suppressHighlighting}
		>
			{content}
		</Text>
	);
};

export const DisplayText = (props: ShortcutTextProps) => <Typography {...props} variant='display' />;

export const Header1 = (props: ShortcutTextProps) => <Typography {...props} variant='header1' />;

export const Header2 = (props: ShortcutTextProps) => <Typography {...props} variant='header2' />;

export const Header3 = (props: ShortcutTextProps) => <Typography {...props} variant='header3' />;

export const TitleText = (props: ShortcutTextProps) => <Typography {...props} variant='title' />;

export const NumericText = (props: ShortcutTextProps) => <Typography {...props} variant='numeric' />;

export const EyebrowText = (props: ShortcutTextProps) => <Typography {...props} variant='eyebrow' />;

export const FieldLabelText = (props: ShortcutTextProps) => <Typography {...props} variant='fieldLabel' />;

export const BodyText = (props: ShortcutTextProps) => <Typography {...props} variant='body' />;

export const BodyStrongText = (props: ShortcutTextProps) => <Typography {...props} variant='bodyStrong' />;

export const CaptionText = (props: ShortcutTextProps) => <Typography {...props} variant='caption' />;

export const StatText = (props: ShortcutTextProps) => <Typography {...props} variant='stat' />;

export const MonoText = (props: ShortcutTextProps) => <Typography {...props} variant='mono' />;

const styles = StyleSheet.create({
	base: {
		includeFontPadding: false
	}
});
