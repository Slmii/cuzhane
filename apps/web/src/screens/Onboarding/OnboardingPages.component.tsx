import { BrandMark } from '@/components/ui/BrandMark/BrandMark.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, NumericText, StatText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

/**
 * The five illustrations of A1, one to one with the design's frames. Each is a still life of a
 * real screen rather than the screen itself — small enough to read at a glance, and never
 * wired to live data: onboarding runs before there is any.
 *
 * **Each draws its own container**, because the frames do not share one: 1–3 sit in a tinted
 * card (1 with its own padding), while 4 is three white cards and 5 a row of tiles over a
 * tinted card.
 */

/** The frames' tinted panel: `background: rgba(28,29,26,.04); border: 1px; radius 20`. */
const ArtCard = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => {
	const { theme } = useThemeContext();

	return (
		<View
			style={[
				styles.artCard,
				{ backgroundColor: toAlphaColor(theme.colors.text, 0.04), borderColor: theme.colors.border },
				style
			]}
		>
			{children}
		</View>
	);
};

/** The frames' white card, for slide 4. */
const WhiteCard = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => {
	const { theme } = useThemeContext();

	return (
		<View
			style={[
				styles.whiteCard,
				{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
				style
			]}
		>
			{children}
		</View>
	);
};

/** 1 · the shelf filling. Nine read, five still open. */
const SHELF_HEIGHTS = [34, 52, 40, 64, 46, 58, 36, 68, 50, 44, 60, 38, 54, 42];
const SHELF_READ_COUNT = 9;
/** `om-grow .55s cubic-bezier(.2,.9,.25,1) both`, each bar 0.05s after the one before. */
const SHELF_GROW = {
	from: { opacity: 0, transform: [{ scaleY: 0.06 }] },
	to: { opacity: 1, transform: [{ scaleY: 1 }] }
};
const SHELF_GROW_MS = 550;
const SHELF_GROW_STEP_MS = 50;
const SHELF_GROW_EASING = cubicBezier(0.2, 0.9, 0.25, 1);

export const ShelfFillingArt = () => {
	const { theme } = useThemeContext();
	const isReducedMotion = useReducedMotion();

	return (
		<ArtCard style={styles.shelfCard}>
			<View style={styles.shelfRow}>
				{SHELF_HEIGHTS.map((height, index) => (
					<Animated.View
						key={`${height}-${index}`}
						// One flat object: Reanimated reads the animation properties off the style itself.
						style={{
							backgroundColor: index < SHELF_READ_COUNT ? theme.colors.accent : theme.colors.markFaded,
							borderRadius: 5,
							height,
							transformOrigin: 'bottom',
							width: 9,
							...(isReducedMotion
								? null
								: {
										animationDelay: index * SHELF_GROW_STEP_MS,
										animationDuration: SHELF_GROW_MS,
										animationFillMode: 'both' as const,
										animationName: SHELF_GROW,
										animationTimingFunction: SHELF_GROW_EASING
								  })
						}}
					/>
				))}
			</View>
			<View style={[styles.shelfBase, { backgroundColor: theme.colors.accent }]} />
			<View style={styles.shelfCount}>
				<NumericText color={theme.colors.accent} style={styles.shelfNumeral}>
					62
				</NumericText>
				<StatText color={theme.colors.faintText}>/ 100 bab</StatText>
			</View>
		</ArtCard>
	);
};

/** 2 · the three fields a group needs, and the code that comes out. */
export const CreateGroupArt = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const rows: [string, string][] = [
		[t('obGroupName'), 'Mahalle Hatmi'],
		[t('obPeople'), '12 / 20'],
		[t('obRoundLength'), '30 gün']
	];

	return (
		<ArtCard>
			<View style={styles.stack}>
				{rows.map(([label, value]) => (
					<View
						key={label}
						style={[
							styles.fieldRow,
							{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
						]}
					>
						<StatText color={theme.colors.faintText}>{label}</StatText>
						<CaptionText weight='semibold'>{value}</CaptionText>
					</View>
				))}
			</View>
			<View style={[styles.codeRow, { backgroundColor: theme.colors.accentSoft }]}>
				<Typography color={theme.colors.accent} style={styles.code}>
					HATM-4K2P
				</Typography>
				<CaptionText color={theme.colors.accent} weight='semibold'>
					{t('obShareCode')}
				</CaptionText>
			</View>
		</ArtCard>
	);
};

/**
 * 3 · the board, bab 7 to 31, cell for cell as the frame draws it. "Başkası okudu" is the
 * frame's `#DCE7DF` on `#2F5B4C`, and `#2B3B33` on `#8FB8A6` in dark — which is exactly
 * `poolTaken` / `poolTakenText`, not the group board's lighter `babReadByOthers`.
 */
type BoardState = 'mine' | 'other' | 'open' | 'pool';

// Five rows of five, as the frame lays the board out.
// prettier-ignore
const BOARD_STATES: BoardState[] = [
	'mine', 'other', 'open', 'other', 'mine',
	'other', 'pool', 'mine', 'other', 'open',
	'pool', 'other', 'mine', 'other', 'open',
	'other', 'mine', 'pool', 'other', 'open',
	'mine', 'other', 'open', 'other', 'mine'
];
const BOARD_FIRST_BAB = 7;

export const PoolGridArt = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const items = useMemo<CellGridItem[]>(
		() =>
			BOARD_STATES.map((state, index) => ({
				key: String(index),
				label: String(index + BOARD_FIRST_BAB),
				backgroundColor:
					state === 'mine'
						? theme.colors.accent
						: state === 'other'
						? theme.colors.poolTaken
						: theme.colors.track,
				labelColor:
					state === 'mine'
						? theme.colors.onAccent
						: state === 'other'
						? theme.colors.poolTakenText
						: theme.colors.faintText,
				isHatched: state === 'pool'
			})),
		[theme]
	);

	// The frame's own words — "okunmadı", not the group board's `legendOpen` ("başkasında"),
	// which names another member's block and would mislabel the open cells here.
	const legend: { color: string; isHatched?: boolean; label: string }[] = [
		{ color: theme.colors.accent, label: t('obLegendRead') },
		{ color: theme.colors.poolTaken, label: t('obLegendOthers') },
		{ color: theme.colors.track, label: t('obLegendOpen') },
		{ color: theme.colors.track, isHatched: true, label: t('legendPool') }
	];

	return (
		<ArtCard>
			<CellGrid columns={5} items={items} />
			<View style={styles.legend}>
				{legend.map(item => (
					<View key={item.label} style={styles.legendItem}>
						<View style={[styles.legendSwatch, { backgroundColor: item.color }]}>
							{item.isHatched ? <Hatch radius={3} /> : null}
						</View>
						<CaptionText color={theme.colors.subtext}>{item.label}</CaptionText>
					</View>
				))}
			</View>
		</ArtCard>
	);
};

