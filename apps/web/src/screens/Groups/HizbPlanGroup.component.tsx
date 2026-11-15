import { BeginnerGuide } from '@/components/BeginnerGuide/BeginnerGuide.component';
import { ReadingHelpPanel, RequestHelpButton } from '@/components/ReadingHelp/ReadingHelp.component';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TabStackParamList } from '@/navigation/types';
import type { GroupDetail } from '@/lib/types/domain';
import { useHizbReading, useEnrollHizb, useUpdateHizbAssignment } from '@/lib/hooks/useHizbReading';
import { useUpdateGroup } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { formatPlanDate, hizbPlanDescriptionKey } from '@/lib/utils/hizbPlanLabels';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { AppInput } from '@/components/ui/Input/Input.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { BodyText, CaptionText, NumericText, TitleText } from '@/components/ui/Typography/Typography.component';
import { ToggleRow } from '@/components/ui/ToggleRow/ToggleRow.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { GroupDetailSkeleton } from './GroupDetailSkeleton.component';
import { ManageSheet } from './ManageSheet.component';
import { MembersSheet } from './MembersSheet.component';
import { ShareSheet } from './ShareSheet.component';
import { HizbPlanOverview } from './HizbPlanOverview.component';
import { LeaveGroupButton } from './LeaveGroupButton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'GroupDetail'> & { group: GroupDetail };
export const HizbPlanGroup = ({ group, route, navigation }: Props) => {
	const { t, language } = useTranslation();
	const { theme } = useThemeContext();
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
	const completeToday = useUpdateHizbAssignment(group.id, data?.today?.id ?? '');
	const [showMembers, setShowMembers] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [showCompleted, setShowCompleted] = useState(false);
	const [showUpcoming, setShowUpcoming] = useState(false);
	if (query.isError) {
		return <ErrorState queries={[query]} />;
	}
	if (!data) {
		return <GroupDetailSkeleton />;
	}
	const removed = data.enrollment?.reason === 'INACTIVITY';
	const active = data.enrollment?.endDay === null;
	const percent = data.coverage.total ? Math.round((data.coverage.covered * 100) / data.coverage.total) : 0;
	const open = (id: string) => navigation.navigate('HizbPlanReader', { groupId: group.id, assignmentId: id });
	const history = query.data!.pages.flatMap(page => page.assignments);
	const upcoming = data.upcoming ?? [];
	const nextUnread = upcoming.find(assignment => !assignment.completedAt);
	const readers = [...data.members].sort((a, b) => Number(b.completed) - Number(a.completed));
	const visibleReaders = showMembers ? readers : readers.slice(0, 6);
	const missed = history.filter(assignment => !assignment.completedAt && assignment.date < data.date);
	// The tick beside "Okundu" is a drawn glyph, never a character in the string.
	const tick = <Icon color={theme.colors.accent} name='check' size={14} strokeWidth={2.1} />;
	const finishToday = () => {
		const assignment = data.today;
		if (!assignment || assignment.completedAt || assignment.canEdit === false || completeToday.isPending) {
			return;
		}
		// This action confirms the whole reading, including repetitions done in a physical book.
		completeToday.mutate(
			{
				version: assignment.version,
				read: true,
				...(assignment.requiresSekine ? { repetitions: 19 } : {}),
				...(assignment.requiresDelailRepetition ? { delailRepetitions: 3 } : {}),
				...(assignment.requiresIstighfar
					? { istighfarRepetitions: Math.max(assignment.istighfarRepetitions, assignment.istighfarTarget) }
					: {})
			},
			{ onError: () => void query.refetch() }
		);
	};
	return (
		<>
			<ScreenContainer pullToRefresh={pullToRefresh}>
				<ScreenHeader
					hasBackButton
					title={group.name}
					subtitle={
						group.hizbIndividual
							? `${t('hpIndividual')} · ${t('hpDays', { days: group.hizbPlan! })}`
							: group.hizbPlan
							? t('hpDays', { days: group.hizbPlan })
							: t('hpMixed')
					}
				/>
				<BeginnerGuide group={group} />
				{!active ? (
					<CardSurface style={styles.card}>
						<TitleText>{t(removed ? 'hpRejoin' : 'hpChoose')}</TitleText>
						{removed ? (
							<BodyText>{t('hpRemoved', { days: data.enrollment?.removalDays ?? 10 })}</BodyText>
						) : null}
						<CaptionText color={theme.colors.subtext}>{t('hpDailyHint')}</CaptionText>
						{(group.hizbPlan ? [group.hizbPlan] : [7, 15, 33]).map(days => (
							<AppButton
								key={days}
								title={t('hpDays', { days })}
								onPress={() => enroll.mutate(days)}
								disabled={enroll.isPending}
							/>
						))}
						{enroll.isError ? <CaptionText color={theme.colors.danger}>{t('hpError')}</CaptionText> : null}
					</CardSurface>
				) : null}
				{!group.hizbIndividual ? (
					<CardSurface style={styles.card}>
						<View style={styles.stats}>
							<View style={styles.stat}>
								<NumericText>{percent}%</NumericText>
								<CaptionText color={theme.colors.subtext}>{t('hpSharedToday')}</CaptionText>
							</View>
							<View style={styles.stat}>
								<NumericText>
									{data.members.filter(member => member.completed).length} / {data.members.length}
								</NumericText>
								<CaptionText color={theme.colors.subtext}>{t('hpReadersDone')}</CaptionText>
							</View>
						</View>
						<ProgressBar
							accessibilityLabel={t('hpSharedToday')}
							percent={percent}
							trackColor={theme.colors.border}
						/>
					</CardSurface>
				) : null}
				<View
					style={[
						styles.personal,
						{ backgroundColor: data.missedCount ? theme.colors.dangerSurface : theme.colors.accentSoft }
					]}
				>
					<BodyText weight='semibold'>{t('myProgress')}</BodyText>
					{data.personalProgress ? (
						<>
							<TitleText>
								{t('hpPlanPosition', {
									day: data.personalProgress.day,
									total: data.personalProgress.total
								})}
							</TitleText>
							<CaptionText>
								{t('hpPlanCompleted', {
									count: data.personalProgress.completed,
									total: data.personalProgress.total
								})}
							</CaptionText>
							<ProgressBar
								accessibilityLabel={t('myProgress')}
								percent={
									data.personalProgress.total
										? (data.personalProgress.completed * 100) / data.personalProgress.total
										: 0
								}
								trackColor={theme.colors.border}
							/>
						</>
					) : null}
					<BodyText weight='semibold' color={data.missedCount ? theme.colors.danger : theme.colors.accent}>
						{t(data.missedCount ? 'hpBehind' : data.today?.completedAt ? 'hpUpToDate' : 'hpNoMissed', {
							count: data.missedCount
						})}
					</BodyText>
					{data.oldestMissedId ? (
						<AppButton
							title={t('hpCatchupStart')}
							variant='surface'
							onPress={() => open(data.oldestMissedId!)}
						/>
					) : null}
					<CaptionText color={theme.colors.subtext}>
						{t('hpPersonal', { count: data.completedTraversals })}
					</CaptionText>
				</View>
				{data.today ? (
					<CardSurface style={styles.card}>
						<CaptionText>
							{t('hpToday')} · {formatPlanDate(data.date, language)}
						</CaptionText>
						<TitleText>
							{t('hpPortion', { days: data.today.planDays, portion: data.today.portion })}
						</TitleText>
						<BodyText>{t(hizbPlanDescriptionKey(data.today.planDays, data.today.portion))}</BodyText>
						<View
							accessibilityLiveRegion='polite'
							style={[
								styles.readStatus,
								styles.status,
								{
									backgroundColor: data.today.completedAt
										? theme.colors.accentSoft
										: theme.colors.surfaceMuted
								}
							]}
						>
							{data.today.completedAt ? tick : null}
							<BodyText
								weight='semibold'
								color={data.today.completedAt ? theme.colors.accent : theme.colors.subtext}
							>
								{t(data.today.completedAt ? 'hpTodayDone' : 'hpTodayPending')}
							</BodyText>
						</View>
						<AppButton
							title={t(data.today.completedAt ? 'hpReadAgain' : 'hpRead')}
							onPress={() => open(data.today!.id)}
							variant={data.today.completedAt ? 'surface' : 'accent'}
						/>
						{!data.today.completedAt && !group.hizbIndividual ? (
							<RequestHelpButton groupId={group.id} target={{ assignmentId: data.today.id }} today />
						) : null}
						{data.today.completedByOther ? (
							<CaptionText color={theme.colors.accent}>{t('helpCompleted')}</CaptionText>
						) : null}
						{!data.today.completedAt ? (
							<>
								<AppButton
									title={t('hpFinishFromOverview')}
									disabled={data.today.canEdit === false}
									onPress={finishToday}
									isLoading={completeToday.isPending}
									variant='surface'
								/>
								<CaptionText color={theme.colors.subtext}>{t('hpFinishFromOverviewHint')}</CaptionText>
								{completeToday.isError ? (
									<CaptionText color={theme.colors.danger}>{t('hpError')}</CaptionText>
								) : null}
							</>
						) : null}
						<CaptionText color={theme.colors.subtext}>
							{t('hpNextDay', {
								time: new Date(data.nextDayAt).toLocaleString(language, {
									day: 'numeric',
									month: 'long',
									hour: '2-digit',
									minute: '2-digit'
								})
							})}
						</CaptionText>
					</CardSurface>
				) : null}
				{active && upcoming.length ? (
					<View style={styles.card}>
						<TitleText>{t('hpUpcoming')}</TitleText>
						<CaptionText color={theme.colors.subtext}>{t('hpReadAheadHint')}</CaptionText>
						{nextUnread ? (
							<AppButton title={t('hpReadAhead')} onPress={() => open(nextUnread.id)} variant='accent' />
						) : null}
						{(showUpcoming ? upcoming : upcoming.slice(0, 3)).map(assignment => (
							<CardSurface key={assignment.id} style={styles.card} onPress={() => open(assignment.id)}>
								<CaptionText>
									{formatPlanDate(assignment.date, language, true)}
									{' · '}
									{t('hpPortion', { days: assignment.planDays, portion: assignment.portion })}
								</CaptionText>
								<BodyText>
									{t(hizbPlanDescriptionKey(assignment.planDays, assignment.portion))}
								</BodyText>
								<View style={styles.status}>
									{assignment.completedAt ? tick : null}
									<BodyText
										weight='semibold'
										color={assignment.completedAt ? theme.colors.accent : theme.colors.subtext}
									>
										{t(assignment.completedAt ? 'hpTodayDone' : 'hpTodayPending')}
									</BodyText>
								</View>
							</CardSurface>
						))}
						{upcoming.length > 3 ? (
							<AppButton
								title={t(showUpcoming ? 'hpHideUpcoming' : 'hpShowUpcoming')}
								onPress={() => setShowUpcoming(!showUpcoming)}
								variant='ghost'
							/>
						) : null}
					</View>
				) : null}
				{!group.hizbIndividual ? (
					<CardSurface style={styles.card}>
						<TitleText>{t('hpReadersToday')}</TitleText>
						{visibleReaders.map(member => (
							<View
								key={member.id}
								style={[
									styles.member,
									{
										borderBottomColor: theme.colors.divider,
										borderBottomWidth: StyleSheet.hairlineWidth
									}
								]}
							>
								<View style={styles.memberHeading}>
									<BodyText weight='semibold' style={{ flex: 1 }}>
										{member.id === data.enrollment?.id
											? t('you')
											: member.displayName ?? t('anonymousMember')}
									</BodyText>
									<View style={styles.status}>
										{member.completed ? tick : null}
										<CaptionText
											color={member.completed ? theme.colors.accent : theme.colors.subtext}
										>
											{t(member.completed ? 'hpTodayDone' : 'hpTodayPending')}
										</CaptionText>
									</View>
								</View>
								<CaptionText color={theme.colors.subtext}>
									{t('hpPortion', { days: member.planDays, portion: member.portion })}
								</CaptionText>
							</View>
						))}
						{data.members.length > 6 ? (
							<AppButton
								title={t(showMembers ? 'hpFewerReaders' : 'hpMembers', { count: data.members.length })}
								onPress={() => setShowMembers(!showMembers)}
								variant='ghost'
							/>
						) : null}
						<AppButton
							title={t('hpHistory')}
							onPress={() => setShowHistory(!showHistory)}
							variant='ghost'
						/>
						{showHistory
							? data.dailyHistory.map(day => (
									<View key={day.date} style={styles.status}>
										<CaptionText>
											{formatPlanDate(day.date, language)} ·{' '}
											{day.total ? Math.round((day.covered * 100) / day.total) : 0}%
										</CaptionText>
										{day.complete ? tick : null}
									</View>
							  ))
							: null}
					</CardSurface>
				) : (
					<CaptionText color={theme.colors.subtext}>{t('hpIndividualCountHint')}</CaptionText>
				)}
				{!group.hizbIndividual ? (
					<ReadingHelpPanel
						groupId={group.id}
						onOpen={request => {
							if (request.assignmentId) {
								open(request.assignmentId);
							}
						}}
					/>
				) : null}
				{!group.hizbIndividual ? <HizbPlanOverview data={data} onOpen={open} /> : null}
				<TitleText>{t('hpCatchup', { count: data.missedCount })}</TitleText>
				<CaptionText color={theme.colors.subtext}>{t('hpDailyHint')}</CaptionText>
				<AppButton
					title={t(showCompleted ? 'hpOnlyMissed' : 'hpShowHistory')}
					onPress={() => setShowCompleted(!showCompleted)}
					variant='ghost'
				/>
				{/* Nothing owed is an answer, not a blank: without it the heading sat over an empty list. */}
				{!showCompleted && !data.missedCount ? (
					<View style={styles.status}>
						{tick}
						<CaptionText color={theme.colors.accent}>{t('hpNoMissed')}</CaptionText>
					</View>
				) : null}
				{(showCompleted ? history : missed).map(assignment => (
					<CardSurface key={assignment.id} style={styles.card}>
						<CaptionText>
							{formatPlanDate(assignment.date, language, true)} ·{' '}
							{t('hpPortion', { days: assignment.planDays, portion: assignment.portion })}
						</CaptionText>
						<BodyText>{t(hizbPlanDescriptionKey(assignment.planDays, assignment.portion))}</BodyText>
						<View style={styles.status}>
							{assignment.completedAt ? tick : null}
							<CaptionText color={assignment.completedAt ? theme.colors.accent : theme.colors.subtext}>
								{t(assignment.completedAt ? 'hpTodayDone' : 'hpTodayPending')}
							</CaptionText>
						</View>
						<AppButton
							title={t(assignment.completedAt ? 'hpReadAgain' : 'hpRead')}
							variant='surface'
							onPress={() => open(assignment.id)}
						/>
						{!assignment.completedAt && !group.hizbIndividual ? (
							<RequestHelpButton groupId={group.id} target={{ assignmentId: assignment.id }} />
						) : null}
					</CardSurface>
				))}
				{query.hasNextPage ? (
					<AppButton
						title={t('hpMore')}
						isLoading={query.isFetchingNextPage}
						onPress={() => void query.fetchNextPage()}
						variant='surface'
					/>
				) : null}
				{group.isOwner && !group.hizbIndividual ? (
					<InactivitySettings key={String(group.inactivityDays)} group={group} />
				) : null}
				{!group.hizbIndividual ? (
					<LeaveGroupButton groupId={group.id} isFlexible isOwner={group.isOwner} />
				) : null}
			</ScreenContainer>
			{!group.hizbIndividual ? (
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
			{!group.hizbIndividual ? (
				<MembersSheet groupId={group.id} isVisible={route.params.sheet === 'members'} onClose={closeSheet} />
			) : null}
		</>
	);
};
const InactivitySettings = ({ group }: { group: GroupDetail }) => {
	const { t } = useTranslation();
	const { theme } = useThemeContext();
	const update = useUpdateGroup();
	const [enabled, setEnabled] = useState(group.inactivityDays != null);
	const [days, setDays] = useState(String(group.inactivityDays ?? 10));
	const valid = /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 365;
	return (
		<CardSurface style={styles.card}>
			<ToggleRow
				title={t('hpInactivity')}
				hint={t('hpInactivityHint')}
				value={enabled}
				onValueChange={setEnabled}
			/>
			{enabled ? (
				<AppInput
					accessibilityLabel={t('hpInactiveDays')}
					hasError={!valid}
					keyboardType='number-pad'
					label={t('hpInactiveDays')}
					maxLength={3}
					onChangeText={setDays}
					value={days}
				/>
			) : null}
			<AppButton
				title={t('save')}
				disabled={enabled && !valid}
				isLoading={update.isPending}
				onPress={() => update.mutate({ groupId: group.id, inactivityDays: enabled ? Number(days) : null })}
				variant='surface'
			/>
			{update.isError ? <CaptionText color={theme.colors.danger}>{t('hpError')}</CaptionText> : null}
		</CardSurface>
	);
};
const styles = StyleSheet.create({
	readStatus: { padding: 12, borderRadius: 10 },
	card: { gap: 12 },
	stats: { flexDirection: 'row', gap: 16 },
	stat: { flex: 1, gap: 4 },
	personal: { padding: 16, borderRadius: 18, gap: 6 },
	status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	member: { gap: 4, paddingVertical: 8 },
	memberHeading: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
});
