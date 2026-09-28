import { Star8 } from '@/components/HatimCelebration/HatimCelebration.component';
import { arabicReaderFonts } from '@/lib/theme/fonts';
import { hatimCompletePalette as palette, toAlphaColor } from '@/lib/theme/tokens';
import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import Svg, {
	Circle,
	Defs,
	G,
	LinearGradient,
	Path,
	Pattern,
	RadialGradient,
	Rect,
	Stop,
	Text as SvgText
} from 'react-native-svg';
import type { HatimBookProps } from './HatimBook.types';

/*
 * Q7's mushaf, from "Hatim Tamamlandi.dc.html" (`q7Fx`'s book): it pops in open — the endpaper
 * on the left, Fâtiha on the right — turns twelve pages, the first Bakara's, and closes onto its
 * green binding, which slides to the middle of the ring and catches a shine.
 *
 * **The design's numbers throughout** — a 50 × 70 leaf, its timings and easings — and its page
 * art drawn in SVG to the same measurements: the frame, the hatched bands, the cartouches and
 * the lines of text.
 *
 * **A leaf shows its back by swapping faces at the edge-on moment**, not by `backfaceVisibility`:
 * React Native has no `preserve-3d`, so a face inside a turning leaf is flattened into it and
 * cannot tell which way it faces. Each face fades at the instant the leaf passes 90°, where it
 * is a line and the swap cannot be seen, and the back is drawn mirrored so it reads the right
 * way round once the leaf has turned.
 */

const LEAF_WIDTH = 50;
const LEAF_HEIGHT = 70;
const PERSPECTIVE = 700;
const PAGE_COUNT = 12;

/*
 * The cover's turn: 3.55s after .25s, held flat until 80.2% and then closing (`q7cv`). Where
 * each kind of leaf is **edge-on** is where its faces swap — worked out from the design's
 * easings, the moment each reaches −90°, not guessed: a page at 41.64% of its turn under
 * `cubic-bezier(.45,.05,.35,1)`, the cover at 88.62% under `(.5,0,.3,1)` over its last stretch.
 */
const COVER_DURATION = 3550;
const COVER_DELAY = 250;
const COVER_TURN_START = 80.2;
const COVER_EDGE_ON = 88.62;
const PAGE_EDGE_ON = 41.64;
/** The hatch's tile: `repeating-linear-gradient(45deg, …, 1px, … 3px)` repeats every 3√2 along an axis. */
const HATCH_TILE = 3 * Math.SQRT2;

type Timing = ReturnType<typeof cubicBezier> | 'linear' | 'ease-in-out';

const animation = (keyframes: Record<string, object>, durationMs: number, delayMs: number, timing: Timing) => ({
	...(keyframes['0%'] ?? {}),
	animationDelay: delayMs,
	animationDuration: durationMs,
	animationFillMode: 'both' as const,
	animationName: keyframes,
	animationTimingFunction: timing
});

/** A leaf turning about the spine, from lying on the left to lying on the right. */
const turn = (durationMs: number, delayMs: number, timing: Timing, holdUntil = '0%') =>
	animation(
		{
			'0%': { transform: [{ perspective: PERSPECTIVE }, { rotateY: '0deg' }] },
			...(holdUntil === '0%'
				? {}
				: { [holdUntil]: { transform: [{ perspective: PERSPECTIVE }, { rotateY: '0deg' }] } }),
			'100%': { transform: [{ perspective: PERSPECTIVE }, { rotateY: '-180deg' }] }
		},
		durationMs,
		delayMs,
		timing
	);

/** A face that shows until the leaf is edge-on (`at`), or only from then on (`isBack`). */
const faceSwap = (durationMs: number, delayMs: number, at: number, isBack: boolean) =>
	animation(
		{
			'0%': { opacity: isBack ? 0 : 1 },
			[`${at}%`]: { opacity: isBack ? 0 : 1 },
			[`${at + 0.1}%`]: { opacity: isBack ? 1 : 0 },
			'100%': { opacity: isBack ? 1 : 0 }
		},
		durationMs,
		delayMs,
		'linear'
	);

