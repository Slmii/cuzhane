import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPlacePatch, mergePlacePatch, placeIn, queueReadingPlaceSave } from './readingPlaces';

const sent: { groupId: string; unitNumber: number; patch: object }[] = [];
let release: (() => void) | null = null;

// Each save waits until the test lets it through, so a turn can land while one is in flight.
vi.mock('@/api/groups.api', () => ({
	saveReadingPlace: (save: { groupId: string; unitNumber: number; patch: object }) => {
		sent.push(save);

		return new Promise<void>(resolve => {
			release = resolve;
		});
	}
}));

const flush = async () => {
	release?.();
	release = null;
	await new Promise(resolve => setTimeout(resolve, 0));
};

describe('mergePlacePatch', () => {
	it('keeps the later place and the higher counts', () => {
		expect(mergePlacePatch({ position: 3, textPagesRead: 5 }, { position: 4, textPagesRead: 2 })).toEqual({
			husrevPagesRead: undefined,
			position: 4,
			textPagesRead: 5
		});
		expect(mergePlacePatch({ position: 3 }, { husrevPagesRead: 1 })).toEqual({
			husrevPagesRead: 1,
			position: 3,
			textPagesRead: undefined
		});
	});
});

describe('applyPlacePatch', () => {
	it('adds a unit in order, and raises counts without lowering them', () => {
		const once = applyPlacePatch(undefined, 2, 9, { position: 4 });
		expect(once).toEqual({
			places: [{ husrevPagesRead: 0, position: 4, textPagesRead: 0, unitNumber: 9 }],
			roundIndex: 2
		});

		const twice = applyPlacePatch(once, 2, 3, { textPagesRead: 6 });
		const thrice = applyPlacePatch(twice, 2, 3, { position: 2, textPagesRead: 1 });
		expect(thrice?.places).toEqual([
			{ husrevPagesRead: 0, position: 2, textPagesRead: 6, unitNumber: 3 },
			{ husrevPagesRead: 0, position: 4, textPagesRead: 0, unitNumber: 9 }
		]);
	});

	it('leaves another round’s places alone', () => {
		const cached = { places: [], roundIndex: 1 };
		expect(applyPlacePatch(cached, 2, 9, { position: 4 })).toBe(cached);
	});
});

describe('placeIn', () => {
	const cached = {
		places: [{ husrevPagesRead: 0, position: 4, textPagesRead: 0, unitNumber: 9 }],
		roundIndex: 2
	};

	it('answers for its own round only', () => {
		expect(placeIn(cached, 2, 9)?.position).toBe(4);
		expect(placeIn(cached, 2, 10)).toBeNull();
		expect(placeIn(cached, 3, 9)).toBeUndefined();
		expect(placeIn(undefined, 2, 9)).toBeUndefined();
	});
});

describe('queueReadingPlaceSave', () => {
	beforeEach(() => {
		sent.length = 0;
	});

	it('sends one at a time per unit, folding turns made meanwhile into the next', async () => {
		void queueReadingPlaceSave({ groupId: 'g', patch: { position: 1 }, unitNumber: 7 });
		void queueReadingPlaceSave({ groupId: 'g', patch: { position: 2, textPagesRead: 1 }, unitNumber: 7 });
		void queueReadingPlaceSave({ groupId: 'g', patch: { position: 3, textPagesRead: 2 }, unitNumber: 7 });

		expect(sent).toEqual([{ groupId: 'g', patch: { position: 1 }, unitNumber: 7 }]);

		await flush();

		expect(sent).toHaveLength(2);
		expect(sent[1]).toEqual({
			groupId: 'g',
			patch: { husrevPagesRead: undefined, position: 3, textPagesRead: 2 },
			unitNumber: 7
		});

		await flush();

		expect(sent).toHaveLength(2);
	});
});
