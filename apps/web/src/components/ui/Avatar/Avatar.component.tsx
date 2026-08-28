import { flattenColor } from '@/lib/utils/colors';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Avatar as DiceBearAvatar, Style } from '@dicebear/core';
import thumbsDefinition from '@dicebear/styles/thumbs.json';
import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { AvatarProps, AvatarTone } from './Avatar.types';

/**
 * Validating the style definition is the expensive part, so it happens once for the
 * whole app rather than per avatar.
 */
const thumbsStyle = new Style(thumbsDefinition);

/**
 * Generated faces, by theme, tone and name. Bounded because it is only ever an optimisation:
 * past the cap it starts again rather than holding every person the session has ever drawn.
 * A group is capped at 20 members, so this covers many groups over before it turns over.
 */
const XML_CACHE_LIMIT = 200;
const XML_CACHE = new Map<string, string>();

/** Deterministic, so the same person always gets the same face and tint. */
const hashName = (name: string) => {
	let hash = 0;

	for (let index = 0; index < name.length; index += 1) {
		hash = (hash * 31 + name.charCodeAt(index)) | 0;
	}

	return Math.abs(hash);
};

/*
 * Deliberately a plain component, not `memo`. Drawing an SVG twenty times over is worth
 * avoiding, but the callers already do: `MembersSheet` memoises its rows, so the elements
 * keep their identity and React never re-renders them or the avatars inside. Wrapping this
 * as well bought nothing and broke rendering under Fast Refresh, where a module whose export
 * turns from a function into a memo object mid-session is picked up as "Component is not a
 * function (it is Object)".
 */
export const Avatar = ({ imageUrl, name, size = 34, style, tone = 'accent' }: AvatarProps) => {
	const { theme } = useThemeContext();

	const xml = useMemo(() => {
		/*
		 * Generated once per person and kept, because a sheet cannot start animating until its
		 * contents have mounted: opening the members list built twenty of these from scratch
		 * first, and that showed as a beat between the tap and the sheet moving. Keyed on
		 * everything the drawing depends on, so a theme switch produces a new face rather than
		 * a stale one.
		 */
		const cacheKey = `${theme.mode}|${tone}|${name}`;
		const cached = XML_CACHE.get(cacheKey);

		if (cached !== undefined) {
			return cached;
		}

		// DiceBear's own palette is far brighter than "paper + sage", so the generated
		// face is re-tinted into the app's colours. The variant is picked from the name
		// so a group's members read as a set without all looking identical.
		const palette: Record<AvatarTone, { background: string; shape: string }[]> = {
			accent: [
				{ background: theme.colors.accentSoft, shape: theme.colors.accent },
				{ background: theme.colors.accentMuted, shape: theme.colors.accentText }
			],
			sand: [
				{ background: theme.colors.sand, shape: theme.colors.sandText },
				{ background: theme.colors.accentSoft, shape: theme.colors.accent }
			],
			neutral: [{ background: theme.colors.surfaceMuted, shape: theme.colors.subtext }]
		};

		const variants = palette[tone];
		const variant = variants[hashName(name) % variants.length] ?? variants[0];

		// DiceBear validates its colours and accepts hex only, while the dark palette
		// carries translucent tokens (`subtext` is an rgba). React Native would have
		// composited those against whatever sits behind; here we have to do it, or the
		// avatar throws "shapeColor does not match the required pattern" and takes the
		// screen down with it.
		const background = flattenColor(variant?.background ?? theme.colors.accentSoft, theme.colors.background);
		const shape = flattenColor(variant?.shape ?? theme.colors.accent, background);

		const generated = new DiceBearAvatar(thumbsStyle, {
			seed: name,
			backgroundColor: background,
			shapeColor: shape,
			// The face punches out of the shape in the page colour rather than black.
			eyesColor: flattenColor(theme.colors.surface, background),
			mouthColor: flattenColor(theme.colors.surface, background)
		}).toString();

		if (XML_CACHE.size >= XML_CACHE_LIMIT) {
			XML_CACHE.clear();
		}

		XML_CACHE.set(cacheKey, generated);

		return generated;
	}, [name, theme, tone]);

	return (
		<View style={[styles.frame, { borderRadius: size / 2, height: size, width: size }, style]}>
			{imageUrl ? (
				// Keyed on the URL: RN caches an `<Image>` by source, so a replaced photo that
				// reuses the host path would otherwise keep painting the old bytes.
				<Image key={imageUrl} source={{ uri: imageUrl }} style={{ height: size, width: size }} />
			) : (
				<SvgXml height={size} width={size} xml={xml} />
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	frame: {
		overflow: 'hidden'
	}
});