/** 4 · the hour, the switch, and what actually arrives — three white cards, no panel. */
export const ReminderArt = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View style={styles.cardStack}>
			<WhiteCard style={styles.timeCard}>
				<StatText color={theme.colors.faintText} style={styles.timeEyebrow}>
					{t('obDailyAt')}
				</StatText>
				<View style={styles.timeRow}>
					{/* The frame sets a bare "–" here; the icon rules keep typographic characters out. */}
					<Icon color={theme.colors.faintText} name='minus' size={15} strokeWidth={1.8} />
					<Typography style={styles.time} variant='display'>
						21:30
					</Typography>
					<Icon color={theme.colors.faintText} name='plus' size={15} strokeWidth={1.8} />
				</View>
			</WhiteCard>

			<WhiteCard style={styles.toggleCard}>
				<View style={styles.toggleCopy}>
					<CaptionText weight='semibold'>{t('obReminderTitle')}</CaptionText>
					<CaptionText color={theme.colors.subtext}>{t('obReminderSub')}</CaptionText>
				</View>
				{/* Drawn, not an `AppSwitch`: nothing here is operable. The frame's `.sw`, 44×26. */}
				<View style={[styles.switchTrack, { backgroundColor: theme.colors.accent }]}>
					<View style={[styles.switchKnob, { backgroundColor: theme.colors.onAccent }]} />
				</View>
			</WhiteCard>

			{/* What arrives: the app's mark on a sage tile, as the lock screen shows it. */}
			<WhiteCard style={styles.notificationCard}>
				<View style={[styles.notificationIcon, { backgroundColor: theme.colors.accent }]}>
					<BrandMark
						color={theme.colors.onAccent}
						fadedColor={toAlphaColor(theme.colors.onAccent, 0.34)}
						size={18}
					/>
				</View>
				<View style={styles.notificationCopy}>
					<CaptionText weight='semibold'>Cüzhane · Mahalle Hatmi</CaptionText>
					<CaptionText color={theme.colors.subtext} style={styles.notificationBody}>
						{t('obNotifBody')}
					</CaptionText>
				</View>
			</WhiteCard>
		</View>
	);
};

/** 5 · what a finished round leaves behind — three tiles over a five-week month. */
const HEAT_OPACITIES = [
	0.85, 0.4, 1, 0.6, 0.15, 0.9, 0.5, 0.7, 1, 0.3, 0.55, 0.8, 0.2, 0.95, 0.45, 1, 0.65, 0.35, 0.75, 0.9, 0.25, 0.6, 1,
	0.5, 0.8, 0.4, 0.7, 0.95, 0.3, 0.85, 0.55, 1, 0.45, 0.65, 0.9
];
const HEAT_COLUMNS = 7;

