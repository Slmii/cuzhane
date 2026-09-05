import { CEVSEN_BABS, type CevsenInvocation } from '@/lib/content/cevsen';

const HARAKAT_PATTERN = /[\u064B-\u0652\u0670\u06D6-\u06ED\u0656\u06EA\u0640]/g;

/** One character: is it a mark the fold removes? Built from the same class as the pattern. */
const HARAKAT_CHAR = new RegExp(`^${HARAKAT_PATTERN.source}$`);

/**
 * The per-character fold: Turkish İ/I before lowercasing (the design's SCH_NORM), then the
 * Arabic marks off. No trimming and no whitespace collapsing here — those are properties of a
 * whole string, and applying them one character at a time is what silently deleted every
 * space from a haystack, so "şifa hatmi" could never find "Şifa Hatmi".
 */
const foldChar = (value: string): string =>
	value.replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr-TR').replace(HARAKAT_PATTERN, '');

/** Turkish-aware, diacritic-tolerant fold used for BOTH the query and the haystack. */
export const normalizeSearch = (value: string): string => foldChar(value.trim()).replace(/\s+/g, ' ');

/** A match of `query` in `text`, as indices into the ORIGINAL text, or null. */
export interface SearchMatch {
	start: number;
	end: number;
}

/**
 * Builds the normalized haystack char by char, recording for each normalized char the original
 * index it came from — chars removed by harakat stripping simply produce no normalized char,
 * and a run of whitespace produces one space, as `normalizeSearch` gives the query.
 */
const buildNormalizedWithMap = (text: string): { normalized: string; originalIndex: number[] } => {
	let normalized = '';
	const originalIndex: number[] = [];

	for (let i = 0; i < text.length; i++) {
		const folded = foldChar(text[i] as string);

		if (/^\s$/.test(folded)) {
			if (!normalized.endsWith(' ')) {
				normalized += ' ';
				originalIndex.push(i);
			}

			continue;
		}

		for (const ch of folded) {
			normalized += ch;
			originalIndex.push(i);
		}
	}

	return { normalized, originalIndex };
};

export const findMatch = (text: string, query: string): SearchMatch | null => {
	const normalizedQuery = normalizeSearch(query);

	if (normalizedQuery === '') {
		return null;
	}

	const { normalized, originalIndex } = buildNormalizedWithMap(text);
	const index = normalized.indexOf(normalizedQuery);

	if (index === -1) {
		return null;
	}

	const start = originalIndex[index] as number;
	const lastMatchedIndex = index + normalizedQuery.length - 1;
	let end = (originalIndex[lastMatchedIndex] as number) + 1;

	// A mark that follows the last matched letter belongs to it — cutting the range before it
	// would split a combining character off the run that carries it.
	while (end < text.length && HARAKAT_CHAR.test(text[end] as string)) {
		end += 1;
	}

	return { start, end };
};

export interface HighlightParts {
	pre: string;
	mid: string;
	post: string;
}

export const highlightMatch = (text: string, query: string): HighlightParts => {
	const match = findMatch(text, query);

	if (!match) {
		return { pre: text, mid: '', post: '' };
	}

	return {
		pre: text.slice(0, match.start),
		mid: text.slice(match.start, match.end),
		post: text.slice(match.end)
	};
};

export interface BabHit {
	babNumber: number;
}

export interface TextHit {
	babNumber: number;
	invocationNumber: number;
	/** A bab's closing refrain numbers itself like an invocation, so this tells the two apart. */
	part: 'invocation' | 'closing';
	line: string;
	/** which field matched */
	source: 'tr' | 'text';
}

export interface CevsenHits {
	babs: BabHit[];
	text: TextHit[];
}

type IndexedInvocation = {
	babNumber: number;
	invocationNumber: number;
	part: TextHit['part'];
	tr?: string;
	text: string;
	normalizedTr?: string;
	normalizedText: string;
};

let cachedIndex: IndexedInvocation[] | null = null;

const getIndexedInvocations = (): IndexedInvocation[] => {
	if (cachedIndex) {
		return cachedIndex;
	}

	const index: IndexedInvocation[] = [];

	for (const bab of CEVSEN_BABS) {
		const entries: [CevsenInvocation, TextHit['part']][] = [
			...bab.invocations.map((invocation): [CevsenInvocation, TextHit['part']] => [invocation, 'invocation']),
			[bab.closing, 'closing']
		];

		for (const [invocation, part] of entries) {
			index.push({
				babNumber: bab.number,
				invocationNumber: invocation.n,
				part,
				tr: invocation.tr,
				text: invocation.text,
				normalizedTr: invocation.tr !== undefined ? normalizeSearch(invocation.tr) : undefined,
				normalizedText: normalizeSearch(invocation.text)
			});
		}
	}

	cachedIndex = index;

	return index;
};

export const searchCevsen = (query: string, options?: { maxText?: number }): CevsenHits => {
	const maxText = options?.maxText ?? 30;
	const trimmed = query.trim();

	const babs: BabHit[] = [];

	if (trimmed !== '' && /^\d+$/.test(trimmed)) {
		const babNumber = Number.parseInt(trimmed, 10);

		if (babNumber >= 1 && babNumber <= 100) {
			babs.push({ babNumber });
		}
	}

	const normalizedQuery = normalizeSearch(query);
	const text: TextHit[] = [];

	if (normalizedQuery.length >= 2) {
		for (const invocation of getIndexedInvocations()) {
			if (text.length >= maxText) {
				break;
			}

			const matchesTr = invocation.normalizedTr?.includes(normalizedQuery) ?? false;
			const matchesText = invocation.normalizedText.includes(normalizedQuery);

			if (!matchesTr && !matchesText) {
				continue;
			}

			text.push({
				babNumber: invocation.babNumber,
				invocationNumber: invocation.invocationNumber,
				part: invocation.part,
				line: matchesTr ? (invocation.tr as string) : invocation.text,
				source: matchesTr ? 'tr' : 'text'
			});
		}
	}

	return { babs, text };
};

export interface GroupLike {
	id: string;
	name: string;
}

export const searchGroups = <T extends GroupLike>(groups: readonly T[] | undefined, query: string): T[] => {
	if (query.trim() === '') {
		return [];
	}

	return (groups ?? []).filter(group => findMatch(group.name, query) !== null);
};
