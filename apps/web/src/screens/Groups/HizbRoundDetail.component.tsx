import { WrapperApiError } from '@/api/wrapper.api';
import { HIZB_RING_WIDTH, hizbRoundCellItem } from '@/components/HizbBoard/hizbCellPalette';
import { HizbLegend } from '@/components/HizbBoard/HizbLegend.component';
import type { PullToRefreshState } from '@/components/ui/PullToRefresh/PullToRefresh.types';
import { LateReadingNotice } from '@/components/LateReadingNotice/LateReadingNotice.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { Avatar } from '@/components/ui/Avatar/Avatar.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import { CaptionText, NumericText, StatText } from '@/components/ui/Typography/Typography.component';
import { useCoverBabs } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupDetail, GroupMember, RoundDetail } from '@/lib/types/domain';
import { formatBabRange } from '@/lib/utils/babs';
import { hizbPartsLabel } from '@/lib/utils/groups';
import {
	hizbRoundCells,
	hizbRoundRows,
	missedPeopleCount,
	roundDateRange,
	type HizbRoundRow
} from '@/lib/utils/rounds';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/** HZ5's lattice at eleven across, so the 32 come out as three rows — the Havuz's layout. */
export const HIZB_ROUND_COLUMNS = 11;

/** What the cover endpoint answers when somebody else read the portion first. */
const COVER_TAKEN_STATUS = 409;

type Props = {
	group: Pick<GroupDetail, 'id' | 'timezone' | 'hideMemberNames' | 'isOwner'>;
	round: RoundDetail;
	members: GroupMember[];
	viewerUserId: string | null;
	pullToRefresh: PullToRefreshState;
	/** Opens a portion in the reader, covering this round — Sekine's way in, since it cannot be marked from here. */
	onOpenReader: (partNumber: number) => void;
};

/**
 * HZ5 — one closed Hizb round, portion by portion, and who still owes what.
 *
 * The Cevşen's round screen with the Hizb's lattice: the fill says what became of a portion —
 * read, missed, taken over, left in the pool — and a ring says it was yours, so a portion of
 * yours that was missed is clay under a ring. The rows below are only those with something
 * still outstanding, which is what the screen is titled for.
 *
 * Covering is the Cevşen's own append-only write (`useCoverBabs`), and the same optimistic
 * sweep. **Sekine is the exception**: it counts only after nineteen repetitions, and the count
 * lives in the reader, so its button opens the reader on this round instead of marking it.
 */
