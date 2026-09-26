import { groupReadPush, poolClaimPush, poolClaimReleasedPush, roundCompletePush } from '@utils/pushCopy';
import { describe, expect, it } from 'vitest';

/*
 * The Cevşen lines are pinned exactly as they read before a group could be anything else, so
 * teaching the copy a second noun cannot quietly change the first.
 */

describe('poolClaimReleasedPush', () => {
	it('names babs for a Cevşen group, unchanged', () => {
		expect(poolClaimReleasedPush('tr', { kind: 'CEVSEN', range: '21–25' })).toEqual({
			title: 'Üstlendiğin bablar devredildi',
			body: '21–25. bablar gruba yeni katılan üyenin payı oldu. Okuduğun bablar sende kalır.'
		});
		expect(poolClaimReleasedPush('en', { kind: 'CEVSEN', range: '21–25' })).toEqual({
			title: 'Babs you took were passed on',
			body: "Babs 21–25 became a new member's share. Anything you already read still counts for you."
		});
		expect(poolClaimReleasedPush('nl', { kind: 'CEVSEN', range: '21–25' })).toEqual({
			title: 'De babs die je overnam zijn doorgegeven',
			body: 'Babs 21–25 zijn het deel geworden van het nieuwe lid. Wat je al gelezen hebt, blijft van jou.'
		});
	});

	it('names portions for a Hizb group', () => {
		expect(poolClaimReleasedPush('tr', { kind: 'HIZB', range: '7–9' })).toEqual({
			title: 'Üstlendiğin bölümler devredildi',
			body: '7–9. bölümler gruba yeni katılan üyenin payı oldu. Okuduğun bölümler sende kalır.'
		});
		expect(poolClaimReleasedPush('en', { kind: 'HIZB', range: '7–9' })).toEqual({
			title: 'Portions you took were passed on',
			body: "Portions 7–9 became a new member's share. Anything you already read still counts for you."
		});
		expect(poolClaimReleasedPush('nl', { kind: 'HIZB', range: '7–9' })).toEqual({
			title: 'De gedeelten die je overnam zijn doorgegeven',
			body: 'Gedeelten 7–9 zijn het deel geworden van het nieuwe lid. Wat je al gelezen hebt, blijft van jou.'
		});
	});

	it('names a single portion in the singular', () => {
		expect(poolClaimReleasedPush('tr', { kind: 'HIZB', range: '19' })).toEqual({
			title: 'Üstlendiğin bölüm devredildi',
			body: '19. bölüm gruba yeni katılan üyenin payı oldu. Okuduğun bölümler sende kalır.'
		});
		expect(poolClaimReleasedPush('en', { kind: 'HIZB', range: '19' })).toEqual({
			title: 'The portion you took was passed on',
			body: "Portion 19 became a new member's share. Anything you already read still counts for you."
		});
		expect(poolClaimReleasedPush('nl', { kind: 'HIZB', range: '19' })).toEqual({
			title: 'Je overgenomen gedeelte is doorgegeven',
			body: 'Gedeelte 19 is het deel geworden van het nieuwe lid. Wat je al gelezen hebt, blijft van jou.'
		});
	});
});

describe('groupReadPush', () => {
	const input = { groupName: 'Aile Halkası', readerName: 'Ahmet' };

	it('names babs for a Cevşen group, unchanged', () => {
		expect(groupReadPush('tr', { ...input, kind: 'CEVSEN', range: '1–13' })).toEqual({
			title: 'Aile Halkası',
			body: 'Ahmet okumasını tamamladı (1–13).'
		});
		expect(groupReadPush('en', { ...input, kind: 'CEVSEN', range: '1–13' }).body).toBe('Ahmet finished babs 1–13.');
		expect(groupReadPush('nl', { ...input, kind: 'CEVSEN', range: '1–13' }).body).toBe(
			'Ahmet is klaar met babs 1–13.'
		);
	});

	it('names portions for a Hizb group', () => {
		// Turkish names no noun here at all — "okumasını" covers either — so it reads the same.
		expect(groupReadPush('tr', { ...input, kind: 'HIZB', range: '1–3' }).body).toBe(
			'Ahmet okumasını tamamladı (1–3).'
		);
		expect(groupReadPush('en', { ...input, kind: 'HIZB', range: '1–3' }).body).toBe('Ahmet finished portions 1–3.');
		expect(groupReadPush('nl', { ...input, kind: 'HIZB', range: '1–3' }).body).toBe(
			'Ahmet is klaar met gedeelten 1–3.'
		);
	});

	it('names a single portion in the singular', () => {
		expect(groupReadPush('tr', { ...input, kind: 'HIZB', range: '19' }).body).toBe(
			'Ahmet okumasını tamamladı (19).'
		);
		expect(groupReadPush('en', { ...input, kind: 'HIZB', range: '19' }).body).toBe('Ahmet finished portion 19.');
		expect(groupReadPush('nl', { ...input, kind: 'HIZB', range: '19' }).body).toBe(
			'Ahmet is klaar met gedeelte 19.'
		);
	});

	it('keeps a share with a pool block on top plural', () => {
		expect(groupReadPush('en', { ...input, kind: 'HIZB', range: '1–3, 19' }).body).toBe(
			'Ahmet finished portions 1–3, 19.'
		);
	});
});

