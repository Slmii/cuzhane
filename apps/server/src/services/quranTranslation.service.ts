import { env } from '@config/env';
import { BAD_GATEWAY, SERVICE_UNAVAILABLE } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import { createServerClient } from '@quranjs/api/server';
import type { MealLanguage } from '@schemas/quran.schema';

/**
 * A verse's meal, **fetched live from the Quran Foundation when it is asked for** — nothing is
 * bundled or stored. The app long-presses a verse in the typeset reader and asks here; the
 * credentials must stay on a server (`EXPO_PUBLIC_*` would put them in the bundle), which is why
 * the app does not call the Quran Foundation itself.
 *
 * One translation per interface language, chosen once:
 */
const TRANSLATIONS: Record<MealLanguage, { id: number; translator: string }> = {
	en: { id: 20, translator: 'Saheeh International' },
	nl: { id: 144, translator: 'Sofian S. Siregar' },
	tr: { id: 77, translator: 'Diyanet İşleri' }
};

export type VerseTranslation = {
	verseKey: string;
	language: MealLanguage;
	/** The meal, as plain text — the source's footnote markers and tags removed. */
	text: string;
	/** Who translated it, shown under the meal as its credit. */
	translator: string;
};

/**
 * **A small cache in front of the API**, in memory and per process: a verse's meal never
 * changes, and a group reading the same cüz asks for the same verses. Bounded, oldest out
 * first (a `Map` keeps insertion order), so a long-running server cannot grow it without end.
 */
const CACHE_LIMIT = 2000;
const cache = new Map<string, VerseTranslation>();

let client: ReturnType<typeof createServerClient> | null = null;

const quranClient = () => {
	if (!env.QURAN_CLIENT_ID || !env.QURAN_CLIENT_SECRET) {
		throw new HttpError(SERVICE_UNAVAILABLE, 'The meal is not configured on this server');
	}

	client ??= createServerClient({ clientId: env.QURAN_CLIENT_ID, clientSecret: env.QURAN_CLIENT_SECRET });

	return client;
};

/** The entities a translation's markup might carry, decoded — React Native shows them literally. */
const NAMED_ENTITIES: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };

/**
 * The source marks its footnotes inline — `Ever-Living,<sup foot_note=254108>1</sup>` — and
 * the numbers mean nothing without the notes, which are not shown. The marker goes with its
 * number, even across a line break; a `<br>` or a closing block becomes a space so the words on
 * either side do not run together; any other tag is dropped and its text kept; entities are
 * decoded **last**, so an encoded `&lt;` is text and never read as a tag.
 */
export const toPlainMeal = (html: string): string =>
	html
		.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
		.replace(/<br\s*\/?>|<\/(?:p|div|li)>/gi, ' ')
		.replace(/<[^>]+>/g, '')
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
			if (code.startsWith('#x') || code.startsWith('#X')) {
				return String.fromCodePoint(parseInt(code.slice(2), 16));
			}

			if (code.startsWith('#')) {
				return String.fromCodePoint(parseInt(code.slice(1), 10));
			}

			return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
		})
		.replace(/\s+/g, ' ')
		.trim();

export const getVerseTranslation = async (verseKey: string, language: MealLanguage): Promise<VerseTranslation> => {
	const cacheKey = `${language}|${verseKey}`;
	const cached = cache.get(cacheKey);

	if (cached) {
		return cached;
	}

	const { id, translator } = TRANSLATIONS[language];
	let text: string | undefined;

	try {
		const verse = await quranClient().verses.findByKey(verseKey as never, { translations: [id] });

		text = verse.translations?.find(translation => translation.resourceId === id)?.text;
	} catch (error) {
		if (error instanceof HttpError) {
			throw error;
		}

		throw new HttpError(BAD_GATEWAY, 'The meal could not be fetched', { verseKey, language });
	}

	if (!text) {
		throw new HttpError(BAD_GATEWAY, 'The meal came back empty', { verseKey, language });
	}

	const result: VerseTranslation = { language, text: toPlainMeal(text), translator, verseKey };

	if (cache.size >= CACHE_LIMIT) {
		const oldest = cache.keys().next().value;

		if (oldest !== undefined) {
			cache.delete(oldest);
		}
	}

	cache.set(cacheKey, result);

	return result;
};