/** The frame's page shading: a soft edge on one side, gone by 16–18% of the width. */
const Shade = ({ fromRight, strength, stop }: { fromRight: boolean; strength: string; stop: number }) => (
	<>
		<Defs>
			<LinearGradient id='shade' x1={fromRight ? '1' : '0'} x2={fromRight ? '0' : '1'} y1='0' y2='0'>
				<Stop offset='0' stopColor={strength} stopOpacity={1} />
				<Stop offset={stop} stopColor={strength} stopOpacity={0} />
			</LinearGradient>
		</Defs>
		<Rect fill='url(#shade)' height={LEAF_HEIGHT} width={LEAF_WIDTH} />
	</>
);

/** An ordinary page: paper, its lines of text, and the shade toward one edge. */
const PlainPage = ({ fromRight }: { fromRight: boolean }) => (
	<Svg height={LEAF_HEIGHT} width={LEAF_WIDTH}>
		<Rect fill={palette.page} height={LEAF_HEIGHT} width={LEAF_WIDTH} />
		{/* A 34 × 48 block at 8, 12, a one-point rule every eight. */}
		{Array.from({ length: 6 }, (_, line) => (
			<Rect fill={palette.rule} height={1} key={line} width={34} x={8} y={12 + 7 + line * 8} />
		))}
		<Shade fromRight={fromRight} stop={0.18} strength={palette.shade} />
	</Svg>
);

/**
 * An illuminated opening page, as the frame's `orn`: a ruled border with hatched bands, a
 * cartouche carrying the sura's name at the head and its place of revelation at the foot, and
 * lines of text between — right-aligned, the first short, as a sura's first line sits.
 */
const IlluminatedPage = ({
	fromRight,
	foot,
	lines,
	title
}: {
	fromRight: boolean;
	foot: string;
	lines: number[];
	title: string;
}) => {
	const textTop = 21;
	const textHeight = LEAF_HEIGHT - 19 - textTop;
	const lineHeight = 1.6;
	const spacing = (textHeight - lines.length * lineHeight) / (lines.length + 1);
	const textWidth = LEAF_WIDTH - 22;

	const cartouche = (y: number, height: number, label: string) => {
		const boxWidth = (LEAF_WIDTH - 17) * 0.58;
		const boxHeight = height - 4;

		return (
			<G>
				<Rect
					fill='url(#hatch)'
					height={height}
					stroke={palette.ink}
					strokeWidth={1}
					width={LEAF_WIDTH - 17}
					x={8.5}
					y={y}
				/>
				<Rect
					fill={palette.cartouche}
					height={boxHeight}
					rx={1.5}
					stroke={palette.ink}
					strokeWidth={0.8}
					width={boxWidth}
					x={(LEAF_WIDTH - boxWidth) / 2}
					y={y + 2}
				/>
				<SvgText
					fill={palette.inkDeep}
					fontFamily={arabicReaderFonts.amiri}
					fontSize={4.6}
					textAnchor='middle'
					x={LEAF_WIDTH / 2}
					y={y + height / 2 + 1.6}
				>
					{label}
				</SvgText>
			</G>
		);
	};

	return (
		<Svg height={LEAF_HEIGHT} width={LEAF_WIDTH}>
			<Defs>
				<RadialGradient cx='50%' cy='45%' id='parchment' rx='60%' ry='45%'>
					<Stop offset='0.4' stopColor={palette.parchment} />
					<Stop offset='1' stopColor={palette.parchmentEdge} />
				</RadialGradient>
				{/* `repeating-linear-gradient(45deg, ink 0 1px, transparent 1px 3px)`. */}
				{/*
				 * The diagonal is drawn into the tile rather than set with `patternTransform`, which
				 * react-native-svg ignores on iOS — the stripes came out upright there. A tile of
				 * 3√2 carries lines 3 apart, one point thick, running as the 45° gradient's bands do.
				 */}
				<Pattern height={HATCH_TILE} id='hatch' patternUnits='userSpaceOnUse' width={HATCH_TILE}>
					<Path
						d={`M0 0L${HATCH_TILE} ${HATCH_TILE}M${HATCH_TILE - 1} -1L${HATCH_TILE + 1} 1M-1 ${
							HATCH_TILE - 1
						}L1 ${HATCH_TILE + 1}`}
						stroke={palette.hatch}
						strokeWidth={1}
					/>
				</Pattern>
				{/* A line of script: dark 3, faint 1, dark 2, gap 1. */}
				<Pattern height={lineHeight} id='script' patternUnits='userSpaceOnUse' width={7}>
					<Rect fill={palette.script} height={lineHeight} width={3} />
					<Rect fill={palette.scriptFaint} height={lineHeight} width={1} x={3} />
					<Rect fill={palette.script} height={lineHeight} width={2} x={4} />
				</Pattern>
			</Defs>
			<Rect fill='url(#parchment)' height={LEAF_HEIGHT} width={LEAF_WIDTH} />
			<Rect
				fill='none'
				height={LEAF_HEIGHT - 7}
				stroke={palette.ink}
				strokeWidth={1}
				width={LEAF_WIDTH - 7}
				x={3.5}
				y={3.5}
			/>
			<Rect fill='url(#hatch)' height={3} width={LEAF_WIDTH - 9} x={4.5} y={4.5} />
			<Rect fill='url(#hatch)' height={3} width={LEAF_WIDTH - 9} x={4.5} y={LEAF_HEIGHT - 7.5} />
			<Rect fill='url(#hatch)' height={LEAF_HEIGHT - 9} width={3} x={4.5} y={4.5} />
			<Rect fill='url(#hatch)' height={LEAF_HEIGHT - 9} width={3} x={LEAF_WIDTH - 7.5} y={4.5} />
			<Rect
				fill='none'
				height={LEAF_HEIGHT - 15.8}
				stroke={palette.ink}
				strokeWidth={0.8}
				width={LEAF_WIDTH - 15.8}
				x={7.9}
				y={7.9}
			/>
			{cartouche(8.5, 9, title)}
			{lines.map((percent, index) => {
				const width = (textWidth * percent) / 100;

				return (
					<Rect
						fill='url(#script)'
						height={lineHeight}
						key={index}
						rx={1}
						width={width}
						x={11 + textWidth - width}
						y={textTop + spacing * (index + 1) + lineHeight * index}
					/>
				);
			})}
			{cartouche(LEAF_HEIGHT - 8.5 - 8, 8, foot)}
			<Shade fromRight={fromRight} stop={0.16} strength={palette.shadeDeep} />
		</Svg>
	);
};

