import type { CornerActionProps } from '@/components/ui/CornerAction/CornerAction.types';
import type { SFSymbol } from 'sf-symbols-typescript';

export interface GlassCornerActionProps extends Omit<CornerActionProps, 'style'> {
	/**
	 * What the glass path draws. `icon` is still required — it is what the drawn fallback
	 * renders, and on that path it is always our own `ui/Icon`.
	 *
	 * Prefer `assetName`: a custom SF Symbol built from the design system's own drawing by
	 * `scripts/build-symbols.mjs`, so the glyph is ours on both paths. `systemIcon` is the
	 * fallback for a glyph the icon set has no drawing for.
	 */
	assetName?: string;
	systemIcon?: SFSymbol;
}
