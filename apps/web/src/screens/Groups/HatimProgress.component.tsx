import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { StatTile } from '@/components/ui/StatTile/StatTile.component';
import {
	BodyStrongText,
	CaptionText,
	MonoText,
	TitleText,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { cuzSuraRange } from '@/lib/content/cuz';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { isRepeatingCycle, type GroupCycle, type MyProgress } from '@/lib/types/domain';
import { Pressable, StyleSheet, View } from 'react-native';

type HatimProgressProps = {
	progress: MyProgress;
	cycle: GroupCycle;
	roundDays: number;
	/** Opens the in-app reader on a cüz — Q6's "Oku" leads to Q5, as the frame links it. */
	onReadCuz: (cuzNumber: number) => void;
	/** Opens the havuz, for an open round in which nothing is held yet. */
	onOpenPool: () => void;
};

/** A cell's three states, the design's `r` / `m` / `o`. */
type CellState = 'read' | 'missed' | 'open';

/**
 * Q6 — "Senin ilerlemen" for a hatim: one row per round, newest first, each cüz held in it
 * drawn as a cell that was read, was missed, or (this round) is still open.
 *
 * **Every cüz, not only the gaps** — the opposite of the Cevşen screen, deliberately. There a
 * share is a dozen babs a day and drawing them all buried the misses in grey; here a round
 * holds a cüz or two, so the whole of it fits in a row and the row *is* the record.
 */
export const HatimProgress = ({ cycle, onOpenPool, onReadCuz, progress, roundDays }: HatimProgressProps) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();

	const rounds = [...progress.periods].reverse();
	const missed = rounds.flatMap(period => period.missedBabs);

	const cellColours: Record<CellState, { backgroundColor: string; borderColor: string; color: string }> = {
		missed: {
			backgroundColor: theme.colors.missed,
			borderColor: theme.colors.missed,
			color: theme.colors.onAccent
		},
		// The one state drawn as a ring rather than a fill: it has not happened yet.
		open: { backgroundColor: theme.colors.surface, borderColor: theme.colors.accent, color: theme.colors.accent },
		read: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent, color: theme.colors.onAccent }
	};

	const legend: { key: 'qLegRead' | 'mpLegendNone' | 'mpLegendOpen'; state: CellState }[] = [
		{ key: 'qLegRead', state: 'read' },
		{ key: 'mpLegendNone', state: 'missed' },
		{ key: 'mpLegendOpen', state: 'open' }
	];

	return (
		<>
			<View style={styles.stats}>
				<StatTile
					label={t('qCuzRead')}
					style={styles.statTile}
					tone='accent'
					value={`${progress.readCount}/${progress.owedCount}`}
				/>
				<StatTile label={t('mpMissed')} style={styles.statTile} tone='missed' value={progress.missedCount} />
				<StatTile label={t('mpRate')} style={styles.statTile} value={`${progress.ratePercent}%`} />
			</View>

			<View style={styles.sectionHead}>
				<TitleText>
					{t(pluralKey(language, progress.periods.length, 'qThisHatimOne', 'qThisHatim'), {
						n: progress.periods.length
					})}
				</TitleText>
				<CaptionText color={theme.colors.subtext}>
					{/* A one-off has one round and no rhythm: it says how long, not how often. */}
					{isRepeatingCycle(cycle)
						? roundDays === 1
							? t('daily')
							: t('qEveryNDays', { n: roundDays })
						: `${roundDays} ${t('qDaysTotal')}`}
				</CaptionText>
			</View>

			<CardSurface isFlush>
				{rounds.map((period, index) => {
					const note = period.isOpen
						? { color: theme.colors.subtext, text: t('mpToday') }
						: period.missedCount > 0
						? { color: theme.colors.missed, text: `${period.missedCount} ${t('mpMissed')}` }
						: null;

					return (
						<View
							key={period.roundIndex}
							style={[
								styles.roundRow,
								index < rounds.length - 1
									? {
											borderBottomColor: theme.colors.divider,
											borderBottomWidth: StyleSheet.hairlineWidth
									  }
									: null
							]}
						>
							<MonoText color={theme.colors.faintText} style={styles.roundLabel}>
								{t('qRoundN', { n: period.roundIndex + 1 })}
							</MonoText>
							{/*
							 * **An open round with nothing in it says why, and where to go.** Under
							 * "Yeniden seçilir" the map empties at every boundary, so a member who has
							 * not chosen again sees a bare row that reads like a fault. Until the
							 * round-end prompt (Q9) asks them, the havuz is where cüz are taken.
							 */}
							{period.isOpen && period.units.length === 0 ? (
								<Pressable
									accessibilityRole='link'
									onPress={onOpenPool}
									style={({ pressed }) => [
										styles.cells,
										styles.emptyRound,
										{ opacity: pressed ? 0.6 : 1 }
									]}
								>
									<CaptionText color={theme.colors.subtext}>{t('qNoCuzThisRound')}</CaptionText>
									<View style={styles.poolLink}>
										<CaptionText color={theme.colors.accent} weight='semibold'>
											{t('qGoToPool')}
										</CaptionText>
										<Icon
											color={theme.colors.accent}
											name='chevronRight'
											size={14}
											strokeWidth={1.8}
										/>
									</View>
								</Pressable>
							) : (
								<View style={styles.cells}>
									{period.units.map(unit => {
										const colours =
											cellColours[unit.isRead ? 'read' : period.isOpen ? 'open' : 'missed'];

										return (
											<View
												key={unit.number}
												style={[
													styles.cell,
													{
														backgroundColor: colours.backgroundColor,
														borderColor: colours.borderColor
													}
												]}
											>
												<Typography
													color={colours.color}
													style={styles.cellLabel}
													weight='semibold'
												>
													{unit.number}
												</Typography>
											</View>
										);
									})}
								</View>
							)}
							{note ? <CaptionText color={note.color}>{note.text}</CaptionText> : null}
						</View>
					);
				})}
			</CardSurface>

			<View style={styles.legend}>
				{legend.map(item => (
					<View key={item.key} style={styles.legendItem}>
						<View
							style={[
								styles.swatch,
								{
									backgroundColor: cellColours[item.state].backgroundColor,
									borderColor: cellColours[item.state].borderColor
								}
							]}
						/>
						<CaptionText color={theme.colors.subtext}>{t(item.key)}</CaptionText>
					</View>
				))}
			</View>

			<View style={styles.sectionHead}>
				<TitleText>{t('qMissedCuz')}</TitleText>
				{missed.length > 0 ? <Chip label={String(missed.length)} tone='missed' /> : null}
			</View>

			{missed.length > 0 ? (
				missed.map(item => (
					<CardSurface key={`${item.roundIndex}-${item.babNumber}`} style={styles.missedCard}>
						<View style={[styles.missedTile, { backgroundColor: theme.colors.missedSurface }]}>
							<TitleText color={theme.colors.missed}>{item.babNumber}</TitleText>
						</View>
						<View style={styles.missedCopy}>
							<BodyStrongText>{t('qCuzTitle', { n: item.babNumber })}</BodyStrongText>
							<CaptionText color={theme.colors.subtext} numberOfLines={1}>
								{t('qMissedCuzSub', {
									range: cuzSuraRange(item.babNumber, language),
									round: item.roundIndex + 1
								})}
							</CaptionText>
						</View>
						<AppButton
							// Its own width beside a `flex: 1` column — see the Cevşen screen's row.
							fullWidth={false}
							onPress={() => onReadCuz(item.babNumber)}
							size='sm'
							style={styles.readButton}
							title={t('read')}
							variant='accent'
						/>
					</CardSurface>
				))
			) : (
				<CardSurface style={styles.empty}>
					<CaptionText color={theme.colors.subtext}>{t('qNoMissedCuz')}</CaptionText>
				</CardSurface>
			)}
		</>
	);
};

