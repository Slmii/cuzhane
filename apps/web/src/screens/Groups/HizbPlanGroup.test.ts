import React, { type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HizbAssignment } from '@/api/hizbReading.api';
import { HizbPlanGroup } from './HizbPlanGroup.component';

const state = vi.hoisted(() => ({
	today: null as HizbAssignment | null,
	upcoming: [] as HizbAssignment[],
	mutate: vi.fn(),
	refetch: vi.fn(),
	navigate: vi.fn(),
	update: vi.fn(),
	isPending: false,
	isError: false
}));
vi.mock('react', async importOriginal => ({
	...(await importOriginal<typeof import('react')>()),
	useEffect: () => undefined,
	useRef: () => ({ current: null }),
	useState: (initial: unknown) => [initial, vi.fn()]
}));
vi.mock('react-native', () => ({ View: 'View', StyleSheet: { create: (s: unknown) => s } }));
vi.mock('@/lib/hooks/useHizbReading', () => ({
	useHizbReading: () => ({
		data: {
			pages: [
				{
					today: state.today,
					upcoming: state.upcoming,
					coverage: { covered: 0, total: 33 },
					enrollment: { endDay: null },
					members: [],
					assignments: [],
					date: '2026-09-26',
					nextDayAt: '2026-09-27T00:00:00Z'
				}
			]
		},
		refetch: state.refetch
	}),
	useEnrollHizb: () => ({}),
	useUpdateHizbAssignment: (groupId: string, id: string) => {
		state.update(groupId, id);
		return { mutate: state.mutate, isPending: state.isPending, isError: state.isError };
	}
}));
vi.mock('@/components/ReadingHelp/ReadingHelp.component', () => ({
	ReadingHelpPanel: 'ReadingHelpPanel',
	RequestHelpButton: 'RequestHelpButton'
}));
vi.mock('@/components/BeginnerGuide/BeginnerGuide.component', () => ({ BeginnerGuide: 'BeginnerGuide' }));
vi.mock('@/lib/hooks/useGroup', () => ({ useUpdateGroup: () => ({}) }));
vi.mock('@/lib/hooks/usePullToRefresh', () => ({ usePullToRefresh: () => ({}) }));
vi.mock('@/lib/theme/ThemeProvider.context', () => ({ useThemeContext: () => ({ theme: { colors: {} } }) }));
vi.mock('@/lib/i18n/I18n.context', () => ({ useTranslation: () => ({ t: (key: string) => key, language: 'nl' }) }));
vi.mock('@/components/BeginnerGuide/BeginnerGuide.component', () => ({ BeginnerGuide: 'BeginnerGuide' }));
vi.mock('@/components/ScreenContainer/ScreenContainer.component', () => ({ ScreenContainer: 'ScreenContainer' }));
vi.mock('@/components/ScreenHeader/ScreenHeader.component', () => ({ ScreenHeader: 'ScreenHeader' }));
vi.mock('@/components/ui/Button/Button.component', () => ({ AppButton: 'AppButton' }));
vi.mock('@/components/ui/CardSurface/CardSurface.component', () => ({ CardSurface: 'CardSurface' }));
vi.mock('@/components/ui/Icon/Icon.component', () => ({ Icon: 'Icon' }));
vi.mock('@/components/ui/Input/Input.component', () => ({ AppInput: 'AppInput' }));
vi.mock('@/components/ui/ProgressBar/ProgressBar.component', () => ({ ProgressBar: 'ProgressBar' }));
vi.mock('@/components/ui/Typography/Typography.component', () => ({
	BodyText: 'BodyText',
	CaptionText: 'CaptionText',
	NumericText: 'NumericText',
	TitleText: 'TitleText'
}));
vi.mock('@/components/ui/ToggleRow/ToggleRow.component', () => ({ ToggleRow: 'ToggleRow' }));
vi.mock('@/components/ui/ErrorState/ErrorState.component', () => ({ ErrorState: 'ErrorState' }));
vi.mock('./GroupDetailSkeleton.component', () => ({ GroupDetailSkeleton: 'GroupDetailSkeleton' }));
vi.mock('./ManageSheet.component', () => ({ ManageSheet: 'ManageSheet' }));
vi.mock('./MembersSheet.component', () => ({ MembersSheet: 'MembersSheet' }));
vi.mock('./ShareSheet.component', () => ({ ShareSheet: 'ShareSheet' }));
vi.mock('./HizbPlanOverview.component', () => ({ HizbPlanOverview: 'HizbPlanOverview' }));
vi.mock('./LeaveGroupButton.component', () => ({ LeaveGroupButton: 'LeaveGroupButton' }));

type Element = ReactElement<Record<string, any>>;
const elements = (node: ReactNode): Element[] =>
	React.Children.toArray(node).flatMap(child =>
		React.isValidElement<Record<string, any>>(child) ? [child, ...elements(child.props.children)] : []
	);
