import { flattenColor } from '@/lib/utils/colors';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { Avatar as DiceBearAvatar, Style } from '@dicebear/core';
import thumbsDefinition from '@dicebear/styles/thumbs.json';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { AvatarProps, AvatarTone } from './Avatar.types';

/**
 * Validating the style definition is the expensive part, so it happens once for the
 * whole app rather than per avatar.
 */
const thumbsStyle = new Style(thumbsDefinition);

/** Deterministic, so the same person always gets the same face and tint. */
const hashName = (name: string) => {
	let hash = 0;

	for (let index = 0; index < name.length; index += 1) {
		hash = (hash * 31 + name.charCodeAt(index)) | 0;
	}

	return Math.abs(hash);
};

export const Avatar = ({ name, size = 34, style, tone = 'accent' }: AvatarProps) => {
	const { theme } = useThemeContext();

	const xml = useMemo(() => {
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

		return new DiceBearAvatar(thumbsStyle, {
			seed: name,
			backgroundColor: background,
			shapeColor: shape,
			// The face punches out of the shape in the page colour rather than black.
			eyesColor: flattenColor(theme.colors.surface, background),
			mouthColor: flattenColor(theme.colors.surface, background)
		}).toString();
	}, [name, theme, tone]);

	return (
		<View style={[styles.frame, { borderRadius: size / 2, height: size, width: size }, style]}>
			<SvgXml height={size} width={size} xml={xml} />
		</View>
	);
};

const styles = StyleSheet.create({
	frame: {
		overflow: 'hidden'
	}
});
