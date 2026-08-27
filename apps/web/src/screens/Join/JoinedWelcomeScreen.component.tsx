import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { BackLink } from '@/components/ui/BackLink/BackLink.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Hatch } from '@/components/ui/Hatch/Hatch.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { LeaveGroupButton } from '@/screens/Groups/LeaveGroupButton.component';
import {
	BodyText,
	CaptionText,
	EyebrowText,
	Header1,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { useRoundReset } from '@/lib/hooks/useRoundReset';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { formatBabRange } from '@/lib/utils/babs';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'JoinedWelcome'>;

export const JoinedWelcomeScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const group = useGetGroupById(groupId);
	// With the other hooks: the loading branch below returns before the body runs.
	const reset = useRoundReset({
		cycle: group.data?.cycle ?? 'WEEKLY',
		roundEndsAt: group.data?.roundEndsAt ?? null,
		timezone: group.data?.timezone ?? 'UTC'
	});

	if (group.isLoading) {
		return (
			<ScreenContainer isScrollable={false}>
				<ActivityIndicator color={theme.colors.accent} style={styles.loading} />
			</ScreenContainer>
		);
	}

	if (group.isError || !group.data) {
		return (
			<ScreenContainer isScrollable>
				<EmptyState actionLabel={t('retry')} onAction={() => group.refetch()} title={t('genericError')} />
			</ScreenContainer>
		);
	}

	const detail = group.data;
	// `myBabNumbers` is the server's answer for today — already rotated for a ROTATION
	// group, and the seat's reserved block while the group is still gathering.
	const babNumbers = detail.myBabNumbers;
	const rangeValue = formatBabRange(babNumbers);
	// Nothing is counted until the owner opens day 1, so the range is only a reservation.
	const isProvisional = detail.status === 'GATHERING';

	const handleStartReading = () => {
		navigation.replace('GroupDetail', { groupId });
	};

	const handleSetReminder = () => {
		navigation.replace('Tabs', { screen: 'Reminders' });
	};

	const handleBackToGroups = () => {
		navigation.replace('Tabs', { screen: 'Groups' });
	};

	const spotsToFill = Math.max(0, detail.spots - detail.memberCount);

	return (
		<ScreenContainer contentContainerStyle={styles.content} isScrollable>
			{/* Not in the design, which lands here only straight after joining. Added because
			    the screen is also reachable from Gruplarım, where a dead end would trap you. */}
			<BackLink onPress={handleBackToGroups} style={styles.back} />
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
					{t(isProvisional ? 'lobbyTitle' : 'midTitle')}
				</Header1>
				<BodyText color={theme.colors.subtext} style={styles.sub} textAlign='center'>
					{isProvisional ? t('lobbySub') : t('midSub', { count: babNumbers.length })}
				</BodyText>

				{isProvisional ? (
					<>
						{/* The whole card is hatched — the range is real but nobody's to read
						    yet, the same thing the hatch means on the board. */}
						<CardSurface style={styles.rangeCard}>
							<Hatch radius={theme.radius.lg} />
							<EyebrowText color={theme.colors.subtext} textAlign='center'>
								{t('yourRange')}
							</EyebrowText>
							<Typography
								color={theme.colors.faintText}
								style={styles.lockedRange}
								textAlign='center'
								variant='display'
							>
								{rangeValue}
							</Typography>
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
									{t('spotsToFill', { count: spotsToFill })}
								</CaptionText>
							</View>
						</CardSurface>
					</>
				) : (
					<CardSurface style={styles.rangeCard}>
						<EyebrowText color={theme.colors.subtext} textAlign='center'>
							{t('yourRange')}
						</EyebrowText>
						{/* Numerals, not anonymous pills: these came out of the pool, so which
						    ones you were handed is the point. */}
						<View style={styles.numeralRow}>
							{babNumbers.map(number => (
								<View
									key={number}
									style={[
										styles.numeral,
										{ backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.md }
									]}
								>
									<Typography color={theme.colors.accent} variant='title'>
										{number}
									</Typography>
								</View>
							))}
						</View>
						<CaptionText color={theme.colors.subtext} style={styles.babsCaption} textAlign='center'>
							{`${t('unclaimedBabs')} · ${babNumbers.length} ${t('babs')}`}
						</CaptionText>
						{reset ? (
							<View style={[styles.roundEndRow, { borderTopColor: theme.colors.divider }]}>
								<Icon color={theme.colors.subtext} name='clock' size={14} strokeWidth={1.7} />
								<CaptionText color={theme.colors.subtext}>
									{`${t('roundEnds')} · ${reset.group}`}
								</CaptionText>
							</View>
						) : null}
					</CardSurface>
				)}
			</View>
			<View style={styles.footer}>
				{isProvisional ? (
					<>
						<AppButton onPress={handleSetReminder} title={t('notifyStart')} />
						{/*
						 * A group that hasn't started is the one a member is most likely to want
						 * out of — nothing has been read, and the seat they're holding is one the
						 * owner may be waiting on. Between the two navigations rather than under
						 * them: its hint would otherwise read as a footnote to "Gruplarıma dön".
						 */}
						<LeaveGroupButton groupId={groupId} />
						<AppButton onPress={handleBackToGroups} title={t('backToGroups')} variant='ghost' />
					</>
				) : (
					<>
						<AppButton onPress={handleStartReading} title={t('startReading')} />
						<AppButton onPress={handleSetReminder} title={t('setReminder')} variant='ghost' />
					</>
				)}
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	back: {
		alignSelf: 'flex-start'
	},
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
	roundEndRow: {
		alignItems: 'center',
		borderTopWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		// Icon and text read as one centred line, not as a label pushed away from its value —
		// the rest of this card is centred too.
		gap: 7,
		justifyContent: 'center',
		marginTop: 16,
		paddingTop: 13
	},
	babsCaption: {
		marginTop: 9
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
	}
});
