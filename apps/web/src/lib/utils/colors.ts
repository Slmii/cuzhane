const RGBA_PATTERN = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/;
const HEX_PATTERN = /^#([\da-f]{3}|[\da-f]{6})$/i;

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const expandHex = (hex: string) =>
	hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase() : hex.toLowerCase();

const parse = (color: string): { r: number; g: number; b: number; a: number } | null => {
	const rgba = RGBA_PATTERN.exec(color);

	if (rgba) {
		return {
			r: Number(rgba[1]),
			g: Number(rgba[2]),
			b: Number(rgba[3]),
			a: rgba[4] === undefined ? 1 : Number(rgba[4])
		};
	}

	if (HEX_PATTERN.test(color)) {
		const hex = expandHex(color);

		return {
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
			a: 1
		};
	}

	return null;
};

/**
 * Flattens a colour onto an opaque backdrop and returns `#rrggbb`.
 *
 * The theme's dark palette carries translucent tokens (`subtext` is
 * `rgba(242,240,234,0.52)`), which React Native composites for free — but anything that
 * hands a colour to a non-RN renderer has to do the compositing itself. DiceBear, for
 * one, accepts only hex and throws on the rest.
 *
 * Returns the backdrop unchanged if either colour is in a form it can't read, which is
 * the safe direction: a wrong-but-valid colour beats a render error.
 */
export const flattenColor = (color: string, backdrop: string): string => {
	const front = parse(color);
	const back = parse(backdrop);

	if (!front) {
		return back ? toHexString(back.r, back.g, back.b) : '#000000';
	}

	if (front.a >= 1 || !back) {
		return toHexString(front.r, front.g, front.b);
	}

	return toHexString(
		front.r * front.a + back.r * (1 - front.a),
		front.g * front.a + back.g * (1 - front.a),
		front.b * front.a + back.b * (1 - front.a)
	);
};

const toHexString = (r: number, g: number, b: number) =>
	`#${[r, g, b].map(channel => clampByte(channel).toString(16).padStart(2, '0')).join('')}`;
