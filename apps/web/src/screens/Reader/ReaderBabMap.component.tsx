import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { BAB_COUNT, slotIndexForBab } from '@/lib/utils/babs';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import type { ReaderBabMapProps } from './ReaderBabMap.types';

/**
 * The strip's heights. The tallest is the current bab, and it replaced the old rail's round
 * head — position is said by a tick standing above its neighbours rather than a dot riding
 * over them.
 */
const TICK_HEIGHT = 7;
const TICK_HEIGHT_READ = 9;
const TICK_HEIGHT_CURRENT = 16;
const TICK_GAP = 1;
/** Tall enough for the current tick, so the row can't reflow as it moves. */
const STRIP_HEIGHT = 18;

/** The design's pool bracket: a 6pt-deep U under the block, with 2.5pt between neighbours. */
const BRACKET_HEIGHT = 6;
const BRACKET_GAP = 2.5;

const HEIGHT_DURATION_MS = 180;
const COLOR_DURATION_MS = 300;

/** One tick. `memo`'d on two primitives, so marking a bab read re-renders exactly one. */
const Tick = memo(
	({
		backgroundColor,
		height,
		isReducedMotion
	}: {
		backgroundColor: string;
		height: number;
		isReducedMotion: boolean;
	}) => (
		<Animated.View
			/*
			 * Eased by a Reanimated CSS transition on **one flat style object** — never
			 * `useAnimatedStyle`, and never inside a style array, where these are just unknown
			 * keys Reanimated won't see. The bab board already paid for this lesson: a mapper
			 * per cell held the JS thread at 17–24fps across a hundred cells.
			 */
			style={{
				...styles.tick,
				backgroundColor,
				height,
				...(isReducedMotion
					? null
					: {
							/*
							 * Both channels, because marking a bab read moves both: 7pt to 9pt and
							 * the ownership colour to accent. Only the *position* is instant, and
							 * that is the finger's business rather than an animation.
							 */
							transitionDuration: [HEIGHT_DURATION_MS, COLOR_DURATION_MS],
							transitionProperty: ['height', 'backgroundColor']
					  })
			}}
		/>
	)
);

Tick.displayName = 'Tick';

/**
 * The hundred ticks, and **nothing that changes while a finger is down**.
 *
 * Split out and `memo`'d for exactly that reason: these props only move when the board does —
 * a bab is read, a pool slot taken — so a scrub re-renders the parent and skips this
 * subtree entirely. Fold the current position back in and every bab crossed costs a hundred
 * element creations and a hundred shallow compares, which is what made the drag stutter.
 */
const Ticks = memo(
	({
		colors,
		count,
		isReducedMotion,
		myBabNumbers,
		poolBabNumbers,
		readBabNumbers
	}: {
		colors: { accent: string; accentMid: string; other: string; pool: string };
		count: number;
		isReducedMotion: boolean;
		myBabNumbers: number[];
		poolBabNumbers: number[];
		readBabNumbers: number[];
	}) => {
		const ticks = useMemo(() => {
			const read = new Set(readBabNumbers);
			const mine = new Set(myBabNumbers);
			const pool = new Set(poolBabNumbers);

			return Array.from({ length: count }, (_, index) => {
				const n = index + 1;

				if (read.has(n)) {
					return { backgroundColor: colors.accent, height: TICK_HEIGHT_READ, n };
				}

				return {
					backgroundColor: mine.has(n) ? colors.accentMid : pool.has(n) ? colors.pool : colors.other,
					height: TICK_HEIGHT,
					n
				};
			});
		}, [colors, count, myBabNumbers, poolBabNumbers, readBabNumbers]);

		return (
			<>
				{ticks.map(tick => (
					<Tick
						backgroundColor={tick.backgroundColor}
						height={tick.height}
						isReducedMotion={isReducedMotion}
						key={tick.n}
					/>
				))}
			</>
		);
	}
);

Ticks.displayName = 'Ticks';

