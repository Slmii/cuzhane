import { describe, expect, it } from 'vitest';
import { readersPreview } from './hizbReadersPreview';

const member = (id: string, over: Partial<Parameters<typeof readersPreview>[0][number]> = {}) => ({
	completed: false,
	completedAt: null,
	displayName: id,
	id,
	isMe: false,
	planDays: 33,
	portion: 1,
	started: false,
	...over
});

describe('readersPreview', () => {
	it('shows a small group whole: you first, then the latest readers, the started, the waiting', () => {
		const preview = readersPreview(
			[
				member('waiting'),
				member('early', { completed: true, completedAt: '2026-10-02T06:00:00.000Z' }),
				member('me', { isMe: true }),
				member('started', { started: true })
			],
			{ namesHidden: false }
		);

		expect(preview.rows.map(row => row.id)).toEqual(['me', 'early', 'started', 'waiting']);
		expect(preview).toMatchObject({ hasMore: false, isAllRead: false, read: 1, total: 4, waiting: 3 });
	});

	it('keeps a large group to four rows, the newest readers first', () => {
		const readers = Array.from({ length: 6 }, (_, index) =>
			member(`r${index}`, { completed: true, completedAt: `2026-10-02T0${index}:00:00.000Z` })
		);
		const preview = readersPreview([member('me', { isMe: true }), ...readers, member('w')], { namesHidden: false });

		expect(preview.rows.map(row => row.id)).toEqual(['me', 'r5', 'r4', 'r3']);
		expect(preview).toMatchObject({ hasMore: true, read: 6, total: 8, waiting: 2 });
	});

	it('with names hidden, shows only you and counts the other readers', () => {
		const preview = readersPreview(
			[
				member('me', { completed: true, completedAt: '2026-10-02T06:00:00.000Z', isMe: true }),
				member('a', { completed: true, displayName: null }),
				member('b', { displayName: null })
			],
			{ namesHidden: true }
		);

		expect(preview.rows.map(row => row.id)).toEqual(['me']);
		expect(preview).toMatchObject({ hasMore: true, othersRead: 1, read: 2, total: 3 });
	});

	it('says when everyone has read, and copes with an older server sending no read times', () => {
		const preview = readersPreview(
			[member('a', { completed: true, completedAt: undefined }), member('me', { completed: true, isMe: true })],
			{ namesHidden: false }
		);

		expect(preview.isAllRead).toBe(true);
		expect(preview.rows.map(row => row.id)).toEqual(['me', 'a']);
	});
});
