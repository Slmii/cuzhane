import type { StringKey } from '../i18n/strings';
import type { GroupKind, GroupSplitMode, GroupStatus } from '../types/domain';

export type GroupIntroductionSource = 'created' | 'joined';
type IntroductionGroup = {
	hizbPlan?: number | null;
	hizbIndividual?: boolean;
	kind: GroupKind;
	splitMode: GroupSplitMode;
	status: GroupStatus;
};
type IntroductionStep = { title: StringKey; body: StringKey };

export const groupIntroductionDestination = (source: GroupIntroductionSource, status: GroupStatus) =>
	source === 'joined' ? 'JoinedWelcome' : status === 'GATHERING' ? 'Lobby' : 'GroupDetail';

export const groupIntroductionSummary = (group: IntroductionGroup): StringKey =>
	group.hizbPlan != null
		? group.hizbIndividual
			? 'introIndividual'
			: 'introPlan'
		: group.kind === 'HIZB'
		? 'introHizb'
		: 'introCevsen';

export const groupIntroductionSteps = (
	group: IntroductionGroup,
	source: GroupIntroductionSource
): IntroductionStep[] => [
	{
		title: 'introShareTitle',
		body:
			group.hizbPlan != null
				? group.hizbPlan === 0
					? 'introPlanChoose'
					: 'introPlanFixed'
				: group.splitMode === 'FLEXIBLE'
				? 'introFlexible'
				: group.splitMode === 'FIXED'
				? 'introFixed'
				: 'introRotation'
	},
	{
		title: 'introReadTitle',
		body: group.hizbPlan != null ? 'introPlanRead' : group.kind === 'HIZB' ? 'introReadHizb' : 'introReadCevsen'
	},
	{
		title:
			group.hizbPlan != null
				? 'introReturnTitle'
				: group.status === 'GATHERING'
				? 'introStartTitle'
				: 'introRoundsTitle',
		body:
			group.hizbPlan != null
				? 'introPlanReturn'
				: group.status === 'GATHERING'
				? source === 'created'
					? 'introCreatorWaiting'
					: 'introMemberWaiting'
				: 'introRounds'
	}
];