const styles = StyleSheet.create({
	cell: {
		alignItems: 'center',
		borderRadius: 8,
		borderWidth: 1.5,
		height: 30,
		justifyContent: 'center',
		minWidth: 30,
		paddingHorizontal: 8
	},
	cellLabel: {
		fontSize: 12,
		lineHeight: 15
	},
	cells: {
		flex: 1,
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 5
	},
	empty: {
		alignItems: 'center',
		padding: 18
	},
	// A column in the cells' slot: the line, then the link under it.
	emptyRound: {
		flexDirection: 'column',
		gap: 2
	},
	legend: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 14
	},
	legendItem: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	missedCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 14,
		paddingVertical: 13
	},
	missedCopy: {
		flex: 1,
		gap: 2,
		minWidth: 0
	},
	missedTile: {
		alignItems: 'center',
		borderRadius: 11,
		height: 38,
		justifyContent: 'center',
		width: 38
	},
	poolLink: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 2
	},
	readButton: {
		flexShrink: 0
	},
	roundLabel: {
		width: 44
	},
	roundRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 12
	},
	sectionHead: {
		alignItems: 'baseline',
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	statTile: {
		flex: 1
	},
	swatch: {
		borderRadius: 3,
		borderWidth: 1.5,
		height: 9,
		width: 9
	},
	stats: {
		flexDirection: 'row',
		gap: 8
	}
});
