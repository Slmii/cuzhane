import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

/** One piece of the band, in the scroll content's points. */
export type BandRect = { x: number; y: number; w: number; h: number; r: number };

type Props = {
	/** Where the line is: one piece per row it covers. Empty when there is no line to show. */
	pieces: BandRect[];
	/** A follower's band is full tone; the reader's own is half, flashing to full on a tap. */
	tone: 'follower' | 'own';
	/** The reader just set it — their own band flashes to full tone for a moment. */
	isFresh?: boolean;
	/** A Hüsrev page is a picture: the band multiplies into it, so the ink stays black. */
	isOverImage?: boolean;
};

/*
 * The design's measures (Birlikte oku v2, "Bant ölçüleri"). Four slots at least, so lines of
 * up to four pieces morph into each other; a longer ayah gets one more slot per row, or its
 * last rows went unmarked (2:20 runs over five).
 */
const MIN_SLOTS = 4;
const GLIDE_MS = 280;
const GLIDE_EASING = cubicBezier(0.2, 0.8, 0.2, 1);
const FADE_OUT_MS = 120;
const FADE_IN_MS = 200;
const COLOR_MS = 450;
const FLASH_MS = 450;
/** A jump further than this fades out and back in rather than gliding the length of the page. */
const FAR_JUMP = 520;

type Shown = { pieces: BandRect[]; isVisible: boolean; motion: 'glide' | 'fade' | 'none' };

/**
 * What still has to happen after a change: `appear` fades the band in at its new place on the
 * next frame; `jump` waits for the fade-out, then places it and fades it in.
 */
type Phase = 'idle' | 'appear' | 'jump';

const sameRects = (a: BandRect[], b: BandRect[]) =>
	a.length === b.length &&
	a.every((piece, index) => {
		const other = b[index];

		return (
			other !== undefined &&
			piece.x === other.x &&
			piece.y === other.y &&
			piece.w === other.w &&
			piece.h === other.h
		);
	});

/**
 * "Göster"'s band: a soft wash behind the line the reader is reading, drawn **behind the text**
 * (rendered before it, in the same scroll content) so the Arabic's colour, size and marks are
 * untouched.
 *
 * - **Slots that morph into each other.** A verse over three rows is three pieces; a slot
 *   with no piece of its own sits on the last one, invisible, so moving to a line of another
 *   shape glides each piece into its new place instead of popping.
 * - **A near move glides** (280 ms); **a far one fades** — out in 120 ms, then in at its new
 *   place in 200 ms — rather than sweeping across the page. Reduce Motion moves it at once.
 * - The reader's own band is half tone; a tap lifts it to full for 0.45 s — "it went".
 *
 * The next state is worked out while rendering, from the pieces it was last given (React's
 * "adjusting state when a prop changes"); only the timed second steps live in effects.
 */
export const LiveBand = ({ pieces, tone, isFresh = false, isOverImage = false }: Props) => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	const [given, setGiven] = useState<BandRect[]>([]);
	const [shown, setShown] = useState<Shown>({ isVisible: false, motion: 'none', pieces: [] });
	const [phase, setPhase] = useState<Phase>('idle');
	// A tap's flash: each one gets a number, and is over once that number has been put out.
	const [flash, setFlash] = useState(0);
	const [flashOver, setFlashOver] = useState(0);

	if (!sameRects(pieces, given)) {
		setGiven(pieces);

		if (isFresh && tone === 'own') {
			setFlash(flash + 1);
		}

		if (pieces.length === 0) {
			setShown({ ...shown, isVisible: false, motion: isReducedMotion ? 'none' : 'fade' });
			setPhase('idle');
		} else if (isReducedMotion) {
			setShown({ isVisible: true, motion: 'none', pieces });
			setPhase('idle');
		} else if (!shown.isVisible || shown.pieces.length === 0) {
			// Placed while invisible; the next frame fades it in, so the fade is all that shows.
			setShown({ isVisible: false, motion: 'none', pieces });
			setPhase('appear');
		} else if (Math.abs((pieces[0]?.y ?? 0) - (shown.pieces[0]?.y ?? 0)) > FAR_JUMP) {
			setShown({ ...shown, isVisible: false, motion: 'fade' });
			setPhase('jump');
		} else {
			setShown({ isVisible: true, motion: 'glide', pieces });
			setPhase('idle');
		}
	}

	useEffect(() => {
		if (phase === 'appear') {
			const frame = requestAnimationFrame(() => {
				setShown({ isVisible: true, motion: 'fade', pieces: given });
				setPhase('idle');
			});

			return () => cancelAnimationFrame(frame);
		}

		if (phase === 'jump') {
			const timer = setTimeout(() => {
				setShown({ isVisible: false, motion: 'none', pieces: given });
				setPhase('appear');
			}, FADE_OUT_MS + 10);

			return () => clearTimeout(timer);
		}

		return undefined;
	}, [given, phase]);

	const isFlashing = flash !== flashOver;

	useEffect(() => {
		if (flash === 0) {
			return undefined;
		}

		const timer = setTimeout(() => setFlashOver(flash), FLASH_MS);

		return () => clearTimeout(timer);
	}, [flash]);

	const isFull = tone === 'follower' || isFlashing;
	const fill = isFull ? theme.colors.liveBand : theme.colors.liveBandOwn;
	const ring = isFull ? theme.colors.liveBandRing : theme.colors.liveBandOwnRing;

	return (
		<View pointerEvents='none' style={StyleSheet.absoluteFill}>
			{Array.from({ length: Math.max(MIN_SLOTS, shown.pieces.length) }, (_slot, index) => {
				const piece = shown.pieces[index] ?? shown.pieces.at(-1);

				if (!piece) {
					return null;
				}

				const hasOwn = index < shown.pieces.length;
				const glide = shown.motion === 'glide';

				return (
					<Animated.View
						key={index}
						style={{
							backgroundColor: fill,
							borderColor: ring,
							borderRadius: piece.r,
							borderWidth: 1,
							height: piece.h,
							left: piece.x,
							...(isOverImage ? { mixBlendMode: 'multiply' as const } : null),
							opacity: shown.isVisible && hasOwn ? 1 : 0,
							position: 'absolute',
							top: piece.y,
							width: piece.w,
							...(shown.motion === 'none'
								? null
								: {
										transitionDuration: [
											glide ? GLIDE_MS : 0,
											glide ? GLIDE_MS : 0,
											glide ? GLIDE_MS : 0,
											glide ? GLIDE_MS : 0,
											shown.isVisible ? FADE_IN_MS : FADE_OUT_MS,
											COLOR_MS,
											COLOR_MS
										],
										transitionProperty: [
											'top',
											'left',
											'width',
											'height',
											'opacity',
											'backgroundColor',
											'borderColor'
										],
										transitionTimingFunction: [
											GLIDE_EASING,
											GLIDE_EASING,
											GLIDE_EASING,
											GLIDE_EASING,
											'ease',
											'ease',
											'ease'
										]
								  })
						}}
					/>
				);
			})}
		</View>
	);
};
