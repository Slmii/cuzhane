import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { CaptionText, NumericText, StatText } from '@/components/ui/Typography/Typography.component';
import { useCachedGroup } from '@/lib/hooks/useCachedGroup';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useGetGroupMembers } from '@/lib/hooks/useMembership';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useCoverBabs, useGetRoundDetail } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { AppTheme } from '@/lib/theme/tokens';
import { formatBabRange } from '@/lib/utils/babs';
import { staggerWithinRuns } from '@/lib/utils/groups';
import { unitCountFor } from '@/lib/utils/units';
import { roundCellStates, roundRows, type RoundCellState, type RoundRow } from '@/lib/utils/rounds';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { RoundDetailSkeleton } from './RoundDetailSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'RoundDetail'>;

/** Stable empty, so the memo below doesn't hand the grid a new array on every render. */
const NO_ITEMS: CellGridItem[] = [];

/**
 * Strong ring for your own share, soft for a block another member covered, nothing
 * otherwise — but always a colour, so every cell keeps the same footprint.
 *
 * At module scope, taking the theme, so the memoised cells can call it without listing a
 * per-render copy of it as a dependency that always changed.
 *
 * **It used to be the outline alone, over a fill that was only read-or-missed** — and that
 * put four of the five states in the same clay, so the legend read as red, red, red, red.
 * The two that were never misses are the ones that had to move: a bab somebody else covered
 * *was* read, and a pool block was never anyone's to miss. Both now borrow the group board's
 * own tokens (`babReadByOthers`, `poolFree`), so the two screens say the same thing with the
 * same colour and the clay is left to mean one thing.
 */
const appearanceFor = (state: RoundCellState, theme: AppTheme) => {
	switch (state) {
		case 'read':
			return {
				backgroundColor: theme.colors.babReadByMe,
				borderColor: theme.colors.babReadByMe,
				labelColor: theme.colors.onAccent
			};
		// Yours, and nobody read it. The one cell on this board that is about the reader, and
		// the only one the clay is spent on — see the note above.
		case 'missedMine':
			return {
				backgroundColor: theme.colors.missed,
				borderColor: theme.colors.text,
				labelColor: theme.colors.onAccent
			};
		// Yours, but somebody stepped in. It **was** read, so it takes the same soft green the
		// group board gives a bab read by someone else.
		case 'takenByOther':
			return {
				backgroundColor: theme.colors.babReadByOthers,
				borderColor: theme.colors.babReadByOthers,
				labelColor: theme.colors.babOthersText
			};
		// An empty seat's block: never anyone's to miss, so it wears the pool's tan and its
		// hatch rather than the clay.
		case 'pool':
			return {
				backgroundColor: theme.colors.poolFree,
				borderColor: theme.colors.poolFree,
				labelColor: theme.colors.sandText
			};
		default:
			return {
				backgroundColor: theme.colors.missed,
				borderColor: theme.colors.missed,
				labelColor: theme.colors.onAccent
			};
	}
};

/**
 * 10a. One closed round, bab by bab, and who still owes what.
 *
 * The grid shows every bab's fate at a glance; the rows underneath say whose it was. A
 * miss is not an error state — it is a share that went uncovered, which anyone can still
 * pick up. That's why the clay is softer than the app's danger red and why every
 * outstanding row carries an action rather than just a count.
 */
