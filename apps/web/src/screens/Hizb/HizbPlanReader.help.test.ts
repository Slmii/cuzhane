import React, { type ReactElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { HizbPlanReader } from './HizbPlanReader.component';
const state = vi.hoisted(() => ({ bookmark: 0, mutate: vi.fn(), setState: vi.fn() }));
vi.mock('react', async original => ({
	...(await original<typeof import('react')>()),
	useContext: () => 0,
	useMemo: (fn: () => unknown) => fn(),
	useRef: () => ({ current: null }),
	useState: (value: unknown) => [value, state.setState]
}));
vi.mock('react-native', () => ({ View: 'View', ScrollView: 'ScrollView', StyleSheet: { create: (s: unknown) => s } }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
vi.mock('expo-haptics', () => ({ impactAsync: () => Promise.resolve(), ImpactFeedbackStyle: {} }));
vi.mock('@/navigation/TabBarOffsetContext', () => ({ TabBarOffsetContext: {} }));
vi.mock('@/lib/hooks/useHizbReading', () => ({
	useHizbAssignment: () => ({
		data: {
			id: 'a',
			version: 2,
			planDays: 32,
			portion: 2,
			date: '2026-09-26',
			bookmark: state.bookmark,
			canEdit: false,
			completedAt: null
		}
	}),
	useUpdateHizbAssignment: () => ({ mutate: state.mutate, isPending: false }),
	useHizbReading: () => ({ data: undefined })
}));
vi.mock('@/lib/content/hizbDelail', () => ({ DELAIL_REPETITIONS: 3, splitDelailRepetition: () => null }));
vi.mock('@/lib/content/hizbIstighfar', () => ({ splitIstighfar: () => null }));
vi.mock('@/lib/content/hizbSekine', () => ({ SEKINE_REPETITIONS: 19, splitSekine: () => null }));
vi.mock('@/components/Hints/HintScroll.context', () => ({ HintScrollProvider: 'HintScrollProvider' }));
vi.mock('@/components/Hints/useHintScreen', () => ({ useHintScreen: () => undefined }));
vi.mock('@/lib/hooks/useHizbPlanText', () => ({
	useHizbPlanText: () => ({ monthDay: () => '', portionsLabel: () => [] })
}));
vi.mock('@/lib/utils/groups', () => ({ hizbPartsLabel: () => '' }));
vi.mock('@/lib/utils/hizbAhead', () => ({ canUndoHizbDay: () => true }));
vi.mock('@/lib/utils/hizbPlanLabels', () => ({ hizbPlanDescriptionKey: () => 'desc' }));
vi.mock('@/screens/Reader/textSizeSheet', () => ({
	textSizeSheet: () => ({ isVisible: false, close: () => undefined })
}));
vi.mock('./HizbPlanReaderSkeleton.component', () => ({ HizbPlanReaderSkeleton: 'HizbPlanReaderSkeleton' }));
vi.mock('@/lib/hooks/useUserSettings', () => ({
	useGetUserSettings: () => ({}),
	useUpdateUserSettings: () => ({ mutate: vi.fn() })
}));
vi.mock('@/lib/i18n/I18n.context', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/theme/ThemeProvider.context', () => ({ useThemeContext: () => ({ theme: { colors: {} } }) }));
vi.mock('@/lib/content/cevsen', () => ({ READER_FONT_SIZE_DEFAULT: 24 }));
vi.mock('@/lib/content/hizbPlans', () => ({
	planBlocks: () => [0, 1, 2].map(() => ({ sectionIndex: 0, block: { lines: [] } }))
}));
vi.mock('@/lib/content/hizbulhakaik', () => ({ HIZB_SECTIONS: [{ title: 'Reading' }], isCevsenSection: () => false }));
vi.mock('@/components/ui/Button/Button.component', () => ({ AppButton: 'AppButton' }));
vi.mock('@/components/ui/Icon/Icon.component', () => ({ Icon: 'Icon' }));
vi.mock('@/components/ui/Typography/Typography.component', () => ({
	BodyText: 'BodyText',
	CaptionText: 'CaptionText',
	EyebrowText: 'EyebrowText',
	TitleText: 'TitleText'
}));
vi.mock('@/components/ui/ErrorState/ErrorState.component', () => ({ ErrorState: 'ErrorState' }));
vi.mock('@/components/RepetitionCounter/RepetitionCounter.component', () => ({
	RepetitionCounter: 'RepetitionCounter'
}));
vi.mock('@/screens/Reader/TextSizeSheet.component', () => ({ TextSizeSheet: 'TextSizeSheet' }));
vi.mock('@/screens/Reader/ReaderSkeleton.component', () => ({ ReaderSkeleton: 'ReaderSkeleton' }));
vi.mock('./HizbBody.component', () => ({ HizbBody: 'HizbBody' }));
type Element = ReactElement<Record<string, any>>;
const elements = (node: ReactNode): Element[] =>
	React.Children.toArray(node).flatMap(c =>
		React.isValidElement<Record<string, any>>(c) ? [c, ...elements(c.props.children)] : []
	);
const render = () => {
	const entry = HizbPlanReader({
		navigation: {},
		route: { params: { groupId: 'g', assignmentId: 'a' } }
	} as any) as Element;
	return elements((entry.type as (props: any) => ReactNode)(entry.props));
};
it('lets the requester turn pages locally while the helper exclusively controls completion', () => {
	const next = render().find(n => n.props.accessibilityLabel === 'abNext')!;
	expect(next.props.disabled).toBeFalsy();
	next.props.onPress();
	expect(state.setState).toHaveBeenCalledWith(1);
	expect(state.mutate).not.toHaveBeenCalled();
	// The last page carries the finish button, which stays the helper's.
	state.bookmark = 2;
	const nodes = render();
	expect(nodes.find(n => n.props.title === 'hpFinish')!.props.disabled).toBe(true);
	expect(nodes.some(n => n.type === 'CaptionText' && n.props.children === 'helpClaimed')).toBe(true);
});
