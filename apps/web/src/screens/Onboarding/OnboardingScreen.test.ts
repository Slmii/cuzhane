import React, { type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingScreen } from './OnboardingScreen.component';

const state = vi.hoisted(() => ({ page: 0, mutate: vi.fn(), markOnboarded: vi.fn() }));
vi.mock('react', async original => ({
	...(await original<typeof import('react')>()),
	useState: () => [
		state.page,
		(next: number | ((current: number) => number)) => {
			state.page = typeof next === 'function' ? next(state.page) : next;
		}
	]
}));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable', StyleSheet: { create: (s: unknown) => s } }));
vi.mock('@/components/ScreenContainer/ScreenContainer.component', () => ({ ScreenContainer: 'ScreenContainer' }));
vi.mock('@/components/ui/Button/Button.component', () => ({ AppButton: 'AppButton' }));
vi.mock('@/components/ui/Icon/Icon.component', () => ({ Icon: 'Icon' }));
vi.mock('@/components/ui/Typography/Typography.component', () => ({
	BodyText: 'BodyText',
	Header1: 'Header1',
	Typography: 'Typography'
}));
vi.mock('@/lib/theme/ThemeProvider.context', () => ({ useThemeContext: () => ({ theme: { colors: {} } }) }));
vi.mock('@/lib/i18n/I18n.context', () => ({
	useTranslation: () => ({
		t: (key: string, params?: unknown) => (params ? `${key}:${JSON.stringify(params)}` : key)
	})
}));
vi.mock('@/lib/hooks/useUserSettings', () => ({ useUpdateUserSettings: () => ({ mutate: state.mutate }) }));
vi.mock('@/lib/utils/onboardingLaunch', () => ({ markOnboardedThisLaunch: state.markOnboarded }));

type Element = ReactElement<Record<string, any>>;
const elements = (node: ReactNode): Element[] =>
	React.Children.toArray(node).flatMap(child =>
		React.isValidElement<Record<string, any>>(child) ? [child, ...elements(child.props.children)] : []
	);
const render = (isReplay = false) => {
	const navigation = { canGoBack: () => isReplay, goBack: vi.fn(), replace: vi.fn() };
	const nodes = elements(OnboardingScreen({ navigation } as any));
	const press = (label: string) => {
		const button = nodes.find(
			node =>
				node.props.title === label ||
				(node.type === ('Pressable' as any) &&
					elements(node.props.children).some(child => child.props.children === label))
		);
		expect(button, `button ${label}`).toBeDefined();
		button!.props.onPress();
	};
	return { navigation, nodes, press };
};

beforeEach(() => {
	state.page = 0;
});
describe('simple first-use guide', () => {
	it('shows one explanation at a time with a four-step count', () => {
		const { nodes } = render();
		expect(nodes.filter(node => node.type === ('Header1' as any))).toHaveLength(1);
		expect(nodes.some(node => node.props.children === 'obStepOf:{"step":1,"total":4}')).toBe(true);
		expect(state.mutate).not.toHaveBeenCalled();
	});
	it('moves forward and back without saving progress as complete', () => {
		render().press('obNext');
		expect(state.page).toBe(1);
		render().press('tourBack');
		expect(state.page).toBe(0);
		expect(state.mutate).not.toHaveBeenCalled();
	});
	it('lets a newcomer leave early and opens the app', () => {
		const { press, navigation } = render();
		press('quickStartLater');
		expect(state.mutate).toHaveBeenCalledWith({ hasSeenOnboarding: true });
		expect(state.markOnboarded).toHaveBeenCalledOnce();
		expect(navigation.replace).toHaveBeenCalledWith('Tabs');
	});
	it('finishes on the fourth step', () => {
		state.page = 3;
		const { press, navigation } = render();
		press('quickStartFinish');
		expect(navigation.replace).toHaveBeenCalledWith('Tabs');
	});
	it('returns a replay to its entry point without changing first-use settings', () => {
		const { press, navigation } = render(true);
		press('quickStartLater');
		expect(navigation.goBack).toHaveBeenCalledOnce();
		expect(state.mutate).not.toHaveBeenCalled();
		expect(state.markOnboarded).not.toHaveBeenCalled();
	});
});
