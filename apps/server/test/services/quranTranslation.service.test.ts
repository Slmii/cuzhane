import { BAD_GATEWAY } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import { SURA_VERSE_COUNTS, VerseTranslationQuerySchema } from '@schemas/quran.schema';
import { getVerseTranslation, toPlainMeal } from '@services/quranTranslation.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The Quran Foundation is never called from a test: the client is replaced, and the
 * credentials are stubbed so the service believes it is configured. The service's cache
 * outlives each test, so every test asks for a verse no other test has.
 */
const { findByKey } = vi.hoisted(() => ({ findByKey: vi.fn() }));

vi.mock('@quranjs/api/server', () => ({ createServerClient: () => ({ verses: { findByKey } }) }));
vi.mock('@config/env', () => ({ env: { QURAN_CLIENT_ID: 'id', QURAN_CLIENT_SECRET: 'secret' } }));

const answer = (resourceId: number, text: string) => ({ translations: [{ resourceId, text }] });

describe('the verse meal', () => {
	beforeEach(() => {
		findByKey.mockReset();
	});

	it('drops the source’s footnote markers with their numbers, and any other tag', () => {
		expect(toPlainMeal('the Ever-Living,<sup foot_note=254108>1</sup> the Self-Sustaining.')).toBe(
			'the Ever-Living, the Self-Sustaining.'
		);
		expect(toPlainMeal('<i>Allāh</i>  is  One')).toBe('Allāh is One');
		// A footnote element spanning a line break goes whole, number and all.
		expect(toPlainMeal('Sustaining.<sup foot_note=1>\n2</sup> Neither')).toBe('Sustaining. Neither');
	});

	it('keeps words apart across a break and decodes what the markup encoded', () => {
		expect(toPlainMeal('first line<br>second<br/>third')).toBe('first line second third');
		expect(toPlainMeal('A&nbsp;B &amp; C &quot;D&quot; &#8217;E&#x2019;')).toBe('A B & C "D" ’E’');
		// Decoded after the tags are gone, so encoded brackets stay text.
		expect(toPlainMeal('&lt;b&gt; is not bold')).toBe('<b> is not bold');
		expect(toPlainMeal('an &unknown; entity')).toBe('an &unknown; entity');
	});

	it('asks for the translation chosen for the language, and credits its translator', async () => {
		findByKey.mockResolvedValue(answer(77, 'Artık secdeye varın, Allah’a kulluk edin.'));

		await expect(getVerseTranslation('53:62', 'tr')).resolves.toEqual({
			language: 'tr',
			text: 'Artık secdeye varın, Allah’a kulluk edin.',
			translator: 'Diyanet İşleri',
			verseKey: '53:62'
		});
		expect(findByKey).toHaveBeenCalledWith('53:62', { translations: [77] });
	});

	it('asks the source once per verse and language, then answers from memory', async () => {
		findByKey.mockResolvedValue(answer(20, 'So prostrate to Allāh and worship [Him].'));

		await getVerseTranslation('96:19', 'en');
		const second = await getVerseTranslation('96:19', 'en');

		expect(findByKey).toHaveBeenCalledTimes(1);
		expect(second.translator).toBe('Saheeh International');
	});

	it('reports the source failing as a bad gateway, not as the app’s own error', async () => {
		findByKey.mockRejectedValue(new Error('socket hang up'));

		await expect(getVerseTranslation('84:21', 'nl')).rejects.toMatchObject({ statusCode: BAD_GATEWAY });
	});

	it('treats an answer without the asked-for translation as a failure, not as an empty meal', async () => {
		findByKey.mockResolvedValue(answer(20, 'the wrong translation'));

		const failure = getVerseTranslation('32:15', 'nl');

		await expect(failure).rejects.toBeInstanceOf(HttpError);
		await expect(failure).rejects.toMatchObject({ statusCode: BAD_GATEWAY });
	});
});

describe('the meal query', () => {
	it('takes a verse key inside the mushaf and one of the three languages', () => {
		expect(VerseTranslationQuerySchema.safeParse({ lang: 'tr', verseKey: '53:62' }).success).toBe(true);
		expect(VerseTranslationQuerySchema.safeParse({ lang: 'nl', verseKey: '114:6' }).success).toBe(true);
	});

	it('knows each sura’s length — 114 of them, the mushaf’s 6236 ayahs', () => {
		expect(SURA_VERSE_COUNTS).toHaveLength(114);
		expect(SURA_VERSE_COUNTS.reduce((total, count) => total + count, 0)).toBe(6236);
		expect(VerseTranslationQuerySchema.safeParse({ lang: 'en', verseKey: '2:286' }).success).toBe(true);
	});

	it('refuses anything else', () => {
		for (const query of [
			// Past its sura's end: refused here, not sent upstream and reported as its failure.
			{ lang: 'en', verseKey: '1:8' },
			{ lang: 'en', verseKey: '2:287' },
			{ lang: 'tr', verseKey: '115:1' },
			{ lang: 'tr', verseKey: '0:1' },
			{ lang: 'tr', verseKey: '2:0' },
			{ lang: 'tr', verseKey: 'bakara' },
			{ lang: 'de', verseKey: '1:1' },
			{ lang: 'tr' }
		]) {
			expect(VerseTranslationQuerySchema.safeParse(query).success, JSON.stringify(query)).toBe(false);
		}
	});
});
