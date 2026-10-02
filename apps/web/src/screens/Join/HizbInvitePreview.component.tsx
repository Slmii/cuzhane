import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import { CaptionText, TitleText, Typography } from '@/components/ui/Typography/Typography.component';
import type { PullToRefreshState } from '@/components/ui/PullToRefresh/PullToRefresh.types';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import type { GroupInvitePreview } from '@/lib/types/domain';
import { kindLabelKey } from '@/lib/utils/groups';
import { compactCount, hizbAgeLabel } from '@/lib/utils/hizbDiscover';
import { timeIn, zoneAbbreviation } from '@/lib/utils/roundReset';
import { turkishWordAblativeSuffix } from '@/lib/utils/turkishSuffixes';
import { StyleSheet, View } from 'react-native';

const PORTIONS = 33;
const PLANS = [7, 15, 33] as const;
const PER_DAY_KEY: Record<(typeof PLANS)[number], StringKey> = {
	7: 'hdPerDay7',
	15: 'hdPerDay15',
	33: 'hdPerDay33'
};
const PLAN_DESC_KEY: Record<(typeof PLANS)[number], StringKey> = {
	7: 'hpPlanDesc7',
	15: 'hpPlanDesc15',
	33: 'hpPlanDesc33'
};

type Props = {
	data: GroupInvitePreview;
	/** Reached with an invite code or the QR (P4): a private group says so beside its plan. */
	isByCode: boolean;
	isJoining: boolean;
	hasJoinError: boolean;
	onJoin: () => void;
	onOpenGroup: () => void;
	pullToRefresh: PullToRefreshState;
};

/**
 * The invite preview of a Hizb group on personal plans — "Hizb Kişisel Plan", section 5, P1–P6.
 * Read-only: the full 33 grid says which portions today's readers have covered, with no share of
 * yours ringed and no names. The rules card appears only for an inactivity rule or hidden names.
 *
 * - P1 fixed plan · P2 mixed plan (the three plans listed as information; the choice comes after
 *   joining, on the group screen) · P3 the day already covered (W3's band; joining stays open).
 * - P4 a private group reached by its code · P5 already a member (no plan list, "Grubu aç") ·
 *   P6 taken out of the order by the inactivity rule (rejoining is the group screen's).
 */