/**
 * The whole cevşen as a hundred ticks across the reader's header.
 *
 * It replaced a 148pt rail that showed a fill for progress and a dot for position — which
 * could say how far along you were and nothing else, so finding your next unread bab meant
 * walking there with the arrows.
 *
 * **Colour is ownership, height is state**, deliberately carrying different things: the four
 * colours are the bab cells' own, so the strip reads in a vocabulary already learned, while
 * height picks out the two things worth seeing at a glance across a hundred — where you are,
 * and what you have finished.
 *
 * The current position is an **overlay driven on the UI thread**, not one of the hundred.
 * The design draws it as a taller ink tick in the row and this is the same picture: it snaps
 * to the tick pitch, so it lands on a tick rather than floating between them. What the split
 * buys is that dragging never re-renders the list — measured off a screen recording, the
 * version that kept position in the list left 44% of frames identical to the one before.
 */
export const ReaderBabMap = ({
	count = BAB_COUNT,
	currentBab,
	hasLegend = true,
	myBabNumbers,
	poolBabNumbers,
	readBabNumbers,
	scrubRatio,
	spots
}: ReaderBabMapProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();
	const [stripWidth, setStripWidth] = useState(0);

	// Handed over as four strings so `Ticks` can `memo` on them. `theme` is a large object
	// carrying every token in the app, and it is replaced on any theme change.
	const colors = useMemo(
		() => ({
			accent: theme.colors.accent,
			accentMid: theme.colors.accentMid,
			other: theme.colors.babMapOther,
			// `poolFree`, the same colour the pool board paints an unclaimed bab. The strip had
			// its own token for this and the two drifted apart.
			pool: theme.colors.poolFree
		}),
		[theme]
	);

	const tickWidth = stripWidth > 0 ? (stripWidth - (count - 1) * TICK_GAP) / count : 0;
	const restingIndex = currentBab - 1;
	const pitch = tickWidth + TICK_GAP;

	const indicatorStyle = useAnimatedStyle(() => {
		const index = scrubRatio.value < 0 ? restingIndex : Math.round(scrubRatio.value * (count - 1));

		return { left: index * pitch };
	});

	/**
	 * The pool's blocks, as `[firstBab, lastBab]` pairs.
	 *
	 * **Grouped by seat, not by contiguity.** Two empty seats next to each other leave two
	 * blocks whose numbers run straight on from one another, and `babRuns` would report them
	 * as one long offer — which is the opposite of what taking one does. `slotIndexForBab` is
	 * the inverse of the split the whole app shares, so this asks the same question the pool
	 * itself asks: which seat is this bab's?
	 */
	const poolBlocks = useMemo(() => {
		if (!spots || poolBabNumbers.length === 0) {
			return [];
		}

		const bySlot = new Map<number, number[]>();

		for (const n of poolBabNumbers) {
			const slot = slotIndexForBab(n, spots, BAB_COUNT);

			if (slot === null) {
				continue;
			}
			const existing = bySlot.get(slot);

			if (existing) {
				existing.push(n);
			} else {
				bySlot.set(slot, [n]);
			}
		}

		return [...bySlot.values()]
			.map(numbers => {
				const sorted = [...numbers].sort((a, b) => a - b);

				return [sorted[0] ?? 0, sorted[sorted.length - 1] ?? 0] as const;
			})
			.sort((a, b) => a[0] - b[0]);
	}, [poolBabNumbers, spots]);

	const legend = useMemo(
		() => [
			{ color: theme.colors.accent, label: t('legRead') },
			{ color: theme.colors.accentMid, label: t('ownMine') },
			{ color: theme.colors.poolFree, label: t('ownPool') },
			{ color: theme.colors.babMapOther, label: t('ownOther') }
		],
		[t, theme]
	);

	return (
		<View>
			<View onLayout={event => setStripWidth(event.nativeEvent.layout.width)} style={styles.strip}>
				<Ticks
					colors={colors}
					count={count}
					isReducedMotion={isReducedMotion}
					myBabNumbers={myBabNumbers}
					poolBabNumbers={poolBabNumbers}
					readBabNumbers={readBabNumbers}
				/>
				{tickWidth > 0 ? (
					<Animated.View
						style={[
							styles.indicator,
							{ backgroundColor: theme.colors.text, width: tickWidth },
							indicatorStyle
						]}
					/>
				) : null}
			</View>
			{/*
			 * A bracket under each pool block — the design's U, open at the top so it reads as
			 * holding the ticks above it rather than as a box of its own.
			 *
			 * Drawn as an overlay at the strip's own pitch rather than by nudging the ticks
			 * apart, which is how the design chunks them: a 2.5pt shove at every block boundary
			 * would push the hundredth tick past the right edge, and the scrub maps a finger's
			 * x onto the strip by even division, so every tick after the first block would
			 * answer to the wrong bab. The gap between brackets says the same thing and costs
			 * the geometry nothing.
			 */}
			{tickWidth > 0 && poolBlocks.length > 0 ? (
				<View style={styles.brackets}>
					{poolBlocks.map(([first, last]) => (
						<Animated.View
							key={first}
							/*
							 * The design's `transition: border-color .3s ease`, and it earns its
							 * keep: walking out of one block and into the next hands the highlight
							 * over, and snapped that reads as a flicker rather than as the same
							 * mark travelling along with you.
							 *
							 * **One flat style object**, like the ticks above — inside a style array
							 * these are keys Reanimated never sees, and the colour snaps.
							 */
							style={{
								...styles.bracket,
								/*
								 * **Only the block you are standing in is drawn in the pool's
								 * colour.** The others are the strip's plain neutral. All of them
								 * tan read as one long offer, when in fact the button below is
								 * about to hand you exactly this one — the outline and the button
								 * have to be talking about the same babs.
								 */
								borderColor:
									currentBab >= first && currentBab <= last
										? theme.colors.poolLine
										: theme.colors.babMapOther,
								left: (first - 1) * pitch + BRACKET_GAP / 2,
								width: (last - first + 1) * pitch - TICK_GAP - BRACKET_GAP,
								...(isReducedMotion
									? null
									: { transitionDuration: COLOR_DURATION_MS, transitionProperty: 'borderColor' })
							}}
						/>
					))}
				</View>
			) : null}
			{hasLegend ? (
				<View style={styles.legend}>
					{legend.map(entry => (
						<View key={entry.label} style={styles.legendItem}>
							<View style={[styles.legendSwatch, { backgroundColor: entry.color }]} />
							<Typography color={theme.colors.subtext} style={styles.legendLabel}>
								{entry.label}
							</Typography>
						</View>
					))}
					{/*
					 * What the brackets under the strip are. Pushed to the far end of the legend
					 * row, in the pool's own ink, because it keys the outlines rather than any of
					 * the four swatches beside it.
					 *
					 * The size is read off the first block rather than assumed: the design's mock
					 * has twenty seats and so blocks of five, but a hundred over seven seats gives
					 * fifteens and fourteens.
					 */}
					{poolBlocks[0] ? (
						<Typography color={theme.colors.sandText} style={[styles.legendLabel, styles.legendSections]}>
							{t('poolSections', { count: poolBlocks[0][1] - poolBlocks[0][0] + 1 })}
						</Typography>
					) : null}
				</View>
			) : null}
		</View>
	);
};