/** The inside of the front cover: a dotted endpaper with a medallion. */
const Endpaper = () => (
	<Svg height={LEAF_HEIGHT} width={LEAF_WIDTH}>
		<Defs>
			<Pattern height={7} id='dots' patternUnits='userSpaceOnUse' width={7}>
				<Circle cx={0} cy={0} fill={toAlphaColor(palette.goldDeep, 0.5)} r={1} />
				<Circle cx={7} cy={0} fill={toAlphaColor(palette.goldDeep, 0.5)} r={1} />
				<Circle cx={0} cy={7} fill={toAlphaColor(palette.goldDeep, 0.5)} r={1} />
				<Circle cx={7} cy={7} fill={toAlphaColor(palette.goldDeep, 0.5)} r={1} />
				<Circle cx={3.5} cy={3.5} fill={toAlphaColor(palette.pageMiddle, 0.35)} r={1} />
			</Pattern>
		</Defs>
		<Rect fill={palette.endpaper} height={LEAF_HEIGHT} width={LEAF_WIDTH} />
		<Rect fill='url(#dots)' height={LEAF_HEIGHT} width={LEAF_WIDTH} />
		<Rect
			fill='none'
			height={LEAF_HEIGHT - 9}
			rx={2}
			stroke={toAlphaColor(palette.goldDeep, 0.7)}
			strokeWidth={1}
			width={LEAF_WIDTH - 9}
			x={4.5}
			y={4.5}
		/>
		{/* The medallion's disc; its star is drawn over it by the caller. */}
		<Circle
			cx={LEAF_WIDTH / 2}
			cy={LEAF_HEIGHT / 2}
			fill={palette.endpaper}
			r={11.5}
			stroke={palette.goldDeep}
			strokeWidth={1}
		/>
	</Svg>
);

