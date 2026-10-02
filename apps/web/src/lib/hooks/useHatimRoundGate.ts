import { useIsTourDemo } from '@/components/Tour/Tour.context';
import { useCurrentUserId } from '@/lib/hooks/useCurrentUserId';
import { useGetGroupById } from '@/lib/hooks/useGroup';
import { useGetRounds } from '@/lib/hooks/useRounds';
import { decideRoundGate, type RoundGateDecision } from '@/lib/utils/roundGate';
import { hasSeenRoundScreen, markRoundScreenSeen } from '@/lib/utils/roundScreensSeen';
import { CUZ_COUNT } from '@/lib/utils/units';
import type { TabStackParamList } from '@/navigation/types';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';

type Navigation = NativeStackNavigationProp<TabStackParamList>;
type Seen = { complete: boolean; previousComplete: boolean; carried: boolean };

/** The tour's answer, one object so the send effect's dependencies hold still. */
const OPEN: RoundGateDecision = { kind: 'open' };

/**
 * The group screen's front door for a hatim: whether it opens on the group, on Q7, or on QR1 —
 * the scenario table, applied. The decision itself is `decideRoundGate`; this gathers what it
 * needs and acts on the answer.
 *
 * **A required pick replaces the group screen; everything else is pushed over it.** Holding no
 * cüz means the group must not be seen at all, so it gives way entirely and back leaves the
 * group. Q7 and the carried note are once-a-round interruptions, and back returns to the group
 * behind them. A completed round seen late is the one chain: Q7 first, carrying on to QR1.
 *
 * **Seen is written as the screen is sent, and read again whenever the group regains focus.**
 * The group screen stays mounted under a pushed screen; coming back, it reloads what the device
 * remembers rather than keeping a copy of its own, and until that answer lands the last decision
 * is not sent twice.
 *
 * `isOpen` is false until the answer is known, so the caller holds its skeleton rather than
 * flashing the group before a required pick takes it away.
 */
