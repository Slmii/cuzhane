import { GroupCard } from '@/components/GroupCard/GroupCard.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { toAlphaColor } from '@/lib/theme/tokens';
import { ResetTimeLabel } from '@/components/ResetTimeLabel/ResetTimeLabel.component';
import { SeatStack } from '@/components/ui/SeatStack/SeatStack.component';
import { compactCount, hizbAgeLabel } from '@/lib/utils/hizbDiscover';
import { timeIn } from '@/lib/utils/roundReset';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { HizbDiscoverCardProps } from './HizbDiscoverCard.types';

/** The longest plan, named when a group's own is missing. */
const PORTIONS = 32;

/**
 * Keşfet's card for a Hizb group on personal plans — "Hizb Kişisel Plan", section 5, cards
 * 01–08, one to one. The shell is the other kinds' (white card, kind chip, the name in the serif);
 * what sets it apart is the progress: how many of its readers read today, and "bugün", because it
 * starts over every night — a count any group can reach, whatever its size or mix of plans. When
 * everyone has read, the same slot turns green.
 *
 * No seats, "x boş yer", "Başlamadı", "Dolu", names or avatars: a plan group starts on creation and
 * has no member limit. The inactivity rule and hidden names show as a short label each, because
 * both change what joining commits you to.
 */
const HizbDiscoverCardComponent = ({ group, onPress }: HizbDiscoverCardProps) => {
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	// Today's readers — a count only, so it shows to anyone, hidden names or not.
	const read = group.hizbReaders?.read ?? 0;
	const total = group.hizbReaders?.total ?? 0;
	const percent = total > 0 ? Math.round((read * 100) / total) : 0;
	const isDone = total > 0 && read === total;
	const isMixed = group.hizbPlan === 0;
	const age = hizbAgeLabel(group.hizbDay ?? 1, t);
	const hasRules = Boolean(group.inactivityDays) || group.hideMemberNames;
	const members = t(pluralKey(language, group.memberCount, 'hdMembersOne', 'hdMembersOther'), {
		count: compactCount(group.memberCount, language)
	});

	return (
		// The other kinds' shell — the mark before the name, the kind and plan stacked on the right,
		// and their footer: members bottom-left where they have seats, the next day bottom-right.
		<GroupCard
			badgeLabel={isMixed ? t('hpMixedPlan') : t('hpDays', { days: group.hizbPlan ?? PORTIONS })}
			badgeTone='accent'
			footerCaption={`${members} · ${age.label}`}
			footerLeading={<SeatStack />}
			{...(group.nextDayAt
				? {
						footerTrailing: (
							<ResetTimeLabel
								label={t('yourTimeAt', { time: timeIn(new Date(group.nextDayAt), language) })}
							/>
						)
				  }
				: {})}
			kind='HIZB'
			name={group.name}
			onPress={onPress}
			{...(group.dedication ? { subtitle: group.dedication } : {})}
		>
			{isDone ? (
				// 03: everyone read today — the green band, the group still open to join.
				<View style={[styles.band, { backgroundColor: theme.colors.accent }]}>
					<View style={styles.bandHead}>
						<View style={styles.bandTitle}>
							<Icon color={theme.colors.onAccent} name='check' size={14} strokeWidth={2.4} />
							<CaptionText color={theme.colors.onAccent} style={styles.bandLabel} weight='semibold'>
								{t('hpAllReadToday')}
							</CaptionText>
						</View>
						<Typography color={theme.colors.onAccent} style={styles.bandCount} variant='numeric'>
							{read}
							<Typography
								color={toAlphaColor(theme.colors.onAccent, 0.62)}
								style={styles.bandTotal}
								variant='numeric'
							>
								{` / ${total}`}
							</Typography>
						</Typography>
					</View>
				</View>
			) : (
				<>
					<View style={styles.countRow}>
						<View style={styles.countLead}>
							<Typography style={styles.count} variant='numeric'>
								{read}
								<Typography color={theme.colors.faintText} style={styles.countTotal} variant='numeric'>
									{` / ${total}`}
								</Typography>
							</Typography>
							<Typography
								color={theme.colors.faintText}
								style={styles.today}
								variant='stat'
								weight='medium'
							>
								{t('hpReadersReadToday')}
							</Typography>
						</View>
						<CaptionText color={theme.colors.faintText} style={styles.percent} weight='semibold'>
							{read === 0 ? t('hdNotYetRead') : t('hpPercent', { percent })}
						</CaptionText>
					</View>
					<ProgressBar fillColor={theme.colors.accent} height={6} percent={percent} style={styles.bar} />
				</>
			)}

			{/* 07: only when there is a rule or hidden names; the full sentences are the preview's. */}
			{hasRules ? (
				<View style={styles.rules}>
					{group.inactivityDays ? (
						<View style={styles.rule}>
							<Icon color={theme.colors.sandText} name='memberLeft' size={13} strokeWidth={1.8} />
							<CaptionText color={theme.colors.sandText} style={styles.ruleLabel} weight='semibold'>
								{t('hdRuleDays', { days: group.inactivityDays })}
							</CaptionText>
						</View>
					) : null}
					{group.hideMemberNames ? (
						<View style={styles.rule}>
							<Icon color={theme.colors.sandText} name='eyeOff' size={13} strokeWidth={1.8} />
							<CaptionText color={theme.colors.sandText} style={styles.ruleLabel} weight='semibold'>
								{t('hdNamesHidden')}
							</CaptionText>
						</View>
					) : null}
				</View>
			) : null}
		</GroupCard>
	);
};

export const HizbDiscoverCard = memo(HizbDiscoverCardComponent);

HizbDiscoverCard.displayName = 'HizbDiscoverCard';

/* Section 5's card body, measure for measure; the header is `GroupCard`'s, 14 above this. */
const styles = StyleSheet.create({
	countRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	},
	countLead: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
	count: { fontSize: 20, lineHeight: 20 },
	countTotal: { fontSize: 14 },
	today: { fontSize: 10, letterSpacing: 0.6 },
	percent: { fontSize: 11 },
	bar: { marginTop: 8 },
	band: { borderRadius: 12, paddingBottom: 11, paddingHorizontal: 12, paddingTop: 10 },
	bandHead: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
	bandTitle: { alignItems: 'center', flexDirection: 'row', gap: 7 },
	bandLabel: { fontSize: 11.5 },
	bandCount: { fontSize: 17, lineHeight: 17 },
	bandTotal: { fontSize: 12 },
	rules: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
	rule: { alignItems: 'center', flexDirection: 'row', gap: 5 },
	ruleLabel: { fontSize: 10.5 }
});