// No `navigation`: going back is the navigator's own header button now.
export const RoundDetailScreen = ({ route }: Props) => {
	const { groupId, roundIndex } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const viewerUserId = useCurrentUserId();

	const groupQuery = useGetGroupById(groupId);
	// The board's size while it loads: the group's kind once known, else what the list said.
	const cachedKind = useCachedGroup(groupId)?.kind;
	const roundQuery = useGetRoundDetail(groupId, roundIndex);
	const membersQuery = useGetGroupMembers(groupId);
	const coverBabs = useCoverBabs();
	const pullToRefresh = usePullToRefresh(groupQuery, roundQuery, membersQuery);

	/*
	 * The hundred cells, memoised above the early returns like the queries themselves.
	 * `CellGrid` memoises a cell on the identity of the item it was handed, and this screen
	 * rebuilt all hundred inline whenever anything on it rendered — covering a single bab
	 * re-evaluated every animated style on the board.
	 */
	const cells = useMemo<CellGridItem[]>(() => {
		const round = roundQuery.data;

		if (!round) {
			return NO_ITEMS;
		}

		const states = roundCellStates(round, viewerUserId);
		// Stagger per run of like cells, so a covered stretch fills in sequence.
		const delays = staggerWithinRuns(round.babs.map(bab => states[bab.number] ?? 'missed'));

		return round.babs.map((bab, index) => {
			const state = states[bab.number] ?? 'missed';

			return {
				key: String(bab.number),
				label: String(bab.number),
				...appearanceFor(state, theme),
				fillDelay: delays[index] ?? 0,
				isHatched: state === 'pool'
			};
		});
	}, [roundQuery.data, theme, viewerUserId]);

	if (groupQuery.isPending || roundQuery.isPending) {
		return (
			<ScreenContainer>
				{/*
				 * The heading is real — the round number is a route param, not something the
				 * request tells us — so only the board is stubbed. The lattice is nearly the
				 * whole page's height here, which is what made a spinner followed by a hundred
				 * cells feel like the screen arriving twice.
				 */}
				<ScreenHeader eyebrow={`${t('roundN')} ${roundIndex + 1}`} hasBackButton title={t('missedTitle')} />
				<RoundDetailSkeleton cellCount={unitCountFor(groupQuery.data?.kind ?? cachedKind ?? 'CEVSEN')} />
			</ScreenContainer>
		);
	}

	if (groupQuery.isError || roundQuery.isError || !groupQuery.data || !roundQuery.data) {
		return <ErrorState queries={[groupQuery, roundQuery]} />;
	}

	const round = roundQuery.data;
	const members = membersQuery.data ?? [];
	const rows = roundRows(round, members, viewerUserId);
	// "5. bab" or "5. cüz" — a hatim's missed units are cüz.
	const isHatim = groupQuery.data.kind === 'HATIM';
	const unitWord = t(isHatim ? 'cuz' : 'bab');

	/**
	 * Who did the covering, from the reader's point of view: "devraldığın" on your own row,
	 * "sen üstlendin" when you covered for someone else, and their name when it was anyone
	 * else. Seeing your own name here reads as though a stranger stepped in.
	 */
	const coveredByLabel = (row: RoundRow) =>
		row.isViewer
			? t('fromMember')
			: row.covered?.isViewer
			? t('transferred')
			: `${row.covered?.byName} ${t('tookOver')}`;

	/** The row's second line. Which shape it takes is decided in `roundRows` and tested there. */
	const detailLine = (row: RoundRow) => {
		switch (row.detailKind) {
			case 'settled': {
				const settled = t(row.settledKey ?? 'noMisses');

				/*
				 * The accent line underneath already names who covered the range, and when
				 * that was you both lines resolve to "sen üstlendin" — the row said it twice,
				 * once stacked directly above the other. Compared rather than special-cased on
				 * the key, so any future pair that collides is caught the same way.
				 */
				return row.covered && coveredByLabel(row) === settled
					? row.rangeLabel
					: `${row.rangeLabel} · ${settled}`;
			}
			case 'poolLeft':
				return `${row.rangeLabel} · ${t('poolLeft')}`;
			case 'wholeBlock':
				return `${row.rangeLabel}. ${unitWord}`;
			default:
				// Both halves are ranges of the same shape, and the second sits *inside* the
				// first — "1–17 · 3–17" reads as one mistyped range unless each says which
				// question it answers.
				return `${t('assignedLbl')} ${row.rangeLabel} · ${t('missingLbl')} ${formatBabRange(
					row.outstanding
				)}. ${unitWord}`;
		}
	};

	const legend: { state: RoundCellState; label: string }[] = [
		{ state: 'read', label: t('legendDone') },
		{ state: 'missed', label: t('legendMissed') },
		{ state: 'missedMine', label: t('legendMine') },
		{ state: 'takenByOther', label: t('legendTaken') },
		{ state: 'pool', label: t('legendPool') }
	];

	return (
		<ScreenContainer pullToRefresh={pullToRefresh}>
			<ScreenHeader eyebrow={`${t('roundN')} ${round.roundIndex + 1}`} hasBackButton title={t('missedTitle')} />

			<View style={styles.statsRow}>
				<CardSurface style={styles.statCard}>
					<NumericText color={theme.colors.missed}>{round.missedCount}</NumericText>
					<StatText color={theme.colors.faintText} style={styles.statLabel}>
						{t(isHatim ? 'missedCuz' : 'missedBabs')}
					</StatText>
				</CardSurface>
				<CardSurface style={styles.statCard}>
					<NumericText>{round.missedPeopleCount}</NumericText>
					<StatText color={theme.colors.faintText} style={styles.statLabel}>
						{t('missedPeople')}
					</StatText>
				</CardSurface>
				<CardSurface style={styles.statCard}>
					<NumericText color={theme.colors.accent}>{round.readCount}</NumericText>
					<StatText color={theme.colors.faintText} style={styles.statLabel}>
						{t('legendDone')}
					</StatText>
				</CardSurface>
			</View>

			<CardSurface style={styles.gridCard}>
				{/*
				 * Every cell carries a 2pt border and most of them make it transparent: the
				 * grid takes one border width for all cells, and a ring that only some cells
				 * had would shift the others by two points.
				 */}
				{/*
				 * Covering a stretch of missed babs sweeps them left to right rather than
				 * repainting the block at once — the same fill the havuz uses, and for the
				 * same reason: the sweep is what says *these* are the ones you just took.
				 * Runs are keyed on state, since a cover changes a contiguous stretch.
				 */}
				<CellGrid borderWidth={2} columns={10} items={cells} />

				{/*
				 * **Inside the card, with the board it keys.** It sat below the card as a loose
				 * row, which read as a footnote to the screen rather than as the key to the
				 * grid directly above it — and left the only board in the app whose legend was
				 * not on the same surface as its cells. The group board and the pool both keep
				 * theirs in.
				 */}
				<View style={styles.legend}>
					{legend.map(entry => (
						<View key={entry.state} style={styles.legendItem}>
							{/* The same table the cells use, so a swatch cannot drift from what it keys. */}
							<View
								style={[
									styles.legendSwatch,
									{
										backgroundColor: appearanceFor(entry.state, theme).backgroundColor,
										borderColor: appearanceFor(entry.state, theme).borderColor
									}
								]}
							>
								{entry.state === 'pool' ? <Hatch /> : null}
							</View>
							<CaptionText color={theme.colors.subtext}>{entry.label}</CaptionText>
						</View>
					))}
				</View>
			</CardSurface>

			<StatText color={theme.colors.faintText} style={styles.rowsHeading}>
				{t('missedTitle')}
			</StatText>

			{/*
			 * The server refuses to overwrite a read that already exists, so losing the race
			 * is the only way a cover can fail. Saying so beats a button that appears to do
			 * nothing — by the time this shows, the list behind it has already refreshed.
			 */}
			{coverBabs.isError ? (
				<CaptionText color={theme.colors.missed} style={styles.coverError}>
					{t('babTakenError')}
				</CaptionText>
			) : null}

			<View style={styles.rows}>
				{rows.map(row => (
					<CardSurface key={row.key} style={styles.row}>
						<Avatar imageUrl={row.imageUrl} name={row.isPool ? t('pool') : row.name} size={38} />
						<View style={styles.rowCopy}>
							<CaptionText weight='semibold'>
								{row.isPool ? t('pool') : row.isViewer ? `${row.name} · ${t('you')}` : row.name}
							</CaptionText>
							<CaptionText color={theme.colors.subtext} style={styles.rowDetail}>
								{detailLine(row)}
							</CaptionText>
							{row.covered ? (
								<CaptionText color={theme.colors.accent} style={styles.rowDetail}>
									{/* Your row reads "devraldığın · 18, 19. bab"; someone else's
									    names who stepped in: "Hasan T. devraldı · 18, 19. bab". */}
									{`${coveredByLabel(row)} · ${formatBabRange(row.covered.babNumbers)}. ${unitWord}`}
								</CaptionText>
							) : null}
						</View>
						{row.outstanding.length > 0 && row.settledKey === null ? (
							<>
								<NumericText color={theme.colors.missed} style={styles.rowCount}>
									{row.outstanding.length}
								</NumericText>
								<AppButton
									fullWidth={false}
									disabled={coverBabs.isPending}
									onPress={() =>
										coverBabs.mutate({
											groupId,
											roundIndex: round.roundIndex,
											// The whole block in one act — taking on someone's
											// share means taking on all of it, not a bab a tap.
											babNumbers: row.outstanding
										})
									}
									size='sm'
									/*
									 * **Both variants carry a glyph**, for the reason the pool's
									 * button records: one with an icon beside one without reads as
									 * two different controls, and here the two sit in the same
									 * list — your own row and somebody else's, one above the
									 * other. `claim` is the icon set's own name for this act
									 * ("Üstlen · Claim"); the tick is what Okudum wears elsewhere.
									 */
									icon={row.isViewer ? 'check' : 'claim'}
									// Your own miss is "Okudum"; someone else's, or the pool's,
									// is "Üstlen" — the same write, a different claim about it.
									title={row.isViewer ? t('markRead') : t('takeOver')}
									variant='accent'
								/>
							</>
						) : null}
					</CardSurface>
				))}
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	gridCard: {
		marginBottom: 11,
		padding: 13
	},
	/**
	 * The same 11 `PoolGrid` puts between its board and its key.
	 *
	 * It had a `marginBottom: 20` and no top margin, which was right while it sat *below* the
	 * card — the gap was to the next section. Inside the card those are both wrong: the key
	 * ends up flush against the last row of cells, and the bottom margin adds to the card's
	 * own padding.
	 */
	legend: {
		columnGap: 14,
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 11,
		rowGap: 8
	},
	legendItem: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	legendSwatch: {
		borderRadius: 4,
		borderWidth: 2,
		height: 11,
		overflow: 'hidden',
		// Slightly larger than the design's 9px: at 9 the 2pt ring leaves a 5pt core, and
		// the hatch has nothing left to show through.
		width: 11
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	rowCopy: {
		flex: 1,
		minWidth: 0
	},
	rowCount: {
		marginRight: 2
	},
	rowDetail: {
		marginTop: 2
	},
	rows: {
		gap: 9
	},
	coverError: {
		marginBottom: 10
	},
	rowsHeading: {
		marginBottom: 10
	},
	statCard: {
		flex: 1,
		paddingHorizontal: 14,
		paddingVertical: 13
	},
	statLabel: {
		marginTop: 4
	},
	statsRow: {
		flexDirection: 'row',
		gap: 8,
		marginBottom: 14
	}
});
