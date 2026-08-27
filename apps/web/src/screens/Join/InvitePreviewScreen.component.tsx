import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { BackLink } from '@/components/ui/BackLink/BackLink.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { SeatStack } from '@/components/ui/SeatStack/SeatStack.component';
import { CaptionText, EyebrowText, Header2, TitleText } from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useGroupPreviewById, useJoinGroup } from '@/lib/hooks/useMembership';
import { useRoundReset } from '@/lib/hooks/useRoundReset';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { cycleLabelKey, splitModeLabelKey } from '@/lib/utils/groups';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'InvitePreview'>;

/** The design lists a dozen; past that the row wraps into a wall of numbers. */
const MAX_POOL_CHIPS = 12;

export const InvitePreviewScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	const preview = useGroupPreviewById(groupId);
	const joinByGroupId = useJoinGroup();
	// Above the early returns with the other hooks — the loading branch below returns first.
	const reset = useRoundReset({
		cycle: preview.data?.cycle ?? 'WEEKLY',
		roundEndsAt: preview.data?.roundEndsAt ?? null,
		timezone: preview.data?.timezone ?? 'UTC'
	});

	if (preview.isLoading) {
		return (
			<ScreenContainer isScrollable={false}>
				<ActivityIndicator color={theme.colors.accent} style={styles.loading} />
			</ScreenContainer>
		);
	}

	if (preview.isError || !preview.data) {
		return (
			<ScreenContainer isScrollable>
				<EmptyState actionLabel={t('retry')} onAction={() => preview.refetch()} title={t('genericError')} />
			</ScreenContainer>
		);
	}

	const data = preview.data;
	// Labelled with the destination rather than "Geri" — this screen is only ever reached
	// from Keşfet, so the back link can name where it goes.
	const handleBackToDiscover = () =>
		navigation.canGoBack() ? navigation.goBack() : navigation.replace('Tabs', { screen: 'Discover' });

	const handleJoinNow = async () => {
		const joined = await joinByGroupId.mutateAsync(data.id);

		// Joining from Keşfet and joining by code produce the same thing, so both land on
		// the same welcome, which decides whether it is showing "your babs are ready" or
		// "waiting to start".
		navigation.replace('JoinedWelcome', { groupId: joined.id });
	};

	const handleDiscover = () => {
		// Reached from Keşfet, this screen sits *on* the Discover stack, so switching to the
		// Discover tab is a no-op and the button did nothing. Popping the tab's own stack is
		// what uncovers the list; the tab switch after it only matters when the preview was
		// opened from another tab (an invite code typed on Gruplarım).
		navigation.popToTop();
		navigation.navigate('Tabs', { screen: 'Discover' });
	};

	if (data.isFull) {
		return (
			<ScreenContainer contentContainerStyle={styles.content} isScrollable>
				<View>
					{/* 03f keeps the same named back link as the other previews. */}
					<BackLink label={t('discover')} onPress={handleBackToDiscover} style={styles.back} />

					<View style={[styles.chipRow, styles.chipRowAfterBack]}>
						<Chip label={`${t('full')} · ${data.memberCount}/${data.spots}`} tone='neutral' />
						<Chip label={t(cycleLabelKey(data.cycle))} tone='accent' />
					</View>

					<Header2 style={styles.previewName}>{data.name}</Header2>
					<CaptionText color={theme.colors.subtext} style={styles.dedication}>
						{`${t(cycleLabelKey(data.cycle))} · ${t(splitModeLabelKey(data.splitMode))}`}
					</CaptionText>

					{/* Why you can't join, stated plainly and centred — this is the whole reason
					    the screen exists, so it leads rather than sitting under the stats. */}
					<CardSurface style={styles.fullCard}>
						<View style={[styles.fullCircle, { backgroundColor: theme.colors.surfaceMuted }]}>
							<Icon color={theme.colors.subtext} name='memberFull' size={22} strokeWidth={1.7} />
						</View>
						<TitleText textAlign='center'>{t('fullTitle')}</TitleText>
						<CaptionText color={theme.colors.subtext} style={styles.fullNote} textAlign='center'>
							{t('fullNote')}
						</CaptionText>
					</CardSurface>

					{/* The round still shows: you can see how it is going, you just can't join it. */}
					<CardSurface style={styles.sectionCard}>
						<View style={styles.sectionHead}>
							<EyebrowText color={theme.colors.faintText}>{t('roundNow')}</EyebrowText>
							<CaptionText color={theme.colors.subtext}>{`${data.readCount} / 100`}</CaptionText>
						</View>
						<ProgressBar percent={data.percent} style={styles.sectionBar} />
						<CaptionText color={theme.colors.subtext}>{t('allClaimed')}</CaptionText>
					</CardSurface>

					{/* No "round ends" row here, unlike 03b — it only matters to someone who is
					    about to start reading. */}
					<CardSurface isFlush style={styles.metaCard}>
						{[
							{ label: t('cadence'), value: t(cycleLabelKey(data.cycle)) },
							{ label: t('groupSize'), value: `${data.memberCount} / ${data.spots}` },
							{ label: t('createdBy'), value: data.createdByName }
						].map((row, index, rows) => (
							<View
								key={row.label}
								style={[
									styles.metaRow,
									index < rows.length - 1
										? {
												borderBottomColor: theme.colors.divider,
												borderBottomWidth: StyleSheet.hairlineWidth
										  }
										: null
								]}
							>
								<CaptionText color={theme.colors.subtext}>{row.label}</CaptionText>
								<CaptionText weight='semibold'>{row.value}</CaptionText>
							</View>
						))}
					</CardSurface>
				</View>
				<View style={styles.footer}>
					{/* One way out, and it is forward: back to the groups you could join. */}
					<AppButton onPress={handleDiscover} title={t('seeSimilar')} />
				</View>
			</ScreenContainer>
		);
	}

	const isRunning = data.status === 'RUNNING';
	const spotsToFill = Math.max(0, data.spots - data.memberCount);
	// A running group is joined for its intention; a gathering one is judged on how it will
	// be read, so 03c names the split mode alongside it.
	const subtitle = isRunning
		? data.dedication
			? t('forName', { dedication: data.dedication })
			: ''
		: [data.dedication, t(splitModeLabelKey(data.splitMode))].filter(Boolean).join(' · ');
	// What a joiner would actually be handed: their seat's share, capped by what's unclaimed.
	const shareSize = data.nextRange ? data.nextRange.end - data.nextRange.start + 1 : 0;

	/**
	 * The meta table. A running group has a round to report and counts the seats that are
	 * taken; a gathering one has neither, so it states the capacity it is waiting to fill
	 * and drops the round row entirely — "when it starts" is the card above.
	 */
	const metaRows: { label: string; value: string }[] = [
		{ label: t('cadence'), value: t(cycleLabelKey(data.cycle)) },
		...(isRunning ? [{ label: t('roundEnds'), value: reset ? reset.group : '—' }] : []),
		{
			label: t('groupSize'),
			value: isRunning ? `${data.memberCount} / ${data.spots}` : `${data.spots}`
		},
		{ label: t('createdBy'), value: data.createdByName }
	];

	// "Zeynep K., Emre T. +12" — two names and a count, since the preview is only handed
	// the first couple.
	const unnamedCount = Math.max(0, data.memberCount - data.memberNames.length);
	const waitingLabel = [data.memberNames.join(', '), unnamedCount > 0 ? t('andMore', { count: unnamedCount }) : '']
		.filter(Boolean)
		.join(' ');

	return (
		<ScreenContainer contentContainerStyle={styles.content} isScrollable>
			<View>
				<BackLink label={t('discover')} onPress={handleBackToDiscover} style={styles.back} />

				{/* Status first, then cadence. The status chip takes the tone that says
				    something — sage for running, sand for waiting — and the cadence chip
				    takes whichever is left, so the two never carry the same weight. */}
				<View style={[styles.chipRow, styles.chipRowAfterBack]}>
					<Chip label={t(isRunning ? 'running' : 'notStarted')} tone={isRunning ? 'accent' : 'sand'} />
					<Chip label={t(cycleLabelKey(data.cycle))} tone={isRunning ? 'sand' : 'accent'} />
				</View>

				<Header2 style={styles.previewName}>{data.name}</Header2>
				{subtitle ? (
					<CaptionText color={theme.colors.subtext} style={styles.dedication}>
						{subtitle}
					</CaptionText>
				) : null}

				{isRunning ? (
					<>
						{/* 03b — what you would be joining mid-round. */}
						<CardSurface style={[styles.sectionCard, styles.firstCard]}>
							<View style={styles.sectionHead}>
								<EyebrowText color={theme.colors.faintText}>{t('roundNow')}</EyebrowText>
								<CaptionText color={theme.colors.subtext}>{`${data.readCount} / 100`}</CaptionText>
							</View>
							<ProgressBar percent={data.percent} style={styles.sectionBar} />
							<CaptionText color={theme.colors.subtext}>
								{t('inProgressNote', { day: data.roundDayIndex ?? 1, read: data.readCount })}
							</CaptionText>
						</CardSurface>

						{data.poolBabNumbers.length > 0 ? (
							<CardSurface style={styles.sectionCard}>
								<View style={styles.sectionHead}>
									<EyebrowText color={theme.colors.faintText}>{t('unclaimedBabs')}</EyebrowText>
									<CaptionText color={theme.colors.accent}>
										{t('unclaimedCount', { count: data.poolBabNumbers.length })}
									</CaptionText>
								</View>
								<View style={styles.babChips}>
									{data.poolBabNumbers.slice(0, MAX_POOL_CHIPS).map(number => (
										<View
											key={number}
											style={[
												styles.babChip,
												{
													backgroundColor: theme.colors.accentSoft,
													borderRadius: theme.radius.sm
												}
											]}
										>
											<CaptionText color={theme.colors.accent}>{number}</CaptionText>
										</View>
									))}
								</View>
								<CaptionText color={theme.colors.subtext} style={styles.sectionNote}>
									{t('joinMidNote', { count: Math.min(data.poolBabNumbers.length, shareSize) })}
								</CaptionText>
							</CardSurface>
						) : null}
					</>
				) : (
					/* 03c — a group that hasn't started, and the two ways it can. */
					<>
						<CardSurface style={[styles.sectionCard, styles.firstCard]}>
							<EyebrowText color={theme.colors.faintText} style={styles.startsEyebrow}>
								{t('startsWhen')}
							</EyebrowText>
							<View style={styles.startRows}>
								<View style={styles.startRow}>
									<View style={[styles.startIcon, { backgroundColor: theme.colors.accentSoft }]}>
										<Icon color={theme.colors.accent} name='play' size={13} strokeWidth={2} />
									</View>
									<CaptionText weight='semibold'>{t('startsManual')}</CaptionText>
								</View>
								<View style={styles.startRow}>
									<View style={[styles.startIcon, { backgroundColor: theme.colors.accentSoft }]}>
										<Icon
											color={theme.colors.accent}
											name='memberCheck'
											size={13}
											strokeWidth={1.9}
										/>
									</View>
									<CaptionText weight='semibold'>{t('startsFull')}</CaptionText>
								</View>
							</View>
							<ProgressBar
								percent={Math.round((data.memberCount / data.spots) * 100)}
								style={styles.fillBar}
							/>
							<View style={styles.sectionHead}>
								<CaptionText color={theme.colors.subtext}>
									{t('membersJoined', { count: data.memberCount, spots: data.spots })}
								</CaptionText>
								<CaptionText color={theme.colors.accent} weight='semibold'>
									{t('spotsToFill', { count: spotsToFill })}
								</CaptionText>
							</View>
						</CardSurface>

						{/* Outside the card: it explains the card above rather than belonging to it. */}
						<CaptionText color={theme.colors.subtext} style={styles.startsNote}>
							{t('startsNote')}
						</CaptionText>
					</>
				)}

				<CardSurface isFlush style={[styles.metaCard, isRunning ? null : styles.metaCardAfterNote]}>
					{metaRows.map((row, index) => (
						<View
							key={row.label}
							style={[
								styles.metaRow,
								index < metaRows.length - 1
									? {
											borderBottomColor: theme.colors.divider,
											borderBottomWidth: StyleSheet.hairlineWidth
									  }
									: null
							]}
						>
							<CaptionText color={theme.colors.subtext}>{row.label}</CaptionText>
							<CaptionText weight='semibold'>{row.value}</CaptionText>
						</View>
					))}
				</CardSurface>

				{/* Who is already here. A running group states it as one line; a gathering one
				    gives it an eyebrow, because "who is waiting with me" is the question that
				    screen is actually about. */}
				{isRunning ? (
					<View style={styles.membersRow}>
						<SeatStack />
						<CaptionText color={theme.colors.subtext}>
							{t('whoIsInCount', { count: data.memberCount })}
						</CaptionText>
					</View>
				) : (
					<View style={styles.waitingBlock}>
						<EyebrowText color={theme.colors.faintText} style={styles.waitingEyebrow}>
							{t('waitingMembers')}
						</EyebrowText>
						<View style={styles.membersRow}>
							<SeatStack />
							<CaptionText color={theme.colors.subtext}>{waitingLabel}</CaptionText>
						</View>
					</View>
				)}
			</View>
			<View style={styles.footer}>
				{/* The label states the outcome: a running group hands you babs now, a
				    gathering one hands you a wait. */}
				<AppButton
					isLoading={joinByGroupId.isPending}
					onPress={handleJoinNow}
					title={t(isRunning ? 'joinAndRead' : 'joinAndWait')}
				/>
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	fullCard: {
		alignItems: 'center',
		marginTop: 20,
		padding: 18
	},
	fullCircle: {
		alignItems: 'center',
		borderRadius: 26,
		height: 52,
		justifyContent: 'center',
		marginBottom: 14,
		width: 52
	},
	fullNote: {
		marginTop: 8
	},
	babChip: {
		paddingHorizontal: 9,
		paddingVertical: 5
	},
	babChips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
		marginTop: 12
	},
	chipRow: {
		flexDirection: 'row',
		gap: 6,
		marginBottom: 10
	},
	// The same air `ScreenHeader` leaves under its back row, so this heading sits where a
	// pushed screen's does instead of crowding the back link.
	chipRowAfterBack: {
		marginTop: 10
	},
	fillBar: {
		marginBottom: 9,
		marginTop: 15
	},
	// The first card sits under the title block, which the design gives more air than the
	// gap between two stacked cards.
	firstCard: {
		marginTop: 20
	},
	membersRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9,
		marginTop: 16
	},
	metaCard: {
		marginTop: 11
	},
	// A little more, because a line of prose sits above it rather than a card edge.
	metaCardAfterNote: {
		marginTop: 16
	},
	startIcon: {
		alignItems: 'center',
		borderRadius: 9,
		height: 26,
		justifyContent: 'center',
		width: 26
	},
	startRows: {
		gap: 11
	},
	startsEyebrow: {
		marginBottom: 11
	},
	startsNote: {
		marginTop: 13
	},
	waitingBlock: {
		marginTop: 18
	},
	waitingEyebrow: {
		marginBottom: 9
	},
	metaRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	sectionBar: {
		marginBottom: 9,
		marginTop: 12
	},
	sectionCard: {
		marginTop: 11,
		padding: 17
	},
	sectionHead: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 10,
		justifyContent: 'space-between'
	},
	sectionNote: {
		marginTop: 13
	},
	startRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	content: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	dedication: {
		marginTop: 7
	},
	// The previews set the name a notch above the shared 23px heading — 26, the size the
	// design gives this h1 on 03b/03c/03f.
	previewName: {
		fontSize: 26,
		lineHeight: 31
	},
	back: {
		paddingBottom: 2,
		paddingTop: 8
	},
	footer: {
		gap: 10,
		marginTop: 22
	},
	loading: {
		flex: 1
	}
});