/** The binding's face: gilt frames, stars in the corners, "القرآن الكريم" and a star medallion. */
const Cover = ({ isStill }: { isStill: boolean }) => (
	<View style={[styles.cover, { backgroundColor: palette.binding }]}>
		<Svg height={LEAF_HEIGHT} style={StyleSheet.absoluteFill} width={LEAF_WIDTH}>
			<Rect fill={palette.spineShade} height={LEAF_HEIGHT} width={3} />
			<Rect
				fill='none'
				height={LEAF_HEIGHT - 11}
				rx={3}
				stroke={toAlphaColor(palette.gold, 0.75)}
				strokeWidth={1}
				width={LEAF_WIDTH - 11}
				x={5.5}
				y={5.5}
			/>
			<Rect
				fill='none'
				height={LEAF_HEIGHT - 17}
				rx={2}
				stroke={toAlphaColor(palette.gold, 0.35)}
				strokeWidth={1}
				width={LEAF_WIDTH - 17}
				x={8.5}
				y={8.5}
			/>
			<SvgText
				fill={palette.goldLight}
				fontFamily={arabicReaderFonts.amiri}
				fontSize={6.5}
				textAnchor='middle'
				x={LEAF_WIDTH / 2}
				y={12 + 5.5}
			>
				القرآن
			</SvgText>
			<SvgText
				fill={palette.goldLight}
				fontFamily={arabicReaderFonts.amiri}
				fontSize={6}
				textAnchor='middle'
				x={LEAF_WIDTH / 2}
				y={LEAF_HEIGHT - 11 - 1}
			>
				الكريم
			</SvgText>
		</Svg>
		{/* The corner stars: 6 across, 3 in from each edge. */}
		{[styles.cornerTopLeft, styles.cornerBottomLeft, styles.cornerTopRight, styles.cornerBottomRight].map(
			(corner, index) => (
				<View key={index} style={[styles.corner, corner]}>
					<Star8 color={palette.gold} size={6} />
				</View>
			)
		)}
		<View style={styles.medallion}>
			<View style={[styles.medallionLayer, { transform: [{ rotate: '22.5deg' }] }]}>
				<Star8 color={toAlphaColor(palette.gold, 0.45)} size={26} />
			</View>
			<View style={[styles.medallionLayer, styles.medallionInner]}>
				<Star8 color={palette.gold} size={20} />
			</View>
			<View
				style={[styles.medallionCore, { backgroundColor: palette.binding, borderColor: palette.goldLight }]}
			/>
		</View>
		{isStill ? null : (
			<Animated.View
				style={[
					styles.shine,
					animation(
						{
							'0%': { transform: [{ translateX: -80 }, { skewX: '-18deg' }] },
							'100%': { transform: [{ translateX: 90 }, { skewX: '-18deg' }] }
						},
						1100,
						4200,
						'ease-in-out'
					)
				]}
			>
				<Svg height='100%' width='100%'>
					<Defs>
						<LinearGradient id='shine' x1='0' x2='1' y1='0' y2='0'>
							<Stop offset='0' stopColor={palette.white} stopOpacity={0} />
							<Stop offset='0.5' stopColor={palette.white} stopOpacity={0.35} />
							<Stop offset='1' stopColor={palette.white} stopOpacity={0} />
						</LinearGradient>
					</Defs>
					<Rect fill='url(#shine)' height='100%' width='100%' />
				</Svg>
			</Animated.View>
		)}
	</View>
);

/** The page the book opens on, on the right: Fâtiha, as the mushaf begins. */
const FATIHA_LINES = [60, 100, 100, 100, 100, 100, 85];
/** The first page turned: Bakara's opening. */
const BAKARA_LINES = [60, 100, 100, 100, 100, 100, 100, 70];

/** The endpaper as the cover's inside shows it: dotted paper and its starred medallion. */
const CoverEndpaper = () => (
	<View style={styles.frontFace}>
		<Endpaper />
		<View style={styles.endpaperStar}>
			<Star8 color={palette.pageMiddle} size={16} />
		</View>
	</View>
);

