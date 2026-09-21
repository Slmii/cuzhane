import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TabStackParamList } from '@/navigation/types';
import type { ReadingAssignment } from '@/api/readingGroups.api';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { BodyStrongText, CaptionText } from '@/components/ui/Typography/Typography.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { HIZB_SECTIONS } from '@/lib/content/hizbulhakaik';
import { useLeaveReadingGroup, useReadingGroup } from '@/lib/hooks/useReadingGroups';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { HizbProgressGrid } from './HizbProgressGrid.component';

type Props = NativeStackScreenProps<TabStackParamList, 'HizbGroup'>;
export const HizbGroupScreen = ({ navigation, route }: Props) => {
	const { t, language } = useTranslation();
	const query = useReadingGroup(route.params.groupId);
	const leave = useLeaveReadingGroup();
	const [showHistory, setShowHistory] = useState(false);
	const [showMembers, setShowMembers] = useState(false);
	const [confirmLeave, setConfirmLeave] = useState(false);
	const [copied, setCopied] = useState(false);
	const [copyError, setCopyError] = useState(false);
	const group = query.data;
	const openPart = useCallback(
		(partIndex: number, assignment?: ReadingAssignment) =>
			navigation.navigate('HizbReader', {
				sectionIndex: partIndex,
				assignment:
					assignment?.status === 'pending'
						? { groupId: route.params.groupId, assignmentId: assignment.id }
						: undefined
			}),
		[navigation, route.params.groupId]
	);
	if (!group) {
		return (
			<ScreenContainer>
				<ScreenHeader hasBackButton title={t('hrGroups')} />
				{query.isPending ? (
					<ActivityIndicator accessibilityLabel={t('hrLoading')} />
				) : (
					<AppButton title={t('retry')} onPress={() => void query.refetch()} />
				)}
			</ScreenContainer>
		);
	}
	const active = group.myMemberships.find(m => m.active);
	const current = active?.cycles.at(-1) ?? group.myMemberships.at(-1)?.cycles.at(-1);
	const pending = group.myMemberships.flatMap(m =>
		m.cycles.flatMap(c => c.assignments.filter(a => a.status === 'pending'))
	);
	const completed = group.myMemberships.reduce((count, m) => count + m.completedCycles, 0);
	const supported = group.planKey === 'hizbul-hakaik-sections-v1' && group.numberOfParts === HIZB_SECTIONS.length;
	const date = (value: string) =>
		new Date(value).toLocaleString(language, {
			timeZone: group.timezone,
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	const read = (assignment: ReadingAssignment) =>
		navigation.navigate('HizbReader', {
			sectionIndex: assignment.partIndex,
			assignment: { groupId: group.id, assignmentId: assignment.id }
		});
	return (
		<ScreenContainer>
			<ScreenHeader
				hasBackButton
				title={group.name}
				subtitle={`${t('hizbTitle')} · ${t(group.cadence === 'WEEKLY' ? 'hrWeekly' : 'hrMonthly')}`}
			/>
			{query.isError ? <AppButton title={t('retry')} onPress={() => void query.refetch()} /> : null}
			<CardSurface style={{ gap: 10 }}>
				<BodyStrongText>{t('hrPersonal')}</BodyStrongText>
				<BodyStrongText>
					{t('hrProgress', { done: current?.completedParts ?? 0, total: group.numberOfParts })}
				</BodyStrongText>
				<ProgressBar percent={((current?.completedParts ?? 0) * 100) / group.numberOfParts} />
				{current ? (
					<HizbProgressGrid
						numberOfParts={group.numberOfParts}
						assignments={current.assignments}
						onPressPart={supported ? openPart : undefined}
					/>
				) : null}
				<CaptionText>{t('hrCompleted', { count: completed })}</CaptionText>
				{current ? (
					<CaptionText>
						{t('hrPeriod', { start: date(current.startedAt), end: date(current.endsAt) })}
					</CaptionText>
				) : null}
				{current?.nextAssignmentAt ? (
					<CaptionText>{t('hrNext', { date: date(current.nextAssignmentAt) })}</CaptionText>
				) : null}
				{active && current?.completedAt ? <CaptionText>{t('hrWaiting')}</CaptionText> : null}
				{active && current && !current.completedAt && Date.parse(current.endsAt) < Date.parse(group.asOf) ? (
					<CaptionText>{t('hrOverdue')}</CaptionText>
				) : null}
				{!active ? <CaptionText>{t('hrFormer')}</CaptionText> : null}
			</CardSurface>
			<CardSurface style={{ gap: 10 }}>
				<BodyStrongText>{t('hrCollective')}</BodyStrongText>
				<CaptionText>
					{t('hrCollectiveProgress', {
						count: group.collective.fullReadings,
						remainder: group.collective.remainderParts,
						total: group.numberOfParts
					})}
				</CaptionText>
				<ProgressBar percent={(group.collective.remainderParts * 100) / group.numberOfParts} />
			</CardSurface>
			{!supported ? <CaptionText>{t('hrPlanUnavailable')}</CaptionText> : null}
			<BodyStrongText>{t('hrDue')}</BodyStrongText>
			{pending.length === 0 ? <CaptionText>{t('hrNoDue')}</CaptionText> : null}
			{pending.map(assignment => (
				<CardSurface style={{ gap: 10 }} key={assignment.id}>
					<BodyStrongText>
						{t('hrPart', { part: assignment.partIndex + 1 })} · {HIZB_SECTIONS[assignment.partIndex]?.title}
					</BodyStrongText>
					<CaptionText>{t('hrAssigned', { date: date(assignment.assignedAt) })}</CaptionText>
					<AppButton title={t('hrRead')} disabled={!supported} onPress={() => read(assignment)} />
				</CardSurface>
			))}
			<AppButton
				title={`${t('hrMembers', { count: group.members.length })} · ${t(showMembers ? 'hrHide' : 'hrShow')}`}
				variant='surface'
				onPress={() => setShowMembers(!showMembers)}
			/>
			{showMembers ? (
				<CardSurface style={{ gap: 10 }}>
					{group.members.map(member => (
						<CaptionText key={member.id}>
							{t('hrMember', {
								sequence: member.joinSequence,
								name: member.displayName,
								part: member.currentPartIndex === null ? '–' : member.currentPartIndex + 1
							})}
						</CaptionText>
					))}
				</CardSurface>
			) : null}
			<AppButton
				title={`${t('hrHistory')} · ${t(showHistory ? 'hrHide' : 'hrShow')}`}
				variant='surface'
				onPress={() => setShowHistory(!showHistory)}
			/>
			{showHistory
				? group.myMemberships.flatMap(member =>
						member.cycles.map(cycle => (
							<CardSurface style={{ gap: 10 }} key={cycle.id}>
								<BodyStrongText>
									{t('hrCycle', { cycle: cycle.index + 1, sequence: member.joinSequence })}
								</BodyStrongText>
								<CaptionText>
									{t('hrProgress', { done: cycle.completedParts, total: group.numberOfParts })}
								</CaptionText>
								<HizbProgressGrid
									numberOfParts={group.numberOfParts}
									assignments={cycle.assignments}
									onPressPart={supported ? openPart : undefined}
								/>
								{cycle.assignments.map(assignment => (
									<View key={assignment.id}>
										<CaptionText>
											{t('hrPart', { part: assignment.partIndex + 1 })} ·{' '}
											{assignment.completedAt
												? `${t('hrDone')} · ${date(assignment.completedAt)}`
												: t('hrAssigned', { date: date(assignment.assignedAt) })}
										</CaptionText>
									</View>
								))}
							</CardSurface>
						))
				  )
				: null}
			<CardSurface style={{ gap: 10 }}>
				<BodyStrongText>
					{t('hrCode')}: {group.inviteCode}
				</BodyStrongText>
				<AppButton
					title={t(copied ? 'hrCopied' : 'hrCopy')}
					variant='surface'
					onPress={() => {
						setCopyError(false);
						void Clipboard.setStringAsync(group.inviteCode)
							.then(() => setCopied(true))
							.catch(() => setCopyError(true));
					}}
				/>
				{copyError ? <CaptionText>{t('hrError')}</CaptionText> : null}
			</CardSurface>
			{active ? <AppButton title={t('hrLeave')} variant='danger' onPress={() => setConfirmLeave(true)} /> : null}
			{confirmLeave && active ? (
				<CardSurface style={{ gap: 10 }}>
					<CaptionText>{t('hrLeaveNote')}</CaptionText>
					<AppButton
						title={t('hrLeave')}
						variant='dangerFilled'
						isLoading={leave.isPending}
						onPress={() => leave.mutate(group.id, { onSuccess: () => setConfirmLeave(false) })}
					/>
					<AppButton
						title={t('hrCancel')}
						variant='ghost'
						disabled={leave.isPending}
						onPress={() => setConfirmLeave(false)}
					/>
					{leave.isError ? <CaptionText>{t('hrError')}</CaptionText> : null}
				</CardSurface>
			) : null}
		</ScreenContainer>
	);
};
