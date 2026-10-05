import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenTitle } from '@/components/ScreenTitle/ScreenTitle.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import type { IconName } from '@/components/ui/Icon/Icon.types';
import { CaptionText, Typography } from '@/components/ui/Typography/Typography.component';
import { cuzPages } from '@/lib/content/quran';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useHizbPlanText } from '@/lib/hooks/useHizbPlanText';
import { useHizbReading } from '@/lib/hooks/useHizbReading';
import { useGetGroupMembers } from '@/lib/hooks/useMembership';
import { useRoundReset } from '@/lib/hooks/useRoundReset';
import { useGetUserSettings, useUpdateUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { pluralKey } from '@/lib/i18n/plural';
import type { StringKey } from '@/lib/i18n/strings';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupDetail } from '@/lib/types/domain';
import { formatBabRange } from '@/lib/utils/babs';
import { INTRO_SETTING } from '@/lib/utils/groupIntro';
import { hizbPortionLabel } from '@/lib/utils/groups';
import { boardPortionsOf } from '@/lib/utils/hizbPlanBoard';
import { timeIn, zoneAbbreviation } from '@/lib/utils/roundReset';
import { turkishNameDativeSuffix, turkishWordLocativeSuffix } from '@/lib/utils/turkishSuffixes';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupHowItWorksSkeleton, GroupHowItWorksSkeletonFoot } from './GroupHowItWorksSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'GroupHowItWorks'>;

const HIZB_PORTIONS = 32;
const CUZ_COUNT = 30;
const VIEWER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
/** Air under the pinned foot, above the home indicator's own inset. */
const FOOT_BOTTOM_GAP = 8;
const PER_DAY: Record<number, StringKey> = { 7: 'hoPerDay7', 15: 'hoPerDay15', 32: 'hoPerDay32' };
const PER_DAY_CAPITALISED: Record<number, StringKey> = { 7: 'hdPerDay7', 15: 'hdPerDay15', 32: 'hdPerDay32' };
const PERIOD: Partial<Record<GroupDetail['cycle'], StringKey>> = {
	DAILY: 'hoPeriodDaily',
	MONTHLY: 'hoPeriodMonthly',
	WEEKLY: 'hoPeriodWeekly'
};

/** The sentence under the title — the group's kind, and for a Cevşen group its seats and cadence. */
const introFor = (detail: GroupDetail, t: (key: StringKey, values?: Record<string, string | number>) => string) => {
	if (detail.kind === 'HIZB') {
		return t(detail.hizbPlan === 0 ? 'hoIntroMixed' : 'hoIntroFixed');
	}

	if (detail.kind === 'HATIM') {
		return t('hoIntroHatim');
	}

	const period = PERIOD[detail.cycle];

	return period
		? t('hoIntroCevsen', { period: t(period), spots: detail.spots })
		: t('hoIntroCevsenOnce', { spots: detail.spots });
};

type Tone = 'accent' | 'sand' | 'neutral';
type Row = { body: string; icon: IconName; tone: Tone; title: string };
/** What one kind puts into the shared layout. */
type Content = {
	intro: string;
	share: {
		eyebrow: string;
		headline: string;
		meta: string;
		metaTone: 'accent' | 'sand';
		/** One entry per segment: mine, taken, free. */
		segments: ('mine' | 'taken' | 'free')[];
		segmentGap: number;
		note: string;
	} | null;
	rows: Row[];
	primary: { label: string; onPress: (() => void) | null };
};

/**
 * How the group works, once, right after joining — "Hizb Kişisel Plan" O1/O2 (Hizb, fixed plan or
 * members choose), O3 (Cevşen) and O4/O5 (Kur'an, before and after it starts). One layout: a
 * "joined" pill, the title and a sentence, the reader's own share on the whole, a card
 * of what to expect, and the way in. No "first time?" question; "don't show again" is the account's
 * own setting for this kind (`INTRO_SETTING`), saved the moment it is ticked — hiding it for one
 * kind leaves the others showing, and no setting elsewhere brings it back.
 */
