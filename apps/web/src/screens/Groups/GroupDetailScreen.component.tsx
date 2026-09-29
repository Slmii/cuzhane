import { HizbPlanGroup } from './HizbPlanGroup.component';
import { BabGrid } from '@/components/BabGrid/BabGrid.component';
import { FlexibleReadingPanel } from '@/components/FlexibleReadingPanel/FlexibleReadingPanel.component';
import { BabLegend } from '@/components/BabLegend/BabLegend.component';
import { BabRow } from '@/components/BabRow/BabRow.component';
import { GridSkeleton } from '@/components/GridSkeleton/GridSkeleton.component';
import { HizbBoard } from '@/components/HizbBoard/HizbBoard.component';
import { HizbBoardSkeleton } from '@/components/HizbBoard/HizbBoardSkeleton.component';
import { HizbSharePanel } from '@/components/HizbSharePanel/HizbSharePanel.component';
import { MyProgressCard } from '@/components/MyProgressCard/MyProgressCard.component';
import { MyProgressCardSkeleton } from '@/components/MyProgressCard/MyProgressCardSkeleton.component';
import { RoundResetRow } from '@/components/RoundResetRow/RoundResetRow.component';
import { ScreenContainer } from '@/components/ScreenContainer/ScreenContainer.component';
import { ScreenHeader } from '@/components/ScreenHeader/ScreenHeader.component';
import { isRepeatingCycle } from '@/lib/types/domain';
import { SliceChip } from '@/components/SliceChip/SliceChip.component';
import { TourTarget } from '@/components/Tour/TourTarget.component';
import { AppButton } from '@/components/ui/Button/Button.component';
import { CardSurface } from '@/components/ui/CardSurface/CardSurface.component';
import { Chip } from '@/components/ui/Chip/Chip.component';
import { ErrorState } from '@/components/ui/ErrorState/ErrorState.component';
import { Icon } from '@/components/ui/Icon/Icon.component';
import { KindMark } from '@/components/ui/KindMark/KindMark.component';
import {
	BodyText,
	CaptionText,
	NumericText,
	StatText,
	TitleText,
	Typography
} from '@/components/ui/Typography/Typography.component';
import { useGetBabs, useSetBabRead } from '@/lib/hooks/useBab';
import { useCachedGroup } from '@/lib/hooks/useCachedGroup';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetGroupById, useGetPoolSlots, useMarkPoolReleasesSeen } from '@/lib/hooks/useGroup';
import { useHatimRoundGate } from '@/lib/hooks/useHatimRoundGate';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useRoundReset, useTimeUntilReset } from '@/lib/hooks/useRoundReset';
import { useGetMyProgress, useGetRounds } from '@/lib/hooks/useRounds';
import { useTranslation } from '@/lib/i18n/I18n.context';
import { useThemeContext } from '@/lib/theme/ThemeProvider.context';
import type { GroupBab } from '@/lib/types/domain';
import { formatBabRange, formatRun } from '@/lib/utils/babs';
import { cuzSuraRange } from '@/lib/content/cuz';
import { roundTimeLeftLabel } from '@/lib/utils/roundReset';
import { unitCountFor, unitLabelKey } from '@/lib/utils/units';
import {
	cycleLabelKey,
	hizbBoardCells,
	type HizbBoardCell,
	kindLabelKey,
	planLabelKey,
	shareSlices,
	toBabCells
} from '@/lib/utils/groups';
import { MUSHAF_DUA_PATHS } from '@/lib/content/mushaf';
import type { TabStackParamList } from '@/navigation/types';
import { LeaveGroupButton } from '@/screens/Groups/LeaveGroupButton.component';
import { ManageSheet } from '@/screens/Groups/ManageSheet.component';
import { MembersSheet } from '@/screens/Groups/MembersSheet.component';
import { ShareSheet } from '@/screens/Groups/ShareSheet.component';
import { JoinedWelcomeSkeleton } from '@/screens/Join/JoinedWelcomeSkeleton.component';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { GroupDetailSkeleton } from './GroupDetailSkeleton.component';
import { HatimGroupSkeleton } from './HatimGroupSkeleton.component';
import { HatimLobbySkeleton } from './HatimLobbySkeleton.component';
import { HizbPlanGroupSkeleton } from './HizbPlanGroupSkeleton.component';
import { LobbySkeleton } from './LobbySkeleton.component';

type Sheet = 'share' | 'manage' | 'members' | null;

const CHEVRON_DOWN_DEGREES = 90;
const CHEVRON_UP_DEGREES = -90;
/** One duration for the panel and the chevron, so the two read as a single movement. */
const PANEL_DURATION_MS = 260;
/**
 * How tall the open bab list may grow — roughly five rows. Past that it scrolls in place
 * rather than pushing the rest of the screen down; see `openHeight`.
 */
const MY_BABS_MAX_HEIGHT = 310;

/**
 * Stood up once, because they are memo dependencies: `?? []` written inline is a new array
 * on every render, which would invalidate the cells it guards every time and defeat the
 * point of memoising them.
 */
const NO_BABS: GroupBab[] = [];
const NO_NUMBERS: number[] = [];
const NO_HIZB_CELLS: HizbBoardCell[] = [];
/** Entries in `BabLegend` — the skeleton stubs the same number so the card keeps its height. */
/** Five keys for a Cevşen board, four for a hatim — see `BabLegend` for why. */
const BAB_LEGEND_COUNT = 5;
const CUZ_LEGEND_COUNT = 4;
/** HZ1 puts the book's mark at the heading's right, a touch larger than the lobby's 40. */
const KIND_MARK_SIZE = 44;

type Props = NativeStackScreenProps<TabStackParamList, 'GroupDetail'>;

/**
 * A Hizb group read on personal plans is a screen of its own (`HizbPlanGroup`); every other
 * group — Cevşen, hatim, or a Hizb group divided by seat — is the one below, which draws each
 * kind's own sections.
 */