export const HizbInvitePreview = ({
	data,
	hasJoinError,
	isByCode,
	isJoining,
	onJoin,
	onOpenGroup,
	pullToRefresh
}: Props) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const { monthDay, trSuffix } = useHizbPlanText();

	const plan = data.hizbPlan ?? PORTIONS;
	const isMixed = data.hizbPlan === 0;
	// Today's readers — a count only, the same on every card: how many of everyone on a plan read.
	const read = data.hizbReaders?.read ?? 0;
	const total = data.hizbReaders?.total ?? 0;
	const percent = total > 0 ? Math.round((read * 100) / total) : 0;
	const isDone = total > 0 && read === total;
	/*
	 * Membership as it was before "Gruba katıl": the join refetches this preview, which then says
	 * "already a member" while the next screen is still sliding in. Held for the whole join.
	 */
	const wasMember = data.isMember && !isJoining;
	const isRemoved = wasMember && data.hizbRemoved === true;
	const isMember = wasMember && !isRemoved;
	const age = hizbAgeLabel(data.hizbDay ?? 1, t);
	const startDate = data.startedAt
		? monthDay(
				new Intl.DateTimeFormat('en-CA', {
					day: '2-digit',
					month: '2-digit',
					timeZone: data.timezone,
					year: 'numeric'
				}).format(new Date(data.startedAt)),
				'long'
		  )
		: null;
	const resetInstant = data.nextDayAt ? new Date(data.nextDayAt) : null;
	const planKey = PLANS.find(days => days === plan);

	const rules: { body: string; icon: IconName; isSand: boolean; title: string }[] = [
		...(data.inactivityDays
			? [
					{
						body: t('hdRuleBody'),
						icon: 'memberLeft' as const,
						isSand: true,
						title: t('hdRuleTitle', { days: data.inactivityDays })
					}
			  ]
			: []),
		...(data.hideMemberNames
			? [{ body: t('hdNamesHiddenBody'), icon: 'eyeOff' as const, isSand: false, title: t('hdNamesHidden') }]
			: [])
	];

	const timeRow = resetInstant ? (
		<>
			<Icon color={theme.colors.faintText} name='clock' size={15} strokeWidth={1.7} />
			<CaptionText style={styles.timeLabel} weight='semibold'>
				{t('hdEveryDayAt', {
					time: timeIn(resetInstant, language, data.timezone),
					zone: zoneAbbreviation(resetInstant, language, data.timezone)
				})}
			</CaptionText>
			<CaptionText color={theme.colors.accent} style={styles.localTime}>
				{t('yourTimeAt', { time: timeIn(resetInstant, language) })}
			</CaptionText>
		</>
	) : null;

	return (
		<ScreenContainer contentContainerStyle={styles.content} pullToRefresh={pullToRefresh}>
			<View>
				<ScreenHeader
					hasBackButton
					subtitle={data.dedication ?? undefined}
					title={data.name}
					titleTrailing={
						<View style={styles.chips}>
							<Chip label={isMixed ? t('hpMixedPlan') : t('hpDays', { days: plan })} tone='accent' />
							{isByCode && data.visibility === 'PRIVATE' ? (
								<Chip icon='lock' label={t('hdPrivateGroup')} tone='neutral' />
							) : (
								<Chip label={t(kindLabelKey('HIZB'))} tone='neutral' />
							)}
						</View>
					}
				/>
				<CaptionText color={theme.colors.faintText} style={styles.meta}>
					{[
						t(pluralKey(language, data.memberCount, 'hdMembersOne', 'hdMembersOther'), {
							count: compactCount(data.memberCount, language)
						}),
						...(startDate && !age.isNew
							? [
									t('hdSince', {
										date: startDate,
										suffix: trSuffix(turkishWordAblativeSuffix(startDate))
									})
							  ]
							: []),
						age.label
					].join(' · ')}
				</CaptionText>

				{/* P6: out of the reading order — still a member; the way back is the group screen. */}
				{isRemoved ? (
					<CardSurface style={styles.card}>
						<View style={styles.removedHead}>
							<View style={[styles.removedIcon, { backgroundColor: theme.colors.missedSurface }]}>
								<Icon color={theme.colors.missed} name='clock' size={18} strokeWidth={1.8} />
							</View>
							<View style={styles.flex}>
								<TitleText style={styles.removedTitle}>{t('hpRemovedTitle')}</TitleText>
								<CaptionText color={theme.colors.subtext} style={styles.removedBody}>
									{t('hdRemovedBody', { days: data.hizbRemovalDays ?? data.inactivityDays ?? 0 })}
								</CaptionText>
							</View>
						</View>
					</CardSurface>
				) : null}

				{/* The plan: one card for a fixed plan; the three, as information, for a mixed one. */}
				{isMixed ? (
					isMember || isRemoved ? null : (
						<>
							<Typography
								color={theme.colors.faintText}
								style={styles.eyebrow}
								variant='eyebrow'
								weight='medium'
							>
								{t('hdPickOnJoin')}
							</Typography>
							<CardSurface isFlush style={styles.card}>
								{PLANS.map((days, index) => (
									<View
										key={days}
										style={[
											styles.planRow,
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
												styles.planRowBadge,
												{ backgroundColor: theme.colors.segmentTrack }
											]}
										>
											<Typography style={styles.planRowNumber} variant='title'>
												{days}
											</Typography>
										</View>
										<View style={styles.flex}>
											<CaptionText style={styles.planRowTitle} weight='semibold'>
												{t('hpDays', { days })}
											</CaptionText>
											<CaptionText color={theme.colors.faintText} style={styles.planRowSub}>
												{t(PLAN_DESC_KEY[days])}
											</CaptionText>
										</View>
									</View>
								))}
							</CardSurface>
						</>
					)
				) : (
					<CardSurface style={[styles.card, styles.planCard]}>
						<View style={[styles.planBadge, { backgroundColor: theme.colors.accentSoft }]}>
							<Typography color={theme.colors.accent} style={styles.planBadgeNumber} variant='numeric'>
								{plan}
							</Typography>
							<Typography
								color={theme.colors.accent}
								style={styles.planBadgeUnit}
								variant='stat'
								weight='semibold'
							>
								{t('hdDaysUnit')}
							</Typography>
						</View>
						<View style={styles.flex}>
							{planKey ? (
								<CaptionText style={styles.planTitle} weight='semibold'>
									{t(PER_DAY_KEY[planKey])}
								</CaptionText>
							) : null}
							<CaptionText color={theme.colors.subtext} style={styles.planBody}>
								{t('hdPlanBody', { days: plan })}
							</CaptionText>
						</View>
					</CardSurface>
				)}

				{/* Today's readers — or, once everyone has read, the green band — and when the day turns over. */}
				{isDone ? (
					<>
						<View style={[styles.band, { backgroundColor: theme.colors.accent }]}>
							<View style={styles.bandHead}>
								<View style={styles.flex}>
									<Typography
										color={toAlphaColor(theme.colors.onAccent, 0.65)}
										style={styles.bandEyebrow}
										variant='stat'
										weight='medium'
									>
										{t('hpTodayDate', {
											date: resetInstant
												? monthDay(
														new Intl.DateTimeFormat('en-CA', {
															day: '2-digit',
															month: '2-digit',
															timeZone: data.timezone,
															year: 'numeric'
														}).format(new Date(resetInstant.getTime() - 1)),
														'long'
												  )
												: ''
										})}
									</Typography>
									<TitleText color={theme.colors.onAccent} style={styles.bandTitle}>
										{t('hpAllReadToday')}
									</TitleText>
								</View>
								<Typography color={theme.colors.onAccent} style={styles.bandCount} variant='numeric'>
									{read}
									<Typography
										color={toAlphaColor(theme.colors.onAccent, 0.6)}
										style={styles.bandTotal}
										variant='numeric'
									>
										{` / ${total}`}
									</Typography>
								</Typography>
							</View>
						</View>
						{timeRow ? <CardSurface style={[styles.card, styles.timeCard]}>{timeRow}</CardSurface> : null}
					</>
				) : (
					<CardSurface isFlush style={styles.card}>
						<View style={styles.coverageBody}>
							<View style={styles.coverageHead}>
								<View>
									<Typography style={styles.coverageNumber} variant='numeric'>
										{`${read} `}
										<Typography
											color={theme.colors.faintText}
											style={styles.coverageTotal}
											variant='numeric'
										>
											{`/ ${total}`}
										</Typography>
									</Typography>
									<Typography
										color={theme.colors.faintText}
										style={styles.coverageLabel}
										variant='stat'
										weight='medium'
									>
										{t('hpReadersReadToday')}
									</Typography>
								</View>
								<CaptionText color={theme.colors.subtext} style={styles.percentLeft} weight='semibold'>
									{t('hpPercent', { percent })}
								</CaptionText>
							</View>
							<ProgressBar fillColor={theme.colors.accent} height={6} percent={percent} />
						</View>
						{timeRow ? (
							<View style={[styles.timeFoot, { borderTopColor: theme.colors.divider }]}>{timeRow}</View>
						) : null}
					</CardSurface>
				)}

				{/* Only when there is something to agree to: the inactivity rule, hidden names. */}
				{rules.length > 0 && !isMember && !isRemoved ? (
					<CardSurface isFlush style={styles.card}>
						{rules.map((rule, index) => (
							<View
								key={rule.title}
								style={[
									styles.ruleRow,
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
										styles.ruleBadge,
										{ backgroundColor: rule.isSand ? theme.colors.sand : theme.colors.segmentTrack }
									]}
								>
									<Icon
										color={rule.isSand ? theme.colors.sandText : theme.colors.subtext}
										name={rule.icon}
										size={15}
										strokeWidth={1.8}
									/>
								</View>
								<View style={styles.flex}>
									<CaptionText style={styles.ruleTitle} weight='semibold'>
										{rule.title}
									</CaptionText>
									<CaptionText color={theme.colors.faintText} style={styles.ruleBody}>
										{rule.body}
									</CaptionText>
								</View>
							</View>
						))}
					</CardSurface>
				) : null}
			</View>

			{/* The foot: join — or, already in, the way to the group. */}
			<View style={styles.foot}>
				{isMember ? (
					<View style={styles.memberNote}>
						<Icon color={theme.colors.accent} name='check' size={15} strokeWidth={2.2} />
						<CaptionText color={theme.colors.accentStrong} style={styles.memberLabel} weight='semibold'>
							{t('hdAlreadyMember')}
						</CaptionText>
					</View>
				) : null}
				{hasJoinError ? (
					<CaptionText color={theme.colors.danger} style={styles.footNote}>
						{t('genericError')}
					</CaptionText>
				) : null}
				<AppButton
					// The owner can close a group to new members; a code still opens its preview.
					disabled={isJoining || (!wasMember && !data.openToJoin)}
					isLoading={isJoining}
					onPress={wasMember ? onOpenGroup : onJoin}
					title={
						isRemoved
							? t('hdGoToGroup')
							: isMember
							? t('hdOpenGroup')
							: isMixed
							? t('hdJoinAndPick')
							: t('joinNow')
					}
					variant='primary'
				/>
				{wasMember ? null : (
					<CaptionText color={theme.colors.faintText} style={styles.footNote}>
						{!data.openToJoin
							? t('hdClosedToJoin')
							: isMixed
							? t('hdPickedPlanStartsToday')
							: t('hdPlanStartsToday', { days: plan })}
					</CaptionText>
				)}
			</View>
		</ScreenContainer>
	);
};

