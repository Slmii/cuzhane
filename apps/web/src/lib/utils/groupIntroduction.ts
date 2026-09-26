import type { StringKey } from '../i18n/strings';
import type { GroupKind, GroupSplitMode, GroupStatus } from '../types/domain';

export type GroupIntroductionSource = 'created' | 'joined';
type IntroductionGroup = { hizbPlan?: number | null; kind: GroupKind; splitMode: GroupSplitMode; status: GroupStatus };
type IntroductionStep = { title: StringKey; body: StringKey };

export const groupIntroductionDestination = (source: GroupIntroductionSource, status: GroupStatus) =>
	source === 'joined' ? 'JoinedWelcome' : status === 'GATHERING' ? 'Lobby' : 'GroupDetail';

export const groupIntroductionSteps = (
	group: IntroductionGroup,
	source: GroupIntroductionSource
): IntroductionStep[] => [
	{
		title: 'introShareTitle',
		body:
			group.hizbPlan != null
				? group.hizbPlan === 0
					? 'hpMixedHint'
					: 'hpFixedHint'
				: group.splitMode === 'FLEXIBLE'
				? 'introFlexible'
				: group.splitMode === 'FIXED'
				? 'introFixed'
				: 'introRotation'
	},
	{
		title: 'introReadTitle',
		body: group.hizbPlan != null ? 'hpDailyHint' : group.kind === 'HIZB' ? 'introReadHizb' : 'introReadCevsen'
	},
	{
		title: group.status === 'GATHERING' ? 'introStartTitle' : 'introRoundsTitle',
		body:
			group.hizbPlan != null
				? 'hpCoverageHint'
				: group.status === 'GATHERING'
				? source === 'created'
					? 'introCreatorWaiting'
					: 'introMemberWaiting'
				: 'introRounds'
	}
];
