import type { HizbAssignment } from '@/api/hizbReading.api';
import { HizbCoverageGrid } from '@/components/HizbCoverageGrid/HizbCoverageGrid.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { CaptionText, TitleText, Typography } from '@/components/ui/Typography/Typography.component';
import { planBlocks } from '@/lib/content/hizbPlans';
import { useDeleteGroup } from '@/lib/hooks/useGroup';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import {
	useEnrollHizb,
	useHizbReading,
	useSetHizbReadsFromBook,
	useUpdateHizbAssignment
} from '@/lib/hooks/useHizbReading';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { GroupDetail } from '@/lib/types/domain';
import { formatBabRange } from '@/lib/utils/babs';
import { confirmDestructive } from '@/lib/utils/confirmDestructive';
import { hizbPortionLabel, kindLabelKey } from '@/lib/utils/groups';
import { boardPortionsOf, planBoardCells, unreadPortionCount } from '@/lib/utils/hizbPlanBoard';
import { timeIn, timeUntilReset, zoneAbbreviation } from '@/lib/utils/roundReset';
import {
	turkishDativeSuffix,
	turkishGenitiveSuffix,
	turkishWordAblativeSuffix,
	turkishWordLocativeSuffix
} from '@/lib/utils/turkishSuffixes';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FlatButton } from '@/components/FlatButton/FlatButton.component';
import { HizbBookSheet } from './HizbBookSheet.component';
import { HizbPlanGroupSkeleton } from './HizbPlanGroupSkeleton.component';
import { LeaveGroupButton } from './LeaveGroupButton.component';
import { ManageSheet } from './ManageSheet.component';
import { MembersSheet } from './MembersSheet.component';
import { ShareSheet } from './ShareSheet.component';

type Props = NativeStackScreenProps<TabStackParamList, 'GroupDetail'> & { group: GroupDetail };

/**
 * A Hizb group on personal plans — the design's "Hizb Kişisel Plan", W1–W4, one to one:
 * "Benim ilerlemem" above, "Grup ilerlemesi" below.
 *
 * - Today's reading is the one card with the dark button until it is read (W1, W4); then it
 *   shrinks to a green "Bugün okundu" row and the button moves to the newest missed day (W2).
 * - The design's missed-days row is a "Senin ilerlemen" banner, as on the Cevşen and Kur'an
 *   screens; it opens the missed days (T2), and the rounds card the history (T3). A catch-up
 *   counts for its own day's coverage and round, never for today's 33.
 * - When the group has covered all 33 today, the coverage moves to a green band on top (W3) —
 *   the reader's day and the group's day are two separate "done"s.
 */
const STATE_RANK = { read: 0, missed: 1, today: 2 } as const;

