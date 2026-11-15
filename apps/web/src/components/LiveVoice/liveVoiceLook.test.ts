import type { LiveVoiceSnapshot } from '@/lib/live/liveVoice';
import { interpolate, STRINGS, type StringKey } from '@/lib/i18n/strings';
import type { LivePerson } from '@/lib/types/domain';
import { describe, expect, it } from 'vitest';
import { describeLiveVoice, withAccusativeTr } from './liveVoiceLook';

const tr = (key: StringKey, values?: Record<string, string | number>) => interpolate(STRINGS.tr[key], values);
const en = (key: StringKey, values?: Record<string, string | number>) => interpolate(STRINGS.en[key], values);

const READER: LivePerson = { isLeader: true, isListening: false, isYou: false, name: 'Ayşe Yılmaz' };
const follower = (isListening: boolean): LivePerson => ({ isLeader: false, isListening, isYou: false, name: 'Mehmet' });

const session = (people: LivePerson[] = [READER, follower(true), follower(true), follower(false)]) => ({
	gone: null,
	people,
	readerPlace: { bab: 14, k: 'CEVSEN' as const }
});

const voice = (overrides: Partial<LiveVoiceSnapshot>): LiveVoiceSnapshot => ({
	isSupported: true,
	isVolumeOff: false,
	pauseReason: null,
	reason: null,
	role: 'listener',
	room: 'on',
	state: 'off',
	...overrides
});

describe('withAccusativeTr', () => {
	it('follows the last vowel, with a y after a vowel', () => {
		expect(withAccusativeTr('Ayşe Yılmaz')).toBe('Ayşe Yılmaz’ı');
		expect(withAccusativeTr('Ali')).toBe('Ali’yi');
		expect(withAccusativeTr('Mehmet')).toBe('Mehmet’i');
		expect(withAccusativeTr('Ömür')).toBe('Ömür’ü');
		expect(withAccusativeTr('Yusuf')).toBe('Yusuf’u');
		expect(withAccusativeTr('Ayşe')).toBe('Ayşe’yi');
	});
});

describe('describeLiveVoice — the reader', () => {
	it('says the voice is on, who follows and how many listen, with "Sesi kapat"', () => {
		const look = describeLiveVoice(voice({ role: 'reader', state: 'listening' }), session(), tr, 'tr');

		expect(look).toMatchObject({
			badge: 'meter',
			button: { action: 'turnOff', label: 'Sesi kapat' },
			lead: 'meter',
			short: 'Sesin açık',
			spoken: 'Sesin açık. 2 kişi dinliyor.',
			stripGlyph: 'micOn',
			stripSub: 'Cevşen · 14. Bab',
			stripTitle: 'Sesin açık · 3 kişi takip ediyor',
			sub: '3 kişi takip ediyor · 2 kişi dinliyor',
			title: 'Sesin açık',
			tone: 'live'
		});
	});

	it('says nobody listens yet, plural-aware in English', () => {
		const look = describeLiveVoice(
			voice({ role: 'reader', state: 'listening' }),
			session([READER, follower(false)]),
			en,
			'en'
		);

		expect(look?.sub).toBe('1 person following · nobody listening yet');
	});

	it('is sand while paused, and says why', () => {
		const call = describeLiveVoice(
			voice({ pauseReason: 'call', role: 'reader', state: 'paused' }),
			session(),
			tr,
			'tr'
		);
		const network = describeLiveVoice(
			voice({ pauseReason: 'network', role: 'reader', state: 'paused' }),
			session(),
			tr,
			'tr'
		);

		expect(call).toMatchObject({
			badge: 'pause',
			lead: 'micPaused',
			sub: 'Görüşme bitince kendiliğinden devam eder'
		});
		expect(network).toMatchObject({ sub: 'İnternet gelince kendiliğinden devam eder', tone: 'warn' });
	});

	it('has nothing to say while off, unavailable, or in an old build', () => {
		expect(describeLiveVoice(voice({ role: 'reader', state: 'off' }), session(), tr, 'tr')).toBeNull();
		expect(describeLiveVoice(voice({ role: 'reader', state: 'unavailable' }), session(), tr, 'tr')).toBeNull();
		expect(
			describeLiveVoice(voice({ isSupported: false, role: 'reader', state: 'listening' }), session(), tr, 'tr')
		).toBeNull();
	});
});

describe('describeLiveVoice — a follower', () => {
	it('offers "Dinle" while the reader’s voice is on and they are not listening', () => {
		const look = describeLiveVoice(voice({ state: 'off' }), session(), tr, 'tr');

		expect(look).toMatchObject({
			badge: 'speaker',
			button: { action: 'listen', isPrimary: true, label: 'Dinle' },
			short: 'Ayşe sesli okuyor',
			stripTitle: 'Ayşe Yılmaz sesli okuyor',
			sub: 'Sesini açtı · dinleyebilirsin',
			title: 'Ayşe Yılmaz okuyor'
		});
		// Stopped by their own choice: "Dinle" again, joining live.
		expect(describeLiveVoice(voice({ state: 'stopped' }), session(), tr, 'tr')?.button?.action).toBe('listen');
	});

	it('says whom they hear, live and where — or that the phone is turned down', () => {
		const look = describeLiveVoice(voice({ state: 'listening' }), session(), tr, 'tr');
		const quiet = describeLiveVoice(voice({ isVolumeOff: true, state: 'listening' }), session(), tr, 'tr');

		expect(look).toMatchObject({
			button: { action: 'stop', label: 'Durdur' },
			short: 'Dinliyorsun · canlı',
			sub: 'Canlı · Cevşen · 14. Bab',
			title: 'Ayşe Yılmaz’ı dinliyorsun'
		});
		expect(quiet?.sub).toBe('Telefonun sesi kısık');
		expect(describeLiveVoice(voice({ state: 'listening' }), session(), en, 'en')?.title).toBe(
			'You’re listening to Ayşe Yılmaz'
		);
	});

	it('says the reader’s voice is paused, and the four-second notice when it went off', () => {
		expect(describeLiveVoice(voice({ room: 'paused', state: 'paused' }), session(), tr, 'tr')).toMatchObject({
			lead: 'speakerPaused',
			title: 'Okuyucunun sesi duraklatıldı',
			tone: 'warn'
		});
		expect(describeLiveVoice(voice({ room: 'off', state: 'notice' }), session(), tr, 'tr')).toMatchObject({
			button: null,
			short: 'Ayşe sesini kapattı',
			title: 'Ayşe Yılmaz sesini kapattı',
			tone: 'calm'
		});
	});

	it('sees nothing while the reader’s voice is off', () => {
		expect(describeLiveVoice(voice({ room: 'off', state: 'off' }), session(), tr, 'tr')).toBeNull();
	});
});
