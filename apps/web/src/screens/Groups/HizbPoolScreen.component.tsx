import { GridSkeleton } from '@/components/GridSkeleton/GridSkeleton.component';
import { HIZB_LEGEND, HIZB_RING_WIDTH, hizbCellItem } from '@/components/HizbBoard/hizbCellPalette';
import { HizbLegend } from '@/components/HizbBoard/HizbLegend.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { SkeletonStatusRow } from '@/components/Skeleton/SkeletonStatusRow.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { BodyStrongText, CaptionText, NumericText, Typography } from '@/components/ui/Typography/Typography.component';
import { HIZB_PORTION_COUNT, portion, workOf } from '@/lib/content/hizbPortions';
import { useGetBabs } from '@/lib/hooks/useBab';
import { useGetGroupById, useGetPoolSlots, useReleasePoolPart, useTakePoolPart } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTimeUntilReset } from '@/lib/hooks/useRoundReset';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { hizbBoardCells } from '@/lib/utils/groups';
import { hizbPoolCells, hizbPoolRows, type HizbPoolRow } from '@/lib/utils/pool';
import { roundTimeLeftLabel } from '@/lib/utils/roundReset';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'Pool'>;

/** HZ3's eleven across, so the 33 come out as three full rows. */
const GRID_COLUMNS = 11;
/** HZ3's 44pt number tile, the Cevşen row's badge. */
const TILE_SIZE = 44;
const TILE_RADIUS = 13;

/**
 * Portions taken since the app started, by group — the rows whose sub-line reads "az önce
 * üstlendin". It decides the wording and nothing else: whether a row offers "Geri al" follows
 * from holding the portion (`hizbPoolRows`), so a relaunch can't take the way back away. Module scope rather than state for the reason the Cevşen's
 * `claimedThisSession` gives: "this session" is the app's, not this screen's, and stepping back
 * to the group and returning is the ordinary thing to do. Nothing here is authoritative; the
 * server decides who holds what.
 */
const claimedThisSession = new Map<string, Set<number>>();

const rememberClaim = (groupId: string, partNumber: number) => {
	const claims = claimedThisSession.get(groupId) ?? new Set<number>();

	claims.add(partNumber);
	claimedThisSession.set(groupId, claims);
};

const forgetClaim = (groupId: string, partNumber: number) => {
	claimedThisSession.get(groupId)?.delete(partNumber);
};

/**
 * HZ3 — a Hizb group's pool, portion by portion. The Cevşen offers an empty seat's block whole;
 * the Hizb's blocks are a portion or two and each portion is a du'a of its own, so here they
 * are taken one at a time.
 *
 * The lattice is the whole book in the group board's states, with the pool's portions read off
 * the pool query (`hizbPoolCells`): that is the cache the take writes optimistically, so the
 * cell fills on the tap — colour only, `CellGrid`'s own transition — and drains the same way on
 * an undo. A single portion is a run of one, so there is no sweep to stagger.
 */