export const GroupHowItWorksScreen = ({ navigation, route }: Props) => {
	const { groupId, isOverGroup = false } = route.params;
	const { language, t } = useTranslation();
	const { theme } = useThemeContext();
	const { portionsLabel, trSuffix, workTitle } = useHizbPlanText();
	const group = useGetGroupById(groupId);
	const detail = group.data;
	const isHizb = detail?.kind === 'HIZB';
	const isCevsen = detail?.kind === 'CEVSEN';
	const reading = useHizbReading(groupId, isHizb);
	// The seat bar needs which seats are taken — the members' own seats.
	const members = useGetGroupMembers(groupId, isCevsen);
	const reset = useRoundReset({
		cycle: detail?.cycle ?? 'WEEKLY',
		kind: detail?.kind ?? 'CEVSEN',
		roundDays: detail?.roundDays ?? 7,
		roundEndsAt: detail?.roundEndsAt ?? null,
		startedAt: detail?.startedAt ?? null,
		timezone: detail?.timezone ?? 'UTC'
	});
	const settings = useGetUserSettings();
	const updateSettings = useUpdateUserSettings();
	/*
	 * The account's own value, saved the moment the box is ticked (the settings hook is optimistic):
	 * a back swipe can't lose the choice, and a failed save visibly un-ticks the box again.
	 */
	const introSetting = INTRO_SETTING[detail?.kind ?? 'CEVSEN'];
	const isHidden = settings.data?.[introSetting] === false;
	const toggleHidden = () => updateSettings.mutate({ [introSetting]: isHidden });

	if (group.isError || reading.isError || members.isError) {
		return <ErrorState queries={[group, reading, members]} />;
	}

	const hizbState = reading.data?.pages[0];

	if (!detail || (isHizb && !hizbState) || (isCevsen && !members.data)) {
		return (
			<HowItWorksFrame foot={<GroupHowItWorksSkeletonFoot />}>
				<GroupHowItWorksSkeleton intro={detail ? introFor(detail, t) : null} />
			</HowItWorksFrame>
		);
	}

	// O2 sits over the group's own screen (the plan was picked there); otherwise this replaced the join.
	const openGroup = () => (isOverGroup ? navigation.goBack() : navigation.replace('GroupDetail', { groupId }));
	/** Opens a reader with the group underneath it, so the reader's back lands on the group. */
	const openOverGroup = (open: () => void) => {
		if (!isOverGroup) {
			navigation.replace('GroupDetail', { groupId });
		} else {
			navigation.goBack();
		}

		open();
	};
	const isRunning = detail.status === 'RUNNING';
	const leaveRow = (isCuz: boolean): Row => ({
		body: t(isCuz ? 'hoLeaveCuz' : 'hoLeaveSeat'),
		icon: 'leave',
		title: t('hoLeaveTitle'),
		tone: 'neutral'
	});
	const waitingRow = (isCuz: boolean): Row => ({
		body: t(isCuz ? 'hoCuzHeld' : 'hoSeatHeld'),
		icon: 'clock',
		title: t('hoStartsWhen'),
		tone: 'sand'
	});

	const content = ((): Content => {
		if (detail.kind === 'HIZB' && hizbState) {
			// O1 / O2: today's portions on the 32.
			const today = hizbState.today;
			const isMixed = detail.hizbPlan === 0;
			const planDays = today?.planDays ?? detail.hizbPlan ?? HIZB_PORTIONS;
			const mine = new Set(today ? boardPortionsOf(today.planDays, today.portion) : []);
			const instant = new Date(hizbState.nextDayAt);
			const time = timeIn(instant, language, detail.timezone);
			const local = timeIn(instant, language, VIEWER_TIME_ZONE);
			const zone = zoneAbbreviation(instant, language, detail.timezone);
			const isSameClock = time === local && zone === zoneAbbreviation(instant, language, VIEWER_TIME_ZONE);

			return {
				intro: introFor(detail, t),
				share: today
					? {
							eyebrow: t('hoTodayShare'),
							headline: hizbPortionLabel(portionsLabel(today), t),
							meta: workTitle(today),
							metaTone: 'accent',
							note: isMixed
								? t('hoPlanMine', { days: planDays, perDay: t(PER_DAY[planDays] ?? 'hoPerDay32') })
								: t('hoPlanFixed', {
										days: planDays,
										perDay: t(PER_DAY_CAPITALISED[planDays] ?? 'hdPerDay32')
								  }),
							segmentGap: 2,
							segments: Array.from({ length: HIZB_PORTIONS }, (_, index) =>
								mine.has(index + 1) ? 'mine' : 'free'
							)
					  }
					: null,
				primary: {
					label: t('hoReadToday'),
					onPress: today
						? () =>
								openOverGroup(() =>
									navigation.navigate('HizbPlanReader', { assignmentId: today.id, groupId })
								)
						: null
				},
				rows: [
					{
						body: t('hoNewDayBody'),
						icon: 'clock',
						title: isSameClock ? t('hoNewDay', { time }) : t('hoNewDayBoth', { local, time, zone }),
						tone: 'accent'
					},
					...(detail.inactivityDays
						? [
								{
									body: t('hdRuleBody'),
									icon: 'memberLeft' as const,
									title: t('hdRuleTitle', { days: detail.inactivityDays }),
									tone: 'sand' as const
								}
						  ]
						: []),
					...(detail.hideMemberNames
						? [
								{
									body: t('hdNamesHiddenBody'),
									icon: 'eyeOff' as const,
									title: t('hdNamesHidden'),
									tone: 'neutral' as const
								}
						  ]
						: []),
					// Neither rule nor hidden names: the round, so the card still says what comes next.
					...(!detail.inactivityDays && !detail.hideMemberNames
						? [
								{
									body: t('hoRoundBody'),
									icon: 'refresh' as const,
									title: t('hoRoundTitle'),
									tone: 'neutral' as const
								}
						  ]
						: [])
				]
			};
		}

		if (detail.kind === 'HATIM') {
			// O4 / O5: the cüz held, on the 30.
			const held = new Set(detail.myBabNumbers);
			const free = new Set(detail.poolBabNumbers);
			const taken = CUZ_COUNT - free.size;
			const pages = detail.myBabNumbers.reduce((sum, cuz) => sum + cuzPages(cuz).length, 0);
			// Over the days actually left in a running round — a late joiner has fewer — else the round.
			const daysToRead = isRunning && detail.daysLeft !== null ? detail.daysLeft : detail.roundDays;
			const perDay = Math.max(1, Math.ceil(pages / Math.max(1, daysToRead)));
			const first = detail.myBabNumbers[0];
			const endsAt = detail.roundEndsAt ?? detail.endsAt;
			const endDate = endsAt
				? new Date(endsAt).toLocaleDateString(language, {
						day: 'numeric',
						month: 'long',
						timeZone: detail.timezone
				  })
				: null;
			const daysLeft = detail.daysLeft ?? 0;

			return {
				intro: introFor(detail, t),
				share: {
					eyebrow: t('hoYourCuz'),
					headline: t('homeCuzRange', { range: detail.myBabNumbers.join(', ') }),
					meta: t('hoCuzTaken', { free: free.size, taken }),
					metaTone: isRunning ? 'accent' : 'sand',
					note: t('hoCuzPace', { pages, perDay }),
					segmentGap: 2,
					segments: Array.from({ length: CUZ_COUNT }, (_, index) =>
						held.has(index + 1) ? 'mine' : free.has(index + 1) ? 'free' : 'taken'
					)
				},
				primary: {
					label: t(isRunning ? 'hoReadCuz' : 'hoOpensOnStart'),
					onPress:
						isRunning && first !== undefined
							? () => openOverGroup(() => navigation.navigate('CuzReader', { cuzNumber: first, groupId }))
							: null
				},
				rows: [
					isRunning && endDate
						? {
								body: t('hoOpenNow'),
								icon: 'calendar' as const,
								title: t('hoEndsOn', {
									date: endDate,
									left: t(pluralKey(language, daysLeft, 'countDaysOne', 'countDaysOther'), {
										count: daysLeft
									}),
									suffix: trSuffix(turkishWordLocativeSuffix(endDate))
								}),
								tone: 'accent' as const
						  }
						: waitingRow(true),
					leaveRow(true)
				]
			};
		}

		// O3: the Cevşen seat — its babs this round, on the seats.
		const taken = new Set((members.data ?? []).map(member => member.slotIndex));
		const mySeat = detail.mySlotIndex;
		const nextBab = detail.myNextBabNumber ?? detail.myBabNumbers[0];

		return {
			intro: introFor(detail, t),
			share: {
				eyebrow: t('hoYourShare'),
				headline: t('homeBabRange', { range: formatBabRange(detail.myBabNumbers) }),
				meta: t('hoSeatOf', { seat: (mySeat ?? 0) + 1, spots: detail.spots, taken: detail.memberCount }),
				metaTone: 'accent',
				note: t(detail.splitMode === 'ROTATION' ? 'hoShareRotating' : 'hoShareFixed'),
				segmentGap: 3,
				segments: Array.from({ length: detail.spots }, (_, seat) =>
					seat === mySeat ? 'mine' : taken.has(seat) ? 'taken' : 'free'
				)
			},
			primary: {
				label: t(isRunning ? 'hoReadShare' : 'hoOpensOnStart'),
				onPress:
					isRunning && nextBab !== undefined
						? () => openOverGroup(() => navigation.navigate('BabReader', { babNumber: nextBab, groupId }))
						: null
			},
			rows: [
				isRunning && reset
					? {
							body: t('hoUnreadWaits'),
							icon: 'refresh' as const,
							title: reset.group,
							tone: 'accent' as const
					  }
					: waitingRow(false),
				leaveRow(false)
			]
		};
	})();

	const toneColours = (tone: Tone) =>
		tone === 'accent'
			? { background: theme.colors.accentSoft, foreground: theme.colors.accent }
			: tone === 'sand'
			? { background: theme.colors.sand, foreground: theme.colors.sandText }
			: { background: theme.colors.segmentTrack, foreground: theme.colors.subtext };
	const segmentColour = (segment: 'mine' | 'taken' | 'free') =>
		segment === 'mine'
			? theme.colors.accent
			: segment === 'taken'
			? theme.colors.accentMuted
			: theme.colors.segmentTrack;

	return (
		<HowItWorksFrame
			foot={
				<>
					<AppButton
						disabled={content.primary.onPress === null}
						// The way in points onward; locked until the group starts, it says so instead.
						{...(content.primary.onPress
							? { icon: 'chevronRight' as const, iconPosition: 'trailing' as const }
							: { icon: 'lock' as const })}
						onPress={() => content.primary.onPress?.()}
						title={content.primary.label}
						variant='primary'
					/>
					{/* A text link, as the design draws it — `ghost` is a filled pill on Android. */}
					<Pressable accessibilityRole='button' onPress={openGroup} style={styles.textLink}>
						<CaptionText color={theme.colors.accent} style={styles.textLinkLabel} weight='semibold'>
							{t('hoGoToGroup')}
						</CaptionText>
					</Pressable>
					<Pressable
						accessibilityRole='checkbox'
						accessibilityState={{ checked: isHidden }}
						hitSlop={8}
						onPress={toggleHidden}
						style={styles.dontShow}
					>
						<View
							style={[
								styles.checkbox,
								{
									backgroundColor: isHidden ? theme.colors.accent : theme.colors.transparent,
									borderColor: isHidden ? theme.colors.accent : theme.colors.border
								}
							]}
						>
							{isHidden ? (
								<Icon color={theme.colors.onAccent} name='check' size={11} strokeWidth={2.6} />
							) : null}
						</View>
						<CaptionText color={theme.colors.subtext} weight='medium'>
							{t('hoDontShow')}
						</CaptionText>
					</Pressable>
				</>
			}
		>
			<View>
				<View style={styles.topRow}>
					<View style={[styles.pill, { backgroundColor: theme.colors.accentSoft }]}>
						<Icon color={theme.colors.accent} name='check' size={13} strokeWidth={2.2} />
						<CaptionText
							color={theme.colors.accent}
							numberOfLines={1}
							style={styles.pillLabel}
							weight='semibold'
						>
							{t('hoJoined', {
								name: detail.name,
								suffix: trSuffix(turkishNameDativeSuffix(detail.name))
							})}
						</CaptionText>
					</View>
				</View>

				<ScreenTitle
					description={content.intro}
					hasReservedSecondaryLabel={false}
					label={t('hoTitle')}
					labelLines={2}
				/>

				{content.share ? (
					<CardSurface style={[styles.card, styles.shareCard]}>
						<Typography
							color={theme.colors.faintText}
							style={styles.eyebrow}
							variant='stat'
							weight='medium'
						>
							{content.share.eyebrow.toLocaleUpperCase(language)}
						</Typography>
						<View style={styles.shareHead}>
							<Typography numberOfLines={1} style={[styles.flex, styles.shareTitle]} variant='numeric'>
								{content.share.headline}
							</Typography>
							<CaptionText
								color={content.share.metaTone === 'sand' ? theme.colors.sandText : theme.colors.accent}
								style={styles.meta}
								weight='semibold'
							>
								{content.share.meta}
							</CaptionText>
						</View>
						<View style={[styles.segments, { gap: content.share.segmentGap }]}>
							{content.share.segments.map((segment, index) => (
								<View
									key={index}
									style={[styles.segment, { backgroundColor: segmentColour(segment) }]}
								/>
							))}
						</View>
						<CaptionText color={theme.colors.subtext} style={styles.note}>
							{content.share.note}
						</CaptionText>
					</CardSurface>
				) : null}

				<CardSurface isFlush style={styles.card}>
					{content.rows.map((row, index) => {
						const colours = toneColours(row.tone);

						return (
							<View
								key={row.title}
								style={[
									styles.row,
									index > 0
										? {
												borderTopColor: theme.colors.divider,
												borderTopWidth: StyleSheet.hairlineWidth
										  }
										: null
								]}
							>
								<View style={[styles.rowBadge, { backgroundColor: colours.background }]}>
									<Icon color={colours.foreground} name={row.icon} size={15} strokeWidth={1.8} />
								</View>
								<View style={styles.flex}>
									<CaptionText style={styles.rowTitle} weight='semibold'>
										{row.title}
									</CaptionText>
									<CaptionText color={theme.colors.subtext} style={styles.rowBody}>
										{row.body}
									</CaptionText>
								</View>
							</View>
						);
					})}
				</CardSurface>
			</View>
		</HowItWorksFrame>
	);
};