export const HizbPlanGroup = ({ group, route, navigation }: Props) => {
	const { t, language } = useTranslation();
	const { theme } = useThemeContext();
	const text = useHizbPlanText();
	const query = useHizbReading(group.id);
	const enroll = useEnrollHizb(group.id);
	const pullToRefresh = usePullToRefresh(query);
	const closeSheet = () => navigation.setParams({ sheet: undefined });
	const sheetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (sheetTimer.current) {
				clearTimeout(sheetTimer.current);
			}
		},
		[]
	);
	const openMembers = () => {
		closeSheet();
		if (sheetTimer.current) {
			clearTimeout(sheetTimer.current);
		}
		// iOS cannot present another sheet while the current one is dismissing.
		sheetTimer.current = setTimeout(() => navigation.setParams({ sheet: 'members' }), 320);
	};
	const data = query.data?.pages[0];
	const today = data?.today ?? null;
	// Today's reading, written from this screen: undo, and marking it read from the book (R1, R2, R4).
	const todayUpdate = useUpdateHizbAssignment(group.id, today?.id ?? '');
	const setReadsFromBook = useSetHizbReadsFromBook(group.id);
	const [isBookSheetOpen, setIsBookSheetOpen] = useState(false);
	const cells = useMemo(() => (data ? planBoardCells(data.coveredSpans, today) : []), [data, today]);
	const isGroupDone = cells.length > 0 && cells.every(cell => cell.state === 'read');
	// S1: the plan chosen on the picker before it is started — the one option when the plan is fixed.
	const [pickedPlan, setPickedPlan] = useState<number | null>(group.hizbPlan || null);
	// S6b: the delete confirmation for an individual reading.
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const deleteGroup = useDeleteGroup();
	/*
	 * S6: an individual reading's round on the 33 — each day of it read, missed or today's, and the
	 * portion the round began on ringed. Its readings are today's and the loaded history's, matched
	 * by their round.
	 */
	const individualRound = useMemo(() => {
		const pages = query.data?.pages ?? [];
		const current = pages[0]?.today;

		if (!current || !group.hizbIndividual) {
			return null;
		}

		const readings = [current, ...pages.flatMap(page => page.assignments)].filter(
			reading => reading.round === current.round
		);
		const states = new Map<number, 'read' | 'missed' | 'today'>();

		for (const reading of readings) {
			const state =
				reading.id === current.id
					? reading.completedAt
						? 'read'
						: 'today'
					: reading.completedAt
					? 'read'
					: 'missed';

			// Two days can share a cell (15 days: 2 and 3 both reach 6); it is read only when every
			// day on it is, and today's unread share outranks a missed one.
			for (const number of boardPortionsOf(reading.planDays, reading.portion)) {
				const held = states.get(number);

				if (!held || STATE_RANK[state] > STATE_RANK[held]) {
					states.set(number, state);
				}
			}
		}

		const first = readings.at(-1);
		const startCell = first ? boardPortionsOf(first.planDays, first.portion)[0] ?? null : null;
		const items: CellGridItem[] = Array.from({ length: 33 }, (_, index) => {
			const number = index + 1;
			const state = states.get(number);
			const backgroundColor =
				state === 'read'
					? theme.colors.accent
					: state === 'missed'
					? theme.colors.missedSurface
					: state === 'today'
					? theme.colors.accentMuted
					: theme.colors.segmentTrack;

			return {
				backgroundColor,
				borderColor:
					state === 'today'
						? theme.colors.text
						: number === startCell
						? theme.colors.accent
						: backgroundColor,
				key: number,
				label: number,
				labelColor:
					state === 'read'
						? theme.colors.onAccent
						: state === 'missed'
						? theme.colors.missed
						: state === 'today'
						? theme.colors.accent
						: theme.colors.faintText
			};
		});

		return {
			items,
			missed: readings.filter(reading => reading.id !== current.id && !reading.completedAt).length,
			read: readings.filter(reading => reading.completedAt).length
		};
	}, [group.hizbIndividual, query.data, theme]);
	if (query.isError) {
		return <ErrorState queries={[query]} />;
	}
	if (!data) {
		// In the same container as the screen, so the bones sit at its width and the data lands in place.
		return (
			<ScreenContainer>
				<HizbPlanGroupSkeleton
					plan={{
						hizbIndividual: group.hizbIndividual ?? false,
						hizbPlan: group.hizbPlan ?? 0,
						hizbStartPortion: group.hizbStartPortion ?? 1,
						memberCount: group.memberCount,
						name: group.name
					}}
				/>
			</ScreenContainer>
		);
	}

	const isShared = !group.hizbIndividual;
	const removed = data.enrollment?.reason === 'INACTIVITY';
	const active = data.enrollment?.endDay === null;
	const newestMissed = data.missed[0] ?? null;
	const readCount = cells.filter(cell => cell.state === 'read').length;
	const readersRead = data.members.filter(member => member.completed);
	const open = (id: string) => navigation.navigate('HizbPlanReader', { groupId: group.id, assignmentId: id });
	// T2, T3, T4 and T5 of the design.
	const openMissed = () => navigation.navigate('HizbMissed', { groupId: group.id });
	const openHistory = () => navigation.navigate('HizbPlanHistory', { groupId: group.id });
	const openProgress = () => navigation.navigate('HizbGroupProgress', { groupId: group.id });
	const openReaders = () => navigation.navigate('HizbReaders', { groupId: group.id });

	const { monthDay, portionDesc, portionsOf, trSuffix, workTitle } = text;

	const resetInstant = new Date(data.nextDayAt);
	const localTime = t('yourTimeAt', { time: timeIn(resetInstant, language) });
	const nextAt = t('hpNextAt', {
		time: timeIn(resetInstant, language, group.timezone),
		zone: zoneAbbreviation(resetInstant, language, group.timezone)
	});
	// Recomputed each render, not memoised on the reset instant, so it keeps counting down.
	const nextIn = t('hpNextIn', { left: t('hoursLeft', timeUntilReset(data.nextDayAt)) });

	const confirmUndo = () =>
		confirmDestructive({
			cancelLabel: t('cancel'),
			confirmLabel: t('hpUndo'),
			message: t('hpUndoHint'),
			onConfirm: () => {
				if (today) {
					todayUpdate.mutate({ read: false, version: today.version });
				}
			},
			title: t('hpUndo')
		});

	// R1: a one-portion day is marked at once — there is nothing to choose; a longer one asks (R2).
	const readFromBook = () => {
		if (!today) {
			return;
		}

		if (today.boardPortions.length === 1) {
			todayUpdate.mutate({ bookPortions: today.boardPortions, version: today.version });

			return;
		}

		setIsBookSheetOpen(true);
	};

	const confirmBook = (portions: number[], isAlways: boolean) => {
		setIsBookSheetOpen(false);

		if (!today || !data) {
			return;
		}

		if (isAlways !== data.readsFromBook) {
			setReadsFromBook.mutate(isAlways);
		}

		todayUpdate.mutate({ bookPortions: portions, version: today.version });
	};

	const isTodayDone = today?.completedAt != null;
	// Read from the book: the green row says so, with the time ("kitaptan · 16:47").
	const isReadFromBook = isTodayDone && today?.readFrom === 'BOOK';
	const readAt = timeIn(new Date(today?.completedAt ?? data.nextDayAt), language);
	// Portions already marked from the book on a day not finished yet.
	const bookPortionsRead = today && !isTodayDone ? today.readPortions : [];
	const isStarted =
		today !== null &&
		!isTodayDone &&
		(today.bookmark > 0 || today.repetitions > 0 || today.istighfarRepetitions > 0 || today.delailRepetitions > 0);
	const pageCount = today ? planBlocks(today.planDays, today.portion).length : 0;
	const page = today ? Math.min(today.bookmark + 1, pageCount) : 0;
	const myPortions = today ? portionsOf(today) : [];
	// Read on the board — by someone else, not by the viewer's own ticks from the book.
	const readByOthers = myPortions.filter(
		number => cells[number - 1]?.state === 'read' && !(today?.readPortions ?? []).includes(number)
	);
	const round = data.currentRound;
	const bannerMuted = toAlphaColor(theme.colors.onHeaderSurface, 0.62);
	// The missed day's own round — the server counts rounds across a leave and a rejoin.
	const missedRound = newestMissed?.round ?? null;

	// S6's short history: today and the four readings before it.
	const recentReadings: HizbAssignment[] = [
		...(today ? [today] : []),
		...(query.data?.pages ?? []).flatMap(page => page.assignments)
	].slice(0, 5);
	// The special states of section S.
	const isFirstDay = data.previousDay === null;
	// S1: a member with no plan yet (a mixed group before choosing); a removed one is S3 instead.
	const isPicking = !active && !removed;
	const planDays = today?.planDays ?? data.enrollment?.planDays ?? 0;
	const planLabel = group.hizbPlan ? t('hpDays', { days: group.hizbPlan }) : t('hpMixedPlan');
	const joinedDate = data.enrollment?.joinedDate ?? null;
	// S7: joined after the group began, still in the first round.
	const isJoinedLate =
		active && joinedDate !== null && joinedDate > data.startedDate && round?.number === 1 && !data.isReturnedToday;
	// A round that began mid-plan says where: "22. günden başladı, 21. günde biter".
	const roundStart =
		today && round && planDays > 0 ? ((((today.portion - round.days) % planDays) + planDays) % planDays) + 1 : 1;
	const roundWrap = roundStart > 1 ? t('hpRoundWrap', { end: roundStart - 1, start: roundStart }) : null;
	const joinedLabel = joinedDate ? monthDay(joinedDate, 'long') : '';
	const subtitle = !isShared
		? t('hpSubtitleIndividual', { days: group.hizbPlan ?? planDays, start: group.hizbStartPortion ?? 1 })
		: removed
		? t('hpSubtitleRemoved', { count: group.memberCount, plan: planLabel })
		: isPicking
		? t('hpSubtitlePick', { count: group.memberCount })
		: data.isReturnedToday
		? t('hpSubtitleReturned', { count: group.memberCount })
		: isFirstDay
		? t('hpSubtitleFirstDay', { count: group.memberCount })
		: isJoinedLate
		? t('hpSubtitleJoined', {
				count: group.memberCount,
				date: joinedLabel,
				suffix: trSuffix(turkishWordLocativeSuffix(joinedLabel))
		  })
		: t('hpMembersDaily', { count: group.memberCount });

	const nextRow = (label: string) => (
		<View style={[styles.footRow, { borderTopColor: theme.colors.divider }]}>
			<Icon color={theme.colors.faintText} name='clock' size={15} strokeWidth={1.7} />
			<CaptionText style={styles.footLabel} weight='semibold'>
				{label}
			</CaptionText>
			<CaptionText color={theme.colors.accent} style={styles.localTime}>
				{localTime}
			</CaptionText>
		</View>
	);

	const counterRow = (label: string, count: number, target: number) => (
		<View key={label} style={styles.progressLine}>
			<CaptionText color={theme.colors.subtext} style={styles.counterLabel} weight='semibold'>
				{label}
			</CaptionText>
			{target <= 3 ? (
				<View style={styles.segments}>
					{Array.from({ length: target }, (_, index) => (
						<View
							key={index}
							style={[
								styles.segment,
								{ backgroundColor: index < count ? theme.colors.accent : theme.colors.progressTrack }
							]}
						/>
					))}
				</View>
			) : (
				<View style={[styles.bar, { backgroundColor: theme.colors.progressTrack }]}>
					<View
						style={[
							styles.barFill,
							{ backgroundColor: theme.colors.accent, width: `${Math.min(100, (count * 100) / target)}%` }
						]}
					/>
				</View>
			)}
			<Typography color={theme.colors.faintText} style={styles.monoCount} variant='mono'>
				{`${count}/${target}`}
			</Typography>
		</View>
	);

	const eyebrow = (label: string, style?: object) => (
		<Typography
			color={theme.colors.faintText}
			style={[styles.sectionEyebrow, style]}
			variant='eyebrow'
			weight='medium'
		>
			{label}
		</Typography>
	);

	const coverageGrid = <HizbCoverageGrid cells={cells} isOnBand={isGroupDone} />;

	// Rounds: done, and where this one stands; the whole card opens the history (T3). It sits under
	// "Grup ilerlemesi" in a shared group, and under "Benim ilerlemem" in an individual reading.
	// Shown from the first day, as the Cevşen's and Kur'an's are.
	const roundsCard = data.enrollment ? (
		<CardSurface isFlush onPress={openHistory} style={styles.sectionEnd}>
			<View style={styles.statsRow}>
				<View style={[styles.statCell, styles.statCellDivided, { borderRightColor: theme.colors.divider }]}>
					<Typography style={styles.statNumber} variant='numeric'>
						{String(data.completedTraversals)}
					</Typography>
					<Typography color={theme.colors.faintText} style={styles.statLabel} variant='stat' weight='medium'>
						{t('hpRoundsCompleted')}
					</Typography>
				</View>
				{round ? (
					<View style={styles.statCell}>
						<Typography style={styles.statNumber} variant='numeric'>
							{`${round.read} `}
							{/* Out of the whole round — the plan's length — so it fills to 7 / 7 as the
							    round completes, like the Cevşen's "x / 100". */}
							<Typography color={theme.colors.faintText} style={styles.statTotal} variant='numeric'>
								{`/ ${today?.planDays ?? data.enrollment?.planDays ?? round.days}`}
							</Typography>
						</Typography>
						<Typography
							color={theme.colors.faintText}
							style={styles.statLabel}
							variant='stat'
							weight='medium'
						>
							{t('hpRoundDaysRead')}
						</Typography>
					</View>
				) : null}
			</View>
			{/* A round that began mid-plan says where it wraps (S3b, S7). */}
			{round && roundWrap ? (
				<View style={[styles.historyRow, styles.spread, { borderTopColor: theme.colors.divider }]}>
					<CaptionText style={styles.footLabel} weight='semibold'>
						{t('hpRoundLabel', { n: round.number })}
					</CaptionText>
					<CaptionText color={theme.colors.faintText} style={styles.linkHint}>
						{roundWrap}
					</CaptionText>
				</View>
			) : null}
			{/* With today read, its card is gone: the next reading's time comes here instead. */}
			{today && isTodayDone ? (
				nextRow(nextIn)
			) : (
				<View style={[styles.historyRow, { borderTopColor: theme.colors.divider }]}>
					<CaptionText style={styles.footLabel} weight='semibold'>
						{t('hpAllHistory')}
					</CaptionText>
					<Icon color={theme.colors.faintText} name='chevronRight' size={15} strokeWidth={1.8} />
				</View>
			)}
		</CardSurface>
	) : null;

	return (
		<>
			<ScreenContainer pullToRefresh={pullToRefresh}>
				<ScreenHeader
					hasBackButton
					subtitle={subtitle}
					title={group.name}
					titleLines={1}
					titleTrailing={
						// The plan, then the kind — the Cevşen and Kur'an screens' pair of tags.
						<View style={styles.titleChips}>
							{/* S3: out of the order says so in the plan's place; S6: an individual reading. */}
							{removed ? (
								<Chip label={t('hpNotInOrder')} tone='sand' />
							) : !isShared ? (
								<Chip label={t('hpIndividualChip')} tone='neutral' />
							) : (
								<Chip label={planLabel} tone='accent' />
							)}
							<Chip label={t(kindLabelKey(group.kind))} tone='neutral' />
						</View>
					}
				/>

				{/* A banner that leads (W3, S1, S3, S3b) sits closer under the heading than an eyebrow does. */}
				<View
					style={
						(isShared && isGroupDone) || isPicking || removed || (data.isReturnedToday && today)
							? styles.bodyUnderBanner
							: styles.body
					}
				>
					{/* W3: the group has covered all 33 today — the coverage leads, in a green band. */}
					{isShared && isGroupDone ? (
						<View style={[styles.doneBand, { backgroundColor: theme.colors.accent }]}>
							<View style={styles.doneBandHead}>
								<View style={styles.flex}>
									<Typography
										color={toAlphaColor(theme.colors.onAccent, 0.65)}
										style={styles.cardEyebrow}
										variant='stat'
										weight='medium'
									>
										{t('hpTodayDate', { date: monthDay(data.date, 'long') })}
									</Typography>
									<TitleText color={theme.colors.onAccent} style={styles.doneBandTitle}>
										{t('hpGroupDone')}
									</TitleText>
								</View>
								<Typography color={theme.colors.onAccent} style={styles.bandCount} variant='numeric'>
									33
									<Typography
										color={toAlphaColor(theme.colors.onAccent, 0.6)}
										style={styles.bandTotal}
										variant='numeric'
									>
										{' / 33'}
									</Typography>
								</Typography>
							</View>
							{coverageGrid}
							<CaptionText color={toAlphaColor(theme.colors.onAccent, 0.72)} style={styles.bandNote}>
								{t('hpContributors', { count: readersRead.length })}
							</CaptionText>
						</View>
					) : null}

					{/* S1: no plan yet — choose one; the first reading is today. */}
					{isPicking ? (
						<CardSurface style={styles.pickCard}>
							<TitleText style={styles.pickTitle}>{t('hpPickTitle')}</TitleText>
							<CaptionText color={theme.colors.subtext} style={styles.pickHint}>
								{t('hpPickHint')}
							</CaptionText>
							<View style={styles.pickOptions}>
								{(group.hizbPlan ? [group.hizbPlan] : [7, 15, 33]).map(days => {
									const isOn = pickedPlan === days;

									return (
										<Pressable
											accessibilityRole='radio'
											accessibilityState={{ selected: isOn }}
											key={days}
											onPress={() => setPickedPlan(days)}
											style={[
												styles.pickOption,
												{
													backgroundColor: isOn
														? theme.colors.accentSoft
														: theme.colors.surface,
													borderColor: isOn ? theme.colors.accent : theme.colors.border
												}
											]}
										>
											<View
												style={[
													styles.pickNumber,
													{
														backgroundColor: isOn
															? theme.colors.accent
															: theme.colors.segmentTrack
													}
												]}
											>
												<Typography
													color={isOn ? theme.colors.onAccent : theme.colors.text}
													style={styles.pickNumberLabel}
													variant='title'
												>
													{days}
												</Typography>
											</View>
											<View style={styles.flex}>
												<CaptionText style={styles.rowTitle} weight='semibold'>
													{t('hpPlanName', { days })}
												</CaptionText>
												<CaptionText color={theme.colors.faintText} style={styles.rowSub}>
													{t(
														days === 7
															? 'hpPlanDesc7'
															: days === 15
															? 'hpPlanDesc15'
															: 'hpPlanDesc33'
													)}
												</CaptionText>
											</View>
											<View
												style={[
													styles.radio,
													{ borderColor: isOn ? theme.colors.accent : theme.colors.border }
												]}
											>
												{isOn ? (
													<View
														style={[
															styles.radioDot,
															{ backgroundColor: theme.colors.accent }
														]}
													/>
												) : null}
											</View>
										</Pressable>
									);
								})}
							</View>
							<AppButton
								disabled={pickedPlan === null || enroll.isPending}
								isLoading={enroll.isPending}
								onPress={() =>
									pickedPlan !== null &&
									enroll.mutate(pickedPlan, {
										// Just joined: O2 now that there is a plan and a share to show.
										onSuccess: () => {
											if (route.params.isJustJoined) {
												navigation.setParams({ isJustJoined: undefined });
												navigation.navigate('GroupHowItWorks', {
													groupId: group.id,
													isOverGroup: true
												});
											}
										}
									})
								}
								size='lg'
								style={styles.darkButton}
								title={pickedPlan ? t('hpPickCta', { days: pickedPlan }) : t('hpPickNone')}
								variant='primary'
							/>
							<CaptionText color={theme.colors.faintText} style={styles.centerNote}>
								{t('hpPickNote', {
									local: localTime,
									time: timeIn(resetInstant, language, group.timezone),
									zone: zoneAbbreviation(resetInstant, language, group.timezone)
								})}
							</CaptionText>
							{enroll.isError ? (
								<CaptionText color={theme.colors.danger}>{t('hpError')}</CaptionText>
							) : null}
						</CardSurface>
					) : null}

					{/* S3: taken out of the reading order — still a member; rejoin at the end of the order. */}
					{removed ? (
						<CardSurface style={styles.cardGap}>
							<View style={styles.removedHead}>
								<View style={[styles.removedIcon, { backgroundColor: theme.colors.missedSurface }]}>
									<Icon color={theme.colors.missed} name='clock' size={18} strokeWidth={1.8} />
								</View>
								<View style={styles.flex}>
									<TitleText style={styles.removedTitle}>{t('hpRemovedTitle')}</TitleText>
									<CaptionText color={theme.colors.subtext} style={styles.removedBody}>
										{t('hpRemovedBody', {
											days: data.enrollment?.removalDays ?? group.inactivityDays ?? 0
										})}
									</CaptionText>
								</View>
							</View>
							<AppButton
								disabled={enroll.isPending}
								isLoading={enroll.isPending}
								onPress={() => enroll.mutate(data.enrollment?.planDays ?? group.hizbPlan ?? 33)}
								size='lg'
								style={styles.darkButton}
								title={t('hpRejoinAction')}
								variant='primary'
							/>
							<CaptionText color={theme.colors.faintText} style={styles.centerNote}>
								{t('hpRejoinNote')}
							</CaptionText>
							{enroll.isError ? (
								<CaptionText color={theme.colors.danger}>{t('hpError')}</CaptionText>
							) : null}
						</CardSurface>
					) : null}

					{/* S3b: back today — the old history and missed days came with them. */}
					{data.isReturnedToday && today ? (
						<View style={[styles.welcome, { backgroundColor: theme.colors.accentSoft }]}>
							<View style={[styles.doneCheck, { backgroundColor: theme.colors.accent }]}>
								<Icon color={theme.colors.onAccent} name='undo' size={15} strokeWidth={2} />
							</View>
							<View style={styles.flex}>
								<CaptionText
									color={theme.colors.accentStrong}
									style={styles.rowTitle}
									weight='semibold'
								>
									{t('hpWelcomeBackTitle')}
								</CaptionText>
								<CaptionText
									color={toAlphaColor(theme.colors.accentStrong, 0.8)}
									style={styles.welcomeBody}
								>
									{t('hpWelcomeBackBody', { day: today.portion, missed: data.missedCount })}
								</CaptionText>
							</View>
						</View>
					) : null}

					{isPicking ? null : eyebrow(t('hpMyProgress'), removed ? styles.removedEyebrow : undefined)}

					{/* W1/W4: today's reading, the one dark button. */}
					{today && !isTodayDone ? (
						<CardSurface isFlush style={styles.cardGap}>
							<View style={styles.todayBody}>
								<View style={styles.spread}>
									<Typography
										color={theme.colors.accent}
										style={styles.cardEyebrow}
										variant='stat'
										weight='medium'
									>
										{/* Always the date: the tag beside it is the reader's own plan day, and a
										    group's "day 1" beside a joiner's "day 2" read as two answers. */}
										{t('hpTodayDate', { date: monthDay(data.date, 'long') })}
									</Typography>
									<View style={[styles.tag, { backgroundColor: theme.colors.segmentTrack }]}>
										<Typography
											color={theme.colors.subtext}
											style={styles.tagLabel}
											variant='stat'
											weight='semibold'
										>
											{isShared
												? t('hpPlanDay', { day: today.portion, days: today.planDays })
												: hizbPortionLabel(formatBabRange(myPortions), t)}
										</Typography>
									</View>
								</View>
								<TitleText style={styles.readingTitle}>{workTitle(today)}</TitleText>
								{portionDesc(today) ? (
									<CaptionText color={theme.colors.subtext} style={styles.readingDesc}>
										{portionDesc(today)}
									</CaptionText>
								) : null}
								{/* A shorter plan's day covers several of the 33 — named as chips. */}
								{myPortions.length > 1 ? (
									<View style={styles.portionChips}>
										{myPortions.map(number => {
											// Marked from the book already: filled, as the read state draws them.
											const isRead = bookPortionsRead.includes(number);

											return (
												<View
													key={number}
													style={[
														styles.portionChip,
														{
															backgroundColor: isRead
																? theme.colors.accent
																: theme.colors.accentMuted
														}
													]}
												>
													<CaptionText
														color={isRead ? theme.colors.onAccent : theme.colors.accent}
														style={styles.portionChipLabel}
														weight='semibold'
													>
														{number}
													</CaptionText>
												</View>
											);
										})}
										<CaptionText color={theme.colors.faintText} style={styles.portionCount}>
											{bookPortionsRead.length > 0
												? t('hbFromBookPartial', {
														read: bookPortionsRead.length,
														total: myPortions.length
												  })
												: t('hpPortionsCount', { count: myPortions.length })}
										</CaptionText>
										{/* A part-read day's ticks are locked in the sheet; this is the way back. */}
										{bookPortionsRead.length > 0 ? (
											<Pressable
												accessibilityRole='button'
												disabled={todayUpdate.isPending}
												hitSlop={8}
												onPress={confirmUndo}
												style={styles.partialUndo}
											>
												<CaptionText color={theme.colors.accent} weight='semibold'>
													{t('hpUndoShort')}
												</CaptionText>
											</Pressable>
										) : null}
									</View>
								) : null}
								{/* Started is not read: the page and the counts carry on where they were. */}
								{isStarted ? (
									<View style={[styles.progressBox, { backgroundColor: theme.colors.background }]}>
										{/* On its own line above the rows, so it heads them all rather than the page. */}
										<View style={[styles.startedTag, { backgroundColor: theme.colors.sand }]}>
											<Typography
												color={theme.colors.sandText}
												style={styles.startedLabel}
												variant='stat'
												weight='semibold'
											>
												{t('hpStarted')}
											</Typography>
										</View>
										<View style={styles.progressLine}>
											<CaptionText
												color={theme.colors.subtext}
												style={styles.smallStrong}
												weight='semibold'
											>
												{t('hpPageOf', { page, total: pageCount })}
											</CaptionText>
											<View style={[styles.bar, { backgroundColor: theme.colors.progressTrack }]}>
												<View
													style={[
														styles.barFill,
														{
															backgroundColor: theme.colors.accent,
															width: `${(page * 100) / Math.max(1, pageCount)}%`
														}
													]}
												/>
											</View>
										</View>
										{today.requiresSekine
											? counterRow(t('hpCounterSekine'), today.repetitions, 19)
											: null}
										{today.requiresIstighfar
											? counterRow(
													t('hpCounterIstighfar'),
													today.istighfarRepetitions,
													today.istighfarTarget
											  )
											: null}
										{today.requiresDelailRepetition
											? counterRow(t('hpCounterSalavat'), today.delailRepetitions, 3)
											: null}
									</View>
								) : null}
								{/*
								 * R1: two ways to read — the app is the dark button, the book the grey one.
								 * R4: a member who always reads from the book gets them the other way round,
								 * with the app a link.
								 */}
								{data.readsFromBook ? (
									<>
										<FlatButton
											disabled={todayUpdate.isPending}
											icon='bookPages'
											onPress={readFromBook}
											style={styles.firstButton}
											title={t('hbReadFromBook')}
											variant='ink'
										/>
										<FlatButton
											onPress={() => open(today.id)}
											style={styles.appLink}
											title={t(isStarted ? 'hpContinue' : 'hbReadInApp')}
											variant='link'
										/>
									</>
								) : (
									<>
										<FlatButton
											onPress={() => open(today.id)}
											style={styles.firstButton}
											title={t(isStarted ? 'hpContinue' : 'hbReadInApp')}
											variant='ink'
										/>
										<FlatButton
											disabled={todayUpdate.isPending}
											icon='bookPages'
											onPress={readFromBook}
											style={styles.bookButton}
											title={t('hbReadFromBook')}
											variant='muted'
										/>
									</>
								)}
							</View>
							{nextRow(nextAt)}
						</CardSurface>
					) : null}

					{/*
					 * W2/W3: today read — a green row, with undo, however it was read. A day read from the
					 * book says so in the second line ("kitaptan · 16:47") rather than keeping a card of
					 * its own: one "read today" look, and the catch-up card below keeps the dark button.
					 */}
					{today && isTodayDone ? (
						<View style={[styles.doneRow, { backgroundColor: theme.colors.accentSoft }]}>
							<View style={[styles.doneCheck, { backgroundColor: theme.colors.accent }]}>
								<Icon color={theme.colors.onAccent} name='check' size={16} strokeWidth={2.4} />
							</View>
							<View style={styles.flex}>
								<CaptionText
									color={theme.colors.accentStrong}
									style={styles.rowTitle}
									weight='semibold'
								>
									{t('hpReadToday')}
								</CaptionText>
								<CaptionText color={toAlphaColor(theme.colors.accentStrong, 0.7)} style={styles.rowSub}>
									{newestMissed
										? t('hpReadTodaySub', {
												day: today.portion,
												time: isReadFromBook ? t('hbFromBookAt', { time: readAt }) : readAt,
												title: workTitle(today)
										  })
										: isReadFromBook
										? `${hizbPortionLabel(formatBabRange(myPortions), t)} · ${t('hbFromBookAt', {
												time: readAt
										  })}`
										: t('hpNoMissedSub', { portions: formatBabRange(myPortions) })}
								</CaptionText>
							</View>
							{/* Not once the group has read all 33 (W3): the day is done for everyone. */}
							{isGroupDone ? null : (
								<AppButton
									disabled={todayUpdate.isPending}
									fullWidth={false}
									onPress={confirmUndo}
									size='sm'
									title={t('hpUndoShort')}
									variant='primary'
								/>
							)}
						</View>
					) : null}

					{/* W2: with today read, the dark button moves to the newest missed day. */}
					{today && isTodayDone && newestMissed ? (
						<CardSurface style={[styles.catchupCard, styles.cardGap]}>
							<View style={styles.spread}>
								<Typography
									color={theme.colors.missed}
									style={styles.cardEyebrow}
									variant='stat'
									weight='medium'
								>
									{t('hpNextCatchup', { date: monthDay(newestMissed.date, 'long') })}
								</Typography>
								<View style={[styles.tag, { backgroundColor: theme.colors.missedSurface }]}>
									<Typography
										color={theme.colors.missed}
										style={styles.tagLabel}
										variant='stat'
										weight='semibold'
									>
										{`1 / ${data.missedCount}`}
									</Typography>
								</View>
							</View>
							<TitleText style={styles.readingTitle}>{workTitle(newestMissed)}</TitleText>
							<CaptionText color={theme.colors.subtext} style={styles.readingDesc}>
								{[
									hizbPortionLabel(formatBabRange(portionsOf(newestMissed)), t),
									portionDesc(newestMissed)
								]
									.filter(Boolean)
									.join(' · ')}
							</CaptionText>
							<AppButton
								onPress={() => open(newestMissed.id)}
								size='lg'
								style={styles.darkButton}
								title={t('hpCatchupAction')}
								variant='primary'
							/>
							<Pressable accessibilityRole='button' onPress={openMissed} style={styles.centerLink}>
								<CaptionText color={theme.colors.subtext} style={styles.linkLabel} weight='semibold'>
									{t('hpAllMissed', { count: data.missedCount })}
								</CaptionText>
							</Pressable>
							{missedRound !== null ? (
								<View style={[styles.noteRow, { borderTopColor: theme.colors.divider }]}>
									<Icon color={theme.colors.accent} name='clock' size={14} strokeWidth={1.8} />
									<CaptionText color={theme.colors.subtext} style={[styles.flex, styles.note]}>
										{(() => {
											const date = monthDay(newestMissed.date, 'long');

											return t('hpCatchupNote', {
												covered: readCount,
												date,
												dateSuffix: trSuffix(turkishGenitiveSuffix(date)),
												n: missedRound,
												roundSuffix: trSuffix(turkishDativeSuffix(missedRound))
											});
										})()}
									</CaptionText>
								</View>
							) : null}
						</CardSurface>
					) : null}

					{/*
					 * "Senin ilerlemen" — the Cevşen and Kur'an screens' banner, in place of the design's
					 * missed-days row: the days owed (red) and the newest of them. It opens them (T2).
					 */}
					{data.enrollment ? (
						<CardSurface
							hasGlassSurface={false}
							onPress={openMissed}
							style={[
								styles.banner,
								isShared && !isJoinedLate ? styles.sectionEnd : styles.cardGap,
								{ backgroundColor: theme.colors.headerSurface }
							]}
						>
							<CaptionText color={theme.colors.onHeaderSurface} weight='semibold'>
								{t('myProgress')}
							</CaptionText>
							<View style={[styles.bannerDivider, { backgroundColor: bannerMuted }]} />
							<CaptionText color={bannerMuted} numberOfLines={1} style={styles.bannerStats}>
								<CaptionText color={theme.colors.onHeaderSurfaceMissed} weight='semibold'>
									{data.missedCount}
								</CaptionText>
								{` ${t('mpMissed')}`}
								{newestMissed
									? ` · ${t('hpBannerNewest', { date: monthDay(newestMissed.date, 'short') })}`
									: ''}
							</CaptionText>
							<Icon
								color={theme.colors.onHeaderSurface}
								name='chevronRight'
								size={15}
								strokeWidth={1.8}
							/>
						</CardSurface>
					) : null}

					{/* S7: joined after the group began — counting starts on the join day. */}
					{isJoinedLate ? (
						<View style={[styles.lateNote, { backgroundColor: theme.colors.sand }]}>
							<CaptionText color={theme.colors.sandText} style={styles.lateNoteText}>
								{t('hpJoinedLateNote', {
									date: monthDay(data.startedDate, 'long'),
									suffix: trSuffix(turkishWordLocativeSuffix(monthDay(data.startedDate, 'long')))
								})}
							</CaptionText>
						</View>
					) : null}

					{/* S6: an individual reading — its round on the 33, a short history, and delete. */}
					{!isShared && individualRound && round ? (
						<CardSurface style={[styles.roundCard, styles.cardGap]}>
							<View style={styles.roundHead}>
								<Typography style={styles.roundTitle} variant='title' weight='medium'>
									{t('hpRoundLabel', { n: round.number })}
								</Typography>
								{roundWrap ? (
									<CaptionText color={theme.colors.faintText} style={styles.linkHint}>
										{roundWrap}
									</CaptionText>
								) : null}
							</View>
							<CellGrid borderWidth={1.5} columns={11} gap={4} items={individualRound.items} radius={6} />
							<View style={styles.legend}>
								<LegendKey
									color={theme.colors.accent}
									label={t('hpLegendReadCount', { count: individualRound.read })}
								/>
								<LegendKey
									color={theme.colors.missedSurface}
									label={t('hpLegendMissedCount', { count: individualRound.missed })}
								/>
								<LegendKey
									color={theme.colors.accentMuted}
									label={t('hpLegendToday')}
									ring={theme.colors.text}
								/>
							</View>
						</CardSurface>
					) : null}
					{!isShared ? (
						<CardSurface isFlush>
							<View style={[styles.historyHead, { borderBottomColor: theme.colors.divider }]}>
								<Typography style={styles.roundTitle} variant='title' weight='medium'>
									{t('hpHistoryTitle')}
								</Typography>
								{joinedDate ? (
									<CaptionText color={theme.colors.faintText} style={styles.linkHint}>
										{t('hpHistorySince', {
											date: monthDay(joinedDate, 'short'),
											suffix: trSuffix(turkishWordAblativeSuffix(monthDay(joinedDate, 'short')))
										})}
									</CaptionText>
								) : null}
							</View>
							{recentReadings.map(reading => (
								<Pressable
									accessibilityRole='button'
									key={reading.id}
									onPress={() => open(reading.id)}
									style={[styles.historyItem, { borderTopColor: theme.colors.divider }]}
								>
									<Typography
										color={theme.colors.faintText}
										style={styles.historyDate}
										variant='mono'
										weight='medium'
									>
										{monthDay(reading.date, 'short')}
									</Typography>
									<CaptionText numberOfLines={1} style={styles.historyTitle} weight='semibold'>
										{hizbPortionLabel(formatBabRange(portionsOf(reading)), t)}
										<CaptionText color={theme.colors.faintText} style={styles.historyTitle}>
											{` · ${workTitle(reading)}`}
										</CaptionText>
									</CaptionText>
									{reading.completedAt ? (
										<View style={[styles.statusChip, { backgroundColor: theme.colors.accentSoft }]}>
											<Icon
												color={theme.colors.accent}
												name='check'
												size={14}
												strokeWidth={2.2}
											/>
											<CaptionText
												color={theme.colors.accent}
												style={styles.statusLabel}
												weight='semibold'
											>
												{t('hpStatusRead')}
											</CaptionText>
										</View>
									) : (
										<AppButton
											fullWidth={false}
											onPress={() => open(reading.id)}
											size='sm'
											title={t('hpReadAction')}
											variant='primary'
										/>
									)}
								</Pressable>
							))}
							<Pressable
								accessibilityRole='button'
								onPress={openHistory}
								style={[styles.historyRow, { borderTopColor: theme.colors.divider }]}
							>
								<CaptionText color={theme.colors.accent} style={styles.footLabel} weight='semibold'>
									{t('hpAllHistory')}
								</CaptionText>
								<Icon color={theme.colors.accent} name='chevronRight' size={15} strokeWidth={1.8} />
							</Pressable>
						</CardSurface>
					) : null}
					{/* An individual reading can't be left, only deleted by its owner (S6b). */}
					{!isShared && group.isOwner ? (
						<AppButton
							accessibilityLabel={t('hpDeleteIndividual')}
							onPress={() => setIsDeleteOpen(true)}
							title={t('hpDeleteIndividual')}
							variant='dangerFilled'
							style={styles.deleteLink}
							icon='delete'
						/>
					) : null}

					{isShared ? (
						<>
							{eyebrow(t('hpGroupProgress'))}
							<CardSurface isFlush>
								{isGroupDone ? null : (
									<View style={styles.coverageBody}>
										<View style={styles.coverageHead}>
											<View>
												<Typography style={styles.coverageNumber} variant='numeric'>
													{`${readCount} `}
													<Typography
														color={theme.colors.faintText}
														style={styles.coverageTotal}
														variant='numeric'
													>
														/ 33
													</Typography>
												</Typography>
												<Typography
													color={theme.colors.faintText}
													style={styles.statLabel}
													variant='stat'
													weight='medium'
												>
													{t('hpPortionsRead')}
												</Typography>
											</View>
											<CaptionText
												color={theme.colors.subtext}
												style={styles.leftCount}
												weight='semibold'
											>
												{t('hpLeftCount', { count: 33 - readCount })}
											</CaptionText>
										</View>
										{coverageGrid}
										{today && !isTodayDone ? (
											myPortions.length === 1 && readByOthers.length > 0 ? (
												// S7: someone else read your portion — your own day still waits.
												<CaptionText color={theme.colors.faintText} style={styles.shareNote}>
													{t('hpYourShareOthersRead', { portion: myPortions[0] ?? '' })}
												</CaptionText>
											) : myPortions.length === 1 ? (
												<View style={styles.legend}>
													<LegendKey
														color={theme.colors.accent}
														label={t('hizbLegendRead')}
													/>
													<LegendKey
														color={theme.colors.segmentTrack}
														label={t('hpLegendLeft')}
													/>
													<LegendKey
														color={theme.colors.accentMuted}
														label={t('hpYourShare', { portions: myPortions[0] ?? '' })}
														ring={theme.colors.text}
													/>
												</View>
											) : (
												<CaptionText color={theme.colors.faintText} style={styles.shareNote}>
													{readByOthers.length > 0
														? t('hpYourShareOthers', {
																others: formatBabRange(readByOthers),
																portions: formatBabRange(myPortions)
														  })
														: t('hpYourShare', { portions: formatBabRange(myPortions) })}
												</CaptionText>
											)
										) : null}
									</View>
								)}
								{/* S5: the first day has no yesterday yet. */}
								{isFirstDay && !isGroupDone ? (
									<View
										style={[
											styles.linkRow,
											{
												borderTopColor: theme.colors.divider,
												borderTopWidth: StyleSheet.hairlineWidth
											}
										]}
									>
										<View
											style={[styles.smallBadge, { backgroundColor: theme.colors.segmentTrack }]}
										>
											<Icon
												color={theme.colors.faintText}
												name='minus'
												size={14}
												strokeWidth={1.8}
											/>
										</View>
										<CaptionText
											color={theme.colors.subtext}
											style={[styles.flex, styles.smallStrong]}
										>
											{t('hpFirstDayNote')}
										</CaptionText>
									</View>
								) : null}
								{/* Not while choosing a plan (S1) or out of the order (S3): yesterday is a member's view. */}
								{data.previousDay && !isPicking && !removed ? (
									<Pressable
										accessibilityRole='button'
										onPress={openProgress}
										style={[
											styles.linkRow,
											isGroupDone
												? null
												: {
														borderTopColor: theme.colors.divider,
														borderTopWidth: StyleSheet.hairlineWidth
												  }
										]}
									>
										<View
											style={[styles.smallBadge, { backgroundColor: theme.colors.missedSurface }]}
										>
											<Typography
												color={theme.colors.missed}
												style={styles.smallBadgeLabel}
												variant='title'
											>
												{unreadPortionCount(data.previousDay.coveredSpans)}
											</Typography>
										</View>
										<CaptionText style={[styles.flex, styles.smallStrong]} weight='semibold'>
											{t('hpYesterdayUnread')}
										</CaptionText>
										<CaptionText color={theme.colors.accent} style={styles.linkHint}>
											{t('hpLast30')}
										</CaptionText>
										<Icon
											color={theme.colors.accent}
											name='chevronRight'
											size={15}
											strokeWidth={1.8}
										/>
									</Pressable>
								) : null}
								{isPicking ? null : (
									<Pressable
										accessibilityRole='button'
										onPress={openReaders}
										style={[
											styles.linkRow,
											{
												borderTopColor: theme.colors.divider,
												borderTopWidth: StyleSheet.hairlineWidth
											}
										]}
									>
										<View style={styles.avatars}>
											{readersRead.slice(0, 3).map((reader, index) => {
												const tones = [
													[theme.colors.accentSoft, theme.colors.accent],
													[theme.colors.sand, theme.colors.sandText],
													[theme.colors.missedSurface, theme.colors.missed]
												] as const;
												const [background, foreground] =
													tones[index % tones.length] ?? tones[0];

												return (
													<View
														key={reader.id}
														style={[
															styles.avatar,
															index > 0 ? styles.avatarOverlap : null,
															{
																backgroundColor: background,
																borderColor: theme.colors.surface
															}
														]}
													>
														{/* A hidden name has no initial either, as on the readers list —
														    "Anonim" drew an "A" that read as a name. */}
														{reader.displayName === null && !reader.isMe ? (
															<Icon
																color={foreground}
																name='lock'
																size={10}
																strokeWidth={1.8}
															/>
														) : (
															<CaptionText
																color={foreground}
																style={styles.avatarLabel}
																weight='semibold'
															>
																{(reader.isMe ? t('hpYou') : reader.displayName ?? '')
																	.charAt(0)
																	.toLocaleUpperCase(language)}
															</CaptionText>
														)}
													</View>
												);
											})}
										</View>
										<CaptionText style={[styles.flex, styles.smallStrong]} weight='semibold'>
											{t('hpReadersToday', {
												read: readersRead.length,
												total: data.members.length
											})}
										</CaptionText>
										<Icon
											color={theme.colors.faintText}
											name='chevronRight'
											size={15}
											strokeWidth={1.8}
										/>
									</Pressable>
								)}
							</CardSurface>
							<View style={styles.groupCardGap}>{roundsCard}</View>
						</>
					) : (
						<CaptionText textAlign='center' color={theme.colors.subtext}>
							{t('hpIndividualCountHint')}
						</CaptionText>
					)}
				</View>

				{isShared ? (
					<LeaveGroupButton groupId={group.id} isFlexible isOwner={group.isOwner} isPlan kind={group.kind} />
				) : null}
			</ScreenContainer>
			{isShared ? (
				<ShareSheet group={group} isVisible={route.params.sheet === 'share'} onClose={closeSheet} />
			) : null}
			{group.isOwner ? (
				<ManageSheet
					group={group}
					isVisible={route.params.sheet === 'manage'}
					onClose={closeSheet}
					onOpenMembers={openMembers}
				/>
			) : null}
			{isShared ? (
				<MembersSheet groupId={group.id} isVisible={route.params.sheet === 'members'} onClose={closeSheet} />
			) : null}
			{/* R2: which of today's portions were read from the book. */}
			{today ? (
				<HizbBookSheet
					alreadyRead={bookPortionsRead}
					isPending={todayUpdate.isPending}
					isVisible={isBookSheetOpen}
					onClose={() => setIsBookSheetOpen(false)}
					onConfirm={confirmBook}
					portions={today.boardPortions}
					readsFromBook={data.readsFromBook}
				/>
			) : null}
			{/* S6b: deleting an individual reading — what goes with it, and that it can't be undone. */}
			{!isShared ? (
				<AppBottomSheet
					description={t('hpDeleteSub')}
					isVisible={isDeleteOpen}
					onClose={() => setIsDeleteOpen(false)}
					title={t('hpDeleteTitle', { name: group.name })}
				>
					<View style={styles.deleteBody}>
						<CardSurface isFlush>
							{[
								{
									badge: String(data.completedTraversals),
									label: t('hpDeleteHistory', { rounds: data.completedTraversals })
								},
								{
									badge: String(data.missedCount),
									label: t('hpDeleteMissed', { count: data.missedCount })
								},
								{ badge: null, label: t('hpDeleteFinal') }
							].map((row, index) => (
								<View
									key={row.label}
									style={[
										styles.deleteRow,
										index > 0
											? {
													borderTopColor: theme.colors.divider,
													borderTopWidth: StyleSheet.hairlineWidth
											  }
											: null
									]}
								>
									<View
										style={[
											styles.deleteBadge,
											{
												backgroundColor:
													row.badge === null
														? theme.colors.segmentTrack
														: theme.colors.missedSurface
											}
										]}
									>
										{row.badge === null ? (
											<Icon
												color={theme.colors.subtext}
												name='alert'
												size={15}
												strokeWidth={1.8}
											/>
										) : (
											<Typography
												color={theme.colors.missed}
												style={styles.smallBadgeLabel}
												variant='title'
											>
												{row.badge}
											</Typography>
										)}
									</View>
									<CaptionText color={theme.colors.subtext} style={styles.flex}>
										{row.label}
									</CaptionText>
								</View>
							))}
						</CardSurface>
						<AppButton
							disabled={deleteGroup.isPending}
							onPress={() => {
								deleteGroup.mutate(group.id);
								setIsDeleteOpen(false);
								navigation.navigate('Groups');
							}}
							size='lg'
							title={t('hpDeleteAction')}
							variant='dangerFilled'
						/>
						<AppButton onPress={() => setIsDeleteOpen(false)} title={t('cancel')} variant='ghost' />
					</View>
				</AppBottomSheet>
			) : null}
		</>
	);
};