export const HizbPoolScreen = ({ route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const groupQuery = useGetGroupById(groupId);
	const babsQuery = useGetBabs(groupId);
	const pool = useGetPoolSlots(groupId);
	const takePart = useTakePoolPart();
	const releasePart = useReleasePoolPart();
	const pullToRefresh = usePullToRefresh(pool, groupQuery, babsQuery);
	const untilReset = useTimeUntilReset(groupQuery.data?.roundEndsAt ?? null);
	/** Seeded from the session store, so the rows keep their "Geri al" across leaving and coming back. */
	const [takenHere, setTakenHere] = useState<number[]>(() => [...(claimedThisSession.get(groupId) ?? [])]);

	/*
	 * Memoised above the early returns, reading the query data: `CellGrid` keeps a cell only
	 * while the item it was handed keeps its identity, and a take re-renders this screen two or
	 * three times in a row — rebuilt inline, all 33 would re-render under the fill.
	 */
	const group = groupQuery.data;
	const babs = babsQuery.data;
	const slots = pool.data;
	const items = useMemo(
		() =>
			group && babs && slots
				? hizbPoolCells(hizbBoardCells(babs, group), slots).map(cell => hizbCellItem(cell, theme, t))
				: [],
		[babs, group, slots, t, theme]
	);
	const rows = useMemo(() => (slots ? hizbPoolRows(slots, new Set(takenHere)) : []), [slots, takenHere]);

	const handleTake = (partNumber: number) => {
		rememberClaim(groupId, partNumber);
		setTakenHere(current => (current.includes(partNumber) ? current : [...current, partNumber]));
		takePart.mutate({ babNumber: partNumber, groupId });
	};

	const handleUndo = (partNumber: number) => {
		forgetClaim(groupId, partNumber);
		setTakenHere(current => current.filter(number => number !== partNumber));
		releasePart.mutate({ babNumber: partNumber, groupId });
	};

	const header = (
		<ScreenHeader eyebrow={t('pool')} hasBackButton subtitle={t('poolSubHizb')} title={t('poolTitleHizb')} />
	);

	if (pool.isPending || groupQuery.isPending || babsQuery.isPending) {
		return (
			<ScreenContainer>
				{/* The heading is real; only the board, which is what the requests are for, is stubbed. */}
				{header}
				<GridSkeleton cellCount={HIZB_PORTION_COUNT} columns={GRID_COLUMNS} legendCount={HIZB_LEGEND.length} />
				<SkeletonStatusRow label={t('loadingPool')} />
			</ScreenContainer>
		);
	}

	if (pool.isError || groupQuery.isError || babsQuery.isError || !group || !slots) {
		return <ErrorState queries={[pool, groupQuery, babsQuery]} />;
	}

	// Free only — what could still be taken on — as the group screen's pool card counts it.
	const freeCount = slots.flatMap(slot => slot.parts).filter(part => part.takenByUserId === null).length;
	// Hours on a DAILY round or a round's last day, days otherwise — the group screen's own value.
	const left = roundTimeLeftLabel({ cycle: group.cycle, daysLeft: group.daysLeft, ...untilReset }, t);

	const renderRow = ({ isJustTaken, isMine, number }: HizbPoolRow) => {
		// Matched against the portion in flight: both mutations belong to the whole screen.
		const isPending =
			(takePart.isPending && takePart.variables?.babNumber === number) ||
			(releasePart.isPending && releasePart.variables?.babNumber === number);
		const description = t(portion(number).descriptionKey);

		return (
			<CardSurface key={number} style={styles.rowCard}>
				{/* Hatched sand while free, as its cell above; solid accent once yours, as the Cevşen row's badge. */}
				<View
					style={[
						styles.tile,
						isMine
							? { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }
							: {
									backgroundColor: theme.colors.poolFree,
									borderColor: theme.colors.poolLine,
									borderStyle: 'dashed'
							  }
					]}
				>
					{isMine ? null : <Hatch radius={TILE_RADIUS} />}
					<Typography
						color={isMine ? theme.colors.onAccent : theme.colors.sandText}
						style={styles.tileLabel}
						variant='title'
						weight='regular'
					>
						{number}
					</Typography>
				</View>
				<View style={styles.rowCopy}>
					<BodyStrongText>
						{t('hizbPartRowTitle', { n: number, work: t(workOf(number).titleKey) })}
					</BodyStrongText>
					{/* "az önce üstlendin" leads, so the portion's long description can't truncate it away. */}
					<CaptionText color={theme.colors.subtext} numberOfLines={2} style={styles.rowSub}>
						{isJustTaken ? `${t('poolUndoHint')} · ${description}` : description}
					</CaptionText>
				</View>
				{/*
				 * One button in one place, whichever way it reads — the Cevşen row's reasoning: a
				 * glass button is a SwiftUI host that measures itself a frame late, so swapping two
				 * elements spilled the new one past the card's edge. Disabled while in flight, so a
				 * double tap can't fire the opposite action; the cell above is the confirmation.
				 */}
				<AppButton
					// "Üstlen: Bölüm 24" — the word alone says nothing about which of the rows it is.
					accessibilityLabel={`${isMine ? t('poolUndo') : t('poolTake')}: ${t('portion')} ${number}`}
					disabled={isPending}
					fullWidth={false}
					icon={isMine ? 'undo' : 'claim'}
					onPress={() => (isMine ? handleUndo(number) : handleTake(number))}
					size='sm'
					title={isMine ? t('poolUndo') : t('poolTake')}
					variant='accent'
				/>
			</CardSurface>
		);
	};

	return (
		<ScreenContainer pullToRefresh={pullToRefresh}>
			{header}
			{/*
			 * A full group has no pool at all, and the Cevşen's screen says only that: a card
			 * counting nothing over a board with nothing on offer would be a second way of saying it.
			 */}
			{slots.length === 0 ? null : (
				<CardSurface style={styles.summaryCard}>
					<View style={styles.summaryRow}>
						<NumericText color={theme.colors.sandText}>{freeCount}</NumericText>
						<CaptionText color={theme.colors.faintText}>
							{t(freeCount === 1 ? 'poolPortionsHizbOne' : 'poolPortionsHizb')}
						</CaptionText>
						<CaptionText color={theme.colors.faintText} style={styles.summaryNote}>
							{t('poolLeftHizb', { left })}
						</CaptionText>
					</View>
					<CellGrid borderWidth={HIZB_RING_WIDTH} columns={GRID_COLUMNS} gap={3} items={items} radius={5} />
					<HizbLegend />
				</CardSurface>
			)}
			{rows.length === 0 ? (
				<EmptyState title={t('poolEmptyHizb')} />
			) : (
				<View style={styles.rows}>{rows.map(renderRow)}</View>
			)}
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	rowCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	rowCopy: {
		flex: 1,
		minWidth: 0
	},
	rowSub: {
		marginTop: 2
	},
	rows: {
		gap: 9
	},
	summaryCard: {
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	summaryNote: {
		marginLeft: 'auto'
	},
	summaryRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 8,
		marginBottom: 12
	},
	tile: {
		alignItems: 'center',
		borderRadius: TILE_RADIUS,
		borderWidth: 1,
		height: TILE_SIZE,
		justifyContent: 'center',
		overflow: 'hidden',
		width: TILE_SIZE
	},
	// 15/19, the app's other badge tiles: a taller line box centres the line, not the numeral.
	tileLabel: {
		fontSize: 15,
		lineHeight: 19
	}
});
