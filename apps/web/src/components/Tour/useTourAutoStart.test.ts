import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTourAutoStart } from './useTourAutoStart';

const state = vi.hoisted(() => ({
	isNewcomer: false,
	isFocused: true,
	isBlocked: false,
	start: vi.fn(),
	setSubject: vi.fn()
}));
vi.mock('react', () => ({ useEffect: (effect: () => void) => effect(), useRef: (current: unknown) => ({ current }) }));
vi.mock('@react-navigation/native', () => ({ useIsFocused: () => state.isFocused }));
vi.mock('@/lib/utils/onboardingLaunch', () => ({ didOnboardThisLaunch: () => state.isNewcomer }));
vi.mock('./Tour.context', () => ({
	useShouldAutoStartTour: () => true,
	useTour: () => ({ ...state, isActive: false })
}));

beforeEach(() => {
	state.isNewcomer = false;
	state.isFocused = true;
	state.isBlocked = false;
});
describe('automatic detailed tour', () => {
	it('does not stack another introduction after the short first-use guide', () => {
		state.isNewcomer = true;
		useTourAutoStart({ subject: null });
		expect(state.start).not.toHaveBeenCalled();
	});
	it('still offers the tour to a returning reader who has not seen it', () => {
		useTourAutoStart({ subject: null });
		expect(state.start).toHaveBeenCalledOnce();
	});
	it('waits while the splash is visible', () => {
		state.isBlocked = true;
		useTourAutoStart({ subject: null });
		expect(state.start).not.toHaveBeenCalled();
	});
	it('waits while another screen has focus', () => {
		state.isFocused = false;
		useTourAutoStart({ subject: null });
		expect(state.start).not.toHaveBeenCalled();
	});
});
