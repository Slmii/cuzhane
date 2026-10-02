import type { HizbAssignment } from '@/api/hizbReading.api';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { TourTarget } from '@/components/Tour/TourTarget.component';
import { AppBottomSheet } from '@/components/ui/BottomSheet/BottomSheet.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { CellGrid } from '@/components/ui/CellGrid/CellGrid.component';
import type { CellGridItem } from '@/components/ui/CellGrid/CellGrid.types';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { NavRow } from '@/components/ui/NavRow/NavRow.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { CaptionText, TitleText, Typography } from '@/components/ui/Typography/Typography.component';
import { planBlocks } from '@/lib/content/hizbPlans';
import { useDeleteGroup } from '@/lib/hooks/useGroup';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import {
	useCreateHizbAhead,
	useEnrollHizb,
	useHizbReading,
	useSetHizbReadsFromBook,
	useUpdateHizbAssignment
} from '@/lib/hooks/useHizbReading';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { GroupDetail } from '@/lib/types/domain';
import { formatBabRange } from '@/lib/utils/babs';
import { confirmDestructive } from '@/lib/utils/confirmDestructive';
import { hizbPortionLabel, kindLabelKey } from '@/lib/utils/groups';
import { hizbAheadView, isReadBeforeItsDay } from '@/lib/utils/hizbAhead';
import { boardPortionsOf, planBoardCells, unreadPortionCount } from '@/lib/utils/hizbPlanBoard';
import { readersPreview } from '@/lib/utils/hizbReadersPreview';
import { timeIn, timeUntilReset, zoneAbbreviation } from '@/lib/utils/roundReset';
import {
	turkishDativeSuffix,
	turkishGenitiveSuffix,
	turkishNameDativeSuffix,
	turkishWordAblativeSuffix,
	turkishWordLocativeSuffix
} from '@/lib/utils/turkishSuffixes';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
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
	const data = query.data?.pages[0];
	const today = data?.today ?? null;
	// Today's reading, written from this screen: undo, and marking it read from the book (R1, R2, R4).
	const todayUpdate = useUpdateHizbAssignment(group.id, today?.id ?? '');
	const setReadsFromBook = useSetHizbReadsFromBook(group.id);
	// Reading ahead: the next day, offered once today's is read.
	const aheadView = data ? hizbAheadView(data) : null;
	const createAhead = useCreateHizbAhead(group.id);
	const [isBookSheetOpen, setIsBookSheetOpen] = useState(false);
	const cells = useMemo(() => (data ? planBoardCells(data.coveredSpans, today) : []), [data, today]);
	const isGroupDone = cells.length > 0 && cells.every(cell => cell.state === 'read');
	// S1: the plan chosen on the picker before it is started — the one option when the plan is fixed.
	const [pickedPlan, setPickedPlan] = useState<number | null>(group.hizbPlan || null);
	// S6b: the delete confirmation for an individual reading.
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	// The days read ahead, listed in a sheet from "N gün ileridesin".
	const [isAheadOpen, setIsAheadOpen] = useState(false);
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
	// Names hidden from this viewer: not the owner, nor a member ticked to see who read.
	const namesHidden = group.hideMemberNames && !group.isOwner && !group.seesReaders;
	const readers = readersPreview(data.members, { namesHidden });
	const readersPercent = readers.total > 0 ? Math.round((readers.read * 100) / readers.total) : 0;
	const open = (id: string) => navigation.navigate('HizbPlanReader', { groupId: group.id, assignmentId: id });
	// T2, T3, T4 and T5 of the design.
	const openMissed = () => navigation.navigate('HizbMissed', { groupId: group.id });
	const openHistory = () => navigation.navigate('HizbPlanHistory', { groupId: group.id });
	// A shared plan's "Tüm geçmiş" is the group's, day by day.
	const openGroupHistory = () => navigation.navigate('HizbGroupHistory', { groupId: group.id });
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
	// A day read ahead says so — "Önceden okundu", and the day it was read on — rather than a time
	// from an earlier day under "Bugün okundu".
	const isReadEarly = today !== null && isReadBeforeItsDay(today.completedAt, today.date, group.timezone);
	const readEarlySub =
		isReadEarly && today
			? [
					hizbPortionLabel(formatBabRange(portionsOf(today)), t),
					t('hpAheadReadOn', {
						date: new Date(today.completedAt ?? data.nextDayAt).toLocaleDateString(language, {
							day: 'numeric',
							month: 'long'
						})
					}),
					isReadFromBook ? t('hbFromBookAt', { time: readAt }) : readAt
			  ].join(' · ')
			: null;
	// Portions already marked from the book on a day not finished yet.
	const bookPortionsRead = today && !isTodayDone ? today.readPortions : [];
	const isStarted =
		today !== null &&
		!isTodayDone &&
		(today.bookmark > 0 || today.repetitions > 0 || today.istighfarRepetitions > 0 || today.delailRepetitions > 0);
	const pageCount = today ? planBlocks(today.planDays, today.portion).length : 0;
	const page = today ? Math.min(today.bookmark + 1, pageCount) : 0;
	const myPortions = today ? portionsOf(today) : [];
	const round = data.currentRound;
	const bannerMuted = toAlphaColor(theme.colors.onHeaderSurface, 0.62);
	// The missed day's own round — the server counts rounds across a leave and a rejoin.
	const missedRound = newestMissed?.round ?? null;

	// The day offered ahead, on today's plan — "Yarın", or its weekday and date further out
	// (capitalised: Dutch writes "maandag", and it opens the row).
	const offer = aheadView?.offer && today ? { ...aheadView.offer, planDays: today.planDays } : null;
	const weekdayDate = (date: string) => {
		const label = new Date(`${date}T12:00:00Z`).toLocaleDateString(language, {
			day: 'numeric',
			month: 'long',
			timeZone: 'UTC',
			weekday: 'long'
		});

		return label.charAt(0).toLocaleUpperCase(language) + label.slice(1);
	};
	const offerWhen = offer ? (offer.daysAway === 1 ? t('hpAheadTomorrow') : weekdayDate(offer.date)) : '';
	const through = aheadView?.through ?? null;
	const throughDate = through ? monthDay(through.date, 'long') : '';

	// "Oku" on the day ahead: its reading is made on the first tap, then opened like any other.
	const openAhead = () => {
		if (offer?.assignmentId) {
			open(offer.assignmentId);
		} else if (offer) {
			createAhead.mutate(undefined, { onSuccess: assignment => open(assignment.id) });
		}
	};

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
	// A round that began mid-plan says where it began and the day it ends — "Bölüm 7 ile başladın ·
	// 2 Kasım günü biter" — not "7. günden başladın, 6. günde": a part of the plan, not a day.
	const roundStart =
		today && round && planDays > 0 ? ((((today.portion - round.days) % planDays) + planDays) % planDays) + 1 : 1;
	const roundEnd =
		round && planDays > 0
			? new Date(Date.parse(`${data.date}T12:00:00Z`) + (planDays - round.days) * 86_400_000)
					.toISOString()
					.slice(0, 10)
			: data.date;
	const roundWrap =
		roundStart > 1
			? t('hpRoundWrap', {
					date: monthDay(roundEnd, 'long'),
					portions: hizbPortionLabel(formatBabRange(portionsOf({ planDays, portion: roundStart })), t)
			  })
			: null;
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

	// Rounds: done, and where this one stands; the whole card opens the group's history. A shared
	// group's only — an individual reading draws its own round card. Shown from the first day, as the
	// Cevşen's and Kur'an's are.
	const roundsCard = data.enrollment ? (
		<CardSurface isFlush onPress={openGroupHistory} style={styles.sectionEnd}>
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
					{/* W3: the group has covered all 33 today — a green band, its count and who took part. */}
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
							</View>
							<CaptionText color={toAlphaColor(theme.colors.onAccent, 0.72)} style={styles.bandNote}>
								{/* In words, not "33 / 33": every other count here is people. */}
								{`${t('hpWholeBookToday')} · ${t('hpContributors', { count: readersRead.length })}`}
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

					{/* "Benim ilerlemem": one headed card around the reader's own rows, as on the Cevşen's. */}
					<SectionCard
						isCard={!isPicking}
						label={t('hpMyProgress')}
						style={removed ? styles.removedEyebrow : undefined}
					>
						{/* W1/W4: today's reading, the one dark button. H1 of the first-use tour — the wrapper
					    carries the card's gap, so the spotlight is the card alone. */}
						{today && !isTodayDone ? (
							<TourTarget id='hizbToday' style={styles.cardGap}>
								{/* No card of its own: it is the section card's first row, edge to edge. */}
								<View style={styles.todayBlock}>
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
																color={
																	isRead ? theme.colors.onAccent : theme.colors.accent
																}
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
											<View
												style={[
													styles.progressBox,
													{ backgroundColor: theme.colors.background }
												]}
											>
												{/* On its own line above the rows, so it heads them all rather than the page. */}
												<View
													style={[styles.startedTag, { backgroundColor: theme.colors.sand }]}
												>
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
													<View
														style={[
															styles.bar,
															{ backgroundColor: theme.colors.progressTrack }
														]}
													>
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
												<AppButton
													disabled={todayUpdate.isPending}
													icon='bookPages'
													onPress={readFromBook}
													size='lg'
													style={styles.firstButton}
													title={t('hbReadFromBook')}
													variant='primary'
												/>
												<AppButton
													onPress={() => open(today.id)}
													style={styles.appLink}
													title={t(isStarted ? 'hpContinue' : 'hbReadInApp')}
													variant='ghost'
												/>
											</>
										) : (
											<>
												<AppButton
													onPress={() => open(today.id)}
													size='lg'
													style={styles.firstButton}
													title={t(isStarted ? 'hpContinue' : 'hbReadInApp')}
													variant='primary'
												/>
												<AppButton
													disabled={todayUpdate.isPending}
													icon='bookPages'
													onPress={readFromBook}
													size='lg'
													style={styles.bookButton}
													title={t('hbReadFromBook')}
													variant='tonal'
												/>
											</>
										)}
									</View>
									{nextRow(nextAt)}
								</View>
							</TourTarget>
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
										{`${isReadEarly ? t('hpReadEarly') : t('hpReadToday')} · ${workTitle(today)}`}
									</CaptionText>
									<CaptionText
										color={toAlphaColor(theme.colors.accentStrong, 0.7)}
										style={styles.rowSub}
									>
										{readEarlySub ??
											(newestMissed
												? t('hpReadTodaySub', {
														day: today.portion,
														time: isReadFromBook
															? t('hbFromBookAt', { time: readAt })
															: readAt
												  })
												: isReadFromBook
												? `${hizbPortionLabel(formatBabRange(myPortions), t)} · ${t(
														'hbFromBookAt',
														{
															time: readAt
														}
												  )}`
												: t('hpNoMissedSub', { portions: formatBabRange(myPortions) }))}
									</CaptionText>
								</View>
								{/* Not once the group has read all 33 (W3): the day is done for everyone. Nor with a
								    day read ahead: a day read ahead stays read. */}
								{isGroupDone || !aheadView?.canUndoToday ? null : (
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

						{/* The next day, once today's is read: one at a time, in order, in the same reader —
						    and, in the same section, how far ahead, opening the list of days read ahead. */}
						{offer || through ? (
							<View style={[styles.aheadSection, { backgroundColor: theme.colors.background }]}>
								<Typography
									color={theme.colors.subtext}
									style={[styles.cardEyebrow, styles.aheadEyebrow]}
									variant='stat'
									weight='medium'
								>
									{t('hpAheadEyebrow')}
								</Typography>
								{offer ? (
									<View style={styles.aheadOfferRow}>
										<View style={[styles.doneCheck, { backgroundColor: theme.colors.accentMuted }]}>
											<Icon
												color={theme.colors.accent}
												name='calendar'
												size={16}
												strokeWidth={1.8}
											/>
										</View>
										<View style={styles.flex}>
											<CaptionText style={styles.rowTitle} weight='semibold'>
												{`${offerWhen} · ${workTitle(offer)}`}
											</CaptionText>
											<CaptionText color={theme.colors.subtext} style={styles.rowSub}>
												{hizbPortionLabel(formatBabRange(portionsOf(offer)), t)}
											</CaptionText>
											{createAhead.isError ? (
												<CaptionText color={theme.colors.danger} style={styles.rowSub}>
													{t('hpError')}
												</CaptionText>
											) : null}
										</View>
										<AppButton
											disabled={createAhead.isPending}
											fullWidth={false}
											onPress={openAhead}
											size='sm'
											title={t('hpReadAction')}
											variant='primary'
										/>
									</View>
								) : null}
								{/* How far ahead — no undo for a day read ahead; the chevron opens the days themselves. */}
								{through ? (
									<NavRow
										label={t(
											pluralKey(language, through.days, 'hpAheadDaysOne', 'hpAheadDaysOther'),
											{
												count: through.days
											}
										)}
										meta={throughDate}
										onPress={() => setIsAheadOpen(true)}
										style={[
											styles.aheadNavRow,
											offer
												? {
														borderTopColor: theme.colors.divider,
														borderTopWidth: StyleSheet.hairlineWidth
												  }
												: null
										]}
									/>
								) : null}
							</View>
						) : null}

						{/* W2: with today read, the dark button moves to the newest missed day. */}
						{today && isTodayDone && newestMissed ? (
							<CardSurface
								style={[
									styles.catchupCard,
									styles.cardGap,
									{ borderColor: theme.colors.missed, borderWidth: 2 }
								]}
							>
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
									<CaptionText
										color={theme.colors.subtext}
										style={styles.linkLabel}
										weight='semibold'
									>
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
					</SectionCard>

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
							<CardSurface isFlush>
								<SectionHeading
									count={`${readers.read} / ${readers.total}`}
									label={t('hpGroupProgress')}
								/>
								{/* Today's readers, for a group of three or of five hundred: how many read, then a
								    few of them — you first — and the whole list a tap away. */}
								<View style={styles.coverageBody}>
									{readers.isAllRead && !isGroupDone ? (
										<View style={[styles.allReadBand, { backgroundColor: theme.colors.accent }]}>
											<View
												style={[
													styles.allReadDisc,
													{ backgroundColor: toAlphaColor(theme.colors.onAccent, 0.18) }
												]}
											>
												<Icon
													color={theme.colors.onAccent}
													name='check'
													size={18}
													strokeWidth={2.2}
												/>
											</View>
											<View style={styles.flex}>
												<TitleText color={theme.colors.onAccent} style={styles.allReadTitle}>
													{t('hpAllReadToday')}
												</TitleText>
												<CaptionText
													color={toAlphaColor(theme.colors.onAccent, 0.8)}
													style={styles.rowSub}
												>
													{t('hpReadersToday', { read: readers.read, total: readers.total })}
												</CaptionText>
											</View>
										</View>
									) : (
										<>
											<View style={styles.coverageHead}>
												<View>
													<Typography style={styles.coverageNumber} variant='numeric'>
														{`${readers.read} `}
														<Typography
															color={theme.colors.faintText}
															style={styles.coverageTotal}
															variant='numeric'
														>
															{`/ ${readers.total}`}
														</Typography>
													</Typography>
													<Typography
														color={theme.colors.faintText}
														style={styles.statLabel}
														variant='stat'
														weight='medium'
													>
														{t('hpReadersReadToday')}
													</Typography>
												</View>
												<CaptionText
													color={theme.colors.subtext}
													style={styles.leftCount}
													weight='semibold'
												>
													{t('hpPercent', { percent: readersPercent })}
												</CaptionText>
											</View>
											<ProgressBar
												fillColor={theme.colors.accent}
												height={6}
												percent={readersPercent}
											/>
										</>
									)}
								</View>
								{readers.rows.map(reader => {
									const isAnonymous = !reader.isMe && reader.displayName === null;
									const name = reader.isMe
										? t('hpYou')
										: reader.displayName ?? t('hpAnonymousReader');
									const chip = reader.completed
										? {
												background: theme.colors.accentSoft,
												foreground: theme.colors.accent,
												label: reader.completedAt
													? timeIn(new Date(reader.completedAt), language)
													: t('hpStatusDone')
										  }
										: reader.started
										? {
												background: theme.colors.sand,
												foreground: theme.colors.sandText,
												label: t('hpStatusStarted')
										  }
										: {
												background: theme.colors.segmentTrack,
												foreground: theme.colors.faintText,
												label: t('hpStatusWaiting')
										  };

									return (
										<View
											key={reader.id}
											style={[
												styles.linkRow,
												{
													borderTopColor: theme.colors.divider,
													borderTopWidth: StyleSheet.hairlineWidth
												}
											]}
										>
											<View
												style={[
													styles.readerAvatar,
													{
														backgroundColor: reader.isMe
															? theme.colors.accent
															: isAnonymous
															? theme.colors.segmentTrack
															: theme.colors.accentSoft
													}
												]}
											>
												{isAnonymous ? (
													<Icon
														color={theme.colors.faintText}
														name='lock'
														size={13}
														strokeWidth={1.8}
													/>
												) : (
													<CaptionText
														color={
															reader.isMe ? theme.colors.onAccent : theme.colors.accent
														}
														style={styles.avatarLabel}
														weight='semibold'
													>
														{name.charAt(0).toLocaleUpperCase(language)}
													</CaptionText>
												)}
											</View>
											<View style={styles.flex}>
												<CaptionText style={styles.rowTitle} weight='semibold'>
													{name}
												</CaptionText>
												<CaptionText color={theme.colors.faintText} style={styles.rowSub}>
													{t('hpReaderLine', {
														day: reader.portion,
														portions: text.portionsLabel(reader)
													})}
												</CaptionText>
											</View>
											<View style={[styles.readerChip, { backgroundColor: chip.background }]}>
												<CaptionText
													color={chip.foreground}
													style={styles.smallStrong}
													weight='semibold'
												>
													{chip.label}
												</CaptionText>
											</View>
										</View>
									);
								})}
								{/* Names hidden from you: rows of "Bir üye" would say nothing, so the rest is a count. */}
								{namesHidden && readers.othersRead > 0 ? (
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
											style={[
												styles.readerAvatar,
												{ backgroundColor: theme.colors.segmentTrack }
											]}
										>
											<Icon
												color={theme.colors.faintText}
												name='lock'
												size={13}
												strokeWidth={1.8}
											/>
										</View>
										<View style={styles.flex}>
											<CaptionText style={styles.rowTitle} weight='semibold'>
												{t(
													// "3 üye daha okudu" under your own row; without one (no plan yet), "3 üye okudu".
													readers.rows.length > 0
														? pluralKey(
																language,
																readers.othersRead,
																'hpOthersReadOne',
																'hpOthersReadOther'
														  )
														: pluralKey(
																language,
																readers.othersRead,
																'hpMembersReadOne',
																'hpMembersReadOther'
														  ),
													{
														count: readers.othersRead
													}
												)}
											</CaptionText>
											<CaptionText color={theme.colors.faintText} style={styles.rowSub}>
												{t('hpNamesHiddenShort')}
											</CaptionText>
										</View>
									</View>
								) : null}
								{readers.hasMore && !isPicking ? (
									<NavRow
										label={t('hpSeeAll')}
										meta={
											readers.waiting > 0
												? t('hpFilterWaiting', { count: readers.waiting })
												: undefined
										}
										onPress={openReaders}
										style={{
											borderTopColor: theme.colors.divider,
											borderTopWidth: StyleSheet.hairlineWidth
										}}
									/>
								) : null}
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
									</View>
								) : null}
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
				<ManageSheet group={group} isVisible={route.params.sheet === 'manage'} onClose={closeSheet} />
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
			{/* The days read ahead: each one's date, its portion and when it was read. */}
			{through && today ? (
				<AppBottomSheet
					description={t(pluralKey(language, through.days, 'hpAheadThroughOne', 'hpAheadThroughOther'), {
						count: through.days,
						date: throughDate,
						suffix: trSuffix(turkishNameDativeSuffix(throughDate))
					})}
					isVisible={isAheadOpen}
					onClose={() => setIsAheadOpen(false)}
					title={t('hpAheadSheetTitle')}
				>
					<View style={styles.deleteBody}>
						<CardSurface isFlush>
							{(through.readings ?? []).map((reading, index) => (
								<View
									key={reading.day}
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
									<View style={[styles.doneCheck, { backgroundColor: theme.colors.accentSoft }]}>
										<Icon color={theme.colors.accent} name='check' size={16} strokeWidth={2.4} />
									</View>
									<View style={styles.flex}>
										<CaptionText style={styles.rowTitle} weight='semibold'>
											{`${weekdayDate(reading.date)} · ${workTitle({
												planDays: today.planDays,
												portion: reading.portion
											})}`}
										</CaptionText>
										<CaptionText color={theme.colors.subtext} style={styles.rowSub}>
											{hizbPortionLabel(
												formatBabRange(
													portionsOf({ planDays: today.planDays, portion: reading.portion })
												),
												t
											)}
										</CaptionText>
										<CaptionText color={theme.colors.subtext} style={styles.rowSub}>
											{t('hpAheadReadOn', {
												date: new Date(reading.completedAt).toLocaleDateString(language, {
													day: 'numeric',
													month: 'long'
												})
											})}
										</CaptionText>
									</View>
								</View>
							))}
						</CardSurface>
					</View>
				</AppBottomSheet>
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
/** A section's heading, as the Cevşen board draws its own: title and count, then a divider. */
const SectionHeading = ({ count, label }: { count?: string; label: string }) => {
	const { theme } = useThemeContext();

	return (
		<View style={[styles.sectionHeading, { borderBottomColor: theme.colors.divider }]}>
			<TitleText>{label}</TitleText>
			{count === undefined ? null : <CaptionText color={theme.colors.faintText}>{count}</CaptionText>}
		</View>
	);
};

/** A headed card around a section's rows — or, while the screen is choosing a plan, just the rows. */
const SectionCard = ({
	children,
	isCard,
	label,
	style
}: {
	children: ReactNode;
	isCard: boolean;
	label: string;
	style?: ViewStyle | undefined;
}) =>
	isCard ? (
		<CardSurface isFlush style={[styles.sectionEnd, style]}>
			<SectionHeading label={label} />
			<View style={styles.sectionCardBody}>{children}</View>
		</CardSurface>
	) : (
		<>{children}</>
	);

const styles = StyleSheet.create({
	sectionHeading: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingBottom: 13,
		paddingHorizontal: 16,
		paddingTop: 15
	},
	// The rows keep their own 10-point gaps, so the last one's is taken off the bottom padding.
	sectionCardBody: { paddingBottom: 5, paddingHorizontal: 15, paddingTop: 15 },
	flex: { flex: 1, minWidth: 0 },
	spread: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
	titleChips: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	// Sections carry their own spacing: 10 between cards, 22 before a section's eyebrow.
	body: { marginTop: 6 },
	// 18 under the heading in all (its 18 + the column's 12 − 12), for a leading banner.
	bodyUnderBanner: { marginTop: -12 },
	cardGap: { marginBottom: 10 },
	sectionEnd: { marginBottom: 22 },
	cardEyebrow: { fontSize: 10, letterSpacing: 0.8 },
	tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
	tagLabel: { fontSize: 10, letterSpacing: 0.6 },
	// W3's band.
	doneBand: { borderRadius: 18, gap: 12, marginBottom: 22, paddingHorizontal: 16, paddingVertical: 18 },
	doneBandHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
	doneBandTitle: { fontSize: 22, lineHeight: 27.5, marginTop: 6 },
	bandNote: { fontSize: 11.5, marginTop: -10 },
	// Today's card.
	todayBody: { padding: 16 },
	// Out to the section card's edges: its body is inset 15, and this row carries its own 16.
	todayBlock: { marginHorizontal: -15, marginTop: -15 },
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
	// Reading ahead: the next day and how far ahead, one section like the done row.
	aheadSection: { borderRadius: 16, marginBottom: 10, overflow: 'hidden' },
	aheadOfferRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
	aheadEyebrow: { paddingHorizontal: 14, paddingTop: 12 },
	aheadNavRow: { paddingHorizontal: 14, paddingVertical: 12 },
	// W2's catch-up card.
	catchupCard: { padding: 16 },
	centerLink: { alignItems: 'center', marginTop: 10 },
	linkLabel: { fontSize: 11.5 },
	noteRow: {
		alignItems: 'center',
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
	readerAvatar: { alignItems: 'center', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
	readerChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
	allReadBand: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, padding: 14 },
	allReadDisc: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
	allReadTitle: { fontSize: 19, lineHeight: 24 },
	linkRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
	linkHint: { fontSize: 11 },
	smallBadge: { alignItems: 'center', borderRadius: 7, height: 24, justifyContent: 'center', minWidth: 24 },
	smallBadgeLabel: { fontSize: 13, lineHeight: 16 },
	avatarLabel: { fontSize: 10, lineHeight: 14 }
});
