import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, NumericText, StatText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * The five illustrations. Each is a still life of a real screen rather than the screen
 * itself — small enough to read at a glance, and never wired to live data: onboarding runs
 * before there is any.
 */

/** 1 · the shelf filling. Nine read, five still open. */
const SHELF_HEIGHTS = [34, 52, 40, 64, 46, 58, 36, 68, 50, 44, 60, 38, 54, 42];
const SHELF_READ_COUNT = 9;

export const ShelfFillingArt = () => {
	const { theme } = useThemeContext();

	return (
		<View>
			<View style={styles.shelfRow}>
				{SHELF_HEIGHTS.map((height, index) => (
					<View
						key={`${height}-${index}`}
						style={{
							backgroundColor: index < SHELF_READ_COUNT ? theme.colors.accent : theme.colors.accentMid,
							borderRadius: 5,
							height,
							width: 9
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
		</View>
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
			<View style={[styles.codeRow, { backgroundColor: theme.colors.accentSoft }]}>
				<Typography color={theme.colors.accent} style={styles.code}>
					HATM-4K2P
				</Typography>
				<CaptionText color={theme.colors.accent} weight='semibold'>
					{t('obShareCode')}
				</CaptionText>
			</View>
		</View>
	);
};

/** 3 · the board, with one bab in each state the legend names. */
const GRID_STATES = ['mine', 'other', 'open', 'other', 'mine', 'other', 'pool', 'mine', 'other', 'open'] as const;

export const PoolGridArt = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const items = useMemo<CellGridItem[]>(
		() =>
			GRID_STATES.map((state, index) => ({
				key: String(index),
				label: String(index + 7),
				backgroundColor:
					state === 'mine'
						? theme.colors.accent
						: state === 'other'
						? theme.colors.babReadByOthers
						: theme.colors.track,
				labelColor: state === 'mine' ? theme.colors.onAccent : theme.colors.subtext,
				isHatched: state === 'pool'
			})),
		[theme]
	);

	const legend: [string, string][] = [
		[t('legendRead'), theme.colors.accent],
		[t('legendOthers'), theme.colors.babReadByOthers],
		[t('legendOpen'), theme.colors.track]
	];

	return (
		<View>
			<CellGrid columns={5} items={items} />
			<View style={styles.legend}>
				{legend.map(([label, colour]) => (
					<View key={label} style={styles.legendItem}>
						<View style={[styles.legendSwatch, { backgroundColor: colour }]} />
						<CaptionText color={theme.colors.subtext}>{label}</CaptionText>
					</View>
				))}
			</View>
		</View>
	);
};

/** 4 · the hour, the switch, and what actually arrives. */
export const ReminderArt = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	return (
		<View style={styles.stack}>
			<View style={styles.timeBlock}>
				<StatText color={theme.colors.faintText}>{t('obDailyAt')}</StatText>
				<View style={styles.timeRow}>
					<Icon color={theme.colors.faintText} name='minus' size={15} strokeWidth={1.8} />
					<Typography style={styles.time} variant='display'>
						21:30
					</Typography>
					<Icon color={theme.colors.faintText} name='plus' size={15} strokeWidth={1.8} />
				</View>
			</View>

			<View
				style={[styles.toggleRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
			>
				<View style={styles.toggleCopy}>
					<CaptionText weight='semibold'>{t('obReminderTitle')}</CaptionText>
					<CaptionText color={theme.colors.subtext}>{t('obReminderSub')}</CaptionText>
				</View>
				{/* Drawn, not an `AppSwitch`: nothing here is operable. */}
				<View style={[styles.switchTrack, { backgroundColor: theme.colors.accent }]}>
					<View style={[styles.switchKnob, { backgroundColor: theme.colors.onAccent }]} />
				</View>
			</View>
		</View>
	);
};

/** 5 · what a finished round leaves behind. */
const HEAT_OPACITIES = [
	0.85, 0.4, 1, 0.6, 0.15, 0.9, 0.5, 0.7, 1, 0.3, 0.55, 0.8, 0.2, 0.95, 0.45, 1, 0.65, 0.35, 0.75, 0.9, 0.25
];

export const RoundRecordArt = () => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();

	const stats: [string, string][] = [
		['7', t('obStatRounds')],
		['41', t('obStatBabs')],
		['19', t('obStatStreak')]
	];

	return (
		<View style={styles.stack}>
			<View style={styles.statRow}>
				{stats.map(([value, label]) => (
					<View
						key={label}
						style={[
							styles.statTile,
							{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
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

			{/*
			 * Explicit rows of `flex: 1`, not a wrapping row of percentage widths. Seven cells
			 * at 100/7% each round up past the container and the row wraps at six — the same
			 * trap `GridSkeleton` documents, and it laid this grid out 6/6/6/3.
			 */}
			<View>
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
			</View>
		</View>
	);
};

const HEAT_COLUMNS = 7;

const styles = StyleSheet.create({
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
		marginTop: 4,
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
		width: 9
	},
	shelfBase: {
		borderRadius: 3,
		height: 6,
		marginBottom: 14,
		marginTop: 8
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
		borderRadius: 9,
		height: 18,
		marginLeft: 'auto',
		width: 18
	},
	switchTrack: {
		borderRadius: 11,
		flexDirection: 'row',
		height: 22,
		padding: 2,
		width: 38
	},
	time: {
		fontSize: 38,
		lineHeight: 38
	},
	timeBlock: {
		alignItems: 'center',
		gap: 8
	},
	timeRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 14
	},
	toggleCopy: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	toggleRow: {
		alignItems: 'center',
		borderRadius: 20,
		borderWidth: 1,
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		padding: 15
	}
});
