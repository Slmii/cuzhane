import { Typography } from '@/components/ui/Typography/Typography.component';
import { useEffect, useRef, useState } from 'react';
import type { CountingTextProps } from './CountingText.types';

/** Long enough to read as counting, short enough not to delay the new group. */
const COUNT_MS = 420;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Every run of digits in the string, with where it sits. */
const NUMBER_PATTERN = /\d+/g;

type Segment = { text: string; value: number | null };

const segment = (value: string): Segment[] => {
	const segments: Segment[] = [];
	let index = 0;

	for (const match of value.matchAll(NUMBER_PATTERN)) {
		if (match.index > index) {
			segments.push({ text: value.slice(index, match.index), value: null });
		}

		segments.push({ text: match[0], value: Number(match[0]) });
		index = match.index + match[0].length;
	}

	if (index < value.length) {
		segments.push({ text: value.slice(index), value: null });
	}

	return segments;
};

/**
 * Renders a string whose numbers count to their new values instead of cutting.
 *
 * "69–84" becoming "1–16" reads as two numbers travelling rather than a label being
 * swapped, which is the point: the range belongs to the ring, and the ring is the same
 * object throughout. Anything that isn't a digit (the en dash, "—") is carried across
 * untouched.
 *
 * The tween runs on the JS thread through `requestAnimationFrame` — it is two integers
 * over 420ms, and it never overlaps a scroll, where the UI-thread work matters.
 */
export const CountingText = ({ color, style, value, variant }: CountingTextProps) => {
	const [display, setDisplay] = useState(value);
	const fromRef = useRef(value);
	const frameRef = useRef<number | null>(null);

	useEffect(() => {
		const from = segment(fromRef.current);
		const to = segment(value);

		// Only tween when the shape matches — "69–84" → "1–16" counts, but "12–20" → "—"
		// has nothing to count between and simply cuts.
		const canCount =
			from.length === to.length &&
			from.every((part, index) => {
				const target = to[index];

				return target !== undefined && (part.value === null) === (target.value === null);
			});

		if (!canCount) {
			fromRef.current = value;
			setDisplay(value);
			return;
		}

		const started = Date.now();

		const step = () => {
			const elapsed = Date.now() - started;
			const progress = Math.min(1, elapsed / COUNT_MS);
			const eased = easeOutCubic(progress);

			setDisplay(
				to
					.map((part, index) => {
						if (part.value === null) {
							return part.text;
						}

						const start = from[index]?.value ?? part.value;

						return String(Math.round(start + (part.value - start) * eased));
					})
					.join('')
			);

			if (progress < 1) {
				frameRef.current = requestAnimationFrame(step);
				return;
			}

			fromRef.current = value;
		};

		frameRef.current = requestAnimationFrame(step);

		return () => {
			if (frameRef.current !== null) {
				cancelAnimationFrame(frameRef.current);
			}

			// Whatever was mid-count is where the next one starts, so an interrupted
			// switch carries on from the digits actually on screen.
			fromRef.current = value;
		};
	}, [value]);

	return (
		<Typography color={color} style={style} variant={variant}>
			{display}
		</Typography>
	);
};
