import { describe, expect, it } from 'vitest';
import data from './cevsen.data.json';
import { toReaderMarks } from './hizbulhakaik.parse';

const { meta: _meta, ...text } = data;

/** Every string in the file but its `meta`, which quotes the source's own spellings. */
const strings = (value: unknown): string[] => {
	if (typeof value === 'string') {
		return [value];
	}

	return value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
};

describe('cevsen.data.json', () => {
	it('leaves no mark on a letter that cannot carry it', () => {
		// The file has no ingestion script in the repo, so the Hizb's rules were applied to it
		// once (22 words: the lam's sukun typed on the article's alef, and one doubled kasra).
		// A re-import from the publisher's file brings them back; this is what would notice.
		const misplaced = strings(text).filter(value => toReaderMarks(value) !== value);

		expect(misplaced).toEqual([]);
	});
});