const render = () =>
	elements(
		HizbPlanGroup({
			group: { id: 'group-1', name: 'Reading group', hizbPlan: 33 },
			route: { params: {} },
			navigation: { navigate: state.navigate }
		} as any)
	);
const finishButton = () => render().find(node => node.props.title === 'hpFinishFromOverview');

beforeEach(() => {
	state.today = {
		id: 'today-1',
		planDays: 33,
		portion: 2,
		version: 4,
		completedAt: null,
		requiresSekine: false,
		requiresDelailRepetition: false,
		requiresIstighfar: false,
		istighfarRepetitions: 0,
		istighfarTarget: 33
	} as HizbAssignment;
	state.upcoming = [];
	state.isPending = false;
	state.isError = false;
});

describe('reading from a physical book', () => {
	it('completes today directly from the overview without opening the reader', () => {
		const button = finishButton();
		expect(button).toBeDefined();
		button!.props.onPress();
		expect(state.update).toHaveBeenCalledWith('group-1', 'today-1');
		expect(state.mutate).toHaveBeenCalledWith({ version: 4, read: true }, expect.any(Object));
		expect(state.navigate).not.toHaveBeenCalled();
	});
	it.each([11, 33, 100])('records the required repetitions including an istighfar target of %s', target => {
		Object.assign(state.today!, {
			requiresSekine: true,
			requiresDelailRepetition: true,
			requiresIstighfar: true,
			istighfarTarget: target
		});
		const button = finishButton();
		expect(button).toBeDefined();
		button!.props.onPress();
		expect(state.mutate).toHaveBeenCalledWith(
			{ version: 4, read: true, repetitions: 19, delailRepetitions: 3, istighfarRepetitions: target },
			expect.any(Object)
		);
		expect(render().some(node => node.props.children === 'hpFinishFromOverviewHint')).toBe(true);
	});
	it('preserves an istighfar count above the selected target', () => {
		Object.assign(state.today!, { requiresIstighfar: true, istighfarRepetitions: 100, istighfarTarget: 33 });
		finishButton()!.props.onPress();
		expect(state.mutate).toHaveBeenCalledWith(
			{ version: 4, read: true, istighfarRepetitions: 100 },
			expect.any(Object)
		);
	});
	it('blocks duplicate presses while saving', () => {
		state.isPending = true;
		expect(finishButton()?.props.isLoading).toBe(true);
		finishButton()!.props.onPress();
		expect(state.mutate).not.toHaveBeenCalled();
	});
	it('hides the completion action when already complete or no assignment exists', () => {
		state.today!.completedAt = '2026-09-26T12:00:00Z';
		expect(finishButton()).toBeUndefined();
		state.today = null;
		expect(finishButton()).toBeUndefined();
	});
	it('shows a save error and refreshes the assignment version for retry', () => {
		state.isError = true;
		expect(render().some(node => node.props.children === 'hpError')).toBe(true);
		finishButton()!.props.onPress();
		state.mutate.mock.calls[0][1].onError();
		expect(state.refetch).toHaveBeenCalledOnce();
	});
});

describe('saved reading status and upcoming readings', () => {
	it('shows a prominent saved status and a separate reopen action for today', () => {
		state.today!.completedAt = '2026-09-26T12:00:00Z';
		const tree = render();
		expect(tree.some(node => node.props.children === 'hpTodayDone' && node.props.weight === 'semibold')).toBe(true);
		const reopen = tree.find(node => node.props.title === 'hpReadAgain');
		expect(reopen).toBeDefined();
		reopen!.props.onPress();
		expect(state.navigate).toHaveBeenCalledWith('HizbPlanReader', { groupId: 'group-1', assignmentId: 'today-1' });
	});
	it('opens the next unread future assignment and displays both saved states', () => {
		state.upcoming = [
			{ ...state.today!, id: 'future-done', date: '2026-09-27', completedAt: '2026-09-26T12:00:00Z' },
			{ ...state.today!, id: 'future-pending', date: '2026-09-28', completedAt: null }
		];
		const tree = render();
		const ahead = tree.find(node => node.props.title === 'hpReadAhead');
		expect(ahead).toBeDefined();
		ahead!.props.onPress();
		expect(state.navigate).toHaveBeenCalledWith('HizbPlanReader', {
			groupId: 'group-1',
			assignmentId: 'future-pending'
		});
		const cards = tree.filter(node => node.type === 'CardSurface' && node.props.onPress);
		expect(cards).toHaveLength(2);
		expect(elements(cards[0].props.children).some(node => node.props.children === 'hpTodayDone')).toBe(true);
		expect(elements(cards[1].props.children).some(node => node.props.children === 'hpTodayPending')).toBe(true);
		cards[0].props.onPress();
		expect(state.navigate).toHaveBeenLastCalledWith('HizbPlanReader', {
			groupId: 'group-1',
			assignmentId: 'future-done'
		});
	});
});