export const RoundRecordArt = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const stats: [string, string][] = [
		['7', t('obStatRounds')],
		['41', t('obStatBabs')],
		['19', t('obStatStreak')]
	];

	return (
		<View style={styles.cardStack}>
			<View style={styles.statRow}>
				{stats.map(([value, label]) => (
					<View
						key={label}
						style={[
							styles.statTile,
							{ backgroundColor: toAlphaColor(theme.colors.text, 0.04), borderColor: theme.colors.border }
						]}
					>
						<NumericText color={theme.colors.accent} style={styles.statValue}>
							{value}
						</NumericText>
						<StatText color={theme.colors.faintText} style={styles.statLabel}>
							{label}
						</StatText>
					</View>
				))}
			</View>

			<ArtCard style={styles.heatCard}>
				{/*
				 * Explicit rows of `flex: 1`, not a wrapping row of percentage widths. Seven cells
				 * at 100/7% each round up past the container and the row wraps at six — the same
				 * trap `GridSkeleton` documents.
				 */}
				{Array.from({ length: Math.ceil(HEAT_OPACITIES.length / HEAT_COLUMNS) }, (_, rowIndex) => (
					<View key={rowIndex} style={styles.heatRow}>
						{HEAT_OPACITIES.slice(rowIndex * HEAT_COLUMNS, (rowIndex + 1) * HEAT_COLUMNS).map(
							(opacity, index) => (
								<View key={`${opacity}-${index}`} style={styles.heatSlot}>
									<View
										style={[
											styles.heatCell,
											{ backgroundColor: toAlphaColor(theme.colors.accent, opacity) }
										]}
									/>
								</View>
							)
						)}
					</View>
				))}
			</ArtCard>
		</View>
	);
};

const styles = StyleSheet.create({
	artCard: {
		borderRadius: 20,
		borderWidth: 1,
		padding: 18
	},
	cardStack: {
		gap: 10
	},
	code: {
		fontSize: 19,
		letterSpacing: 1.9
	},
	codeRow: {
		alignItems: 'center',
		borderRadius: 14,
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between',
		marginTop: 12,
		padding: 13
	},
	fieldRow: {
		alignItems: 'center',
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 13,
		paddingVertical: 11
	},
	// The heat card's `padding: 15`, less the 2.5 each slot adds on its outer side.
	heatCard: {
		padding: 12.5
	},
	heatCell: {
		aspectRatio: 1,
		borderRadius: 3,
		width: '100%'
	},
	heatRow: {
		flexDirection: 'row'
	},
	heatSlot: {
		flex: 1,
		flexDirection: 'row',
		padding: 2.5
	},
	legend: {
		columnGap: 14,
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 12,
		rowGap: 6
	},
	legendItem: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	legendSwatch: {
		borderRadius: 3,
		height: 9,
		overflow: 'hidden',
		width: 9
	},
	notificationBody: {
		marginTop: 3
	},
	notificationCard: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: 12,
		padding: 14
	},
	notificationCopy: {
		flex: 1,
		minWidth: 0
	},
	notificationIcon: {
		alignItems: 'center',
		borderRadius: 9,
		height: 30,
		justifyContent: 'center',
		width: 30
	},
	shelfBase: {
		borderRadius: 3,
		height: 6,
		marginBottom: 14,
		marginTop: 8
	},
	// `padding: 22px 20px 18px` — slide 1's panel alone is padded differently.
	shelfCard: {
		paddingBottom: 18,
		paddingHorizontal: 20,
		paddingTop: 22
	},
	shelfCount: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 7,
		justifyContent: 'center'
	},
	shelfNumeral: {
		fontSize: 22,
		lineHeight: 22
	},
	shelfRow: {
		alignItems: 'flex-end',
		flexDirection: 'row',
		gap: 5,
		height: 70,
		justifyContent: 'center'
	},
	stack: {
		gap: 8
	},
	statLabel: {
		marginTop: 5
	},
	statRow: {
		flexDirection: 'row',
		gap: 8
	},
	statTile: {
		borderRadius: 14,
		borderWidth: 1,
		flex: 1,
		paddingHorizontal: 12,
		paddingVertical: 13
	},
	statValue: {
		fontSize: 21,
		lineHeight: 21
	},
	switchKnob: {
		borderRadius: 10,
		height: 20,
		marginLeft: 'auto',
		width: 20
	},
	switchTrack: {
		borderRadius: 13,
		flexDirection: 'row',
		height: 26,
		padding: 3,
		width: 44
	},
	time: {
		fontSize: 38,
		lineHeight: 38
	},
	timeCard: {
		alignItems: 'center',
		padding: 18
	},
	timeEyebrow: {
		marginBottom: 8
	},
	timeRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 14
	},
	toggleCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		padding: 15
	},
	toggleCopy: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	whiteCard: {
		borderRadius: 20,
		borderWidth: 1
	}
});