/**
 * The screen's two parts: what it says, scrolling, and the way on, pinned as low as the screen
 * allows, just clear of the home indicator (O1–O5's sticky foot). The
 * skeleton uses the same frame, so nothing moves when the group answers.
 */
export const HowItWorksFrame = ({ children, foot }: { children: ReactNode; foot: ReactNode }) => {
	const insets = useSafeAreaInsets();

	return (
		<ScreenContainer contentContainerStyle={styles.frame} isScrollable={false} shouldIncludeTabBarOffset={false}>
			<ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} style={styles.flex}>
				{children}
			</ScrollView>
			{/* The screen runs to the window's bottom on both platforms (measured: frame = window), so
			    the foot clears the home indicator / gesture bar itself. */}
			<View style={[styles.footBar, { paddingBottom: FOOT_BOTTOM_GAP + insets.bottom }]}>{foot}</View>
		</ScreenContainer>
	);
};

/* O1–O5's measures. */
const styles = StyleSheet.create({
	// The frame: flush to the edges and the bottom, so the foot bar can run full width to the edge.
	frame: { gap: 0, paddingBottom: 0, paddingHorizontal: 0 },
	body: { paddingBottom: 20, paddingHorizontal: 20 },
	footBar: { gap: 4, paddingHorizontal: 20, paddingTop: 12 },
	// O1–O5's "Grup ekranına geç": 600 13 in the accent, 12 of air around it.
	textLink: { alignItems: 'center', paddingVertical: 12 },
	textLinkLabel: { fontSize: 13 },
	flex: { flex: 1, minWidth: 0 },
	topRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
	pill: {
		alignItems: 'center',
		borderRadius: 999,
		flexDirection: 'row',
		flexShrink: 1,
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 6
	},
	pillLabel: { flexShrink: 1, fontSize: 11 },
	card: { marginBottom: 12 },
	shareCard: { gap: 12, padding: 16 },
	eyebrow: { fontSize: 10, letterSpacing: 0.6 },
	shareHead: { alignItems: 'baseline', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
	shareTitle: { fontSize: 26, lineHeight: 26 },
	meta: { fontSize: 11.5 },
	segments: { flexDirection: 'row' },
	segment: { borderRadius: 2, flex: 1, height: 10 },
	note: { lineHeight: 18.6 },
	row: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
	rowBadge: { alignItems: 'center', borderRadius: 9, height: 30, justifyContent: 'center', width: 30 },
	rowTitle: { fontSize: 12.5 },
	rowBody: { fontSize: 11, lineHeight: 16.5, marginTop: 2 },
	dontShow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: 2 },
	checkbox: {
		alignItems: 'center',
		borderRadius: 5,
		borderWidth: 1.5,
		height: 16,
		justifyContent: 'center',
		width: 16
	}
});
