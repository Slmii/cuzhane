import { describe, expect, it } from 'vitest';
import { groupIntroductionDestination, groupIntroductionSteps } from './groupIntroduction';

describe('group introduction', () => {
	it('returns creators to their lobby or active group and joiners to their welcome', () => {
		expect(groupIntroductionDestination('created', 'GATHERING')).toBe('Lobby');
		expect(groupIntroductionDestination('created', 'RUNNING')).toBe('GroupDetail');
		expect(groupIntroductionDestination('joined', 'GATHERING')).toBe('JoinedWelcome');
		expect(groupIntroductionDestination('joined', 'RUNNING')).toBe('JoinedWelcome');
	});

	it('explains choosing portions for flexible groups without claiming automatic assignment', () => {
		const steps = groupIntroductionSteps({ kind: 'CEVSEN', splitMode: 'FLEXIBLE', status: 'RUNNING' }, 'joined');
		expect(steps.map(step => step.body)).toEqual(['introFlexible', 'introReadCevsen', 'introRounds']);
	});

	it('explains fixed and rotating shares and Hizb reading separately', () => {
		expect(
			groupIntroductionSteps({ kind: 'HIZB', splitMode: 'FIXED', status: 'RUNNING' }, 'joined').map(
				step => step.body
			)
		).toEqual(['introFixed', 'introReadHizb', 'introRounds']);
		expect(
			groupIntroductionSteps({ kind: 'CEVSEN', splitMode: 'ROTATION', status: 'RUNNING' }, 'created')[0].body
		).toBe('introRotation');
	});

	it('explains starting to the creator and waiting to the member while gathering', () => {
		const group = { kind: 'CEVSEN', splitMode: 'ROTATION', status: 'GATHERING' } as const;
		expect(groupIntroductionSteps(group, 'created')[2].body).toBe('introCreatorWaiting');
		expect(groupIntroductionSteps(group, 'joined')[2].body).toBe('introMemberWaiting');
	});
});
