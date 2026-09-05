import type { IconName } from '@/components/ui/Icon/Icon.types';

export interface SymbolIconProps {
	/** The custom symbol in `CuzhaneSymbols.xcassets`, named after its SVG (`ara-search`). */
	assetName: string;
	/** The same glyph from `ui/Icon`, drawn wherever SwiftUI isn't. */
	icon: IconName;
	size: number;
	color: string;
	/** For the drawn fallback only; SwiftUI takes `weight`. */
	strokeWidth?: number;
	weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}
