import React, { type ReactElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ReadingHelpPanel, RequestHelpButton } from './ReadingHelp.component';
import type { ReadingHelp } from '@/api/readingHelp.api';
const state = vi.hoisted(() => ({
	requests: [] as ReadingHelp[],
	mutate: vi.fn(),
	request: vi.fn(),
	open: vi.fn(),
	pending: false,
	error: false
}));
vi.mock('react-native', () => ({ View: 'View', StyleSheet: { create: (s: unknown) => s } }));
vi.mock('@/lib/hooks/useReadingHelp', () => ({
	useReadingHelp: () => ({ data: state.requests, isError: state.error, refetch: vi.fn() }),
	useRequestReadingHelp: () => ({ mutate: state.request, isPending: state.pending }),
	useActOnReadingHelp: () => ({ mutate: state.mutate, isPending: state.pending })
}));
vi.mock('@/lib/theme/ThemeProvider.context', () => ({ useThemeContext: () => ({ theme: { colors: {} } }) }));
vi.mock('@/lib/i18n/I18n.context', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/ui/Button/Button.component', () => ({ AppButton: 'AppButton' }));
vi.mock('@/components/ui/CardSurface/CardSurface.component', () => ({ CardSurface: 'CardSurface' }));
vi.mock('@/components/ui/Icon/Icon.component', () => ({ Icon: 'Icon' }));
vi.mock('@/components/ui/Typography/Typography.component', () => ({
	BodyText: 'BodyText',
	CaptionText: 'CaptionText',
	TitleText: 'TitleText'
}));
type Element = ReactElement<Record<string, any>>;
const elements = (node: ReactNode): Element[] =>
	React.Children.toArray(node).flatMap(c =>
		React.isValidElement<Record<string, any>>(c) ? [c, ...elements(c.props.children)] : []
	);
const render = () => elements(ReadingHelpPanel({ groupId: 'g', onOpen: state.open }));
const button = (title: string) => render().find(n => n.props.title === title);
beforeEach(() => {
	state.pending = false;
	state.error = false;
	state.requests = [
		{
			id: 'r',
			version: 2,
			mine: false,
			claimed: false,
			takenByMe: false,
			completed: false,
			babNumbers: [1, 2],
			remainingNumbers: [1, 2],
			roundIndex: 0,
			assignmentId: null,
			kind: 'CEVSEN'
		} as ReadingHelp
	];
});
it('requests help for the exact assignment without marking it read', () => {
	const nodes = elements(RequestHelpButton({ groupId: 'g', target: { assignmentId: 'a' }, today: true }));
	nodes.find(n => n.props.title === 'helpToday')!.props.onPress();
	expect(state.request).toHaveBeenCalledWith({ assignmentId: 'a' });
	expect(state.mutate).not.toHaveBeenCalled();
});
it('claiming does not complete or open the reading before the claim succeeds', () => {
	button('helpTake')!.props.onPress();
	expect(state.mutate).toHaveBeenCalledWith({ id: 'r', version: 2, action: 'claim' });
	expect(button('helpFinish')).toBeUndefined();
	expect(state.open).not.toHaveBeenCalled();
});
it('only the helper can open, finish, or release the reading', () => {
	state.requests[0]!.claimed = true;
	state.requests[0]!.takenByMe = true;
	button('helpRead')!.props.onPress();
	expect(state.open).toHaveBeenCalledWith(state.requests[0]);
	button('helpFinish')!.props.onPress();
	expect(state.mutate).toHaveBeenCalledWith({ id: 'r', version: 2, action: 'complete' });
	button('helpRelease')!.props.onPress();
	expect(state.mutate).toHaveBeenCalledWith({ id: 'r', version: 2, action: 'release' });
	state.requests[0]!.takenByMe = false;
	expect(button('helpFinish')).toBeUndefined();
	expect(button('helpTake')).toBeUndefined();
});
it('shows the requester a cancel action and completed readings a checkmark', () => {
	state.requests[0]!.mine = true;
	button('helpCancel')!.props.onPress();
	expect(state.mutate).toHaveBeenCalledWith({ id: 'r', version: 2, action: 'cancel' });
	state.requests[0]!.completed = true;
	expect(button('helpCancel')).toBeUndefined();
	expect(render().some(n => String(n.props.children).includes('helpCompleted'))).toBe(true);
});
it('disables actions while saving and offers retry when loading fails', () => {
	state.pending = true;
	expect(button('helpTake')!.props.disabled).toBe(true);
	state.error = true;
	expect(button('retry')).toBeDefined();
});

it('allows requesting more passages in the same round after a previous request completed', () => {
	state.requests[0]!.mine = true;
	state.requests[0]!.completed = true;
	const nodes = elements(RequestHelpButton({ groupId: 'g', target: { roundIndex: 0 }, today: true }));
	expect(nodes.some(n => n.props.title === 'helpToday')).toBe(true);
});