export const GroupDetailScreen = (props: Props) => {
	const query = useGetGroupById(props.route.params.groupId);
	// Until the group answers, the list it was opened from may already know its kind.
	const cached = useCachedGroup(props.route.params.groupId);
	const cachedKind = cached?.kind;
	if (query.isError) {
		return <ErrorState queries={[query]} />;
	}
	if (!query.data) {
		return (
			<ScreenContainer>
				{/* A personal-plan group loads under its own screen's bones, which it keeps until its reading answers. */}
				{cached?.plan ? (
					<HizbPlanGroupSkeleton plan={cached.plan} />
				) : cachedKind === 'HATIM' ? (
					<HatimGroupSkeleton />
				) : (
					<GroupDetailSkeleton kind={cachedKind ?? 'CEVSEN'} />
				)}
			</ScreenContainer>
		);
	}
	return query.data.hizbPlan != null ? (
		<HizbPlanGroup {...props} group={query.data} />
	) : (
		<LegacyGroupDetailScreen {...props} />
	);
};
const LegacyGroupDetailScreen = ({ navigation, route }: Props) => {
	const { groupId } = route.params;
	const { theme } = useThemeContext();
	const { language, t } = useTranslation();
	const userId = useCurrentUserId();
	const [sheet, setSheet] = useState<Sheet>(null);
	/*
	 * **The screen's two whole-group actions live in the navigator's bar**, opposite the back
	 * button, rather than on the title's baseline. That is what puts them in the same glass row
	 * as the control iOS already draws there, and it costs the heading no width — a group's name
	 * had been truncating to make room for them. `GroupDetailToolbar` is what draws them, and
	 * `AppNavigator` registers it so the bar is filled on the first frame.
	 *
	 * It sits outside the screen, so it asks for a sheet through the route rather than calling
	 * `setSheet`. Read as a second way of being open rather than copied into state by an effect —
	 * the arriving param is already a render's worth of information. Same shape as Gruplarım's
	 * `shouldOpenJoinSheet`.
	 */
	const requestedSheet = route.params.sheet ?? null;
	const openSheet = sheet ?? requestedSheet;

	const closeSheet = () => {
		setSheet(null);

		// Cleared on dismissal, or the param would reopen the sheet on the next render.
		if (requestedSheet) {
			navigation.setParams({ sheet: undefined });
		}
	};
	// Declared up here with the other hooks: the loading and error branches below return
	// early, and a hook that only runs on the happy path would change order between renders.
	const [isMyBabsOpen, setIsMyBabsOpen] = useState(false);
	// The base `chevron` glyph points right, so down is +90° and up is -90°. Closed points
	// down at the content it will reveal; open points up at the content it will hide. One
	// glyph rotated through half a turn, rather than swapping in a second icon.
	const isReducedMotion = useReducedMotion();
	/*
	 * Both halves of the disclosure are driven *from* `isMyBabsOpen` inside their worklets,
	 * the way `CellGrid` eases its colours, rather than by writing to a shared value from the
	 * press handler — one source of truth, and no imperative mutation for the compiler to
	 * object to.
	 */
	const chevronStyle = useAnimatedStyle(() => {
		const angle = `${isMyBabsOpen ? CHEVRON_UP_DEGREES : CHEVRON_DOWN_DEGREES}deg`;

		return {
			transform: [{ rotate: isReducedMotion ? angle : withTiming(angle, { duration: PANEL_DURATION_MS }) }]
		};
	});
	/*
	 * The panel animates its real height — not a fade, and not a layout transition.
	 *
	 * The rows stay mounted and measured, and opening runs the clipped wrapper from nothing to
	 * that measurement. It has to be the actual height because this card sits mid-column in a
	 * scroll view: `LinearTransition` commits the new layout at once and interpolates only the
	 * card, so everything below would jump to its final place while the card was still growing
	 * into it.
	 */
	const [myBabsHeight, setMyBabsHeight] = useState(0);
	/*
	 * Capped, and the rows scroll inside the cap.
	 *
	 * A share is five babs in a small group and twenty-six once pool blocks are on top of it,
	 * and at full height that panel ran well past a screen — opening it pushed the pool card,
	 * the board and everything else so far down that the page turned into a list of one
	 * member's babs. Five rows is enough to show it *is* a list and to start reading down it;
	 * the rest is a scroll away rather than a page away.
	 */
	const openHeight = Math.min(myBabsHeight, MY_BABS_MAX_HEIGHT);
	const myBabsBodyStyle = useAnimatedStyle(() => {
		const height = isMyBabsOpen ? openHeight : 0;
		const opacity = isMyBabsOpen ? 1 : 0;

		return isReducedMotion
			? { height, opacity }
			: {
					height: withTiming(height, { duration: PANEL_DURATION_MS }),
					opacity: withTiming(opacity, { duration: PANEL_DURATION_MS })
			  };
	});

	const toggleMyBabs = () => {
		setIsMyBabsOpen(current => !current);
	};

	const groupQuery = useGetGroupById(groupId);
	/*
	 * Which skeleton to hold while the group loads: its own kind once known, else whatever the
	 * list it was opened from said. Up here with the hooks — the loading branch below is one of
	 * the early returns.
	 */
	const cached = useCachedGroup(groupId);
	const loadingKind = groupQuery.data?.kind ?? cached?.kind;

	const babsQuery = useGetBabs(groupId);
	const isFlexible = groupQuery.data?.splitMode === 'FLEXIBLE';
	const flexiblePoolQuery = useGetPoolSlots(groupId, { isEnabled: isFlexible });
	// Both read from the query data rather than the narrowed `detail` below, so they sit with
	// the other hooks above the early returns and keep hook order stable.
	const reset = useRoundReset({
		cycle: groupQuery.data?.cycle ?? 'WEEKLY',
		kind: groupQuery.data?.kind ?? 'CEVSEN',
		roundDays: groupQuery.data?.roundDays ?? 7,
		roundEndsAt: groupQuery.data?.roundEndsAt ?? null,
		startedAt: groupQuery.data?.startedAt ?? null,
		timezone: groupQuery.data?.timezone ?? 'UTC'
	});
	const untilReset = useTimeUntilReset(groupQuery.data?.roundEndsAt ?? null);
	const roundsQuery = useGetRounds(groupId);
	// Gated on the group having started: see the hook.
	const myProgressQuery = useGetMyProgress(
		groupId,
		groupQuery.data?.status === 'RUNNING' && groupQuery.data.splitMode !== 'FLEXIBLE'
	);
	const setBabRead = useSetBabRead();
	const markPoolReleasesSeen = useMarkPoolReleasesSeen();
	const pullToRefresh = usePullToRefresh(
		groupQuery,
		babsQuery,
		roundsQuery,
		...(isFlexible ? [flexiblePoolQuery] : [myProgressQuery])
	);
	// A hatim may open on Q7 or QR1 instead — and a member holding no cüz never sees this screen.
	const roundGate = useHatimRoundGate(groupId, navigation);

	/*
	 * The two boards' cells, and the tap that opens one, memoised up here with the other
	 * hooks — above the early returns, and reading from the query data rather than the
	 * narrowed `detail` below, for the same reason `reset` does: hook order has to hold.
	 *
	 * `CellGrid` memoises a cell on the identity of the item it was handed, so building these
	 * inline in the JSX gave a hundred cells a new object every render and re-evaluated a
	 * hundred animated styles because a sheet opened.
	 */
	const babs = babsQuery.data ?? NO_BABS;
	// The server decides what "mine" means today — under ROTATION the babs a member reads
	// are a different seat's block every round, so this can't be derived from assignment.
	const myBabNumbers = groupQuery.data?.myBabNumbers ?? NO_NUMBERS;
	const myBabNumberSet = useMemo(() => new Set(myBabNumbers), [myBabNumbers]);
	const babCells = useMemo(
		() =>
			toBabCells(babs, {
				myBabNumbers,
				poolBabNumbers: groupQuery.data?.poolBabNumbers ?? NO_NUMBERS,
				viewerUserId: userId ?? null
			}),
		[babs, groupQuery.data?.poolBabNumbers, myBabNumbers, userId]
	);
	const handlePressBab = useCallback(
		(babNumber: number) => {
			const bab = babs.find(candidate => candidate.number === babNumber);

			if (bab && myBabNumberSet.has(bab.number)) {
				// A cüz cell opens Q4; the reader is the Cevşen's and would show the wrong text.
				// Read off the query here: `isHatim` below is declared after the early returns,
				// and this callback is a hook that has to sit above them.
				if (groupQuery.data?.kind === 'HATIM') {
					navigation.navigate('CuzDetail', { cuzNumber: babNumber, groupId });
				} else {
					navigation.navigate('BabReader', { groupId, babNumber });
				}
			}
		},
		[babs, groupId, groupQuery.data?.kind, myBabNumberSet, navigation]
	);
	/*
	 * The Hizb's board (HZ1), held the same way and for the same reason: `HizbBoard` draws
	 * `CellGrid`'s own cells, memoised on what they are handed. A Cevşen group never draws it,
	 * so there is nothing to build for one.
	 */
	const isHizbGroup = groupQuery.data?.kind === 'HIZB';
	const hizbCells = useMemo(
		() =>
			isHizbGroup
				? hizbBoardCells(babs, { myBabNumbers, poolBabNumbers: groupQuery.data?.poolBabNumbers ?? NO_NUMBERS })
				: NO_HIZB_CELLS,
		[babs, groupQuery.data?.poolBabNumbers, isHizbGroup, myBabNumbers]
	);
	// The board's "Fihrist ›". Held for the same reason as the cells: `HizbBoard` is memoised.
	const handleOpenHizbIndex = useCallback(() => navigation.navigate('HizbIndex', { groupId }), [groupId, navigation]);

	const status = groupQuery.data?.status;
	const isOwnerOfGroup = groupQuery.data?.isOwner === true;

	// A group that hasn't started has no board to show — the lobby is the whole screen.
	// `replace` rather than `navigate` so the two never stack and back still leaves the
	// group entirely.
	useEffect(() => {
		if (status === 'GATHERING') {
			// The lobby is the creator's; a waiting member gets the "you're in, waiting to
			// start" screen instead. One screen per state, not one per role.
			navigation.replace(isOwnerOfGroup ? 'Lobby' : 'JoinedWelcome', { groupId });
		}
	}, [groupId, isOwnerOfGroup, navigation, status]);

	// Only the group gates the screen. The board arrives separately, and the two things that
	// need it — the pool card and the hundred — each have their own stand-in, so waiting on
	// it no longer blanks the whole page.
	// Held on the skeleton while the round gate decides, too: a required pick must take the
	// screen away before any of the group has been drawn.
	if (groupQuery.isPending || (groupQuery.data !== undefined && !roundGate.isOpen)) {
		return (
			<ScreenContainer>
				{/* Each kind's own stand-in — a hatim's, the Hizb's, else the Cevşen's. */}
				{loadingKind === 'HATIM' ? (
					<HatimGroupSkeleton />
				) : (
					<GroupDetailSkeleton kind={loadingKind ?? 'CEVSEN'} />
				)}
			</ScreenContainer>
		);
	}

	if (groupQuery.isError || babsQuery.isError || !groupQuery.data) {
		return <ErrorState queries={[groupQuery, babsQuery]} />;
	}

	const detail = groupQuery.data;

	// The redirect above has already fired; hold rather than render a board for a group that
	// has no progress yet. It shows the skeleton of where the redirect is going — the owner's
	// lobby, or the waiting screen for everyone else — since holding this screen's own shape
	// would flash a layout that never arrives.
	if (detail.status === 'GATHERING') {
		return detail.isOwner ? (
			<ScreenContainer isScrollable={false}>
				{detail.kind === 'HATIM' ? <HatimLobbySkeleton /> : <LobbySkeleton kind={detail.kind} />}
			</ScreenContainer>
		) : (
			// The waiting screen is the same shape for every kind; only its words differ.
			<ScreenContainer isScrollable={false}>
				<JoinedWelcomeSkeleton />
			</ScreenContainer>
		);
	}
	/*
	 * HZ1 — a Hizb group. The screen is the Cevşen's with its sections swapped where the design
	 * swaps them: the heading, the summary card, the assigned panel, the row cards' counts and
	 * the board. Everything else — the progress banner, the release notice, the sheets, the way
	 * out — is drawn once for both.
	 */
	const isHizb = detail.kind === 'HIZB';
	// One card however many blocks were taken over — "27–39, 66–78" reads better than a
	// stack of identical notices. A Hizb block can be a single portion, which reads "7", not "7–7".
	const poolReleaseRanges = detail.poolReleases
		.map(release =>
			isHizb
				? formatRun({ end: release.endBab, start: release.startBab })
				: `${release.startBab}–${release.endBab}`
		)
		.join(', ');
	const myBabs = babs.filter(bab => myBabNumberSet.has(bab.number)).sort((a, b) => a.number - b.number);
	// The slice the reader is on, plus a count of the others — see `shareSlices`.
	const mySlices = shareSlices(myBabNumbers, detail.myNextBabNumber);
	const myReadCount = myBabs.filter(bab => bab.readAt !== null).length;
	// Only a DAILY round is labelled as a countdown to its reset; see the Cevşen card below.
	const isDaily = detail.cycle === 'DAILY';
	const isRoundComplete = detail.completedAt !== null;
	const isHatim = detail.kind === 'HATIM';
	// A hundred or thirty, from the group rather than a constant — see `unitCountFor`.
	const unitCount = unitCountFor(detail.kind);
	// Newest closed round — the list arrives newest-first with the open one at the head.
	const lastClosedRound = (roundsQuery.data ?? []).find(round => !round.isOpen);
	// Undefined while the group is still gathering — the server has no rounds to report
	// and answers 403 — so the card simply does not appear until the hatim starts.
	const myProgress = myProgressQuery.data;
	// Hours on a DAILY round and on any round's last day, where the floored day count reads 0;
	// days otherwise, "1 day" for one. Both kinds' cards show it.
	const leftValue = roundTimeLeftLabel({ cycle: detail.cycle, daysLeft: detail.daysLeft, ...untilReset }, t);

	/*
	 * **The heading is the screen's again, and the bar carries only controls.**
	 *
	 * A native `headerTitle` was tried: it makes the bar a real bar, which is what earns the
	 * glass — but a system bar has one line for what is here a title, a dedication and a cadence
	 * chip, so the design's whole heading block went with it.
	 *
	 * What actually made the material flat was never the missing title. It was the *sticky*
	 * wrapper this block used to sit in, painting `background` edge to edge so scrolling cards
	 * could not run through it — an opaque band directly under the bar is all the bar had to
	 * refract. Unpinned and unpainted, the page itself passes beneath, so the toolbar refracts
	 * the board and the cards the way the tab bar always has.
	 *
	 * `hasBackButton` is what pushes this clear of the control above it.
	 */
	const header = (
		<ScreenHeader
			hasBackButton
			subtitle={detail.dedication ? t('forName', { dedication: detail.dedication }) : undefined}
			title={detail.name}
			// A group's name is whatever somebody typed, so it truncates rather than wrapping.
			titleLines={1}
			/*
			 * **Both chips on the title's own line, as a pair.**
			 *
			 * The kind sat in `action`, which is the far corner and — with a dedication under
			 * the name — is centred against the *block* rather than the title, so the two chips
			 * ended up at different heights on opposite ends of the row. `titleTrailing` is
			 * inside `labelRow`, which centres on the title itself and keeps them adjacent.
			 *
			 * Cadence first, kind second: the cadence is the more specific of the two and the
			 * one that changes between groups of the same sort.
			 *
			 * **A one-off has no cadence to name.** "Özel" sets how long the hatim runs, not how
			 * often it comes round, so a chip there would claim a rhythm that does not exist —
			 * the reset line below says when it ends instead.
			 */
			titleTrailing={
				<View style={styles.titleChips}>
					{isRepeatingCycle(detail.cycle) ? (
						<Chip label={t(cycleLabelKey(detail.cycle))} tone='accent' />
					) : null}
					{/*
					 * Both kinds carry it: a screen that tags only the unusual one makes the
					 * other the unmarked default, which it stops being as soon as somebody has
					 * one of each.
					 */}
					<Chip label={t(kindLabelKey(detail.kind))} tone='neutral' />
				</View>
			}
		/>
	);

	/*
	 * HZ1 counts the pool by what is still free to take, where the Cevşen's card counts the
	 * whole of it. Once every pool portion has somebody the card says so rather than offering
	 * none — and stays, so the way to Havuz doesn't go with the last claim.
	 */
	if (detail.splitMode === 'FLEXIBLE') {
		return (
			<>
				<ScreenContainer pullToRefresh={pullToRefresh}>
					{header}
					<CardSurface>
						<TitleText>{t('planFlexible')}</TitleText>
						<CaptionText>{t('flexibleMembers', { count: detail.memberCount })}</CaptionText>
						<CaptionText>{`${t('groupProgress')}: ${detail.readCount} / ${detail.partCount}`}</CaptionText>
						{reset ? <RoundResetRow groupLabel={reset.group} localLabel={reset.local} /> : null}
					</CardSurface>
					<FlexibleReadingPanel
						group={detail}
						onOpenReader={number =>
							detail.kind === 'HIZB'
								? navigation.navigate('HizbReader', { groupId, partNumber: number })
								: navigation.navigate('BabReader', { groupId, babNumber: number })
						}
					/>
					<AppButton title={t('membersTitle')} onPress={() => setSheet('members')} variant='surface' />
					<AppButton
						title={t('rounds')}
						onPress={() => navigation.navigate('Rounds', { groupId })}
						variant='surface'
					/>
					<LeaveGroupButton groupId={groupId} isFlexible isOwner={detail.isOwner} kind={detail.kind} />
				</ScreenContainer>
				<ShareSheet group={detail} isVisible={openSheet === 'share'} onClose={closeSheet} />
				{detail.isOwner ? (
					<ManageSheet group={detail} isVisible={openSheet === 'manage'} onClose={closeSheet} />
				) : null}
				<MembersSheet groupId={groupId} isVisible={openSheet === 'members'} onClose={closeSheet} />
			</>
		);
	}
	const freePoolCount = detail.poolBabNumbers.length;
	const hizbPoolCount = freePoolCount > 0 ? freePoolCount : detail.poolAllBabNumbers.length;
	const hizbPoolLine = () =>
		freePoolCount > 0
			? t(freePoolCount === 1 ? 'poolFreeHizbOne' : 'poolFreeHizb', { count: freePoolCount })
			: t('allClaimedPortions', { count: detail.poolAllBabNumbers.length });
	// "Geçen tur"'s line counts portions. It names no people, as HZ1's does: a round's summary
	// carries only its missing count — who owed them is on the round's own screen.
	const hizbMissedLine = (count: number) =>
		t(count === 1 ? 'missedPortionsHizbOne' : 'missedPortionsHizb', { count });

	return (
		<>
			<ScreenContainer pullToRefresh={pullToRefresh}>
				{/*
				 * HZ1's heading: the book's mark in the corner — the toolbar's actions are in the
				 * navigator's bar either way — and under the name, the round and the plan. The design's
				 * group has no dedication; a group that has one keeps it, on the line below.
				 */}
				{isHizb ? (
					<ScreenHeader
						action={<KindMark kind='HIZB' size={KIND_MARK_SIZE} />}
						hasBackButton
						subtitle={[
							`${t('roundN')} ${(detail.roundIndex ?? 0) + 1} · ${t(planLabelKey(detail.splitMode))}`,
							detail.dedication ? t('forName', { dedication: detail.dedication }) : null
						]
							.filter(Boolean)
							.join('\n')}
						title={detail.name}
						titleLines={1}
						titleTrailing={<Chip label={t(cycleLabelKey(detail.cycle))} tone='accent' />}
					/>
				) : (
					header
				)}
				{/*
				 * 07 / 07c. One card rather than two loose tiles: the reset line belongs to
				 * the same fact as the countdown beside it — how long is left, and until when
				 * exactly. Split apart, the countdown reads as the reader's own clock when it
				 * never was.
				 */}
				{/*
				 * The Hizb's summary card counts what the group has read, where the Cevşen's counts its
				 * members, and says how long the round has left under one label whatever the cycle. A
				 * finished round turns the count sage rather than taking the countdown's place: the
				 * count already reads "33 / 33", and when the next one starts is still worth knowing.
				 */}
				{isHizb ? (
					<CardSurface isFlush>
						<View style={styles.statsRow}>
							<View
								style={[
									styles.statCell,
									styles.statCellDivided,
									{ borderRightColor: theme.colors.divider }
								]}
							>
								<NumericText color={isRoundComplete ? theme.colors.accent : theme.colors.text}>
									{`${detail.readCount} `}
									<Typography
										color={theme.colors.faintText}
										style={styles.statTotal}
										variant='numeric'
									>
										{`/ ${detail.partCount}`}
									</Typography>
								</NumericText>
								<StatText
									color={isRoundComplete ? theme.colors.accent : theme.colors.faintText}
									style={styles.statLabel}
								>
									{t(isRoundComplete ? 'roundCompleted' : 'portionsReadStat')}
								</StatText>
							</View>
							<View style={styles.statCell}>
								<NumericText>{leftValue}</NumericText>
								<StatText color={theme.colors.faintText} style={styles.statLabel}>
									{t('untilRoundEnd')}
								</StatText>
							</View>
						</View>
						{reset ? (
							<RoundResetRow
								groupLabel={reset.group}
								localLabel={reset.local}
								style={[styles.statsReset, { borderTopColor: theme.colors.divider }]}
								variant='panel'
							/>
						) : null}
					</CardSurface>
				) : (
					<CardSurface isFlush>
						<View style={styles.statsRow}>
							<View
								style={[
									styles.statCell,
									styles.statCellDivided,
									{ borderRightColor: theme.colors.divider }
								]}
							>
								<NumericText>{`${detail.memberCount} / ${detail.spots}`}</NumericText>
								<StatText color={theme.colors.faintText} style={styles.statLabel}>
									{t('members')}
								</StatText>
							</View>
							{/*
							 * **The round closing is shown here rather than in a banner of its own.**
							 * This is the card whose whole job is "where is this round", so the
							 * answer "it is finished" belongs in it — and it needs no new furniture
							 * to design, space and then take away again when the round rolls.
							 *
							 * The countdown is what it replaces, deliberately: once the hundred is
							 * closed, how long is left has stopped being the interesting number.
							 * `RoundResetRow` below still says when it starts again, so nothing is
							 * lost. The state clears itself — `ensureCurrentRound` wipes
							 * `completedAt` at the boundary along with the board.
							 */}
							<View style={styles.statCell}>
								{isRoundComplete ? (
									<>
										<NumericText color={theme.colors.accent}>
											{`${unitCount} / ${unitCount}`}
										</NumericText>
										<StatText color={theme.colors.accent} style={styles.statLabel}>
											{t('roundCompleted')}
										</StatText>
									</>
								) : (
									<>
										<NumericText>{leftValue}</NumericText>
										<StatText color={theme.colors.faintText} style={styles.statLabel}>
											{/* A DAILY round counts down in hours — "1 gün" would say nothing. */}
											{isDaily ? t('untilMidnight') : t('left')}
										</StatText>
									</>
								)}
							</View>
						</View>
						{reset ? (
							<RoundResetRow
								groupLabel={reset.group}
								localLabel={reset.local}
								style={[styles.statsReset, { borderTopColor: theme.colors.divider }]}
								variant='panel'
							/>
						) : null}
					</CardSurface>
				)}

				{/*
				 * Its own stand-in while it loads, like the board and the pool card below —
				 * this screen gates only on the group query, and my-progress is a separate
				 * request that almost always answers second.
				 *
				 * **`isLoading`, not `isPending` or `isFetching`.** `isPending` stays true for
				 * a *disabled* query, so a gathering group would hold the bones forever; and
				 * `isFetching` is true on every background refetch, which would swap the card
				 * back to bones each time a read invalidated it. `isLoading` is the pair —
				 * first load, in flight — and only that.
				 */}
				{myProgressQuery.isLoading ? <MyProgressCardSkeleton /> : null}
				{myProgress ? (
					<MyProgressCard
						isHatim={isHatim}
						onPress={() => navigation.navigate('MyProgress', { groupId })}
						progress={myProgress}
					/>
				) : null}

				{/*
				 * The sage "Sana atanan" strip *is* the collapsible's header now. It used to be
				 * a separate banner sitting above a "Babların 1–5" row, which said the same
				 * range twice and put the thing you tap below the thing that explains it.
				 *
				 * The card takes the strip's colour while closed: a rounded card is white at
				 * the corners, and with a green header filling it edge to edge those corners
				 * were four white nicks against the sage.
				 */}
				{/* No glass while it is closed: the sage fill *is* this panel, and the material
				    tints itself `surface` and washes over whatever colour arrives in `style`. */}
				{isHizb ? (
					<HizbSharePanel
						babs={babsQuery.data}
						groupId={groupId}
						onOpenPart={partNumber => navigation.navigate('HizbReader', { groupId, partNumber })}
						onToggleRead={(partNumber, read) => setBabRead.mutate({ babNumber: partNumber, groupId, read })}
						partNumbers={myBabNumbers}
						roundIndex={detail.roundIndex ?? 0}
						viewerUserId={userId ?? null}
					/>
				) : (
					<CardSurface
						hasGlassSurface={isMyBabsOpen}
						isFlush
						style={isMyBabsOpen ? null : { backgroundColor: theme.colors.accentSoft }}
					>
						{/* C1 of the first-use tour frames this row, closed or open. */}
						<TourTarget id='assigned'>
							<Pressable
								// The eyebrow and the sentence are gone from the row, so the label they carried
								// has to come from here or it announces nothing but its numbers.
								accessibilityLabel={`${t('assigned')} ${mySlices.current}`}
								accessibilityRole='button'
								accessibilityState={{ expanded: isMyBabsOpen }}
								onPress={toggleMyBabs}
								style={[
									styles.myBabsHeader,
									{ backgroundColor: theme.colors.accentSoft },
									isMyBabsOpen
										? {
												borderBottomColor: theme.colors.divider,
												borderBottomWidth: StyleSheet.hairlineWidth
										  }
										: null
								]}
							>
								{/* The badge carries one slice, not the whole share, with the count of the
							    others pinned to it — spelled out, "1–13, 27–39" ran the badge to twice
							    the width and wrapped the sentence beside it onto three lines. The chip
							    belongs *here*, against the range it is counting, rather than up beside
							    the eyebrow where it read as a tag on the words. */}
								<View style={styles.myBabsBadgeRow}>
									<View style={[styles.myBabsBadge, { backgroundColor: theme.colors.accent }]}>
										<Typography
											color={theme.colors.onAccent}
											style={styles.myBabsBadgeLabel}
											variant='title'
										>
											{isHatim
												? formatBabRange(myBabNumbers).replaceAll(', ', ' · ')
												: mySlices.current}
										</Typography>
									</View>
									{/* A hatim's share is already whole in the badge — there is no slice left over. */}
									{isHatim ? null : <SliceChip count={mySlices.moreCount} isCompact tone='surface' />}
								</View>
								{/* The eyebrow stays; the sentence under it went. It named the range a second
							    time and, once the share came in pieces, needed three lines to do it —
							    while the badge beside it had already said where you are. */}
								<View style={styles.myBabsCopy}>
									<Typography
										color={theme.colors.accent}
										style={styles.myBabsLabel}
										variant='stat'
										weight='medium'
									>
										{isHatim ? t('qMyCuz') : t('assigned')}
									</Typography>
								</View>
								<View style={styles.myBabsMeta}>
									<CaptionText color={theme.colors.accent} weight='semibold'>{`${myReadCount} / ${
										myBabNumbers.length
									} ${t('done')}`}</CaptionText>
									<Animated.View style={chevronStyle}>
										<Icon
											color={theme.colors.faintText}
											name='chevronRight'
											size={15}
											strokeWidth={1.8}
										/>
									</Animated.View>
								</View>
							</Pressable>
						</TourTarget>
						{/* Clipped, and inert while closed: the rows stay mounted so the panel has a
						    height to animate to, which also means they would otherwise still be
						    reachable by a tap or by VoiceOver in a card that reads as shut. */}
						<Animated.View
							accessibilityElementsHidden={!isMyBabsOpen}
							importantForAccessibility={isMyBabsOpen ? 'auto' : 'no-hide-descendants'}
							pointerEvents={isMyBabsOpen ? 'auto' : 'none'}
							style={[styles.myBabsBody, myBabsBodyStyle]}
						>
							{/*
							 * The rows live in a scroller that fills the wrapper absolutely — which is
							 * also what lets them be measured. As an ordinary child they inherited the
							 * wrapper's animated height (nothing, while closed) and reported zero, so
							 * the panel had no size to open to; a scroll view measures its content
							 * unconstrained however short its own frame is.
							 *
							 * Scrolling turns on only when there is more than the cap, so a share that
							 * fits can't swallow the page's own scroll.
							 *
							 * Not a `FlatList`: nesting a VirtualizedList inside the screen's
							 * ScrollView is the thing React Native warns about, and a share is at most
							 * a couple of dozen rows — the cap already stops it from being long, and
							 * virtualising two dozen cheap rows would cost more than it saves.
							 */}
							<ScrollView
								nestedScrollEnabled
								scrollEnabled={isMyBabsOpen && myBabsHeight > MY_BABS_MAX_HEIGHT}
								style={styles.myBabsScroll}
							>
								<View onLayout={event => setMyBabsHeight(event.nativeEvent.layout.height)}>
									{myBabNumbers.length === 0 ? (
										<BodyText color={theme.colors.faintText} style={styles.noAssignedBabs}>
											{t('noAssignedBabs')}
										</BodyText>
									) : (
										myBabs.map(bab => {
											const isRead = bab.readAt !== null;
											/*
											 * **Who read it, not merely that it was read.** A bab in your
											 * share can already have been read by whoever held that block on
											 * an earlier rotation day. This drew your own ticked box over
											 * their work and then offered an undo the server refuses —
											 * only the reader may clear a read — so the tick was a control
											 * that could not do the thing it looked like it did.
											 */
											const isReadByOthers = isRead && bab.readByUserId !== userId;

											return (
												<BabRow
													isRead={isRead}
													isReadByOthers={isReadByOthers}
													key={bab.number}
													// A cüz opens its own page (Q4), where it is marked; a bab opens the
													// reader, where a bab is read and marked at once.
													onOpen={() =>
														isHatim
															? navigation.navigate('CuzDetail', {
																	cuzNumber: bab.number,
																	groupId
															  })
															: navigation.navigate('BabReader', {
																	groupId,
																	babNumber: bab.number
															  })
													}
													onToggle={() =>
														setBabRead.mutate({
															babNumber: bab.number,
															groupId,
															read: !isRead
														})
													}
													openLabel={t('read')}
													subtitle={
														isReadByOthers
															? // Named where the server could resolve one, and falling
															  // back where it couldn't rather than printing an id: a
															  // member who has since left still has reads on this
															  // board, and "cmt9x…" says less than nothing.
															  bab.readByDisplayName
																? t('readBeforeYoursBy', {
																		name:
																			(detail.hideMemberNames &&
																				!detail.isOwner) ||
																			bab.readByUserId?.startsWith('anonymous:')
																				? t('anonymousMember')
																				: bab.readByDisplayName
																  })
																: t('readBeforeYours')
															: isRead
															? t('readToday')
															: // **The sura range, not "Henüz okunmadı".** A cüz is
															// named by where it falls — "Ahzâb 31 – Yâsîn 27" —
															// and that is what someone about to read one needs;
															// a bab's number already is its name, so the Cevşen
															// row keeps saying whether it is read.
															isHatim
															? cuzSuraRange(bab.number, language)
															: t('notRead')
													}
													title={
														isHatim
															? t('cuzOrdinal', { n: bab.number })
															: t('babOrdinal', { n: bab.number })
													}
												/>
											);
										})
									)}
								</View>
							</ScrollView>
						</Animated.View>
					</CardSurface>
				)}

				{/*
				 * "Senin ilerlemen" — the reader's own record, and the way in to F7.
				 *
				 * Directly under the babs card and above "Geçen tur", which is where the design
				 * puts it and the order the two read in: your own share first, then the group's
				 * last pass. Guarded on the query rather than rendered empty, because a group
				 * still GATHERING has no rounds to report and the server answers 403 for one.
				 */}
				{/*
				 * "Geçen tur" — the way into Turlar. Shown only once a round has actually closed:
				 * before that there is no history to look at, and a nav row to an empty screen is
				 * worse than no row.
				 */}
				{lastClosedRound ? (
					<CardSurface
						onPress={() => navigation.navigate('Rounds', { groupId })}
						style={styles.lastRoundCard}
					>
						<View
							style={[
								styles.lastRoundBadge,
								{
									backgroundColor: lastClosedRound.missedCount
										? theme.colors.missedSurface
										: theme.colors.accentSoft
								}
							]}
						>
							<Typography
								color={lastClosedRound.missedCount ? theme.colors.missed : theme.colors.accent}
								style={styles.lastRoundBadgeLabel}
								variant='title'
							>
								{lastClosedRound.missedCount}
							</Typography>
						</View>
						<View style={styles.lastRoundCopy}>
							<CaptionText weight='semibold'>
								{`${t('lastRound')} · ${t('roundN')} ${lastClosedRound.roundIndex + 1}`}
							</CaptionText>
							<CaptionText color={theme.colors.subtext} style={styles.lastRoundSub}>
								{isHizb
									? hizbMissedLine(lastClosedRound.missedCount)
									: `${lastClosedRound.missedCount} ${t(isHatim ? 'missedCuz' : 'missedBabs')}`}
							</CaptionText>
						</View>
						<Icon color={theme.colors.faintText} name='chevronRight' size={15} strokeWidth={1.8} />
					</CardSurface>
				) : null}

				{/*
				 * "A joiner took over the block you volunteered for." The push says it first,
				 * but only if it could be delivered — permission may be denied and the phone
				 * may have been off. This is the copy of that news which cannot go missing.
				 * Dismissible, because it reports something already done rather than asking.
				 */}
				{/* No glass on the release notice: `sand` is what marks it as news rather than
				    another section, and the material would paint that colour out. */}
				{detail.poolReleases.length > 0 ? (
					<CardSurface
						hasGlassSurface={false}
						style={[styles.releaseCard, { backgroundColor: theme.colors.sand }]}
					>
						<View style={styles.releaseRow}>
							<Icon color={theme.colors.sandText} name='info' size={19} strokeWidth={1.8} />
							<View style={styles.releaseCopy}>
								<CaptionText color={theme.colors.sandText} weight='semibold'>
									{t(isHizb ? 'poolReleasedTitleHizb' : 'poolReleasedTitle')}
								</CaptionText>
								<CaptionText color={theme.colors.sandText} style={styles.releaseBody}>
									{t(isHizb ? 'poolReleasedBodyHizb' : 'poolReleasedBody', {
										range: poolReleaseRanges
									})}
								</CaptionText>
							</View>
						</View>
						<AppButton
							onPress={() => markPoolReleasesSeen.mutate(groupId)}
							size='sm'
							title={t('gotIt')}
							variant='surface'
						/>
					</CardSurface>
				) : null}

				{/*
				 * "Ortak havuz" — the way into Havuz, in the same row shape as "Geçen tur" above:
				 * a count in a tile, the name, a line under it, a chevron. It used to carry the
				 * whole pool board; the board lives on the Havuz screen now, and this row is only
				 * the door. Only groups that started with seats to spare have a pool at all — and
				 * the *whole* pool is counted, not just the part still unclaimed, so the row
				 * doesn't vanish once the last block is taken, taking the way to the screen with
				 * it. The count comes from the group, so nothing here waits on the board.
				 */}
				{detail.poolAllBabNumbers.length > 0 ? (
					<CardSurface
						onPress={() => navigation.navigate('Pool', { groupId, kind: detail.kind })}
						style={styles.lastRoundCard}
					>
						<View style={[styles.lastRoundBadge, { backgroundColor: theme.colors.sand }]}>
							<Typography
								color={theme.colors.sandText}
								style={styles.lastRoundBadgeLabel}
								variant='title'
							>
								{isHizb ? hizbPoolCount : detail.poolAllBabNumbers.length}
							</Typography>
						</View>
						<View style={styles.lastRoundCopy}>
							<CaptionText weight='semibold'>{t('pool')}</CaptionText>
							<CaptionText color={theme.colors.subtext} style={styles.lastRoundSub}>
								{isHizb
									? hizbPoolLine()
									: `${detail.poolAllBabNumbers.length} ${t(unitLabelKey(detail.kind))}`}
							</CaptionText>
						</View>
						<Icon color={theme.colors.faintText} name='chevronRight' size={15} strokeWidth={1.8} />
					</CardSurface>
				) : null}

				{/*
				 * "Hatim duası" — a Kuran group's way to the du'a, in the same row shape as the two
				 * above: a book in the tile where they carry a count. Only once this round's hatim is
				 * complete, which is when the du'a is read; Q7 offers it at that moment too. It goes
				 * again with the rollover, since the new round's `completedAt` starts cleared.
				 */}
				{isHatim && isRoundComplete ? (
					<CardSurface onPress={() => navigation.navigate('HatimDua')} style={styles.lastRoundCard}>
						<View style={[styles.lastRoundBadge, { backgroundColor: theme.colors.accentSoft }]}>
							<Icon color={theme.colors.accent} name='readInApp' size={20} />
						</View>
						<View style={styles.lastRoundCopy}>
							<CaptionText weight='semibold'>{t('qHatimDua')}</CaptionText>
							<CaptionText color={theme.colors.subtext} style={styles.lastRoundSub}>
								{t('qHatimDuaPages', { n: MUSHAF_DUA_PATHS.length })}
							</CaptionText>
						</View>
						<Icon color={theme.colors.faintText} name='chevronRight' size={15} strokeWidth={1.8} />
					</CardSurface>
				) : null}

				{/*
				 * The hundred, in the same card the pool above it uses: heading and count on a
				 * white surface, a divider, then the board and its legend in the body. The
				 * heading used to sit outside on the page background with the board floating
				 * under it, so two sections of the same screen — the same lattice, twice —
				 * were built as two different kinds of thing.
				 */}
				{isHizb ? (
					babsQuery.isPending ? (
						<HizbBoardSkeleton />
					) : (
						<HizbBoard cells={hizbCells} onPressIndex={handleOpenHizbIndex} />
					)
				) : babsQuery.isPending ? (
					/*
					 * The skeleton, not a blank hundred. `emptyBabCells` renders every cell in
					 * the "unread" tone, which doesn't read as loading — it reads as nobody
					 * having read anything, which is a claim about the data rather than an
					 * admission that it hasn't arrived.
					 */
					<GridSkeleton cellCount={unitCount} legendCount={isHatim ? CUZ_LEGEND_COUNT : BAB_LEGEND_COUNT} />
				) : (
					<CardSurface isFlush>
						<View style={[styles.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
							<TitleText>{t('groupProgress')}</TitleText>
							{/* The count is the group's own, so the heading is real either way. */}
							<CaptionText
								color={theme.colors.faintText}
							>{`${detail.readCount} / ${unitCount}`}</CaptionText>
						</View>
						<View style={styles.sectionBody}>
							<BabGrid cells={babCells} kind={detail.kind} onPressBab={handlePressBab} />
							<BabLegend kind={detail.kind} />
						</View>
					</CardSurface>
				)}

				{/*
				 * Both group actions are corner actions in the heading now, so the only
				 * full-width button left is the one the owner can't have: 07d's way out. An
				 * owner cannot leave a group they would strand, and has nothing here.
				 *
				 * Last thing on the screen, under the board. It used to sit between the pool and
				 * the hundred, which put an irreversible action in the middle of the page you
				 * scroll through to read — you meet it on the way past rather than by going
				 * looking for it.
				 */}
				{/* No margin of its own: `ScreenContainer` already spaces this column, and adding to
			    that put 30pt above the button where every card sits 12 apart. */}
				{detail.isOwner ? null : <LeaveGroupButton groupId={groupId} kind={detail.kind} />}
			</ScreenContainer>

			<ShareSheet group={detail} isVisible={openSheet === 'share'} onClose={closeSheet} />
			{detail.isOwner ? (
				<ManageSheet group={detail} isVisible={openSheet === 'manage'} onClose={closeSheet} />
			) : null}
			<MembersSheet groupId={groupId} isVisible={openSheet === 'members'} onClose={closeSheet} />
		</>
	);
};

const styles = StyleSheet.create({
	/** The cadence and the kind, side by side on the title's own line. */
	titleChips: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	actionButton: {
		flex: 1
	},
	actionsRow: {
		flexDirection: 'row',
		gap: 8
	},
	sectionBody: {
		gap: 12,
		padding: 15
	},
	releaseBody: {
		marginTop: 3
	},
	releaseCard: {
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	releaseCopy: {
		flex: 1,
		minWidth: 0
	},
	releaseRow: {
		flexDirection: 'row',
		gap: 11
	},
	sectionHeader: {
		alignItems: 'center',
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingBottom: 13,
		paddingHorizontal: 16,
		paddingTop: 15
	},
	myBabsBadge: {
		alignItems: 'center',
		borderRadius: 12,
		height: 38,
		justifyContent: 'center',
		// `minWidth`, not a width: "96–100" is wider than the 38pt square "1–5" fits in.
		minWidth: 38,
		paddingHorizontal: 6
	},
	myBabsBadgeLabel: {
		fontSize: 15,
		lineHeight: 19
	},
	// Clips the rows to whatever the animated height currently is; without it they spill out
	// of the card and over the section below on the way open.
	myBabsBody: {
		overflow: 'hidden'
	},
	// Fills the clipped wrapper rather than sitting in its flow, so the rows keep their own
	// height to be measured by even when the wrapper is animated down to nothing.
	myBabsScroll: {
		...StyleSheet.absoluteFill
	},
	myBabsHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 14
	},
	// Takes the slack between the range and the count, so the two ends stay put however long
	// the label in the middle is.
	myBabsCopy: {
		flex: 1,
		minWidth: 0
	},
	myBabsLabel: {
		letterSpacing: 0.8
	},
	// Badge and chip travel together as the row's leading block.
	myBabsBadgeRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 6
	},
	myBabsMeta: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 9
	},
	noAssignedBabs: {
		paddingHorizontal: 16,
		paddingVertical: 20
	},
	lastRoundBadge: {
		alignItems: 'center',
		borderRadius: 13,
		height: 40,
		justifyContent: 'center',
		// `minWidth`, not a fixed width: the design's mock never exceeds a single digit, but
		// a round nobody touched reads 100 and spills straight out of a 40pt square.
		minWidth: 40,
		paddingHorizontal: 6
	},
	lastRoundBadgeLabel: {
		// 15/19, matching the design and the app's other badge tiles — not the 25/28 numeric
		// scale. A tall line box in a 40pt square centres the *line*, not the glyph, which is
		// what left the digit sitting high.
		fontSize: 15,
		lineHeight: 19
	},
	lastRoundCard: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 13,
		paddingHorizontal: 16,
		paddingVertical: 15
	},
	lastRoundCopy: {
		flex: 1,
		minWidth: 0
	},
	lastRoundSub: {
		marginTop: 2
	},
	statCell: {
		flex: 1,
		paddingHorizontal: 15,
		paddingVertical: 14
	},
	statCellDivided: {
		borderRightWidth: StyleSheet.hairlineWidth
	},
	statLabel: {
		marginTop: 4
	},
	statsReset: {
		borderTopWidth: StyleSheet.hairlineWidth
	},
	// HZ1's "/ 33", set smaller beside the count it is out of.
	statTotal: {
		fontSize: 16
	},
	statsRow: {
		flexDirection: 'row',
		gap: 8
	}
});
