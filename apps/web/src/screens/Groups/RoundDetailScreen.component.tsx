import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { CaptionText, NumericText, StatText } from '@/components/ui/Typography/Typography.component';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useGetGroupMembers } from '@/lib/hooks/useMembership';
import { useCoverBabs, useGetRoundDetail } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { formatBabRange } from '@/lib/utils/babs';
import { roundRows, type RoundCellState, roundCellStates, type RoundRow } from '@/lib/utils/rounds';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'RoundDetail'>;

/**
 * 10a. One closed round, bab by bab, and who still owes what.
 *
 * The grid shows every bab's fate at a glance; the rows underneath say whose it was. A
 * miss is not an error state — it is a share that went uncovered, which anyone can still
 * pick up. That's why the clay is softer than the app's danger red and why every
 * outstanding row carries an action rather than just a count.
 */
export const RoundDetailScreen = ({ navigation, route }: Props) => {
	const { groupId, roundIndex } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const viewerUserId = useCurrentUserId();

	const groupQuery = useGetGroupById(groupId);
	const roundQuery = useGetRoundDetail(groupId, roundIndex);
	const membersQuery = useGetGroupMembers(groupId);
	const coverBabs = useCoverBabs();

	if (groupQuery.isPending || roundQuery.isPending) {
		return (
			<ScreenContainer isScrollable={false}>
				<View style={styles.centered}>
					<ActivityIndicator color={theme.colors.accent} />
				</View>
			</ScreenContainer>
		);
	}

	if (groupQuery.isError || roundQuery.isError || !groupQuery.data || !roundQuery.data) {
		return (
			<ScreenContainer isScrollable={false}>
				<View style={styles.centered}>
					<EmptyState
						actionLabel={t('retry')}
						onAction={() => {
							groupQuery.refetch();
							roundQuery.refetch();
						}}
						title={t('genericError')}
					/>
				</View>
			</ScreenContainer>
		);
	}

	const round = roundQuery.data;
	const members = membersQuery.data ?? [];
	const cellStates = roundCellStates(round, viewerUserId);
	const rows = roundRows(round, members, viewerUserId);

	const cellColor = (state: RoundCellState) => (state === 'read' ? theme.colors.accent : theme.colors.missed);

	// Strong ring for your own share, soft for a block another member covered, nothing
	// otherwise — but always a colour, so every cell keeps the same footprint.
	const outlineFor = (state: RoundCellState) =>
		state === 'missedMine'
			? theme.colors.text
			: state === 'takenByOther'
			? theme.colors.borderStrong
			: theme.colors.transparent;

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
			case 'settled':
				return `${row.rangeLabel} · ${t(row.settledKey ?? 'noMisses')}`;
			case 'poolLeft':
				return `${row.rangeLabel} · ${t('poolLeft')}`;
			case 'wholeBlock':
				return `${row.rangeLabel}. ${t('bab')}`;
			default:
				// Both halves are ranges of the same shape, and the second sits *inside* the
				// first — "1–17 · 3–17" reads as one mistyped range unless each says which
				// question it answers.
				return `${t('assignedLbl')} ${row.rangeLabel} · ${t('missingLbl')} ${formatBabRange(
					row.outstanding
				)}. ${t('bab')}`;
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
		<ScreenContainer>
			<ScreenHeader
				eyebrow={`${t('roundN')} ${round.roundIndex + 1}`}
				onBack={navigation.goBack}
				title={t('missedTitle')}
			/>

			<View style={styles.statsRow}>
				<CardSurface style={styles.statCard}>
					<NumericText color={theme.colors.missed}>{round.missedCount}</NumericText>
					<StatText color={theme.colors.faintText} style={styles.statLabel}>
						{t('missedBabs')}
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
				<CellGrid
					borderWidth={2}
					columns={10}
					items={round.babs.map(bab => {
						const state = cellStates[bab.number] ?? 'missed';

						return {
							key: String(bab.number),
							label: String(bab.number),
							backgroundColor: cellColor(state),
							labelColor: theme.colors.onAccent,
							// Ownership rides on the outline, not the fill — the fill already
							// carries read-or-missed and can't say both at once.
							borderColor: outlineFor(state),
							isHatched: state === 'pool'
						};
					})}
				/>
			</CardSurface>

			<View style={styles.legend}>
				{legend.map(entry => (
					<View key={entry.state} style={styles.legendItem}>
						<View
							style={[
								styles.legendSwatch,
								{
									backgroundColor: cellColor(entry.state),
									borderColor: outlineFor(entry.state)
								}
							]}
						>
							{entry.state === 'pool' ? <Hatch /> : null}
						</View>
						<CaptionText color={theme.colors.subtext}>{entry.label}</CaptionText>
					</View>
				))}
			</View>

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
						<Avatar name={row.isPool ? t('pool') : row.name} size={38} />
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
									{`${coveredByLabel(row)} · ${formatBabRange(row.covered.babNumbers)}. ${t('bab')}`}
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
									// Your own miss is "Okudum"; someone else's, or the pool's,
									// is "Üstlen" — the same write, a different claim about it.
									title={row.isViewer ? t('markRead') : t('takeOver')}
									variant={row.isViewer ? 'accent' : 'accentOutline'}
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
	centered: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	},
	gridCard: {
		marginBottom: 11,
		padding: 13
	},
	legend: {
		columnGap: 14,
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginBottom: 20,
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