const styles = StyleSheet.create({
	// Left and right uprights with a floor between them — no top edge, so it brackets the
	// ticks rather than boxing them.
	bracket: {
		borderBottomLeftRadius: 3,
		borderBottomRightRadius: 3,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderLeftWidth: StyleSheet.hairlineWidth,
		borderRightWidth: StyleSheet.hairlineWidth,
		height: BRACKET_HEIGHT,
		position: 'absolute',
		top: 0
	},
	brackets: {
		height: BRACKET_HEIGHT + 1
	},
	indicator: {
		borderRadius: 1.5,
		height: TICK_HEIGHT_CURRENT,
		position: 'absolute'
	},
	legend: {
		alignItems: 'center',
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 11,
		marginTop: 7
	},
	legendItem: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 5
	},
	legendLabel: {
		fontSize: 9.5,
		lineHeight: 13
	},
	legendSections: {
		marginLeft: 'auto'
	},
	legendSwatch: {
		borderRadius: 2.5,
		height: 9,
		width: 9
	},
	strip: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: TICK_GAP,
		height: STRIP_HEIGHT
	},
	tick: {
		borderRadius: 1.5,
		// `flex: 1` with `minWidth: 0` so a hundred divide the width exactly rather than each
		// claiming a minimum and overflowing the header.
		flex: 1,
		minWidth: 0
	}
});
