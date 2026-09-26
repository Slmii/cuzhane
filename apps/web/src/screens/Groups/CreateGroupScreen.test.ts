import React, { type ReactElement, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { createFormControl } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGroupSchema, type GroupForm } from '@/lib/schemas/group.schema';
import { CreateGroupScreen } from './CreateGroupScreen.component';

const state = vi.hoisted(() => ({
	setStep: vi.fn(),
	mutate: vi.fn(),
	isError: false
}));

vi.mock('react', async importOriginal => ({
	...(await importOriginal<typeof import('react')>()),
	useMemo: (factory: () => unknown) => factory(),
	useState: (initial: unknown) => [initial === 1 ? 4 : initial, state.setStep]
}));
vi.mock('react-native', () => ({ View: 'View', ScrollView: 'ScrollView', StyleSheet: { create: (s: unknown) => s } }));
vi.mock('@/lib/hooks/useGroup', () => ({ useCreateGroup: () => ({ ...state, isPending: false }) }));
vi.mock('@/lib/theme/ThemeProvider.context', () => ({ useThemeContext: () => ({ theme: { colors: {} } }) }));
vi.mock('@/lib/i18n/I18n.context', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/PlanPreview/PlanPreview.component', () => ({ PlanPreview: 'PlanPreview' }));
vi.mock('@/components/ui/BottomSheet/BottomSheet.component', () => ({ AppBottomSheet: 'AppBottomSheet' }));
vi.mock('@/components/ui/CardSurface/CardSurface.component', () => ({ CardSurface: 'CardSurface' }));
vi.mock('@/components/ui/Form/Field/Field.component', () => ({ Field: 'Field' }));
vi.mock('@/components/ui/Form/Form.component', () => ({ Form: 'Form' }));
vi.mock('@/components/ui/Form/KindOptionGroup/KindOptionGroup.component', () => ({
	FormKindOptionGroup: 'FormKindOptionGroup'
}));
vi.mock('@/components/ui/Form/OptionGroup/OptionGroup.component', () => ({ FormOptionGroup: 'FormOptionGroup' }));
vi.mock('@/components/ui/Form/Select/Select.component', () => ({ Select: 'Select' }));
vi.mock('@/components/ui/Form/Stepper/Stepper.component', () => ({ FormStepper: 'FormStepper' }));
vi.mock('@/components/ui/ToggleRow/ToggleRow.component', () => ({ ToggleRow: 'ToggleRow' }));
vi.mock('@/components/ui/Icon/Icon.component', () => ({ Icon: 'Icon' }));
vi.mock('@/components/ui/SpotsGrid/SpotsGrid.component', () => ({ SpotsGrid: 'SpotsGrid' }));
vi.mock('@/components/ui/Typography/Typography.component', () => ({
	BodyText: 'BodyText',
	CaptionText: 'CaptionText',
	FieldLabelText: 'FieldLabelText'
}));
vi.mock('./CreateGroupStepHeader.component', () => ({ CreateGroupStepHeader: 'CreateGroupStepHeader', LAST_STEP: 4 }));
vi.mock('./CreatingGroupStep.component', () => ({ CreatingGroupStep: 'CreatingGroupStep' }));

type Element = ReactElement<Record<string, any>>;
const elements = (node: ReactNode): Element[] =>
	React.Children.toArray(node).flatMap(child => {
		if (!React.isValidElement<Record<string, any>>(child)) {
			return [];
		}
		return [child, ...elements(child.props.children)];
	});

const renderLastStep = (values: Partial<GroupForm> = {}) => {
	const screen = CreateGroupScreen({ navigation: { canGoBack: () => true, goBack: vi.fn(), popTo: vi.fn() } } as any);
	const form = elements(screen).find(node => node.type === ('Form' as any))!;
	const methods = createFormControl<GroupForm>({
		defaultValues: { ...form.props.defaultValues, kind: 'HIZB', spots: 33, name: 'Test Hizb', ...values },
		resolver: zodResolver(createGroupSchema(key => key)) as any
	});
	const content = form.props.render(methods);
	const header = elements(content).find(node => node.type === ('CreateGroupStepHeader' as any))!;
	return { content, submit: header.props.onNext };
};

beforeEach(() => {
	state.isError = false;
});

describe('Hizb creation final step', () => {
	it.each([false, true])('submits with automatic removal enabled: %s', async inactivityEnabled => {
		const { submit } = renderLastStep({ inactivityEnabled, inactivityDays: 12 });
		await submit();
		expect(state.mutate).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 'HIZB',
				hizbPlan: 33,
				inactivityDays: inactivityEnabled ? 12 : null
			}),
			expect.any(Object)
		);
	});
	it('shows a creation failure while keeping the final button available for retry', async () => {
		state.isError = true;
		const { content, submit } = renderLastStep();
		expect(elements(content).some(node => node.props.children === 'groupCreateError')).toBe(true);
		await submit();
		expect(state.mutate).toHaveBeenCalledOnce();
	});
	it('returns to the name step when submission finds an error in an earlier step', async () => {
		const { submit } = renderLastStep({ name: '' });
		await submit();
		expect(state.mutate).not.toHaveBeenCalled();
		expect(state.setStep).toHaveBeenCalledWith(2);
	});
});
