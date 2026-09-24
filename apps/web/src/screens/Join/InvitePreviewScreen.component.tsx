import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { CuzMap, CuzMapLegend } from '@/components/CuzMap/CuzMap.component';
import type { CuzCellState } from '@/components/CuzMap/CuzMap.types';
import { InvitePreviewSkeleton } from './InvitePreviewSkeleton.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { SeatStack } from '@/components/ui/SeatStack/SeatStack.component';
import {
	CaptionText,
	EyebrowText,
	Header2,
	NumericText,
	TitleText
} from '@/components/ui/Typography/Typography.component';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useGroupPreviewById, useJoinGroup } from '@/lib/hooks/useMembership';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useRoundReset } from '@/lib/hooks/useRoundReset';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { cycleLabelKey, splitModeLabelKey } from '@/lib/utils/groups';
import { CUZ_COUNT } from '@/lib/utils/units';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = NativeStackScreenProps<TabStackParamList, 'InvitePreview'>;

/**
 * Chips per row. Eight is the most that fits three digits at this size, and a share is
 * never so long that the rows outgrow the card — 100 babs over the smallest group is 20.
 */
const BAB_COLUMNS = 8;

const chunk = (numbers: number[], size: number): number[][] => {
	const rows: number[][] = [];

	for (let index = 0; index < numbers.length; index += size) {
		rows.push(numbers.slice(index, index + size));
	}

	return rows;
};

