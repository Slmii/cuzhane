import { STRINGS } from '@/lib/i18n/strings';
import { describe, expect, it } from 'vitest';
import { hintQueue, isTargetVisible, type HintQueueInput, type HintRect } from './hintQueue';
import { HINT_ID_PATTERN, HINTS, LEGACY_TOUR_HINT_IDS, WELCOME_HINT_ID } from './hints';

const WINDOW = { height: 800, width: 400 };
const ON_SCREEN: HintRect = { height: 40, width: 200, x: 20, y: 300 };

const queue = (overrides: Partial<HintQueueInput> = {}) =>
	hintQueue({
		blockers: { isKeyboardUp: false, isLive: false, isOverlayOpen: false, isSplashVisible: false },
		hints: HINTS,
		isEnabled: true,
		rects: {},
		screen: 'home',
		seenIds: new Set(),
		window: WINDOW,
		...overrides
	}).map(hint => hint.id);

describe('the hint registry', () => {
	it('gives every hint a valid id, used once', () => {
		const ids = HINTS.map(hint => hint.id);

		expect(new Set(ids).size).toBe(ids.length);

		for (const id of ids) {
			expect(id).toMatch(HINT_ID_PATTERN);
		}
	});

	it('has copy for every hint in every language', () => {
		for (const strings of Object.values(STRINGS)) {
			for (const hint of HINTS) {
				expect(strings[hint.titleKey]).toBeTruthy();
				expect(strings[hint.bodyKey]).toBeTruthy();
			}
		}
	});

	it('counts only the welcome as seen for the old tour’s finishers, as the server does', () => {
		expect([...LEGACY_TOUR_HINT_IDS]).toEqual(['welcome']);

		for (const id of LEGACY_TOUR_HINT_IDS) {
			expect(HINTS.some(hint => hint.id === id)).toBe(true);
		}
	});

	it('centres only the welcome and the pages’ explainers, one per page', () => {
		const centred = HINTS.filter(hint => hint.target === null);

		expect(centred.map(hint => hint.id)).toEqual([
			WELCOME_HINT_ID,
			'pool.intro',
			'rounds.intro',
			'roundDetail.intro',
			'hizbMissed.intro',
			'planHistory.intro',
			'groupHistory.intro'
		]);
		expect(new Set(centred.map(hint => hint.screen)).size).toBe(centred.length);
	});

	it('gives each screen’s hints their own places in its sequence', () => {
		const places = HINTS.map(hint => `${hint.screen} ${hint.order}`);

		expect(new Set(places).size).toBe(places.length);
	});
});

describe('hintQueue', () => {
	it('shows the welcome first on Ana sayfa, on its own', () => {
		expect(queue({ rects: { nextCard: ON_SCREEN } })).toEqual(['welcome']);
	});

	it('follows the welcome with the screen’s own hints once it is seen', () => {
		expect(queue({ rects: { nextCard: ON_SCREEN }, seenIds: new Set(['welcome']) })).toEqual(['home.nextCard']);
	});

	it('plays a screen’s hints in their order, top to bottom, and only that screen’s', () => {
		expect(
			queue({
				rects: { newGroup: ON_SCREEN, readMark: ON_SCREEN, readerMap: ON_SCREEN, textSize: ON_SCREEN },
				screen: 'reader'
			})
		).toEqual(['reader.textSize', 'reader.map', 'reader.readMark']);
	});

	it('explains each item of Gruplarım’s menu on the + itself', () => {
		expect(queue({ rects: { newGroup: ON_SCREEN }, screen: 'groups' })).toEqual([
			'groups.newGroup',
			'groups.menuNew',
			'groups.menuCode',
			'groups.menuLive'
		]);
	});

	it('shows a page’s explainer with nothing to point at', () => {
		expect(queue({ screen: 'pool' })).toEqual(['pool.intro']);
		expect(queue({ screen: 'rounds', seenIds: new Set(['rounds.intro']) })).toEqual([]);
	});

	it('takes a section that comes later on its own, once it is there', () => {
		const seenIds = new Set(['hizbGroup.clock', 'hizbGroup.today']);

		expect(queue({ rects: { planClock: ON_SCREEN }, screen: 'hizbGroup', seenIds })).toEqual([]);
		expect(queue({ rects: { planAhead: ON_SCREEN }, screen: 'hizbGroup', seenIds })).toEqual(['hizbGroup.ahead']);
	});

	it('leaves out what has been seen', () => {
		expect(
			queue({
				rects: { readMark: ON_SCREEN, readerMap: ON_SCREEN },
				screen: 'reader',
				seenIds: new Set(['reader.map'])
			})
		).toEqual(['reader.readMark']);
	});

	it('shows nothing when hints are turned off', () => {
		expect(queue({ isEnabled: false })).toEqual([]);
		expect(queue({ isEnabled: false, rects: { newGroup: ON_SCREEN }, screen: 'groups' })).toEqual([]);
	});

	it('shows nothing while no screen is focused', () => {
		expect(queue({ screen: null })).toEqual([]);
	});

	it('waits for a target that is not there yet', () => {
		expect(queue({ screen: 'groups' })).toEqual([]);
		expect(queue({ rects: { readMark: ON_SCREEN }, screen: 'reader' })).toEqual(['reader.readMark']);
	});

	it('waits for a target that is off screen', () => {
		expect(queue({ rects: { cuzGrid: { ...ON_SCREEN, y: 900 } }, screen: 'pickCuz' })).toEqual([]);
		expect(queue({ rects: { cuzGrid: { ...ON_SCREEN, x: 420 } }, screen: 'pickCuz' })).toEqual([]);
		expect(queue({ rects: { cuzGrid: { ...ON_SCREEN, y: -60 } }, screen: 'pickCuz' })).toEqual([]);
	});

	it('takes a target below the fold that its scroll view will bring into view', () => {
		expect(queue({ rects: { counter: { ...ON_SCREEN, canScroll: true, y: 1400 } }, screen: 'hizbReader' })).toEqual(
			['hizbReader.counter']
		);
	});

	it.each([['isSplashVisible'], ['isOverlayOpen'], ['isLive'], ['isKeyboardUp']] as const)(
		'waits while %s',
		blocker => {
			const blockers = { isKeyboardUp: false, isLive: false, isOverlayOpen: false, isSplashVisible: false };

			expect(queue({ blockers: { ...blockers, [blocker]: true } })).toEqual([]);
			expect(
				queue({
					blockers: { ...blockers, [blocker]: true },
					rects: { liveButton: ON_SCREEN },
					screen: 'freeReader'
				})
			).toEqual([]);
		}
	);
});

describe('isTargetVisible', () => {
	it('needs a laid-out box', () => {
		expect(isTargetVisible(undefined, WINDOW)).toBe(false);
		expect(isTargetVisible({ ...ON_SCREEN, height: 0, width: 0 }, WINDOW)).toBe(false);
		expect(isTargetVisible(ON_SCREEN, WINDOW)).toBe(true);
	});
});
