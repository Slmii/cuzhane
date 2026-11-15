import { describe, expect, it } from 'vitest';
import { turkishAblativeSuffix } from './homeTasks';
import {
	turkishAccusativeSuffix,
	turkishDativeSuffix,
	turkishGenitiveSuffix,
	turkishLocativeSuffix,
	turkishNameDativeSuffix,
	turkishWordAblativeSuffix,
	turkishWordLocativeSuffix
} from './turkishSuffixes';

describe('Turkish case endings', () => {
	it('locative: Tur 3’te, 4’te, 8’de, 1’de, 6’da, 40’ta', () => {
		expect([3, 4, 8, 1, 6, 40].map(turkishLocativeSuffix)).toEqual(['te', 'te', 'de', 'de', 'da', 'ta']);
	});

	it('dative: Tur 3’e, 2’ye, 6’ya, 9’a, 10’a, 20’ye, 70’e, 100’e', () => {
		expect([3, 2, 6, 9, 10, 20, 70, 100].map(turkishDativeSuffix)).toEqual([
			'e',
			'ye',
			'ya',
			'a',
			'a',
			'ye',
			'e',
			'e'
		]);
	});

	it('genitive of the months: Eylül’ün, Ekim’in, Mart’ın, Temmuz’un', () => {
		expect(['Eylül', 'Ekim', 'Mart', 'Temmuz', 'Ağustos', 'Aralık'].map(turkishGenitiveSuffix)).toEqual([
			'ün',
			'in',
			'ın',
			'un',
			'un',
			'ın'
		]);
	});

	it('accusative of the months: Eylül’ü, Ekim’i, Mart’ı, Temmuz’u', () => {
		expect(['Eylül', 'Ekim', 'Mart', 'Temmuz'].map(turkishAccusativeSuffix)).toEqual(['ü', 'i', 'ı', 'u']);
	});

	it('ablative of zero: 0’dan, as sıfır takes', () => {
		expect(turkishAblativeSuffix(0)).toBe('dan');
		expect(turkishAblativeSuffix(100)).toBe('den');
	});

	it('locative and ablative of a word: Eylül’de, Ağustos’ta, Mart’ta, Eyl’den, Ağu’dan', () => {
		expect(['20 Eylül', '2 Ağustos', 'Mart', 'Nisan'].map(turkishWordLocativeSuffix)).toEqual([
			'de',
			'ta',
			'ta',
			'da'
		]);
		expect(['20 Eyl', '2 Ağu'].map(turkishWordAblativeSuffix)).toEqual(['den', 'dan']);
	});

	it('dative of a group name: Hizbi’ne, Halkası’na, Grubu’na, Hizb’e, Talebe’ye, Cuma’ya', () => {
		expect(
			['Talebe Hizbi', 'Cuma Halkası', 'Aile Grubu', 'Ailece Hizb', 'Talebe', 'Cuma'].map(turkishNameDativeSuffix)
		).toEqual(['ne', 'na', 'na', 'e', 'ye', 'ya']);
	});

	it('dative of a date, as "kadar" wants it: 4 Ekim’e, 3 Ocak’a, 9 Mayıs’a, 2 Temmuz’a, 8 Eylül’e', () => {
		expect(['4 Ekim', '3 Ocak', '9 Mayıs', '2 Temmuz', '8 Eylül'].map(turkishNameDativeSuffix)).toEqual([
			'e',
			'a',
			'a',
			'a',
			'e'
		]);
	});
});
