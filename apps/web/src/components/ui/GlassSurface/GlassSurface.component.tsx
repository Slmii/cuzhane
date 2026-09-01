import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass';
import { View } from 'react-native';
import type { GlassSurfaceProps } from './GlassSurface.types';

/**
 * A background that is the platform's own Liquid Glass where that exists, and a flat colour
 * everywhere else. It draws nothing but the surface — callers lay their content over it.
 *
 * **The one place in the app that decides whether glass is allowed**, so the three conditions
 * are answered once: the OS has it, the build has it, and the reader hasn't asked for it to go
 * away. Android and any iOS before 26 get `fallbackColor`, which is the surface the app was
 * designed with — the material is an addition on the platforms that have it, never a
 * requirement.
 *
 * No `try`/`require` shim, unlike `ui/SegmentedControl` and the reader's slider.
 * `@callstack/liquid-glass` resolves `LiquidGlassView` to a plain `View` and
 * `isLiquidGlassSupported` to a literal `false` on every platform but iOS, so importing it
 * unconditionally can't throw — there is no native view to fail to find.
 *
 * **`colorScheme` is the resolved theme, not the system's.** It defaults to `'system'`, and
 * Görünüm can be set to Açık on a phone in dark mode — which would put dark glass under light
 * content. `resolvedMode` is what everything else on screen is drawn from, so it is what the
 * material sits on the same side of.
 *
 * One thing to know before reaching for this: **glass renders what is behind it, so it needs
 * something there.** Over a flat colour it resolves to that flat colour and looks like an
 * ordinary fill. It earns its keep where content moves underneath — a sheet over a screen, a
 * bar over a scroll — not on a panel sitting on a plain background.
 */
export const GlassSurface = ({
	effect = 'regular',
	fallbackColor,
	pointerEvents,
	style,
	tintColor
}: GlassSurfaceProps) => {
	const { resolvedMode } = useThemeContext();

	/*
	 * **Reduce Transparency is the system's business, not ours.** This used to fall back to the
	 * flat fill when that setting was on. It doesn't any more: UIKit's own materials already
	 * respond to it, so the check was duplicating the OS — and duplicating it unevenly, since
	 * the glass buttons, switches, segmented controls and the reader's slider never had it. The
	 * result was a sheet that went flat under controls that stayed glass.
	 *
	 * Settled by looking rather than by argument: with the setting on, the system's adapted
	 * glass reads fine beside our own surfaces, so the app now lets iOS do the adapting
	 * everywhere. If that judgement is ever revisited, it belongs in all eight places or none.
	 */
	if (!isLiquidGlassSupported) {
		return <View pointerEvents={pointerEvents} style={[style, { backgroundColor: fallbackColor }]} />;
	}

	return (
		<LiquidGlassView
			colorScheme={resolvedMode}
			effect={effect}
			pointerEvents={pointerEvents}
			style={style}
			{...(tintColor !== undefined ? { tintColor } : {})}
		/>
	);
};
