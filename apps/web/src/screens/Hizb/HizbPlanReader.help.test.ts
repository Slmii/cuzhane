import React, { type ReactElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { HizbPlanReader } from './HizbPlanReader.component';
const state = vi.hoisted(() => ({ mutate: vi.fn(), setState: vi.fn() }));
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
vi.mock('@/navigation/TabBarOffsetContext', () => ({ TabBarOffsetContext: {} }));
vi.mock('@/lib/hooks/useHizbReading', () => ({
	useHizbAssignment: () => ({
		data: {
			id: 'a',
			version: 2,
			planDays: 33,
			portion: 2,
			date: '2026-09-26',
			bookmark: 0,
			canEdit: false,
			completedAt: null
		}
	}),
	useUpdateHizbAssignment: () => ({ mutate: state.mutate })
}));
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
vi.mock('@/components/ui/Typography/Typography.component', () => ({
	BodyText: 'BodyText',
	CaptionText: 'CaptionText',
	TitleText: 'TitleText'
}));
vi.mock('@/components/ui/ErrorState/ErrorState.component', () => ({ ErrorState: 'ErrorState' }));
vi.mock('@/components/RepetitionCounter/RepetitionCounter.component', () => ({
	RepetitionCounter: 'RepetitionCounter'
}));
vi.mock('@/screens/Reader/TextSizeSheet.component', () => ({ TextSizeSheet: 'TextSizeSheet' }));
vi.mock('@/screens/Groups/GroupDetailSkeleton.component', () => ({ GroupDetailSkeleton: 'GroupDetailSkeleton' }));
vi.mock('./HizbBody.component', () => ({ HizbBody: 'HizbBody' }));
type Element = ReactElement<Record<string, any>>;
const elements = (node: ReactNode): Element[] =>
	React.Children.toArray(node).flatMap(c =>
		React.isValidElement<Record<string, any>>(c) ? [c, ...elements(c.props.children)] : []
	);
it('lets the requester turn pages locally while the helper exclusively controls completion', () => {
	const entry = HizbPlanReader({ route: { params: { groupId: 'g', assignmentId: 'a' } } } as any);
	const nodes = elements((entry.type as (props: any) => ReactNode)(entry.props));
	const next = nodes.find(n => n.props.accessibilityLabel === 'abNext')!;
	expect(next.props.disabled).toBeFalsy();
	next.props.onPress();
	expect(state.setState).toHaveBeenCalledWith(1);
	expect(state.mutate).not.toHaveBeenCalled();
	expect(nodes.find(n => n.props.title === 'hpFinish')!.props.disabled).toBe(true);
});
