import { DetailsCard } from '@/components/DetailsCard/DetailsCard.component';
import { InviteQr } from '@/components/InviteQr/InviteQr.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { SCREEN_TITLE_PADDING_UNDER_BAR } from '@/components/ScreenTitle/ScreenTitle.component';
import { AvatarStack } from '@/components/ui/AvatarStack/AvatarStack.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { KindMark } from '@/components/ui/KindMark/KindMark.component';
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
import { groupQueryKeys } from '@/lib/hooks/queryKeys';
import { useGetGroupById, useStartGroup, useUpdateGroup } from '@/lib/hooks/useGroup';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupSummary } from '@/lib/types/domain';
import { cycleLabelKey, hizbSeatColumns, movesEachRound, planLabelKey } from '@/lib/utils/groups';
import type { TabStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GroupDetailSkeleton } from './GroupDetailSkeleton.component';
import { LobbySkeleton } from './LobbySkeleton.component';

type Props = NativeStackScreenProps<TabStackParamList, 'Lobby'>;

/** HC4 draws the book's mark at 40 beside the name. */
const KIND_MARK_SIZE = 40;
/** The faces the Hizb lobby's members row shows before its count takes over. */
const MEMBER_FACES = 3;

/**
 * A group that hasn't started yet. The owner sees the fill and the button that opens day
 * 1 (design 06a); everyone else sees the range being held for them, marked provisional
 * because nothing is committed until the owner starts (06b).
 */