export const HatimBook = ({ isReducedMotion }: HatimBookProps) => {
	// With Reduce Motion the book is simply closed, where the animation ends.
	if (isReducedMotion) {
		return (
			<View style={styles.book}>
				<View style={[styles.stage, styles.stageSettled]}>
					<View style={[styles.rightBoard, { backgroundColor: palette.binding }]} />
					<View style={styles.rightLeaf}>
						<Cover isStill />
					</View>
				</View>
			</View>
		);
	}

	return (
		<Animated.View
			style={[
				styles.book,
				animation(
					{
						'0%': { opacity: 0, transform: [{ translateY: 12 }, { scale: 0.7 }] },
						'100%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] }
					},
					500,
					100,
					cubicBezier(0.2, 1.3, 0.4, 1)
				)
			]}
		>
			<Animated.View
				style={[
					styles.stage,
					animation(
						{
							'0%': { transform: [{ translateX: 0 }, { scale: 1 }] },
							'100%': { transform: [{ translateX: -30 }, { scale: 1.2 }] }
						},
						600,
						3850,
						cubicBezier(0.3, 1.2, 0.4, 1)
					)
				]}
			>
				<View style={[styles.rightBoard, { backgroundColor: palette.binding }]} />
				{/*
				 * The left board goes as the cover passes the spine — 88–91% of its turn. **The fade is
				 * on a plain wrapper, not on the board**: a view's own drop shadow is drawn apart from it
				 * and does not fade with its opacity, so fading the board itself left its shadow behind
				 * as a rectangle once it had gone. Faded as a group, the shadow goes with it.
				 */}
				<Animated.View
					style={[
						styles.stage,
						animation(
							{
								'0%': { opacity: 1 },
								'88%': { opacity: 1 },
								'91%': { opacity: 0 },
								'100%': { opacity: 0 }
							},
							3550,
							250,
							'linear'
						)
					]}
				>
					<View style={[styles.leftBoard, { backgroundColor: palette.binding }]} />
				</Animated.View>
				<View style={styles.rightLeaf}>
					<IlluminatedPage foot='مكية' fromRight lines={FATIHA_LINES} title='سورة الفاتحة' />
				</View>

				{/*
				 * The cover, in two parts so its stacking lives on the animation timeline and not on
				 * a timer. **Lying open**, it is under the pages (the frame's `z-index: 1`) — so this
				 * still endpaper, below them, until the cover starts to close. **Closing**, it must be
				 * over the pages it closes on (the frame's `z-index: 40` from 80.3%) — so the turning
				 * leaf sits above them throughout, unseen until that same instant.
				 */}
				<Animated.View
					style={[styles.leaf, { zIndex: 1 }, faceSwap(COVER_DURATION, COVER_DELAY, COVER_TURN_START, false)]}
				>
					<CoverEndpaper />
				</Animated.View>
				<Animated.View
					style={[styles.leaf, { zIndex: 40 }, faceSwap(COVER_DURATION, COVER_DELAY, COVER_TURN_START, true)]}
				>
					<Animated.View
						style={[
							styles.leafFill,
							turn(COVER_DURATION, COVER_DELAY, cubicBezier(0.5, 0, 0.3, 1), `${COVER_TURN_START}%`)
						]}
					>
						<Animated.View
							style={[styles.face, faceSwap(COVER_DURATION, COVER_DELAY, COVER_EDGE_ON, false)]}
						>
							<CoverEndpaper />
						</Animated.View>
						<Animated.View
							style={[
								styles.face,
								styles.backFace,
								faceSwap(COVER_DURATION, COVER_DELAY, COVER_EDGE_ON, true)
							]}
						>
							<Cover isStill={false} />
						</Animated.View>
					</Animated.View>
				</Animated.View>

				{Array.from({ length: PAGE_COUNT }, (_, index) => {
					const delay = 950 + index * 130;

					return (
						<Animated.View
							key={index}
							style={[
								styles.leaf,
								{ zIndex: 20 - index },
								// Gone once the book has closed over them, at 3.85s.
								animation({ '0%': { opacity: 1 }, '100%': { opacity: 0 } }, 10, 3850, 'linear')
							]}
						>
							<Animated.View
								style={[styles.leafFill, turn(550, delay, cubicBezier(0.45, 0.05, 0.35, 1))]}
							>
								<Animated.View style={[styles.face, faceSwap(550, delay, PAGE_EDGE_ON, false)]}>
									<View style={styles.frontFace}>
										{index === 0 ? (
											<IlluminatedPage
												foot='مدنية'
												fromRight={false}
												lines={BAKARA_LINES}
												title='سورة البقرة'
											/>
										) : (
											<PlainPage fromRight={false} />
										)}
									</View>
								</Animated.View>
								<Animated.View
									style={[styles.face, styles.backFace, faceSwap(550, delay, PAGE_EDGE_ON, true)]}
								>
									<View style={styles.pageBack}>
										<PlainPage fromRight />
									</View>
								</Animated.View>
							</Animated.View>
						</Animated.View>
					);
				})}
			</Animated.View>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	// A face turned half round, so it reads the right way once its leaf has turned.
	backFace: {
		transform: [{ rotateY: '180deg' }]
	},
	book: {
		height: LEAF_HEIGHT,
		width: LEAF_WIDTH * 2
	},
	corner: {
		position: 'absolute'
	},
	cornerBottomLeft: { bottom: 3, left: 3 },
	cornerBottomRight: { bottom: 3, right: 3 },
	cornerTopLeft: { left: 3, top: 3 },
	cornerTopRight: { right: 3, top: 3 },
	cover: {
		alignItems: 'center',
		borderBottomLeftRadius: 2,
		borderBottomRightRadius: 5,
		borderTopLeftRadius: 2,
		borderTopRightRadius: 5,
		height: LEAF_HEIGHT,
		justifyContent: 'center',
		overflow: 'hidden',
		width: LEAF_WIDTH
	},
	endpaperStar: {
		alignItems: 'center',
		bottom: 0,
		justifyContent: 'center',
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	face: {
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	frontFace: {
		borderBottomLeftRadius: 3,
		borderTopLeftRadius: 3,
		overflow: 'hidden'
	},
	leaf: {
		height: LEAF_HEIGHT,
		left: 0,
		position: 'absolute',
		top: 0,
		transformOrigin: 'right center',
		width: LEAF_WIDTH
	},
	leafFill: {
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0,
		transformOrigin: 'right center'
	},
	leftBoard: {
		borderBottomLeftRadius: 5,
		borderTopLeftRadius: 5,
		bottom: -3,
		left: -3,
		position: 'absolute',
		top: -3,
		width: LEAF_WIDTH + 3,
		...boardShadow()
	},
	medallion: {
		alignItems: 'center',
		height: 26,
		justifyContent: 'center',
		width: 26
	},
	medallionCore: {
		borderRadius: 4.5,
		borderWidth: 1,
		height: 9,
		width: 9
	},
	medallionInner: {
		bottom: 3,
		left: 3,
		right: 3,
		top: 3
	},
	medallionLayer: {
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	pageBack: {
		borderBottomRightRadius: 3,
		borderTopRightRadius: 3,
		overflow: 'hidden'
	},
	rightBoard: {
		borderBottomRightRadius: 5,
		borderTopRightRadius: 5,
		bottom: -3,
		left: LEAF_WIDTH,
		position: 'absolute',
		right: -3,
		top: -3,
		...boardShadow()
	},
	rightLeaf: {
		borderBottomRightRadius: 3,
		borderTopRightRadius: 3,
		height: LEAF_HEIGHT,
		left: LEAF_WIDTH,
		overflow: 'hidden',
		position: 'absolute',
		top: 0,
		width: LEAF_WIDTH
	},
	shine: {
		bottom: 0,
		position: 'absolute',
		top: 0,
		width: 26
	},
	stage: {
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0
	},
	// Where the stage ends: slid to the middle and grown, as `q7shift` leaves it.
	stageSettled: {
		transform: [{ translateX: -30 }, { scale: 1.2 }]
	}
});

/** `0 10px 18px rgba(0,0,0,.28)`, the boards' drop shadow. */
function boardShadow() {
	return {
		elevation: 8,
		shadowColor: palette.shadow,
		shadowOffset: { height: 10, width: 0 },
		shadowOpacity: 0.28,
		shadowRadius: 9
	};
}