export const InvitePreviewScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();

	const preview = useGroupPreviewById(groupId);
	const joinByGroupId = useJoinGroup();
	const pullToRefresh = usePullToRefresh(preview);
	/** Set on press — see `shownRows` below, which explains why the card has to stop updating. */
	const [joinedShare, setJoinedShare] = useState<{ poolCount: number; rows: number[][] } | null>(null);
	// Above the early returns with the other hooks — the loading branch below returns first.
	const reset = useRoundReset({
		cycle: preview.data?.cycle ?? 'WEEKLY',
		roundDays: preview.data?.roundDays ?? 7,
		roundEndsAt: preview.data?.roundEndsAt ?? null,
		timezone: preview.data?.timezone ?? 'UTC'
	});

	if (preview.isLoading) {
		return (
			<ScreenContainer>
				<InvitePreviewSkeleton />
			</ScreenContainer>
		);
	}

	if (preview.isError || !preview.data) {
		return <ErrorState queries={[preview]} />;
	}

	const data = preview.data;
	/*
	 * **A hatim preview counts cüz, not seats** — QJ1 and QJ2.
	 *
	 * Its `spots` is thirty as a ceiling on `slotIndex` and divides nothing, so every number
	 * this screen reads off the seat count answers a question a hatim does not ask: "2 / 30
	 * kontenjan" on a group whose thirty cüz are gone, and a "sana atanır" block that nobody
	 * is assigned. What a joiner weighs instead is the map — which of the thirty are still
	 * free — and the two rules deciding what becomes of the ones they take.
	 */
	const isHatim = data.kind === 'HATIM';
	const freeCuz = new Set(data.poolBabNumbers);
	const readCuz = new Set(data.readBabNumbers);
	const takenCuzCount = CUZ_COUNT - freeCuz.size;
	// Read wins over held: a finished cüz is still somebody's, and "okundu" is the more
	// useful of the two facts. A free cüz cannot be read, so those two never compete.
	const cuzStateOf = (number: number): CuzCellState =>
		readCuz.has(number) ? 'read' : freeCuz.has(number) ? 'free' : 'taken';
	// "3 cüz", or the absence of a cap said out loud — a blank row would read as unknown.
	const maxPerMemberLabel = data.maxPerMember === null ? t('qNoMax') : `${data.maxPerMember} ${t('cuz')}`;

	/**
	 * QJ1's and QJ2's shared card: how many cüz are going spare, and which ones.
	 *
	 * `isFirst` because it leads on QJ1 and follows the "all taken" card on QJ2, and the
	 * design gives the first card under a title more air than one card gives the next.
	 */
	const cuzMapCard = (isFirst: boolean) => (
		<CardSurface style={[styles.sectionCard, isFirst ? styles.firstCard : null]}>
			<View style={styles.sectionHead}>
				<View style={styles.cuzCount}>
					<NumericText color={theme.colors.accent}>{freeCuz.size}</NumericText>
					<CaptionText color={theme.colors.faintText}>{t('qFreeCuz')}</CaptionText>
				</View>
				{data.daysLeft === null ? null : (
					<CaptionText color={theme.colors.subtext}>{`${data.daysLeft} ${t('qDaysLeft')}`}</CaptionText>
				)}
			</View>
			{/* The compact map: QJ1 and QJ2 report with ten across, not the picker's six. */}
			<CuzMap stateOf={cuzStateOf} style={styles.cuzMap} variant='compact' />
			{/* Only the states this map draws: a full hatim has no free cell to key, and
			    nothing here is yours until you have joined. */}
			<CuzMapLegend states={data.isFull ? ['read', 'taken'] : ['read', 'taken', 'free']} />
		</CardSurface>
	);

	// A push, not a replace: the preview is what someone backs out to if they change their
	// mind about which cüz — nothing has been taken yet.
	const handlePickCuz = () => navigation.push('PickCuz', { groupId: data.id });

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
			<ScreenContainer contentContainerStyle={styles.content} isScrollable pullToRefresh={pullToRefresh}>
				<View>
					{/* Clears the navigator's back button, which this screen draws no link of
					    its own beside. Same band every pushed screen's heading starts below. */}
					<View style={[styles.chipRow, styles.chipRowUnderBar]}>
						{isHatim ? <Chip label={t('qHatim')} tone='sand' /> : null}
						{/* What is full, by the measure that kind of group uses: seats for a
						    Cevşen group, cüz for a hatim — whose seats are still nearly all
						    free while there is nothing left to read. */}
						<Chip
							label={`${t('full')} · ${
								isHatim ? `${takenCuzCount}/${CUZ_COUNT}` : `${data.memberCount}/${data.spots}`
							}`}
							tone='neutral'
						/>
						<Chip label={t(cycleLabelKey(data.cycle))} tone='accent' />
					</View>

					<Header2 style={styles.previewName}>{data.name}</Header2>
					<CaptionText color={theme.colors.subtext} style={styles.dedication}>
						{/* A hatim has no split mode to name — everybody picks — so it says who is
						    in it instead, which is what QJ2 puts here. */}
						{isHatim
							? `${t(cycleLabelKey(data.cycle))} · ${data.memberCount} ${t('members')}`
							: `${t(cycleLabelKey(data.cycle))} · ${t(splitModeLabelKey(data.splitMode))}`}
					</CaptionText>

					{/* Why you can't join, stated plainly and centred — this is the whole reason
					    the screen exists, so it leads rather than sitting under the stats. */}
					<CardSurface style={styles.fullCard}>
						{/* `segmentTrack`, not `surfaceMuted`: in dark mode that token is `#232520`,
						    the exact colour of the `CardSurface` this sits on, so the disc vanished
						    and left the glyph floating. This is the one that steps off a card in
						    both themes — the same reason Home's shelf pill uses it. */}
						<View style={[styles.fullCircle, { backgroundColor: theme.colors.segmentTrack }]}>
							<Icon
								color={theme.colors.subtext}
								name={isHatim ? 'book' : 'memberFull'}
								size={22}
								strokeWidth={1.7}
							/>
						</View>
						{/*
						 * A hatim is not full of *people* — QJ2's whole point is that its seats
						 * are free and there is still nothing to read, so "Kontenjan tamamlandı"
						 * would be both wrong and the opposite of the reason they can't join.
						 */}
						<TitleText textAlign='center'>{t(isHatim ? 'qFullTitle' : 'fullTitle')}</TitleText>
						<CaptionText color={theme.colors.subtext} style={styles.fullNote} textAlign='center'>
							{t(isHatim ? 'qFullNote' : 'fullNote')}
						</CaptionText>
					</CardSurface>

					{/* The round still shows: you can see how it is going, you just can't join it. */}
					{isHatim ? (
						cuzMapCard(false)
					) : (
						<CardSurface style={styles.sectionCard}>
							<View style={styles.sectionHead}>
								<EyebrowText color={theme.colors.faintText}>{t('roundNow')}</EyebrowText>
								<CaptionText color={theme.colors.subtext}>{`${data.readCount} / 100`}</CaptionText>
							</View>
							<ProgressBar percent={data.percent} style={styles.sectionBar} />
							<CaptionText color={theme.colors.subtext}>{t('allClaimed')}</CaptionText>
						</CardSurface>
					)}

					{/* No "round ends" row here, unlike 03b — it only matters to someone who is
					    about to start reading. */}
					<CardSurface isFlush style={styles.metaCard}>
						{[
							{ label: t('cadence'), value: t(cycleLabelKey(data.cycle)) },
							// A hatim's seat count says nothing, so it states the cap instead —
							// the rule that decides how many of the thirty one reader may hold.
							isHatim
								? { label: t('qMaxPer'), value: maxPerMemberLabel }
								: { label: t('groupSize'), value: `${data.memberCount} / ${data.spots}` },
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
		: // A hatim has no split mode: everybody picks, which is the one thing "Serbest seçim"
		  // would be saying, and QC2 has already said it.
		  [data.dedication, isHatim ? '' : t(splitModeLabelKey(data.splitMode))].filter(Boolean).join(' · ');
	// What a joiner would actually be handed: their seat's share, capped by what's unclaimed.
	const shareSize = data.nextRange ? data.nextRange.end - data.nextRange.start + 1 : 0;
	// The seat's own block, spelled out. This is what a joiner is actually handed, and it
	// exists whenever a seat is free — unlike `poolBabNumbers`, which carries only the part
	// nobody has volunteered for and comes back empty in a group whose free seats have all
	// been covered, taking the card with it.
	const nextBabNumbers = data.nextRange
		? Array.from({ length: shareSize }, (_, index) => (data.nextRange?.start ?? 0) + index)
		: [];
	// Explicit rows of `flex: 1`, the same way `CellGrid` lays the board out. Wrapping
	// content-sized chips left whatever the last one didn't fill as a ragged margin down the
	// right of the card, and the gap read as a missing chip rather than as spare room.
	const babRows = chunk(nextBabNumbers, BAB_COLUMNS);

	/**
	 * What this card showed at the moment you pressed join, held until the screen goes away.
	 *
	 * **Joining changes the answer to the question this card is asking.** `nextRange` is the
	 * next *free* seat's block, and the join takes that seat — so once `useJoinGroup` settles it
	 * invalidates every group query, the preview refetches, and the card repaints with the
	 * following seat's babs. That happens before `navigation.replace` lands, so the numbers
	 * someone just agreed to visibly turn into somebody else's for a frame or two.
	 *
	 * Freezing is the honest fix rather than suppressing the refetch: the new data is correct,
	 * it is simply the answer to a question this screen has stopped asking.
	 */
	const shownRows = joinedShare?.rows ?? babRows;
	const shownPoolCount = joinedShare?.poolCount ?? data.poolBabNumbers.length;

	const handleJoinNow = async () => {
		setJoinedShare({ poolCount: data.poolBabNumbers.length, rows: babRows });

		const joined = await joinByGroupId.mutateAsync({ groupId: data.id });

		// Joining from Keşfet and joining by code produce the same thing, so both land on
		// the same welcome, which decides whether it is showing "your babs are ready" or
		// "waiting to start".
		navigation.replace('JoinedWelcome', { groupId: joined.id });
	};

	/**
	 * The meta table. A running group has a round to report and counts the seats that are
	 * taken; a gathering one has neither, so it states the capacity it is waiting to fill
	 * and drops the round row entirely — "when it starts" is the card above.
	 */
	const metaRows: { label: string; value: string; secondary?: string }[] = [
		{ label: t('cadence'), value: t(cycleLabelKey(data.cycle)) },
		/*
		 * Both clocks, as everywhere else the reset is stated. Someone deciding whether to join
		 * is exactly who needs the local one — the group's zone is the creator's and they may
		 * not share it.
		 *
		 * On its own line rather than appended: a weekly group states both by weekday
		 * ("Her cumartesi 00:00 GMT+3", "sende cuma 23:00"), which is far too long to sit
		 * beside a label in a table row.
		 */
		...(isRunning
			? [
					{
						label: t('roundEnds'),
						value: reset ? reset.group : '—',
						...(reset ? { secondary: reset.local } : {})
					}
			  ]
			: []),
		{
			label: t('groupSize'),
			value: isRunning ? `${data.memberCount} / ${data.spots}` : `${data.spots}`
		},
		{ label: t('createdBy'), value: data.createdByName }
	];

	/**
	 * QJ1's rules card — the two things a hatim decides that nothing else on the screen says,
	 * plus the reset a joiner is joining into.
	 *
	 * The cap and the boundary are on the preview rather than discovered after joining
	 * because they are exactly what is being weighed: a cap of one is a different group from
	 * no cap, and "cüzler korunur" is a commitment past this round.
	 */
	const hatimRuleRows: { label: string; value: string; secondary?: string }[] = [
		{ label: t('qMaxPer'), value: maxPerMemberLabel },
		// A one-off has no boundary to survive — it ends rather than rolling — so the policy
		// is not a rule of it, exactly as QC3 hides the choice for that cadence.
		...(data.cycle === 'CUSTOM'
			? []
			: [{ label: t('qAtEnd'), value: t(data.boundaryPolicy === 'REPICK' ? 'qRepick' : 'qKeepCuz') }]),
		...(isRunning
			? [
					{
						label: t('qRoundEnds'),
						value: reset ? reset.group : '—',
						...(reset ? { secondary: reset.local } : {})
					}
			  ]
			: []),
		{ label: t('createdBy'), value: data.createdByName }
	];

	/**
	 * 03c's "how this starts" card. Extracted because a gathering hatim fills with **cüz**,
	 * not with people: its thirty seats are a ceiling on `slotIndex` and one member may hold
	 * six, so a seat bar over a hatim reads as nearly empty at the moment it is nearly full.
	 */
	const startsWhenCard = (
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
						<Icon color={theme.colors.accent} name='memberCheck' size={13} strokeWidth={1.9} />
					</View>
					<CaptionText weight='semibold'>{t(isHatim ? 'qAutoStartFull' : 'startsFull')}</CaptionText>
				</View>
			</View>
			<ProgressBar
				percent={Math.round(
					((isHatim ? takenCuzCount : data.memberCount) / (isHatim ? CUZ_COUNT : data.spots)) * 100
				)}
				style={styles.fillBar}
			/>
			<View style={styles.sectionHead}>
				<CaptionText color={theme.colors.subtext}>
					{isHatim
						? `${takenCuzCount} / ${CUZ_COUNT} ${t('qCuzTaken')}`
						: t('membersJoined', { count: data.memberCount, spots: data.spots })}
				</CaptionText>
				<CaptionText color={theme.colors.accent} weight='semibold'>
					{isHatim ? `${freeCuz.size} ${t('qFree')}` : t('spotsToFill', { count: spotsToFill })}
				</CaptionText>
			</View>
		</CardSurface>
	);

	return (
		<ScreenContainer contentContainerStyle={styles.content} isScrollable pullToRefresh={pullToRefresh}>
			<View>
				{/* Status first, then cadence. The status chip takes the tone that says
				    something — sage for running, sand for waiting — and the cadence chip
				    takes whichever is left, so the two never carry the same weight. */}
				<View style={[styles.chipRow, styles.chipRowUnderBar]}>
					{/* What is read leads, as it does on a group card — before a hatim's status
					    or its cadence means anything, you have to know it is a hatim. */}
					{isHatim ? <Chip label={t('qHatim')} tone='neutral' /> : null}
					<Chip label={t(isRunning ? 'running' : 'notStarted')} tone={isRunning ? 'accent' : 'sand'} />
					<Chip label={t(cycleLabelKey(data.cycle))} tone={isRunning ? 'sand' : 'accent'} />
				</View>

				<Header2 style={styles.previewName}>{data.name}</Header2>
				{subtitle ? (
					<CaptionText color={theme.colors.subtext} style={styles.dedication}>
						{subtitle}
					</CaptionText>
				) : null}

				{isHatim ? (
					/*
					 * QJ1 — a hatim states two things and no progress bar: what is left on the
					 * map, and the rules you are agreeing to. The bar was the wrong instrument
					 * anyway ("N / 100" over thirty cüz); the map is the count.
					 */
					<>
						{isRunning ? null : startsWhenCard}
						{cuzMapCard(isRunning)}

						<CardSurface isFlush style={styles.metaCard}>
							{hatimRuleRows.map((row, index) => (
								<View
									key={row.label}
									style={[
										styles.metaRow,
										index < hatimRuleRows.length - 1
											? {
													borderBottomColor: theme.colors.divider,
													borderBottomWidth: StyleSheet.hairlineWidth
											  }
											: null
									]}
								>
									<CaptionText color={theme.colors.subtext}>{row.label}</CaptionText>
									<View style={styles.metaValue}>
										<CaptionText textAlign='right' weight='semibold'>
											{row.value}
										</CaptionText>
										{row.secondary ? (
											<CaptionText
												color={theme.colors.accent}
												textAlign='right'
												weight='semibold'
											>
												{row.secondary}
											</CaptionText>
										) : null}
									</View>
								</View>
							))}
						</CardSurface>

						{/* Outside the card: it is the condition on the button, not a rule of
						    the group — and the button is what it sits above. */}
						<CaptionText color={theme.colors.subtext} style={styles.startsNote}>
							{t('qJoinNote')}
						</CaptionText>
					</>
				) : isRunning ? (
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

						{/*
						 * One card, one subject: the babs *you* would be handed. It used to list
						 * the pool instead, and the three numbers on it each answered a different
						 * question — "33 sahipsiz" (the whole unclaimed pool), twelve chips (a
						 * display cap) and "16'i sana atanır" (your seat's block). Worse, the
						 * chips were the pool's lowest numbers, so the card showed babs 1-12
						 * while promising 69-84. Your seat's block is the only one of the three
						 * a joiner can act on, so it is the only one shown.
						 */}
						{/* The frozen rows, not the live ones — joining can take the last seat, which
						    leaves `nextRange` null and would pull the whole card out from under the
						    press rather than merely changing its numbers. */}
						{shownRows.length > 0 ? (
							<CardSurface style={styles.sectionCard}>
								<View style={styles.sectionHead}>
									<EyebrowText color={theme.colors.faintText}>{t('yourRange')}</EyebrowText>
									{/* Not a second count of the chips below — every bab sitting in
									    an empty seat, which is the group's state rather than your
									    share, and includes the block you are about to take. The
									    same number its Havuz screen shows. */}
									<CaptionText color={theme.colors.accent}>
										{t('unclaimedCount', { count: shownPoolCount })}
									</CaptionText>
								</View>
								{/*
								 * Every one of them, however many rows that takes. These are the babs
								 * you are agreeing to read, so a "+4" would be withholding part of
								 * the thing the card exists to show.
								 *
								 * Filled in the board's `babReadByMe`, the same green they will wear
								 * once they are yours — so this card, the Katıldın screen and the
								 * board are all showing one fact rather than three similar-looking
								 * ones. `onAccent` for the numeral: the fill is too dark to read
								 * accent against.
								 */}
								<View style={styles.babChips}>
									{shownRows.map(row => (
										<View key={row[0]} style={styles.babRow}>
											{row.map(number => (
												<View
													key={number}
													style={[
														styles.babChip,
														{
															backgroundColor: theme.colors.babReadByMe,
															borderRadius: theme.radius.sm
														}
													]}
												>
													<CaptionText color={theme.colors.onAccent}>{number}</CaptionText>
												</View>
											))}
											{/* A short last row keeps the chip width of the full ones rather
											    than stretching to fill — five babs spread across the card
											    would read as a different kind of thing to the rows above. */}
											{Array.from({ length: BAB_COLUMNS - row.length }, (_, index) => (
												<View key={`gap-${index}`} style={styles.babChipSpacer} />
											))}
										</View>
									))}
								</View>
								<CaptionText color={theme.colors.subtext} style={styles.sectionNote}>
									{t('joinRangeNote', { count: shareSize })}
								</CaptionText>
							</CardSurface>
						) : null}
					</>
				) : (
					/* 03c — a group that hasn't started, and the two ways it can. */
					<>
						{startsWhenCard}

						{/* Outside the card: it explains the card above rather than belonging to it. */}
						<CaptionText color={theme.colors.subtext} style={styles.startsNote}>
							{t('startsNote')}
						</CaptionText>
					</>
				)}

				{/* A hatim has stated all of this in its rules card already, and the row this
				    one leads with — "Kontenjan 2 / 30" — is the number that means least to it. */}
				{isHatim ? null : (
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
								{/* A right-aligned column, so a second line stacks under the first
							    instead of running back towards the label. */}
								<View style={styles.metaValue}>
									<CaptionText textAlign='right' weight='semibold'>
										{row.value}
									</CaptionText>
									{row.secondary ? (
										<CaptionText color={theme.colors.accent} textAlign='right' weight='semibold'>
											{row.secondary}
										</CaptionText>
									) : null}
								</View>
							</View>
						))}
					</CardSurface>
				)}

				{/*
				 * How many are already here — a count, never who. A running group states it as
				 * one line. A gathering one used to name its first two members under "Bekleyen
				 * üyeler"; that was removed on request, because whoever reads this has not joined
				 * and a group's members are its own business. The server no longer sends names.
				 */}
				{isRunning ? (
					<View style={styles.membersRow}>
						<SeatStack />
						<CaptionText color={theme.colors.subtext}>
							{t('whoIsInCount', { count: data.memberCount })}
						</CaptionText>
					</View>
				) : null}
			</View>
			<View style={styles.footer}>
				{/* The label states the outcome: a running group hands you babs now, a
				    gathering one hands you a wait. */}
				{/* The chevron trails the words, pointing out of the button: this commits and moves
				    you on, rather than qualifying the label the way a leading glyph would. */}
				{/*
				 * **A hatim is not joined from here** — QJ3 is. You cannot be in one and hold
				 * no cüz, so the button opens the picker rather than posting a join the server
				 * would refuse: this screen used to call the Cevşen join path for both kinds,
				 * and against a hatim that came back as an unhandled error on the tap.
				 */}
				<AppButton
					icon='chevronRight'
					iconPosition='trailing'
					isLoading={joinByGroupId.isPending}
					onPress={isHatim ? handlePickCuz : handleJoinNow}
					title={t(isHatim ? 'qJoinPick' : isRunning ? 'joinAndRead' : 'joinAndWait')}
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
		alignItems: 'center',
		flex: 1,
		paddingVertical: 5
	},
	babChipSpacer: {
		flex: 1
	},
	babChips: {
		gap: 6,
		marginTop: 12
	},
	babRow: {
		flexDirection: 'row',
		gap: 6
	},
	chipRow: {
		flexDirection: 'row',
		gap: 6,
		marginBottom: 10
	},
	// The count and its unit on one baseline, the way the lobby heads its own map.
	cuzCount: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 6
	},
	// The same air the pool board leaves between its grid and the numbers above it.
	cuzMap: {
		marginTop: 14
	},
	// The same air `ScreenHeader` leaves under its back row, so this heading sits where a
	// pushed screen's does instead of crowding the back link.
	/*
	 * The heading starts below the navigator's bar, like every other pushed screen. This screen
	 * heads with a chip row rather than a `ScreenTitle`, so it reserves the band itself instead
	 * of getting it from `isUnderNavigationBar`.
	 */
	chipRowUnderBar: {
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
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
	metaRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		justifyContent: 'space-between',
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	// Shrinks rather than pushing the label off: a weekly group's reset line is long.
	metaValue: {
		alignItems: 'flex-end',
		flexShrink: 1,
		gap: 2
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
	footer: {
		gap: 10,
		marginTop: 22
	},
	loading: {
		flex: 1
	}
});
