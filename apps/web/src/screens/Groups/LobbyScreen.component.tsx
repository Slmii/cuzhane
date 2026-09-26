import { CuzMap, CuzMapLegend } from '@/components/CuzMap/CuzMap.component';
import { InviteQr } from '@/components/InviteQr/InviteQr.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { AvatarStack } from '@/components/ui/AvatarStack/AvatarStack.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar.component';
import { SpotsGrid } from '@/components/ui/SpotsGrid/SpotsGrid.component';
import { ToggleRow } from '@/components/ui/ToggleRow/ToggleRow.component';
import {
	BodyText,
	CaptionText,
	EyebrowText,
	NumericText,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { useCachedGroup } from '@/lib/hooks/useCachedGroup';
import { useGetGroupById, useStartGroup, useUpdateGroup } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import { unitCountFor } from '@/lib/utils/units';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { JoinedWelcomeSkeleton } from '@/screens/Join/JoinedWelcomeSkeleton.component';
import { HatimLobbySkeleton } from './HatimLobbySkeleton.component';
import { LobbySkeleton } from './LobbySkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'Lobby'>;

/**
 * A group that hasn't started yet. The owner sees the fill and the button that opens day
 * 1 (design 06a); everyone else sees the range being held for them, marked provisional
 * because nothing is committed until the owner starts (06b).
 */
/** Small enough to read as a summary rather than a member list. */
const JOINED_AVATAR_SIZE = 30;
/** As the frame draws it — five faces, then the count. Past five the stack falls back to "+N". */
const JOINED_AVATAR_MAX = 5;

export const LobbyScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const group = useGetGroupById(groupId);
	// Chooses the skeleton below: the group's kind once known, else what the list it came from said.
	const cached = useCachedGroup(groupId);
	const isHatimLoading = (group.data?.kind ?? cached?.kind) === 'HATIM';
	const startGroup = useStartGroup();
	const pullToRefresh = usePullToRefresh(group);

	// 06a is the creator's lobby and the only one there is. A member waiting for the group
	// to start has a designed screen of their own — the same "you're in, waiting" state they
	// saw on joining — so they are sent there rather than shown a second, near-identical one.
	const isOwner = group.data?.isOwner;

	useEffect(() => {
		if (isOwner === false) {
			navigation.replace('JoinedWelcome', { groupId });
		}
	}, [groupId, isOwner, navigation]);
	const updateGroup = useUpdateGroup();

	const [hasCopied, setHasCopied] = useState(false);

	if (group.isLoading) {
		return (
			<ScreenContainer isScrollable={false}>
				{isHatimLoading ? <HatimLobbySkeleton /> : <LobbySkeleton />}
			</ScreenContainer>
		);
	}

	if (group.isError || !group.data) {
		return <ErrorState queries={[group]} />;
	}

	const detail = group.data;
	const isHatim = detail.kind === 'HATIM';
	// By seat, so the creator leads and the order matches the order people arrived in.
	const memberNames = [...detail.members].sort((a, b) => a.slotIndex - b.slotIndex).map(member => member.displayName);
	const unitCount = unitCountFor(detail.kind);
	const openSpots = detail.spots - detail.memberCount;
	const fillPercent = Math.round((detail.memberCount / detail.spots) * 100);

	const handleCopyInvite = async () => {
		if (!detail.inviteCode) {
			return;
		}

		// The code itself, with the display dash stripped — there is no invite URL to build.
		await Clipboard.setStringAsync(detail.inviteCode.replace(/-/g, ''));
		setHasCopied(true);
	};

	const handleStart = () => {
		// `replace`, not `navigate`: the lobby is gone the moment the hatim starts, and
		// leaving it in the stack would let a back swipe return to a screen that no
		// longer describes the group.
		// Straight to the board: the state change is the message, so there is no interstitial
		// to confirm it. `replace` so the lobby isn't left behind to swipe back into.
		startGroup.mutate(groupId, { onSuccess: () => navigation.replace('GroupDetail', { groupId }) });
	};

	/*
	 * **A hatim fills with cüz, not with people.** Its seat count is pinned at thirty and
	 * divides nothing — one member may hold six — so "1 / 30 katıldı · 29 boş kontenjan" was
	 * answering a question nobody in a hatim asks, over a grid of seats that mean nothing.
	 * What is actually filling up is the map: how many of the thirty are spoken for, and
	 * which. Everything else on this screen (the code, the QR, Başlat) is the same either way.
	 */
	const takenCuzCount = unitCount - detail.poolBabNumbers.length;
	/*
	 * Plain sets, not `useMemo`: this sits *below* the screen's guards, where a hook cannot
	 * go, and thirty numbers cost nothing to re-Set. `CuzMap` is not memoised, so there is no
	 * identity to preserve either — memoising here would buy nothing and move the hook above
	 * the data it reads.
	 */
	const myCuz = new Set(detail.myBabNumbers);
	const freeCuz = new Set(detail.poolBabNumbers);

	const fillCard = (
		<CardSurface>
			<View style={styles.fillRow}>
				<NumericText color={theme.colors.accent}>{isHatim ? takenCuzCount : detail.memberCount}</NumericText>
				<CaptionText color={theme.colors.faintText}>
					{isHatim ? `/ ${unitCount} ${t('qCuzTaken')}` : `/ ${detail.spots} ${t('joinedCount')}`}
				</CaptionText>
				{detail.isOwner ? (
					<CaptionText color={theme.colors.faintText} style={styles.openSpots}>
						{isHatim ? `${detail.poolBabNumbers.length} ${t('qFree')}` : `${openSpots} ${t('openSpots')}`}
					</CaptionText>
				) : null}
			</View>
			<ProgressBar
				percent={isHatim ? Math.round((takenCuzCount / unitCount) * 100) : fillPercent}
				style={styles.fillBar}
			/>
			{isHatim ? (
				<>
					<CuzMap stateOf={number => (myCuz.has(number) ? 'mine' : freeCuz.has(number) ? 'free' : 'taken')} />
					{/*
					 * **The key belongs wherever the map is**, and this was the one place drawing
					 * thirty cells in three fills without one — the picker has it and the group
					 * board has it, so a lobby left the reader to work out that tan meant free.
					 *
					 * "senin" rather than the picker's "seçtin": here the solid cells are what
					 * you already hold, not a selection being made.
					 */}
					<CuzMapLegend mineLabel={t('legendMine')} />
				</>
			) : (
				<SpotsGrid filled={detail.memberCount} total={detail.spots} />
			)}
			{detail.isOwner ? (
				<CaptionText color={theme.colors.subtext} style={styles.poolNote}>
					{t(isHatim ? 'qLobbyPoolNote' : 'poolNote')}
				</CaptionText>
			) : null}
		</CardSurface>
	);

	// The redirect above has already fired; hold rather than flash the creator's lobby. It
	// shows the *waiting* screen's skeleton, since `JoinedWelcome` is where a non-owner is sent —
	// the gathering state of it, which is the same shape for both kinds.
	if (!detail.isOwner) {
		return (
			<ScreenContainer isScrollable={false}>
				<JoinedWelcomeSkeleton />
			</ScreenContainer>
		);
	}

	return (
		<ScreenContainer contentContainerStyle={styles.content} pullToRefresh={pullToRefresh} shouldIncludeTabBarOffset>
			{/*
			 * **One block, so `space-between` has exactly two children to separate.** It is what
			 * pushes the start block to the foot; left to the children directly it spread every
			 * gap in the column, and the first one to open up was between the heading and the
			 * KURUCU row.
			 */}
			<View style={styles.top}>
				<ScreenHeader hasBackButton subtitle={t('notCounting')} title={detail.name} />
				<View style={styles.stateRow}>
					<EyebrowText color={theme.colors.faintText}>{t('creator')}</EyebrowText>
					<Chip label={t('lobbyState')} tone='sand' />
				</View>
				{fillCard}
				<CardSurface isFlush>
					<View style={[styles.inviteBlock, { borderBottomColor: theme.colors.border }]}>
						<EyebrowText color={theme.colors.faintText} style={styles.inviteLabel}>
							{t('inviteLink')}
						</EyebrowText>
						<View style={styles.inviteRow}>
							{/* The code set as type rather than as a monospaced URL fragment — it is
						    something the creator reads out, not a string to be transcribed. */}
							<Typography
								color={theme.colors.accent}
								numberOfLines={1}
								style={styles.inviteValue}
								variant='title'
								weight='regular'
							>
								{detail.inviteCode ?? '—'}
							</Typography>
							<AppButton
								// Buttons default to full width; here it sits beside the code, so
								// it has to shrink to its label or the code has nowhere to go.
								fullWidth={false}
								// `copy` at rest, `check` once it lands — see `ShareSheet`, same button.
								icon={hasCopied ? 'check' : 'copy'}
								onPress={() => void handleCopyInvite()}
								size='sm'
								title={hasCopied ? t('copied') : t('copyInvite')}
								variant='accent'
							/>
						</View>
						{/* The same code for whoever is in the room — see `InviteQr`. */}
						{detail.inviteCode ? (
							<View style={styles.inviteQr}>
								<InviteQr inviteCode={detail.inviteCode} />
							</View>
						) : null}
					</View>
					{/*
					 * **Who is already in, above the switch that decides when it starts.**
					 *
					 * The card said how many seats or cüz were gone and never who had arrived,
					 * which is the thing a creator watching a lobby is actually waiting for —
					 * and the one piece of it a number cannot carry. It sits on the invite
					 * card's own divider rather than in a card of its own: it is the answer to
					 * the code directly above it.
					 *
					 * Both kinds get it. Nothing about "people have joined" is particular to
					 * how the group divides its reading.
					 */}
					<View style={[styles.joinedRow, { borderBottomColor: theme.colors.border }]}>
						{/*
						 * Five, not the stack's default three. The frame draws five overlapping
						 * faces and then the count — at three the row was two faces short and
						 * carried a "+2" chip instead, which breaks the overlap's rhythm and
						 * says the same number twice: once in the chip and again in "5 kişi
						 * katıldı" right beside it.
						 */}
						<AvatarStack max={JOINED_AVATAR_MAX} names={memberNames} size={JOINED_AVATAR_SIZE} />
						<CaptionText color={theme.colors.subtext}>
							{t('joinedPeople', { count: detail.memberCount })}
						</CaptionText>
					</View>
					<ToggleRow
						hint={t(isHatim ? 'qAutoStartHint' : 'autoStartHint')}
						onValueChange={value => updateGroup.mutate({ autoStartWhenFull: value, groupId })}
						title={t(isHatim ? 'qAutoStartFull' : 'autoStartFull')}
						value={detail.autoStartWhenFull}
					/>
				</CardSurface>
			</View>
			{/*
			 * **Pinned to the bottom, like every other screen whose one action closes it.** It sat
			 * directly under the cards, which on a half-full lobby left it stranded mid-screen
			 * with a page of empty paper below — the same block on the welcome screen and the
			 * group screen sits at the foot. `styles.footer` is what does it, against the
			 * `space-between` on the container's content.
			 *
			 * No margins anywhere on this column: `ScreenContainer` already spaces it by 12, the
			 * same as Gruplarım's list, and the cards each added 11 of their own on top — which
			 * put 23 between everything here and nowhere else.
			 */}
			<View style={styles.footer}>
				<AppButton isLoading={startGroup.isPending} onPress={handleStart} title={t('startNow')} />
				<BodyText color={theme.colors.faintText} textAlign='center'>
					{t('startHint')}
				</BodyText>
			</View>
		</ScreenContainer>
	);
};