describe('roundCompletePush', () => {
	const input = { groupName: 'Aile Halkası', roundNumber: 4 };

	it('counts the hundred for a Cevşen group, unchanged', () => {
		expect(roundCompletePush('tr', { ...input, kind: 'CEVSEN' })).toEqual({
			title: 'Aile Halkası',
			body: '4. tur tamamlandı — 100 babın hepsi okundu.'
		});
		expect(roundCompletePush('en', { ...input, kind: 'CEVSEN' }).body).toBe(
			'Round 4 is complete — all 100 babs read.'
		);
		expect(roundCompletePush('nl', { ...input, kind: 'CEVSEN' }).body).toBe(
			'Ronde 4 is voltooid — alle 100 babs gelezen.'
		);
	});

	it('counts the 33 for a Hizb group', () => {
		expect(roundCompletePush('tr', { ...input, kind: 'HIZB' })).toEqual({
			title: 'Aile Halkası',
			body: '4. tur tamamlandı — 33 bölümün hepsi okundu.'
		});
		expect(roundCompletePush('en', { ...input, kind: 'HIZB' }).body).toBe(
			'Round 4 is complete — all 33 portions read.'
		);
		expect(roundCompletePush('nl', { ...input, kind: 'HIZB' }).body).toBe(
			'Ronde 4 is voltooid — alle 33 gedeelten gelezen.'
		);
	});
});

describe('poolClaimPush', () => {
	const input = { groupName: 'Aile Halkası', takerName: 'Zeynep' };

	it('names babs for a Cevşen group, unchanged', () => {
		expect(poolClaimPush('tr', { ...input, kind: 'CEVSEN', range: '66–70' })).toEqual({
			title: 'Aile Halkası',
			body: 'Zeynep havuzdan 66–70 bablarını üstlendi.'
		});
		expect(poolClaimPush('en', { ...input, kind: 'CEVSEN', range: '66–70' }).body).toBe(
			'Zeynep took babs 66–70 from the pool.'
		);
		expect(poolClaimPush('nl', { ...input, kind: 'CEVSEN', range: '66–70' }).body).toBe(
			'Zeynep heeft babs 66–70 uit de pool genomen.'
		);
	});

	it('names portions for a Hizb group', () => {
		expect(poolClaimPush('tr', { ...input, kind: 'HIZB', range: '10–12' }).body).toBe(
			'Zeynep havuzdan 10–12 bölümlerini üstlendi.'
		);
		expect(poolClaimPush('en', { ...input, kind: 'HIZB', range: '10–12' }).body).toBe(
			'Zeynep took portions 10–12 from the pool.'
		);
		expect(poolClaimPush('nl', { ...input, kind: 'HIZB', range: '10–12' }).body).toBe(
			'Zeynep heeft gedeelten 10–12 uit de pool genomen.'
		);
	});

	it('names a single portion in the singular', () => {
		expect(poolClaimPush('tr', { ...input, kind: 'HIZB', range: '19' }).body).toBe(
			'Zeynep havuzdan 19. bölümü üstlendi.'
		);
		expect(poolClaimPush('en', { ...input, kind: 'HIZB', range: '19' }).body).toBe(
			'Zeynep took portion 19 from the pool.'
		);
		expect(poolClaimPush('nl', { ...input, kind: 'HIZB', range: '19' }).body).toBe(
			'Zeynep heeft gedeelte 19 uit de pool genomen.'
		);
	});
});
