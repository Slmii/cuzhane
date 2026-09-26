import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TabStackParamList } from '@/navigation/types';
import type { GroupDetail } from '@/lib/types/domain';
import { useHizbReading, useEnrollHizb } from '@/lib/hooks/useHizbReading';
import { useUpdateGroup } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { hizbPlanDescriptionKey } from '@/lib/utils/hizbPlanLabels';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
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
	const [showMembers, setShowMembers] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [showCompleted, setShowCompleted] = useState(false);
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
	const readers = [...data.members].sort((a, b) => Number(b.completed) - Number(a.completed));
	const visibleReaders = showMembers ? readers : readers.slice(0, 6);
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
						<View
							accessibilityRole='progressbar'
							accessibilityLabel={t('hpSharedToday')}
							accessibilityValue={{ min: 0, max: 100, now: percent }}
							style={[styles.progress, { backgroundColor: theme.colors.border }]}
						>
							<View style={{ height: 6, width: `${percent}%`, backgroundColor: theme.colors.accent }} />
						</View>
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
							<View
								accessibilityRole='progressbar'
								accessibilityLabel={t('myProgress')}
								accessibilityValue={{
									min: 0,
									max: data.personalProgress.total,
									now: data.personalProgress.completed
								}}
								style={[styles.progress, { backgroundColor: theme.colors.border }]}
							>
								<View
									style={{
										height: 6,
										width: `${
											(data.personalProgress.completed * 100) / data.personalProgress.total
										}%`,
										backgroundColor: theme.colors.accent
									}}
								/>
							</View>
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
							{t('hpToday')} ·{' '}
							{new Date(`${data.date}T12:00:00`).toLocaleDateString(language, {
								day: 'numeric',
								month: 'long'
							})}
						</CaptionText>
						<TitleText>
							{t('hpPortion', { days: data.today.planDays, portion: data.today.portion })}
						</TitleText>
						<BodyText>{t(hizbPlanDescriptionKey(data.today.planDays, data.today.portion))}</BodyText>
						<CaptionText color={theme.colors.accent}>
							{t(data.today.completedAt ? 'hpTodayDone' : 'hpTodayPending')}
						</CaptionText>
						<AppButton
							title={t(data.today.completedAt ? 'hpComplete' : 'hpRead')}
							onPress={() => open(data.today!.id)}
							variant={data.today.completedAt ? 'surface' : 'accent'}
						/>
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
									<CaptionText color={member.completed ? theme.colors.accent : theme.colors.subtext}>
										{t(member.completed ? 'hpTodayDone' : 'hpTodayPending')}
									</CaptionText>
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
									<CaptionText key={day.date}>
										{day.date} · {Math.round((day.covered * 100) / day.total)}%
										{day.complete ? ' ✓' : ''}
									</CaptionText>
							  ))
							: null}
					</CardSurface>
				) : (
					<CaptionText color={theme.colors.subtext}>{t('hpIndividualCountHint')}</CaptionText>
				)}
				{!group.hizbIndividual ? <HizbPlanOverview data={data} onOpen={open} /> : null}
				<TitleText>{t('hpCatchup', { count: data.missedCount })}</TitleText>
				<CaptionText color={theme.colors.subtext}>{t('hpDailyHint')}</CaptionText>
				<AppButton
					title={t(showCompleted ? 'hpOnlyMissed' : 'hpShowHistory')}
					onPress={() => setShowCompleted(!showCompleted)}
					variant='ghost'
				/>
				{history
					.filter(assignment => showCompleted || (!assignment.completedAt && assignment.date < data.date))
					.map(assignment => (
						<CardSurface key={assignment.id} style={styles.card} onPress={() => open(assignment.id)}>
							<CaptionText>
								{assignment.date} ·{' '}
								{t('hpPortion', { days: assignment.planDays, portion: assignment.portion })}
							</CaptionText>
							<BodyText>{t(hizbPlanDescriptionKey(assignment.planDays, assignment.portion))}</BodyText>
							<CaptionText color={assignment.completedAt ? theme.colors.accent : theme.colors.subtext}>
								{t(assignment.completedAt ? 'hpComplete' : 'hpRead')}
							</CaptionText>
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
				<>
					<CaptionText>{t('hpInactiveDays')}</CaptionText>
					<TextInput
						accessibilityLabel={t('hpInactiveDays')}
						keyboardType='number-pad'
						value={days}
						onChangeText={setDays}
						style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
					/>
				</>
			) : null}
			<AppButton
				title={t('save')}
				disabled={enabled && !valid}
				isLoading={update.isPending}
				onPress={() => update.mutate({ groupId: group.id, inactivityDays: enabled ? Number(days) : null })}
				variant='surface'
			/>
		</CardSurface>
	);
};
const styles = StyleSheet.create({
	card: { gap: 12 },
	stats: { flexDirection: 'row', gap: 16 },
	stat: { flex: 1, gap: 4 },
	personal: { padding: 16, borderRadius: 18, gap: 6 },
	progress: { height: 6, borderRadius: 3, overflow: 'hidden' },
	member: { gap: 4, paddingVertical: 8 },
	memberHeading: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
	input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 }
});