const styles = StyleSheet.create({
	/** Cards at the top, the start block at the foot — the welcome screen's arrangement. */
	content: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	/** The button and its hint travel together, so `space-between` moves them as one. */
	footer: {
		gap: 12
	},
	/**
	 * Everything above the start block, as one child. `ScreenContainer` spaces a column by 12 and
	 * that is what this restores inside the wrapper — without it the cards sat flush.
	 */
	top: {
		gap: 12
	},
	fillBar: {
		marginBottom: 13,
		marginTop: 10
	},
	fillRow: {
		alignItems: 'baseline',
		flexDirection: 'row',
		gap: 8
	},
	inviteBlock: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		padding: 15
	},
	inviteLabel: {
		marginBottom: 7
	},
	inviteQr: {
		marginTop: 16
	},
	inviteRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10
	},
	inviteValue: {
		// 16/1 Newsreader with the design's .06em tracking, a step up from `title`'s 17/23.
		flex: 1,
		fontSize: 16,
		letterSpacing: 0.96,
		lineHeight: 21
	},
	loading: {
		flex: 1
	},
	openSpots: {
		marginLeft: 'auto'
	},
	/**
	 * The avatar row, between the invite block and the switch.
	 *
	 * **Bottom edge only.** The invite block above already draws its own bottom hairline, so
	 * a top border here stacked two lines in the same place — and left the row running
	 * straight into the switch below it with nothing between them.
	 */
	joinedRow: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 15,
		paddingVertical: 13
	},
	poolNote: {
		marginTop: 12
	},
	reservedCard: {
		marginBottom: 11,
		paddingVertical: 20
	},
	reservedHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 8,
		justifyContent: 'center',
		marginBottom: 9
	},
	reservedNote: {
		marginTop: 9
	},
	stateRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between'
	}
});