export const HizbRoundDetail = ({ group, members, onOpenReader, pullToRefresh, round, viewerUserId }: Props) => {
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
	const coverBabs = useCoverBabs();
	const privateNames = group.hideMemberNames && !group.isOwner;
	/**
	 * Rows acted on during this visit. They stay listed once settled, so the row under the next
	 * tap is still the one that was there — memory, like the Havuz's `takenHere`, not a record.
	 */
	const [settledHere, setSettledHere] = useState<ReadonlySet<string>>(() => new Set());

	// `CellGrid` keeps a cell while its item keeps its identity; a cover re-renders this twice.
	const items = useMemo(
		() => hizbRoundCells(round, viewerUserId).map(cell => hizbRoundCellItem(cell, theme, t)),
		[round, t, theme, viewerUserId]
	);
	const rows = useMemo(
		() =>
			hizbRoundRows(round, members, viewerUserId, settledHere).map(row =>
				!row.isPool && !row.isViewer && (privateNames || row.key.startsWith('anonymous:'))
					? { ...row, name: t('anonymousMember'), imageUrl: null }
					: row
			),
		[members, privateNames, round, settledHere, t, viewerUserId]
	);
	/*
	 * "Kişi" from the portions themselves rather than the server's `missedPeopleCount`: the cover
	 * marks its portions read in the cache on the tap, so a count read off them drops with the
	 * clay cells beside it, where the stored one waited for the response. Same rule as the server.
	 */
	const peopleCount = useMemo(() => missedPeopleCount(round), [round]);
	/*
	 * A 409 is the one failure with a cause worth naming: somebody else covered it first, and the
	 * refetch has already put their read on the board. Anything else — no connection, a refusal —
	 * says only that it did not go through. Sekine's 409 cannot reach here; it goes to the reader.
	 */
	const coverErrorKey =
		coverBabs.error instanceof WrapperApiError && coverBabs.error.status === COVER_TAKEN_STATUS
			? 'portionTakenError'
			: 'genericError';

	/** "15–16. bölüm", "Portion 19" — a set of portions with the noun in the language's own place. */
	const partsText = (numbers: number[]) => hizbPartsLabel(formatBabRange(numbers), t);

	/**
	 * Who did the covering, from the reader's side — the Cevşen screen's own three phrasings:
	 * "devraldığın" on your row, "sen üstlendin" for you on someone else's, their name otherwise.
	 */
	const coveredByLabel = (row: HizbRoundRow) =>
		row.isViewer
			? t('fromMember')
			: row.covered?.isViewer
			? t('transferred')
			: `${privateNames ? t('anonymousMember') : row.covered?.byName} ${t('tookOver')}`;

	/** The row's second line, in the shape `roundRows` picked for it. */
	const detailLine = (row: HizbRoundRow) => {
		switch (row.detailKind) {
			case 'settled': {
				const settled = t(row.settledKey ?? 'noMisses');

				// The accent line under it may already say "sen üstlendin"; the Cevşen screen's rule.
				return row.covered && coveredByLabel(row) === settled
					? row.partsLabel
					: `${row.partsLabel} · ${settled}`;
			}
			case 'poolLeft':
				// What is still sitting there, not every portion the empty seats held.
				return `${formatBabRange(row.outstanding)} · ${t('poolLeft')}`;
			case 'wholeBlock':
				// None of it read, so "Atanan 23–24 · Eksik 23–24" would say one span twice.
				return partsText(row.outstanding);
			default:
				return t('hizbRoundMissed', {
					assigned: row.partsLabel,
					missing: formatBabRange(row.outstanding)
				});
		}
	};

	const handleAction = (row: HizbRoundRow) => {
		const { action } = row;

		if (action === null) {
			return;
		}

		if (action.kind === 'read') {
			onOpenReader(action.partNumber);

			return;
		}

		setSettledHere(current => new Set(current).add(row.key));
		// The whole of what can be marked, in one act — as the Cevşen takes a block.
		coverBabs.mutate({ babNumbers: action.partNumbers, groupId: group.id, roundIndex: round.roundIndex });
	};

	const actionTitle = (row: HizbRoundRow) =>
		row.action?.kind === 'read' ? t('read') : row.isViewer ? t('markAsRead') : t('takeOver');

	return (
		<ScreenContainer pullToRefresh={pullToRefresh}>
			<ScreenHeader
				eyebrow={`${t('roundN')} ${round.roundIndex + 1} · ${roundDateRange(
					round.startedAt,
					round.endsAt,
					language,
					group.timezone
				)}`}
				hasBackButton
				title={t('missedTitle')}
			/>

			<View style={styles.statsRow}>
				<CardSurface style={styles.statCard}>
					<NumericText color={theme.colors.missed}>{round.missedCount}</NumericText>
					<StatText color={theme.colors.faintText} style={styles.statLabel}>
						{t('missedPortions')}
					</StatText>
				</CardSurface>
				<CardSurface style={styles.statCard}>
					<NumericText>{peopleCount}</NumericText>
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
				<CellGrid borderWidth={HIZB_RING_WIDTH} columns={HIZB_ROUND_COLUMNS} items={items} />
			</CardSurface>

			<HizbLegend style={styles.legend} variant='round' />

			{round.missedCount > 0 ? <LateReadingNotice daysLate={round.daysLate} /> : null}

			{/* A round that missed nothing says so, rather than ending on the grid as if it had not loaded. */}
			{rows.length === 0 ? (
				<CaptionText color={theme.colors.subtext}>{t('roundNothingMissedHizb')}</CaptionText>
			) : (
				<StatText color={theme.colors.faintText} style={styles.rowsHeading}>
					{t('missedTitle')}
				</StatText>
			)}

			{coverBabs.isError ? (
				<CaptionText color={theme.colors.missed} style={styles.coverError}>
					{t(coverErrorKey)}
				</CaptionText>
			) : null}

			<View style={styles.rows}>
				{rows.map(row => (
					<CardSurface key={row.key} style={styles.row}>
						<Avatar imageUrl={row.imageUrl} name={row.isPool ? t('pool') : row.name} size={38} />
						<View style={styles.rowCopy}>
							{/* HZ5 heads your own row "Sen" — the Fihrist's word for you. */}
							<CaptionText weight='semibold'>
								{row.isPool ? t('pool') : row.isViewer ? t('hizbIndexYou') : row.name}
							</CaptionText>
							<CaptionText color={theme.colors.subtext} style={styles.rowDetail}>
								{detailLine(row)}
							</CaptionText>
							{row.covered ? (
								<CaptionText color={theme.colors.accent} style={styles.rowDetail}>
									{`${coveredByLabel(row)} · ${partsText(row.covered.babNumbers)}`}
								</CaptionText>
							) : null}
						</View>
						{row.action ? (
							<>
								<NumericText color={theme.colors.missed} style={styles.rowCount}>
									{row.outstanding.length}
								</NumericText>
								<AppButton
									accessibilityLabel={`${actionTitle(row)}: ${partsText(
										row.action.kind === 'read' ? [row.action.partNumber] : row.action.partNumbers
									)}`}
									disabled={coverBabs.isPending}
									fullWidth={false}
									/*
									 * A glyph on every variant, as on the Cevşen's rows: the tick your
									 * own row's mark wears, the icon set's `claim` for taking someone
									 * else's, and the book for Sekine, which opens the text.
									 */
									icon={row.action.kind === 'read' ? 'book' : row.isViewer ? 'check' : 'claim'}
									onPress={() => handleAction(row)}
									size='sm'
									title={actionTitle(row)}
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
	coverError: {
		marginBottom: 10
	},
	gridCard: {
		padding: 13
	},
	legend: {
		marginBottom: 20,
		marginTop: 11
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