export const LobbyScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { t } = useTranslation();
	const group = useGetGroupById(groupId);
	const startGroup = useStartGroup();
	const pullToRefresh = usePullToRefresh(group);
	/*
	 * Which lobby the skeleton stands in for, off the shelf the lobby is opened from — Gruplarım,
	 * Ara, and create-group, whose mutation refetches the shelf before it navigates. Read off the
	 * cache rather than subscribed to, as `GroupDetailToolbar` seeds its glyph: it is only a
	 * seed, and a lobby missing from the shelf simply gets the Cevşen's.
	 */
	const seededKind = useQueryClient()
		.getQueryData<GroupSummary[]>(groupQueryKeys.groups())
		?.find(entry => entry.id === groupId)?.kind;

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
				<LobbySkeleton kind={seededKind ?? 'CEVSEN'} />
			</ScreenContainer>
		);
	}

	if (group.isError || !group.data) {
		return <ErrorState queries={[group]} />;
	}

	const detail = group.data;
	// HC4 — the Hizb's lobby. Everything the two share is drawn once; the branches below are
	// the parts HC4 changes: the heading, the seat caption, the details card, the members row
	// and the start copy, which counts rounds where the Cevşen's still says "Gün 1".
	const isHizb = detail.kind === 'HIZB';
	const openSpots = detail.spots - detail.memberCount;
	/*
	 * A full Hizb lobby has no auto-start to offer: `autoStartIfFull` runs only inside a join,
	 * and with no seat left there is no join to come — the owner's button is the only way in.
	 * That includes every one-seat group, whose owner fills it on creation and can never leave.
	 */
	const hasAutoStartToggle = !isHizb || openSpots > 0;
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

	const fillCard = (
		<CardSurface>
			<View style={styles.fillRow}>
				<NumericText color={theme.colors.accent}>{detail.memberCount}</NumericText>
				<CaptionText color={theme.colors.faintText}>{`/ ${detail.spots} ${t('joinedCount')}`}</CaptionText>
				{detail.isOwner ? (
					<CaptionText color={theme.colors.faintText} style={styles.openSpots}>
						{`${openSpots} ${t('openSpots')}`}
					</CaptionText>
				) : null}
			</View>
			<ProgressBar percent={fillPercent} style={styles.fillBar} />
			<SpotsGrid
				filled={detail.memberCount}
				total={detail.spots}
				{...(isHizb ? { columns: hizbSeatColumns(detail.spots) } : {})}
			/>
			{detail.isOwner ? (
				<CaptionText color={theme.colors.subtext} style={styles.poolNote}>
					{/* The Hizb says how its portions will move rather than where the empty seats'
					    ones go — and a plan that never moves (FIXED, or a lone seat) says so. */}
					{isHizb
						? t(
								movesEachRound(detail.splitMode, detail.spots)
									? 'hizbSeatsNoteRotation'
									: 'hizbSeatsNoteFixed'
						  )
						: t('poolNote')}
				</CaptionText>
			) : null}
		</CardSurface>
	);

	// The redirect above has already fired; hold rather than flash the creator's lobby. It
	// shows the *group* screen's skeleton, since that is where a non-owner is being sent.
	if (!detail.isOwner) {
		return (
			<ScreenContainer>
				<GroupDetailSkeleton />
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
				{isHizb ? (
					/*
					 * HC4 turns the heading over: the KURUCU row and its chip lead, the name comes
					 * under them with the book's mark at its right. The row takes the band under
					 * the navigator's back button itself — as the invite preview's chip row does —
					 * so the heading under it is an ordinary one, and one block keeps the column's
					 * gap from opening between the two.
					 */
					<View>
						<View style={[styles.stateRow, styles.stateRowUnderBar]}>
							<EyebrowText color={theme.colors.faintText}>{t('creator')}</EyebrowText>
							<Chip label={t('lobbyState')} tone='sand' />
						</View>
						<ScreenHeader
							action={<KindMark kind='HIZB' size={KIND_MARK_SIZE} />}
							subtitle={t('notCounting')}
							title={detail.name}
						/>
					</View>
				) : (
					<>
						<ScreenHeader hasBackButton subtitle={t('notCounting')} title={detail.name} />
						<View style={styles.stateRow}>
							<EyebrowText color={theme.colors.faintText}>{t('creator')}</EyebrowText>
							<Chip label={t('lobbyState')} tone='sand' />
						</View>
					</>
				)}
				{fillCard}
				{isHizb ? (
					<DetailsCard
						rows={[
							{ label: t('cycle'), value: t(cycleLabelKey(detail.cycle)) },
							{ label: t('readingPlan'), value: t(planLabelKey(detail.splitMode)) }
						]}
					/>
				) : null}
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
					{isHizb ? (
						// Who is already in, in seat order — faces for the first few, then the count.
						<View
							style={[
								styles.membersRow,
								// Last in the card when the toggle is gone, so no rule under it.
								hasAutoStartToggle
									? {
											borderBottomColor: theme.colors.border,
											borderBottomWidth: StyleSheet.hairlineWidth
									  }
									: null
							]}
						>
							<AvatarStack
								people={[...detail.members]
									.sort((a, b) => a.slotIndex - b.slotIndex)
									.slice(0, MEMBER_FACES)
									.map(member => ({ imageUrl: member.imageUrl, name: member.displayName }))}
								size={28}
							/>
							<CaptionText color={theme.colors.subtext}>
								{t('peopleJoined', { count: detail.memberCount })}
							</CaptionText>
						</View>
					) : null}
					{hasAutoStartToggle ? (
						<ToggleRow
							hint={t(isHizb ? 'autoStartHintHizb' : 'autoStartHint')}
							onValueChange={value => updateGroup.mutate({ autoStartWhenFull: value, groupId })}
							title={isHizb ? t('autoStartFullHizb', { spots: detail.spots }) : t('autoStartFull')}
							value={detail.autoStartWhenFull}
						/>
					) : null}
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
				<AppButton
					isLoading={startGroup.isPending}
					onPress={handleStart}
					title={t(isHizb ? 'startNowHizb' : 'startNow')}
				/>
				<BodyText color={theme.colors.faintText} textAlign='center'>
					{t(isHizb ? 'startHintHizb' : 'startHint')}
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
	membersRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 15,
		paddingVertical: 12
	},
	openSpots: {
		marginLeft: 'auto'
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
		justifyContent: 'space-between',
		marginBottom: 10
	},
	/*
	 * The Hizb's state row heads the screen, so it clears the navigator's bar — and gives up
	 * most of its margin, since the heading under it opens with 8 of its own and HC4 leaves 10.
	 *
	 * **By hand, because `ScreenTitle` has nowhere to put this row.** Its eyebrow sits inside
	 * the text column, left of `action`, at a pinned 14pt; HC4's chip is 22pt and stands at the
	 * far right, over the mark — a full-width row above the title *and* its action. Owning that
	 * would be a second layout in the component every screen heads with, for one screen, so
	 * the row reserves the band itself, as the invite preview's chip row does.
	 */
	stateRowUnderBar: {
		marginBottom: 2,
		paddingTop: SCREEN_TITLE_PADDING_UNDER_BAR
	}
});
