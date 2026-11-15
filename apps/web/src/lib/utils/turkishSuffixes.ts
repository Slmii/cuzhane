import { turkishAblativeSuffix } from '@/lib/utils/homeTasks';

/**
 * Turkish case endings the Hizb plan screens write after a number or a month — "Tur 3’te",
 * "Tur 3’e", "26 Eylül’ün", "26 Eylül’ü". Vowel harmony and the spoken word's last sound decide each, so none
 * can live in the string table as one suffix.
 */

/** The locative — "Tur 3’te", "Tur 6’da": the ablative without its final n. */
export const turkishLocativeSuffix = (value: number): string => turkishAblativeSuffix(value).slice(0, -1);

/** Dative endings for 0–9 by the spoken unit: sıfır, bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz. */
const UNIT_DATIVE = ['a', 'e', 'ye', 'e', 'e', 'e', 'ya', 'ye', 'e', 'a'] as const;
/** …and for the tens: on, yirmi, otuz, kırk, elli, altmış, yetmiş, seksen, doksan. */
const TEN_DATIVE = ['e', 'a', 'ye', 'a', 'a', 'ye', 'a', 'e', 'e', 'a'] as const;

/** The dative — "Tur 3’e", "Tur 6’ya", "Tur 10’a". Hundreds and thousands (yüz, bin) take "e". */
export const turkishDativeSuffix = (value: number): string => {
	const units = value % 10;
	const tens = Math.floor(value / 10) % 10;

	if (units !== 0) {
		return UNIT_DATIVE[units] ?? 'e';
	}

	return tens !== 0 ? TEN_DATIVE[tens] ?? 'e' : value === 0 ? 'a' : 'e';
};

const BACK_UNROUNDED = 'aı';
const FRONT_UNROUNDED = 'ei';
const BACK_ROUNDED = 'ou';

/**
 * The genitive after a word ending in a consonant — "Eylül’ün", "Ekim’in", "Mart’ın",
 * "Temmuz’un". Every Turkish month name ends in a consonant, which is all this is used for.
 */
export const turkishGenitiveSuffix = (word: string): string => {
	const vowels = word.toLocaleLowerCase('tr').match(/[aeıioöuü]/g);
	const last = vowels?.at(-1) ?? 'e';

	return BACK_UNROUNDED.includes(last)
		? 'ın'
		: FRONT_UNROUNDED.includes(last)
		? 'in'
		: BACK_ROUNDED.includes(last)
		? 'un'
		: 'ün';
};

/**
 * The accusative after a word ending in a consonant — "26 Eylül’ü okursan", "Ekim’i", "Mart’ı",
 * "Temmuz’u". As with the genitive, only month names reach it.
 */
export const turkishAccusativeSuffix = (word: string): string => turkishGenitiveSuffix(word).slice(0, -1);

const BACK_VOWELS = 'aıou';
const HARD_CONSONANTS = 'fstkçşhp';

/**
 * The locative after a word — "20 Eylül’de", "2 Ağustos’ta", "Mart’ta": the last vowel picks e/a,
 * a hard final consonant turns d into t.
 */
export const turkishWordLocativeSuffix = (word: string): string => {
	const lower = word.toLocaleLowerCase('tr');
	const last = lower.match(/[aeıioöuü]/g)?.at(-1) ?? 'e';
	const final = lower.at(-1) ?? '';

	return `${HARD_CONSONANTS.includes(final) ? 't' : 'd'}${BACK_VOWELS.includes(last) ? 'a' : 'e'}`;
};

/** The ablative after a word — "20 Eyl’den", "2 Ağu’dan": the locative plus n. */
export const turkishWordAblativeSuffix = (word: string): string => `${turkishWordLocativeSuffix(word)}n`;

/**
 * The dative after a group's name — "Talebe Hizbi’ne", "Cuma Halkası’na", "Ailece Hizb’e",
 * "Talebe’ye". A name ending in i/ı/u/ü is read as a compound's possessive ("Hizbi", "Halkası",
 * "Grubu"), which takes n; one ending in a/e takes y; a consonant takes the vowel alone.
 */
export const turkishNameDativeSuffix = (name: string): string => {
	const lower = name.trim().toLocaleLowerCase('tr');
	const last = lower.match(/[aeıioöuü]/g)?.at(-1) ?? 'e';
	const final = lower.at(-1) ?? '';
	const vowel = BACK_VOWELS.includes(last) ? 'a' : 'e';

	return 'ıiuü'.includes(final) ? `n${vowel}` : 'aeoö'.includes(final) ? `y${vowel}` : vowel;
};