/* Section 5's P1–P6, measure for measure. */
const styles = StyleSheet.create({
	content: { flexGrow: 1, justifyContent: 'space-between' },
	flex: { flex: 1, minWidth: 0 },
	chips: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	meta: { fontSize: 12, marginBottom: 18 },
	card: { marginBottom: 10 },
	eyebrow: { marginBottom: 10 },
	// The fixed plan's card: its badge, then what a day holds.
	planCard: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
	planBadge: { alignItems: 'center', borderRadius: 15, height: 52, justifyContent: 'center', width: 52 },
	planBadgeNumber: { fontSize: 22, lineHeight: 22 },
	planBadgeUnit: { fontSize: 8.5, letterSpacing: 0.68 },
	planTitle: { fontSize: 13 },
	planBody: { fontSize: 11.5, lineHeight: 17.25, marginTop: 2 },
	// The mixed plan's three rows.
	planRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
	planRowBadge: { alignItems: 'center', borderRadius: 11, height: 36, justifyContent: 'center', width: 36 },
	planRowNumber: { fontSize: 17, lineHeight: 21 },
	planRowTitle: { fontSize: 12.5 },
	planRowSub: { fontSize: 11, marginTop: 1 },
	// Today's coverage.
	coverageBody: { paddingBottom: 14, paddingHorizontal: 16, paddingTop: 15 },
	coverageHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
	coverageNumber: { fontSize: 26, lineHeight: 26 },
	coverageTotal: { fontSize: 17 },
	coverageLabel: { fontSize: 10, letterSpacing: 0.6, marginTop: 5 },
	percentLeft: { fontSize: 11.5 },
	timeFoot: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 9,
		paddingHorizontal: 16,
		paddingVertical: 12
	},
	timeCard: { alignItems: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 16, paddingVertical: 12 },
	timeLabel: { fontSize: 12 },
	localTime: { fontSize: 11.5, marginLeft: 'auto' },
	// P3: W3's band.
	band: { borderRadius: 18, gap: 12, marginBottom: 10, padding: 16 },
	bandHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
	bandEyebrow: { fontSize: 10, letterSpacing: 0.8 },
	bandTitle: { fontSize: 20, lineHeight: 25, marginTop: 6 },
	bandCount: { fontSize: 26, lineHeight: 26 },
	bandTotal: { fontSize: 15 },
	// The rules.
	ruleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
	ruleBadge: { alignItems: 'center', borderRadius: 9, height: 30, justifyContent: 'center', width: 30 },
	ruleTitle: { fontSize: 12.5 },
	ruleBody: { fontSize: 11, lineHeight: 16.5, marginTop: 2 },
	// P6.
	removedHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
	removedIcon: { alignItems: 'center', borderRadius: 13, height: 40, justifyContent: 'center', width: 40 },
	removedTitle: { fontSize: 19, lineHeight: 23.75 },
	removedBody: { fontSize: 12.5, lineHeight: 19.4, marginTop: 4 },
	// The foot.
	foot: { marginTop: 12 },
	memberNote: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center', marginBottom: 11 },
	memberLabel: { fontSize: 12.5 },
	footNote: { fontSize: 11, marginTop: 9, textAlign: 'center' }
});