/** One key under the coverage grid: a swatch (ringed for "yours") and its word. */
const LegendKey = ({ color, label, ring }: { color: string; label: string; ring?: string }) => {
	const { theme } = useThemeContext();

	return (
		<View style={styles.legendKey}>
			<View style={[styles.swatch, { backgroundColor: color, borderColor: ring ?? color }]} />
			<CaptionText color={theme.colors.faintText} style={styles.legendLabel}>
				{label}
			</CaptionText>
		</View>
	);
};

/* The design's measures, one to one (W1–W4 of "Hizb Kişisel Plan"). */
const styles = StyleSheet.create({
	flex: { flex: 1, minWidth: 0 },
	spread: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
	titleChips: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	// Sections carry their own spacing: 10 between cards, 22 before a section's eyebrow.
	body: { marginTop: 6 },
	// 18 under the heading in all (its 18 + the column's 12 − 12), for a leading banner.
	bodyUnderBanner: { marginTop: -12 },
	sectionEyebrow: { marginBottom: 10 },
	cardGap: { marginBottom: 10 },
	sectionEnd: { marginBottom: 22 },
	cardEyebrow: { fontSize: 10, letterSpacing: 0.8 },
	tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
	tagLabel: { fontSize: 10, letterSpacing: 0.6 },
	// W3's band.
	doneBand: { borderRadius: 18, gap: 12, marginBottom: 22, paddingHorizontal: 16, paddingVertical: 18 },
	doneBandHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
	doneBandTitle: { fontSize: 22, lineHeight: 27.5, marginTop: 6 },
	bandCount: { fontSize: 26, lineHeight: 26 },
	bandTotal: { fontSize: 15 },
	bandNote: { fontSize: 11.5 },
	// Today's card.
	todayBody: { padding: 16 },
	readingTitle: { fontSize: 21, lineHeight: 26.25, marginTop: 10 },
	readingDesc: { fontSize: 12.5, lineHeight: 18.75, marginTop: 3 },
	// R1/R4's chips, to the design: 6 apart, 10 under the title, 5×8 padding, radius 7, 11 semibold.
	portionChips: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
	portionChip: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
	portionChipLabel: { fontSize: 11, lineHeight: 14 },
	portionCount: { fontSize: 11.5, lineHeight: 22, marginLeft: 4 },
	progressBox: { borderRadius: 12, gap: 8, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10 },
	progressLine: { alignItems: 'center', flexDirection: 'row', gap: 8 },
	startedTag: { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
	startedLabel: { fontSize: 9.5, letterSpacing: 0.57 },
	smallStrong: { fontSize: 11 },
	counterLabel: { fontSize: 11, width: 58 },
	segments: { flexDirection: 'row', gap: 4 },
	segment: { borderRadius: 3, height: 5, width: 18 },
	bar: { borderRadius: 2, flex: 1, height: 4, overflow: 'hidden' },
	barFill: { height: '100%' },
	monoCount: { fontSize: 11 },
	darkButton: { marginTop: 14, minHeight: 48, paddingVertical: 15 },
	// R1/R4, as the design sets them: the card's first button 14 below, the grey one 8 under it,
	// R4's "Uygulamada oku" link 10 under the dark one.
	firstButton: { marginTop: 14 },
	bookButton: { marginTop: 8 },
	appLink: { marginTop: 10 },
	// Undoing a part-read day, at the end of its chips' row.
	partialUndo: { marginLeft: 'auto' },
	footRow: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	// Section S.
	pickCard: { marginBottom: 22, padding: 16 },
	pickTitle: { fontSize: 21, lineHeight: 26.25 },
	pickHint: { fontSize: 12.5, lineHeight: 18.75, marginBottom: 14, marginTop: 4 },
	pickOptions: { gap: 8 },
	pickOption: {
		alignItems: 'center',
		borderRadius: 15,
		borderWidth: 1.5,
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 14,
		paddingVertical: 12
	},
	pickNumber: { alignItems: 'center', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
	pickNumberLabel: { fontSize: 17, lineHeight: 21 },
	radio: {
		alignItems: 'center',
		borderRadius: 10,
		borderWidth: 1.5,
		height: 20,
		justifyContent: 'center',
		width: 20
	},
	radioDot: { borderRadius: 5, height: 10, width: 10 },
	centerNote: { fontSize: 11, marginTop: 10, textAlign: 'center' },
	removedHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
	removedIcon: { alignItems: 'center', borderRadius: 13, height: 40, justifyContent: 'center', width: 40 },
	removedTitle: { fontSize: 19, lineHeight: 23.75 },
	removedBody: { fontSize: 12.5, lineHeight: 19.4, marginTop: 4 },
	removedEyebrow: { marginTop: 12 },
	welcome: {
		alignItems: 'flex-start',
		borderRadius: 16,
		flexDirection: 'row',
		gap: 12,
		marginBottom: 18,
		paddingHorizontal: 14,
		paddingVertical: 13
	},
	welcomeBody: { fontSize: 11.5, lineHeight: 17.25, marginTop: 2 },
	lateNote: { borderRadius: 14, marginBottom: 22, paddingHorizontal: 14, paddingVertical: 11 },
	lateNoteText: { fontSize: 11.5, lineHeight: 17.25 },
	roundCard: { paddingHorizontal: 16, paddingVertical: 15 },
	roundHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
	roundTitle: { fontSize: 15, lineHeight: 19 },
	historyHead: {
		alignItems: 'baseline',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 13
	},
	historyItem: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 10
	},
	historyDate: { fontSize: 11, width: 52 },
	historyTitle: { flex: 1, fontSize: 12.5, minWidth: 0 },
	statusChip: {
		alignItems: 'center',
		borderRadius: 7,
		flexDirection: 'row',
		gap: 4,
		paddingHorizontal: 9,
		paddingVertical: 5
	},
	statusLabel: { fontSize: 10.5 },
	deleteLink: {
		marginTop: 18,
		marginBottom: 12
	},
	footLabelFixed: { fontSize: 12 },
	deleteBody: { gap: 14, paddingBottom: 20 },
	deleteRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
	deleteBadge: { alignItems: 'center', borderRadius: 9, height: 30, justifyContent: 'center', width: 30 },
	// The rounds card; 10 under the coverage card in "Grup ilerlemesi".
	groupCardGap: { marginTop: 10 },
	statsRow: { flexDirection: 'row' },
	statCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
	statCellDivided: { borderRightWidth: StyleSheet.hairlineWidth },
	statNumber: { fontSize: 24, lineHeight: 24 },
	statTotal: { fontSize: 16 },
	historyRow: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		paddingHorizontal: 16,
		paddingVertical: 11
	},
	// The Cevşen and Kur'an screens' "Senin ilerlemen" banner.
	banner: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
	bannerDivider: { height: 11, width: 1 },
	bannerStats: { flex: 1, minWidth: 0 },
	footLabel: { flex: 1, fontSize: 12, minWidth: 0 },
	localTime: { fontSize: 11.5 },
	// W2/W3's green row.
	doneRow: {
		alignItems: 'center',
		borderRadius: 16,
		flexDirection: 'row',
		gap: 12,
		marginBottom: 10,
		paddingHorizontal: 14,
		paddingVertical: 12
	},
	doneCheck: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
	rowTitle: { fontSize: 12.5 },
	rowSub: { fontSize: 11, marginTop: 2 },
	// W2's catch-up card.
	catchupCard: { padding: 16 },
	centerLink: { alignItems: 'center', marginTop: 10 },
	linkLabel: { fontSize: 11.5 },
	noteRow: {
		alignItems: 'flex-start',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 9,
		marginTop: 12,
		paddingTop: 12
	},
	note: { fontSize: 11, lineHeight: 16.5 },
	// The missed-days row.
	// The rounds card.
	statLabel: { fontSize: 10, letterSpacing: 0.6, marginTop: 5 },
	// Group progress.
	coverageBody: { paddingBottom: 14, paddingHorizontal: 16, paddingTop: 15 },
	coverageHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
	coverageNumber: { fontSize: 26, lineHeight: 26 },
	coverageTotal: { fontSize: 17 },
	leftCount: { fontSize: 11.5 },
	legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 11 },
	legendKey: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	legendLabel: { fontSize: 10.5 },
	swatch: { borderRadius: 3, borderWidth: 1.5, height: 9, width: 9 },
	shareNote: { fontSize: 11, lineHeight: 16.5, marginTop: 11 },
	linkRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
	linkHint: { fontSize: 11 },
	smallBadge: { alignItems: 'center', borderRadius: 7, height: 24, justifyContent: 'center', minWidth: 24 },
	smallBadgeLabel: { fontSize: 13, lineHeight: 16 },
	avatars: { flexDirection: 'row' },
	avatar: { alignItems: 'center', borderRadius: 12, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
	avatarOverlap: { marginLeft: -6 },
	avatarLabel: { fontSize: 10, lineHeight: 14 }
});
