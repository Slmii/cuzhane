import { Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { BAB_COUNT } from '@/lib/utils/babs';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import type { ReaderBabMapProps } from './ReaderBabMap.types';

/**
 * The strip's three heights. The tallest replaces the rail's old round head — position is
 * now said by a tick standing above its neighbours rather than by a dot riding over them.
 */
const TICK_HEIGHT = 7;
const TICK_HEIGHT_READ = 9;
const TICK_HEIGHT_CURRENT = 16;
/** Tall enough for the current tick, so the row doesn't reflow as it moves. */
const STRIP_HEIGHT = 18;

const HEIGHT_DURATION_MS = 180;
const COLOR_DURATION_MS = 300;

/**
 * One tick. **`memo`'d, and it has to stay that way** — there are a hundred of them and the
 * header re-renders on every bab the finger crosses while scrubbing, so without this each
 * drag would rebuild the whole strip a hundred times over. Both props are primitives, so the
 * default shallow compare is enough; only the two ticks that actually changed re-render.
 */
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
			 * Eased by a Reanimated CSS transition on **one flat style object**, never
			 * `useAnimatedStyle` and never inside a style array — inside an array these are
			 * just unknown keys and Reanimated never sees them. This is the lesson the bab
			 * board already paid for: a mapper per cell held the JS thread at 17–24fps across
			 * a hundred cells, where the same easing declared as a transition holds 60.
			 *
			 * Two channels, two durations: height is the quicker of the pair because it moves
			 * on every bab you cross while scrubbing, where colour only moves when a bab is
			 * actually marked.
			 */
			style={{
				...styles.tick,
				backgroundColor,
				height,
				...(isReducedMotion
					? null
					: {
							transitionDuration: [HEIGHT_DURATION_MS, COLOR_DURATION_MS],
							transitionProperty: ['height', 'backgroundColor']
					  })
			}}
		/>
	)
);

Tick.displayName = 'Tick';

/**
 * The whole cevşen as a hundred ticks across the reader's header.
 *
 * It replaced a 148pt rail that showed one filled portion for progress and a dot for where
 * you were. That rail could say how far along you were and nothing else — which bab was
 * yours, which sat in the pool and which you had already read were all invisible in it, so
 * the only way to find your next unread bab was to walk there with the arrows.
 *
 * **Colour is ownership, height is state.** They carry different things on purpose: the four
 * colours are the same four the bab cells use, so the strip reads in a vocabulary already
 * learned elsewhere, while height picks out the two things you need at a glance in a
 * hundred-wide strip — where you are, and what you have finished.
 *
 * Order matters and is the design's: current, then read, then yours, then pool, then
 * everyone else's. Read beats ownership because a finished bab is finished whoever owned it.
 */
export const ReaderBabMap = ({ currentBab, myBabNumbers, poolBabNumbers, readBabNumbers }: ReaderBabMapProps) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();

	const ticks = useMemo(() => {
		const read = new Set(readBabNumbers);
		const mine = new Set(myBabNumbers);
		const pool = new Set(poolBabNumbers);

		return Array.from({ length: BAB_COUNT }, (_, index) => {
			const n = index + 1;

			if (n === currentBab) {
				return { backgroundColor: theme.colors.text, height: TICK_HEIGHT_CURRENT, n };
			}
			if (read.has(n)) {
				return { backgroundColor: theme.colors.accent, height: TICK_HEIGHT_READ, n };
			}

			return {
				backgroundColor: mine.has(n)
					? theme.colors.accentMid
					: pool.has(n)
					? theme.colors.babMapPool
					: theme.colors.babMapOther,
				height: TICK_HEIGHT,
				n
			};
		});
	}, [currentBab, myBabNumbers, poolBabNumbers, readBabNumbers, theme]);

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
			<View style={styles.strip}>
				{ticks.map(tick => (
					<Tick
						backgroundColor={tick.backgroundColor}
						height={tick.height}
						isReducedMotion={isReducedMotion}
						key={tick.n}
					/>
				))}
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
		gap: 1,
		height: STRIP_HEIGHT
	},
	tick: {
		borderRadius: 1.5,
		// `flex: 1` with `minWidth: 0` so a hundred of them divide the width exactly rather
		// than each claiming a minimum and overflowing the header.
		flex: 1,
		minWidth: 0
	}
});
