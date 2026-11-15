import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The app's state is the test's to set; the socket is a fake that records what was made.
const appState = vi.hoisted(() => ({
	current: 'active',
	listener: null as ((next: string) => void) | null
}));

vi.mock('react-native', () => ({
	AppState: {
		addEventListener: (_type: string, listener: (next: string) => void) => {
			appState.listener = listener;

			return { remove: () => undefined };
		},
		get currentState() {
			return appState.current;
		}
	}
}));
vi.mock('@/api/wrapper.api', () => ({ resolveAuthToken: vi.fn(async () => 'token') }));
vi.mock('@/lib/constants', () => ({ API_BASE_URL: 'http://api.test' }));

class FakeSocket {
	static OPEN = 1;
	static made: FakeSocket[] = [];
	readyState = 0;
	onopen: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;
	onclose: ((event: { code: number }) => void) | null = null;
	close = vi.fn();
	send = vi.fn();

	constructor() {
		FakeSocket.made.push(this);
	}
}

const { openLiveConnection } = await import('@/lib/utils/liveConnection');

const handlers = () => ({ onFrame: vi.fn(), onGone: vi.fn(), onState: vi.fn() });

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('WebSocket', FakeSocket);
	FakeSocket.made = [];
	appState.current = 'active';
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('live connection — held for voice in the background', () => {
	it('cancels a pending reconnect when the hold is released in the background', () => {
		const connection = openLiveConnection('ABCD2345', handlers());

		connection.hold(true);
		appState.current = 'background';
		appState.listener?.('background');

		// The socket dropped while held: a reconnect is scheduled.
		FakeSocket.made[0]?.onclose?.({ code: 1006 });
		expect(FakeSocket.made).toHaveLength(1);

		connection.hold(false);
		vi.advanceTimersByTime(60_000);

		expect(FakeSocket.made).toHaveLength(1);
		connection.close();
	});

	it('lets go of the socket in the background once the hold is released', () => {
		const connection = openLiveConnection('ABCD2345', handlers());

		connection.hold(true);
		appState.current = 'background';
		appState.listener?.('background');
		expect(FakeSocket.made[0]?.close).not.toHaveBeenCalled();

		connection.hold(false);
		expect(FakeSocket.made[0]?.close).toHaveBeenCalled();
		connection.close();
	});

	it('does not reconnect in the background on a timer set while it was active', () => {
		const connection = openLiveConnection('ABCD2345', handlers());

		FakeSocket.made[0]?.onclose?.({ code: 1006 });
		appState.current = 'background';
		appState.listener?.('background');
		vi.advanceTimersByTime(60_000);

		expect(FakeSocket.made).toHaveLength(1);
		connection.close();
	});
});
