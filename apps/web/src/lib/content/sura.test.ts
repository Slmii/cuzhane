import { describe, expect, it } from 'vitest';
import { allSuras, suraInfo } from './sura';

describe('the bundled sura list', () => {
	it('holds the 114 suras in order, each named, their ayahs summing to the mushaf’s 6236', () => {
		const suras = allSuras();

		expect(suras).toHaveLength(114);
		expect(suras.every((sura, index) => sura.number === index + 1 && sura.nameArabic.length > 0)).toBe(true);
		expect(suras.reduce((total, sura) => total + sura.versesCount, 0)).toBe(6236);
	});

	it('sets the basmala above every sura but Al-Fātiḥa and At-Tawba', () => {
		expect(
			allSuras()
				.filter(sura => !sura.bismillahPre)
				.map(sura => sura.number)
		).toEqual([1, 9]);
	});

	it('places every sura in Mecca or Medina — 86 and 28, as the heading’s caption reads them', () => {
		const places = allSuras().map(sura => sura.revelationPlace);

		expect(places.filter(place => place === 'makkah')).toHaveLength(86);
		expect(places.filter(place => place === 'madinah')).toHaveLength(28);
		// The design's own sample: "17 · Al-İsrâ · Mekkî · 111 âyet".
		expect(suraInfo(17)).toMatchObject({ revelationPlace: 'makkah', versesCount: 111 });
	});

	it('answers Al-Mulk as the heading shows it, and nothing outside 1–114', () => {
		expect(suraInfo(67)).toMatchObject({ nameArabic: 'الملك', number: 67, versesCount: 30 });
		expect(suraInfo(0)).toBeUndefined();
		expect(suraInfo(115)).toBeUndefined();
	});
});
