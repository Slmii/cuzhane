import { CYCLES_FOR_KIND, partCountFor, requiredRepetitions } from '@utils/groupKinds';
import { describe, expect, it } from 'vitest';

describe('groupKinds util', () => {
	describe('partCountFor', () => {
		it('divides the Cevşen into its hundred babs', () => {
			expect(partCountFor('CEVSEN')).toBe(100);
		});

		it('divides the Hizb into the revised 33 portions', () => {
			expect(partCountFor('HIZB')).toBe(33);
		});
	});

	describe('requiredRepetitions', () => {
		it('asks for the Sekine nineteen times', () => {
			expect(requiredRepetitions('HIZB', 19)).toBe(19);
		});

		it('asks for every other Hizb part once', () => {
			expect(requiredRepetitions('HIZB', 18)).toBe(1);
		});

		it('asks for every Cevşen bab once, bab 19 included', () => {
			expect(requiredRepetitions('CEVSEN', 19)).toBe(1);
		});
	});

	describe('CYCLES_FOR_KIND', () => {
		it('keeps the Cevşen to its daily and weekly rounds', () => {
			expect(CYCLES_FOR_KIND.CEVSEN).not.toContain('MONTHLY');
		});

		it('gives the Hizb a month as well', () => {
			expect(CYCLES_FOR_KIND.HIZB).toContain('MONTHLY');
		});
	});
});
