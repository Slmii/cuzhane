import type { PushLanguage } from './pushCopy';

/**
 * The Hizb's works and the portions each spans, so a notice can say which one was read — "9 ·
 * Evrâd-ı Kudsiye". **Mirrors `HIZB_WORKS` and the `hizbWork*` strings in the web app — change
 * both.** The names are the works' own, the same in every language but the Qur'an portion's.
 */
const WORKS: { parts: [number, number]; name: Record<PushLanguage, string> | string }[] = [
	{ parts: [1, 3], name: { en: 'Qur’an portion', nl: 'Koran-gedeelte', tr: 'Kur’an bölümü' } },
	{ parts: [4, 8], name: 'Cevşenü’l-Kebîr' },
	{ parts: [9, 13], name: 'Evrâd-ı Kudsiye' },
	{ parts: [14, 18], name: 'Delâilü’n-Nûr' },
	{ parts: [19, 19], name: 'Sekîne' },
	{ parts: [20, 20], name: 'Münâcât & İsm-i Âzam' },
	{ parts: [21, 24], name: 'Münâcâtü’l-Kur’ân' },
	{ parts: [25, 25], name: 'Tahmîdiye' },
	{ parts: [26, 29], name: 'Hulâsatü’l-Hulâsa' },
	{ parts: [30, 32], name: 'Tazarru ve Niyaz' }
];

/** The works a set of portions touches, in reading order, named for the reader: "Evrâd-ı Kudsiye, Delâilü’n-Nûr". */
export const hizbWorksOf = (portions: readonly number[], language: PushLanguage): string =>
	WORKS.filter(work => portions.some(portion => portion >= work.parts[0] && portion <= work.parts[1]))
		.map(work => (typeof work.name === 'string' ? work.name : work.name[language]))
		.join(', ');