export const useHatimRoundGate = (groupId: string, navigation: Navigation): { isOpen: boolean } => {
	const userId = useCurrentUserId();
	const isFocused = useIsFocused();
	const groupQuery = useGetGroupById(groupId);
	const roundsQuery = useGetRounds(groupId);
	/*
	 * **The tour's demo hatim just opens.** It sits past its first round with its cüz kept, so the
	 * gate would send the carried-over note — over a screen the tour is pointing at, with a demo
	 * group the round screens know nothing about.
	 */
	const isDemo = useIsTourDemo();

	const detail = groupQuery.data;
	const isHatimRunning = !isDemo && detail?.kind === 'HATIM' && detail.status === 'RUNNING';
	const roundIndex = detail?.roundIndex ?? 0;
	const seenKey = `${userId ?? ''}|${groupId}|${roundIndex}`;

	const [seen, setSeen] = useState<{ key: string; value: Seen } | null>(null);
	const sentRef = useRef<string | null>(null);
	/**
	 * The last screen actually sent from here. Coming back from it, the group is drawn even if the
	 * device failed to remember it — otherwise the same decision, not sent twice, would hold the
	 * skeleton up for good.
	 */
	const [shown, setShown] = useState<string | null>(null);

	useEffect(() => {
		if (!isHatimRunning || !userId || !isFocused) {
			return;
		}

		let isCurrent = true;

		void Promise.all([
			hasSeenRoundScreen('hatimComplete', userId, groupId, roundIndex),
			roundIndex > 0 ? hasSeenRoundScreen('hatimComplete', userId, groupId, roundIndex - 1) : true,
			hasSeenRoundScreen('cuzCarried', userId, groupId, roundIndex)
		]).then(([complete, previousComplete, carried]) => {
			if (isCurrent) {
				setSeen({ key: seenKey, value: { carried, complete, previousComplete } });
			}
		});

		return () => {
			isCurrent = false;
		};
	}, [groupId, isFocused, isHatimRunning, roundIndex, seenKey, userId]);

	const me = detail?.members.find(member => member.userId === userId);
	const roundStartedAt = detail?.roundStartedAt ? new Date(detail.roundStartedAt) : null;
	const previousRound = roundsQuery.data?.find(round => round.roundIndex === roundIndex - 1);

	/*
	 * Waiting on the rounds only where they can matter, and not on their failure: a list that
	 * did not load costs the late celebration, never the way into the group. **A cached list is
	 * only trusted once it knows the previous round as closed** — one fetched before the boundary
	 * still shows that round open and unfinished, and deciding on it put QR1 before the Q7 that
	 * should have come first. Otherwise the fresh answer is waited for.
	 */
	const isHistoryReady =
		roundIndex === 0 ||
		roundsQuery.isError ||
		(roundsQuery.data !== undefined && (previousRound?.isOpen === false || !roundsQuery.isFetching));
	const isReady = detail !== undefined && (!isHatimRunning || (seen?.key === seenKey && isHistoryReady));

	const decision: RoundGateDecision | null = isDemo
		? OPEN
		: detail === undefined || !isReady
		? null
		: decideRoundGate({
				boundaryPolicy: detail.boundaryPolicy,
				hasSkippedRound: detail.hasSkippedRound,
				holdsCuz: detail.myBabNumbers.length > 0,
				isComplete: detail.completedAt !== null,
				isHatim: detail.kind === 'HATIM',
				isRunning: detail.status === 'RUNNING',
				previousRoundComplete: (previousRound?.readCount ?? 0) >= CUZ_COUNT,
				roundIndex,
				seen: seen?.value ?? { carried: false, complete: false, previousComplete: false },
				wasInPreviousRound:
					me !== undefined && roundStartedAt !== null && new Date(me.joinedAt) < roundStartedAt
		  });

	const signature = decision ? `${seenKey}|${JSON.stringify(decision)}` : null;

	useEffect(() => {
		if (!decision || decision.kind === 'open' || !isFocused || !userId || signature === null) {
			return;
		}

		if (sentRef.current === signature) {
			return;
		}

		sentRef.current = signature;

		if (decision.kind === 'roundStart' && decision.reason === 'pick') {
			navigation.replace('RoundStart', { groupId, reason: 'pick' });

			return;
		}

		// Written before leaving, so the reload on the way back already finds it.
		void (async () => {
			if (decision.kind === 'roundStart') {
				await markRoundScreenSeen('cuzCarried', userId, groupId, roundIndex);
				setShown(signature);
				navigation.navigate('RoundStart', { groupId, reason: 'carried' });

				return;
			}

			await markRoundScreenSeen('hatimComplete', userId, groupId, decision.roundIndex);

			// The carried note that follows the celebration is shown by it, so it is seen too.
			if (decision.then === 'carried') {
				await markRoundScreenSeen('cuzCarried', userId, groupId, roundIndex);
			}

			const params = {
				groupId,
				roundIndex: decision.roundIndex,
				...(decision.then ? { then: decision.then } : {})
			};

			if (decision.then === 'pick') {
				navigation.replace('HatimComplete', params);
			} else {
				setShown(signature);
				navigation.navigate('HatimComplete', params);
			}
		})();
	}, [decision, groupId, isFocused, navigation, roundIndex, signature, userId]);

	return { isOpen: decision?.kind === 'open' || (signature !== null && signature === shown) };
};

/**
 * The shorter guard for the screens under a group — a cüz, the reader, progress, the havuz —
 * which a notification or a link can open without passing the group screen. Only the required
 * pick applies there: the once-a-round screens belong to opening the group itself.
 *
 * Only while focused: `replace` acts on the top of the stack, so from under a pushed screen it
 * would take that screen's place instead — see `RoundStartScreen`.
 *
 * A Şahsi Kur'an reading holds no cüz — its plan reads them all in turn — so it never picks.
 */
export const useRequireRoundCuz = (groupId: string, navigation: Navigation): void => {
	const isFocused = useIsFocused();
	const detail = useGetGroupById(groupId).data;
	const mustPick =
		detail?.kind === 'HATIM' &&
		detail.planDays == null &&
		detail.status === 'RUNNING' &&
		detail.myBabNumbers.length === 0 &&
		!detail.hasSkippedRound;

	useEffect(() => {
		if (mustPick && isFocused) {
			navigation.replace('RoundStart', { groupId, reason: 'pick' });
		}
	}, [groupId, isFocused, mustPick, navigation]);
};
