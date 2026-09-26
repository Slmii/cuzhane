import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import {
	BodyText,
	CaptionText,
	EyebrowText,
	Header1,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { worksForParts } from '@/lib/content/hizbPortions';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useRoundReset } from '@/lib/hooks/useRoundReset';
import { useGetUserSettings } from '@/lib/hooks/useUserSettings';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { formatBabRange } from '@/lib/utils/babs';
import type { TabStackParamList } from '@/navigation/types';
import { LeaveGroupButton } from '@/screens/Groups/LeaveGroupButton.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, View } from 'react-native';
import { JoinedWelcomeSkeleton } from './JoinedWelcomeSkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'JoinedWelcome'>;

export const JoinedWelcomeScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const group = useGetGroupById(groupId);
	const userSettings = useGetUserSettings();
	// With the other hooks: the loading branch below returns before the body runs.
	const reset = useRoundReset({
		cycle: group.data?.cycle ?? 'WEEKLY',
		roundEndsAt: group.data?.roundEndsAt ?? null,
		startedAt: group.data?.startedAt ?? null,
		timezone: group.data?.timezone ?? 'UTC'
	});

	if (group.isLoading) {
		return (
			<ScreenContainer isScrollable={false}>
				<JoinedWelcomeSkeleton />
			</ScreenContainer>
		);
	}

	if (group.isError || !group.data) {
		return <ErrorState queries={[group]} />;
	}

	const detail = group.data;
	// `myBabNumbers` is the server's answer for today — already rotated for a ROTATION
	// group, and the seat's reserved block while the group is still gathering.
	const babNumbers = detail.myBabNumbers;
	const rangeValue = formatBabRange(babNumbers);
	// Nothing is counted until the owner opens day 1, so the range is only a reservation.
	const isProvisional = detail.status === 'GATHERING';
	/*
	 * HJ3 — the Hizb's wait, and its welcome into a running group. The same screen with its
	 * own noun, and one line more in both states: which of the book's works the portions sit
	 * in, since "15–16" alone says nothing to someone who hasn't learnt the division by
	 * number. Nothing is recomputed for the wait: while the group gathers the server derives
	 * `myBabNumbers` from the seat alone, which is exactly round 0's share —
	 * `babNumbersForRound(slot, spots, 0, partCount)`.
	 */
	const isHizb = detail.kind === 'HIZB';
	const worksLine = isHizb
		? worksForParts(babNumbers)
				.map(work => t(work.titleKey))
				.join(' · ')
		: '';
	// "biri sana atandı" / "An unclaimed portion" — a Hizb seat can hold a single portion.
	const midSubKey = isHizb ? (babNumbers.length === 1 ? 'midSubHizbOne' : 'midSubHizb') : 'midSub';
	// While settings are still loading we don't know either way, so fall back to the unset
	// (ghost button) state rather than flashing the soft-green row and then swapping it out.
	//
	// The settings object rather than a boolean, so the row's clock is narrowed to a string
	// by the same check that decides to show the row — read separately, a drift between the
	// two would put the word "undefined" where the time goes.
	const activeReminder = userSettings.data?.reminderEnabled === true ? userSettings.data : null;

	const handleStartReading = () => {
		navigation.replace('GroupDetail', { groupId });
	};

	const handleSetReminder = () => {
		/*
		 * **`initial: false`, or the bell tab loses its root.** Navigating into a nested
		 * navigator makes the named screen that navigator's *only* route unless this is passed —
		 * so the tab's stack became `[Reminders]`, its back control did nothing, and because
		 * leaving a tab pops it to its *first* route, the settings screen stayed that tab's root
		 * for the rest of the session with the inbox unreachable. Harmless until today, when
		 * `Reminders` legitimately was the root.
		 */
		navigation.replace('Tabs', {
			screen: 'Notifications',
			params: { screen: 'Reminders', initial: false }
		});
	};

	const handleBackToGroups = () => {
		navigation.replace('Tabs', { screen: 'Groups' });
	};

	if (detail.splitMode === 'FLEXIBLE') {
		return (
			<ScreenContainer>
				<Header1>{t('flexibleJoined')}</Header1>
				<BodyText>{detail.name}</BodyText>
				<BodyText color={theme.colors.subtext}>
					{t(detail.hizbPlan != null ? 'hpDailyHint' : 'planFlexibleHint')}
				</BodyText>
				<CaptionText>{t('flexibleMembers', { count: detail.memberCount })}</CaptionText>
				<AppButton
					title={t(detail.hizbPlan != null ? (detail.hizbPlan ? 'hpRead' : 'hpChoose') : 'flexibleChoose')}
					onPress={handleStartReading}
				/>
			</ScreenContainer>
		);
	}

	const spotsToFill = Math.max(0, detail.spots - detail.memberCount);

	return (
		<ScreenContainer contentContainerStyle={styles.content} isScrollable>
			{/*
			 * **No back control at all**, which is the design's own arrangement: you have just
			 * joined, and the one thing to do next is read. A "Geri" was added at one point
			 * because this screen is also reachable from Gruplarım and a dead end would trap
			 * you — but it isn't a dead end. The tab bar is on screen throughout, the running
			 * state offers "Okumaya başla", and the waiting state still offers "Gruplarıma dön"
			 * below. Two ways back, one of them a bare chevron, only made the page ambiguous.
			 */}
			<View style={styles.hero}>
				{/*
				 * 03d celebrates with a check in sage; 03e waits with a clock in neutral. The
				 * icon is the first thing that says which of the two states you are in.
				 */}
				<View
					style={[
						styles.heroCircle,
						{ backgroundColor: isProvisional ? theme.colors.secondary : theme.colors.accentSoft }
					]}
				>
					{isProvisional ? (
						<Icon color={theme.colors.subtext} name='clock' size={26} strokeWidth={1.6} />
					) : (
						<Icon color={theme.colors.accent} name='check' size={26} strokeWidth={1.6} />
					)}
				</View>

				<Header1 style={styles.title} textAlign='center'>
					{t(isProvisional ? 'lobbyTitle' : isHizb ? 'midTitleHizb' : 'midTitle')}
				</Header1>
				<BodyText color={theme.colors.subtext} style={styles.sub} textAlign='center'>
					{isProvisional
						? t(isHizb ? 'lobbySubHizb' : 'lobbySub')
						: t(midSubKey, { count: babNumbers.length })}
				</BodyText>

				{isProvisional ? (
					<>
						{/* The whole card is hatched — the range is real but nobody's to read
						    yet, the same thing the hatch means on the board. */}
						<CardSurface style={styles.rangeCard}>
							<Hatch radius={theme.radius.lg} />
							<EyebrowText color={theme.colors.subtext} textAlign='center'>
								{t(isHizb ? 'yourPortions' : 'yourRange')}
							</EyebrowText>
							<Typography
								color={theme.colors.faintText}
								style={styles.lockedRange}
								textAlign='center'
								variant='display'
							>
								{rangeValue}
							</Typography>
							{worksLine ? (
								<CaptionText color={theme.colors.subtext} style={styles.works} textAlign='center'>
									{worksLine}
								</CaptionText>
							) : null}
							<View style={styles.lockPillRow}>
								<View style={[styles.lockPill, { backgroundColor: theme.colors.secondary }]}>
									<Icon color={theme.colors.subtext} name='lock' size={12} strokeWidth={1.9} />
									<CaptionText color={theme.colors.subtext} weight='semibold'>
										{t('rangeLocked')}
									</CaptionText>
								</View>
							</View>
						</CardSurface>

						{/* Progress leads, the counts explain it — a separate card, because it
						    is about the group filling up rather than about your range. */}
						<CardSurface style={styles.fillCard}>
							<ProgressBar percent={Math.round((detail.memberCount / detail.spots) * 100)} />
							<View style={styles.fillRow}>
								<CaptionText color={theme.colors.subtext}>
									{t('membersJoined', { count: detail.memberCount, spots: detail.spots })}
								</CaptionText>
								<CaptionText color={theme.colors.accent} weight='semibold'>
									{t(isHizb ? 'morePeople' : 'spotsToFill', { count: spotsToFill })}
								</CaptionText>
							</View>
						</CardSurface>
					</>
				) : (
					<CardSurface style={styles.rangeCard}>
						<EyebrowText color={theme.colors.subtext} textAlign='center'>
							{t(isHizb ? 'yourPortions' : 'yourRange')}
						</EyebrowText>
						{/*
						 * The numbers themselves, not anonymous pills: these came out of the pool,
						 * so which ones you were handed is the point.
						 *
						 * Filled in the board's own `babReadByMe`, the same green the invite preview
						 * gives them and the same one they wear once read. Three screens in a row
						 * show these numbers — preview, here, then the board — and one colour makes
						 * that one fact rather than three that merely look alike.
						 */}
						<View style={styles.numeralRow}>
							{babNumbers.map(number => (
								<View
									key={number}
									style={[
										styles.numeral,
										{ backgroundColor: theme.colors.babReadByMe, borderRadius: theme.radius.sm }
									]}
								>
									{/* `onAccent`, the same pairing the board uses — the fill is dark
									    enough that accent-on-accent would be unreadable. */}
									<CaptionText color={theme.colors.onAccent}>{number}</CaptionText>
								</View>
							))}
						</View>
						{worksLine ? (
							<CaptionText color={theme.colors.subtext} style={styles.works} textAlign='center'>
								{worksLine}
							</CaptionText>
						) : null}
						{/*
						 * Both clocks, as everywhere else the reset is stated. The reset is a
						 * group-wide fact on the creator's zone, so for anyone in another one the
						 * group's time alone is off by hours with nothing explaining why — and this
						 * screen is the first thing a new member sees, which is exactly when that
						 * would be most confusing.
						 *
						 * The label stays: unlike the group screen, there is no eyebrow here saying
						 * what the time refers to.
						 */}
						{reset ? (
							<View style={[styles.roundEndBlock, { borderTopColor: theme.colors.divider }]}>
								<View style={styles.roundEndRow}>
									<Icon color={theme.colors.subtext} name='clock' size={14} strokeWidth={1.7} />
									<CaptionText color={theme.colors.subtext}>
										{`${t('roundEnds')} · ${reset.group}`}
									</CaptionText>
								</View>
								{/* Accent and semibold, the same emphasis the group card gives it:
								    the local time is the one the reader actually acts on. */}
								<CaptionText color={theme.colors.accent} textAlign='center' weight='semibold'>
									{reset.local}
								</CaptionText>
							</View>
						) : null}
					</CardSurface>
				)}
			</View>
			<View style={styles.footer}>
				{isProvisional ? (
					<>
						{/*
						 * **No "Başladığında bana bildir" here.** It led this footer and promised a
						 * notification nothing sends: it only navigated to Hatırlatma, whose
						 * reminder is a fixed daily time that ignores this group entirely —
						 * `reminderTotals` counts RUNNING groups and this one is still GATHERING.
						 * The push path could do it (a send from `startGroupForUser`) and doesn't
						 * yet, so the button went rather than keep claiming otherwise.
						 *
						 * A group that hasn't started is the one a member is most likely to want
						 * out of — nothing has been read, and the seat they're holding is one the
						 * owner may be waiting on. Above "Gruplarıma dön" rather than under it:
						 * its hint would otherwise read as a footnote to that button.
						 */}
						<AppButton onPress={handleBackToGroups} title={t('backToGroups')} variant='primary' />
						<LeaveGroupButton groupId={groupId} />
					</>
				) : (
					<>
						<AppButton onPress={handleStartReading} title={t('startReading')} />
						{/* A reminder that's already on replaces the "set one" ghost button rather
						    than sitting beside it — the design swaps the two, and having both would
						    be two ways to the same place. */}
						{activeReminder ? (
							<Pressable
								onPress={handleSetReminder}
								style={({ pressed }) => [
									styles.reminderRow,
									{ backgroundColor: theme.colors.accentSoft, opacity: pressed ? 0.86 : 1 }
								]}
							>
								<Icon color={theme.colors.accent} name='tabReminders' size={14} strokeWidth={1.8} />
								<CaptionText color={theme.colors.accent} weight='semibold'>
									{`${t('reminderOnAt')} · ${activeReminder.reminderTime}`}
								</CaptionText>
								<CaptionText color={theme.colors.faintText} weight='semibold'>
									{t('reminderChange')}
								</CaptionText>
							</Pressable>
						) : (
							<AppButton onPress={handleSetReminder} title={t('setReminder')} variant='ghost' />
						)}
					</>
				)}
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	fillCard: {
		marginTop: 11,
		padding: 16
	},
	fillRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between',
		marginTop: 10
	},
	heroCircle: {
		alignItems: 'center',
		// The design centres it with `margin: 0 auto`; the hero column isn't centre-aligned
		// because the cards inside it stretch full width.
		alignSelf: 'center',
		borderRadius: 33,
		height: 66,
		justifyContent: 'center',
		marginBottom: 22,
		width: 66
	},
	lockPill: {
		alignItems: 'center',
		borderRadius: 9,
		flexDirection: 'row',
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 6
	},
	lockPillRow: {
		alignItems: 'center',
		marginTop: 13
	},
	lockedRange: {
		marginTop: 10
	},
	numeral: {
		paddingHorizontal: 9,
		paddingVertical: 5
	},
	numeralRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
		justifyContent: 'center',
		marginTop: 12
	},
	// Two lines, never a wrapped one. A WEEKLY group states both clocks by weekday
	// ("Her cumartesi 00:00 GMT+3" / "sende cuma 23:00"), which does not fit across one, and
	// wrapping broke it wherever the width happened to run out — usually leaving "sende"
	// hanging off the end of the first line, attached to the group's clock rather than to
	// yours. The local time is its own fact, so it gets its own line.
	roundEndBlock: {
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: 4,
		marginTop: 16,
		paddingTop: 13
	},
	roundEndRow: {
		alignItems: 'center',
		flexDirection: 'row',
		// Icon and text read as one centred line, not as a label pushed away from its value —
		// the rest of this card is centred too.
		gap: 7,
		justifyContent: 'center'
	},
	content: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	footer: {
		gap: 10,
		marginTop: 22
	},
	hero: {
		paddingTop: 64
	},
	loading: {
		flex: 1
	},
	reminderRow: {
		alignItems: 'center',
		borderRadius: 12,
		flexDirection: 'row',
		gap: 8,
		justifyContent: 'center',
		paddingHorizontal: 14,
		paddingVertical: 11
	},
	rangeCard: {
		marginTop: 28,
		// 22, not the card default of 16 — the design gives this one more room.
		padding: 22
	},
	sub: {
		marginTop: 9
	},
	// The design bumps the shared 27px heading to 29 on this screen.
	title: {
		fontSize: 29,
		lineHeight: 33
	},
	works: {
		marginTop: 8
	}
});
