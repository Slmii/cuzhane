import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CaptionText, EyebrowText, MonoText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { partCountFor } from '@/lib/utils/groupKinds';
import { movesEachRound, partUnitKey, planPreviewRows } from '@/lib/utils/groups';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { PlanPreviewProps } from './PlanPreview.types';

/** Enough rounds to read the pattern without turning the card into a calendar. */
const PREVIEW_ROUNDS = 4;

/** The design's `transition: width .35s ease, margin-left .35s ease`. */
const SLIDE_DURATION_MS = 350;

type PlanRowProps = {
	label: string;
	range: string;
	/** Percent of the whole text, 0-100. */
	offset: number;
	width: number;
};

/**
 * One day's row. Split out so each can own its animated style — hooks can't run in a
 * loop in the parent — and so the bar slides to its new position when the spots stepper
 * moves instead of jumping there.
 */
const PlanRow = ({ label, offset, range, width }: PlanRowProps) => {
	const { theme } = useThemeContext();

	// Resolved out here: a worklet can only read plain values, not call into the theme.
	const fillColor = theme.colors.accent;

	const animatedFill = useAnimatedStyle(
		() => ({
			marginLeft: withTiming(`${offset}%`, { duration: SLIDE_DURATION_MS }),
			width: withTiming(`${width}%`, { duration: SLIDE_DURATION_MS })
		}),
		[offset, width]
	);

	return (
		<View style={styles.row}>
			<MonoText color={theme.colors.faintText} numberOfLines={1} style={styles.dayLabel}>
				{label}
			</MonoText>
			<Typography color={theme.colors.accent} numberOfLines={1} style={styles.range} variant='body'>
				{range}
			</Typography>
			<View style={[styles.track, { backgroundColor: theme.colors.track }]}>
				<Animated.View style={[styles.fill, { backgroundColor: fillColor }, animatedFill]} />
			</View>
		</View>
	);
};

/**
 * Shows what the chosen plan actually means, round by round: the range and where it sits
 * across the whole text — the hundred babs, or the Hizb's 33 portions. A ROTATION group walks
 * forward one seat each round, so the bar marches left to right; a FIXED group is one
 * unmoving row. The rows themselves are `planPreviewRows`, tested; this only labels them.
 */
export const PlanPreview = ({ kind, slotIndex = 0, splitMode, spots, style }: PlanPreviewProps) => {
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	const isRotation = splitMode === 'ROTATION';
	const total = partCountFor(kind);

	const rows = planPreviewRows({ maxRounds: PREVIEW_ROUNDS, partCount: total, slotIndex, splitMode, spots }).map(
		row => ({
			// Keyed by the round alone. Including the range would give the row a new identity
			// every time `spots` changes, remounting it — and a remounted bar can't animate
			// from where the old one was.
			key: row.roundIndex,
			// Rounds, not days: this step comes before the cycle is chosen, so "gün" would be
			// a guess — and a wrong one for a weekly group, which holds its range all week.
			label: row.isEveryRound ? t('everyRoundLabel') : t('roundShort', { n: row.roundIndex + 1 }),
			range: `${row.start}–${row.end}`,
			offset: row.offset,
			width: row.width
		})
	);

	return (
		/*
		 * **Glass, even though this only ever renders inside a sheet.** It was opted out on the
		 * reasoning that a sheet is already the platform's material, so a card of glass inside
		 * one is glass on glass — and that was overruled by looking at it. A panel inside a sheet
		 * is still a panel: it needs to read as a distinct surface from the sheet it sits on, and
		 * the material is what separates them. The same call was made for the share sheet's code
		 * panel. The blanket "no `CardSurface` in a sheet" rule is therefore about not *sweeping*
		 * sheets, not a ban.
		 */
		<CardSurface style={[styles.card, style]}>
			<View style={styles.headerRow}>
				<EyebrowText color={theme.colors.faintText}>
					{isRotation ? t('planRotation') : t('planFixed')}
				</EyebrowText>
				<CaptionText color={theme.colors.faintText}>
					{/* `spots` rounds is how long a full rotation takes — after that a seat is
					    back where it started, having read the whole book. A lone seat (the Hizb
					    allows one) reads all of it every round, which is what "Her tur" says,
					    on the row as well as here — and "1 rounds" is what the count would have
					    said. */}
					{movesEachRound(splitMode, spots)
						? t('roundsToFullCycle', { count: spots, total, unit: t(partUnitKey(kind)) })
						: t('everyRoundLabel')}
				</CaptionText>
			</View>
			<View style={styles.rows}>
				{rows.map(row => (
					<PlanRow key={row.key} label={row.label} offset={row.offset} range={row.range} width={row.width} />
				))}
			</View>
		</CardSurface>
	);
};

const styles = StyleSheet.create({
	card: {
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	// `minWidth`, not a fixed width: "G1" needs almost nothing while FIXED's "Her tur" is
	// several times wider, and pinning the column made the long one wrap onto two lines.
	// Every row within one plan carries the same shape of label, so they still line up.
	dayLabel: {
		minWidth: 30
	},
	fill: {
		borderRadius: 3,
		height: '100%'
	},
	headerRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 11
	},
	// Same reasoning — "97–100" is wider than "1–5", and the range must never wrap either.
	range: {
		minWidth: 58
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	rows: {
		gap: 6
	},
	track: {
		borderRadius: 3,
		flex: 1,
		height: 5,
		overflow: 'hidden'
	}
});
