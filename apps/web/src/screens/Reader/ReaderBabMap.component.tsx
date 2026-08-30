import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { BAB_COUNT } from '@/lib/utils/babs';
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
		isReducedMotion,
		myBabNumbers,
		poolBabNumbers,
		readBabNumbers
	}: {
		colors: { accent: string; accentMid: string; babMapOther: string; babMapPool: string };
		isReducedMotion: boolean;
		myBabNumbers: number[];
		poolBabNumbers: number[];
		readBabNumbers: number[];
	}) => {
		const ticks = useMemo(() => {
			const read = new Set(readBabNumbers);
			const mine = new Set(myBabNumbers);
			const pool = new Set(poolBabNumbers);

			return Array.from({ length: BAB_COUNT }, (_, index) => {
				const n = index + 1;

				if (read.has(n)) {
					return { backgroundColor: colors.accent, height: TICK_HEIGHT_READ, n };
				}

				return {
					backgroundColor: mine.has(n)
						? colors.accentMid
						: pool.has(n)
						? colors.babMapPool
						: colors.babMapOther,
					height: TICK_HEIGHT,
					n
				};
			});
		}, [colors, myBabNumbers, poolBabNumbers, readBabNumbers]);

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
	currentBab,
	myBabNumbers,
	poolBabNumbers,
	readBabNumbers,
	scrubRatio
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
			babMapOther: theme.colors.babMapOther,
			babMapPool: theme.colors.babMapPool
		}),
		[theme]
	);

	const tickWidth = stripWidth > 0 ? (stripWidth - (BAB_COUNT - 1) * TICK_GAP) / BAB_COUNT : 0;
	const restingIndex = currentBab - 1;
	const pitch = tickWidth + TICK_GAP;

	const indicatorStyle = useAnimatedStyle(() => {
		const index = scrubRatio.value < 0 ? restingIndex : Math.round(scrubRatio.value * (BAB_COUNT - 1));

		return { left: index * pitch };
	});

	const legend = useMemo(
		() => [
			{ color: theme.colors.accent, label: t('legRead') },
			{ color: theme.colors.accentMid, label: t('ownMine') },
			{ color: theme.colors.babMapPool, label: t('ownPool') },
			{ color: theme.colors.babMapOther, label: t('ownOther') }
		],
		[t, theme]
	);

	return (
		<View>
			<View onLayout={event => setStripWidth(event.nativeEvent.layout.width)} style={styles.strip}>
				<Ticks
					colors={colors}
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
			<View style={styles.legend}>
				{legend.map(entry => (
					<View key={entry.label} style={styles.legendItem}>
						<View style={[styles.legendSwatch, { backgroundColor: entry.color }]} />
						<Typography color={theme.colors.subtext} style={styles.legendLabel}>
							{entry.label}
						</Typography>
					</View>
				))}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
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
