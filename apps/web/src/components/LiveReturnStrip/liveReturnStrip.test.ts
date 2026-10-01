import { describe, expect, it } from 'vitest';
import type { LiveSessionState } from '@/lib/hooks/useLiveSession';
import { interpolate, STRINGS, type StringKey } from '@/lib/i18n/strings';
import { announcedSecondsOf, describeLiveStrip, hasLiveStrip, initialsOf, liveReaderRouteFor } from './liveReturnStrip';

const tr = (key: StringKey, values?: Record<string, string | number>) => interpolate(STRINGS.tr[key], values);
const en = (key: StringKey, values?: Record<string, string | number>) => interpolate(STRINGS.en[key], values);

const READER = { isLeader: true, isYou: false, name: 'Ayşe Yılmaz' };
const FOLLOWER = { isLeader: false, isYou: false, name: 'Mehmet' };

const session = (overrides: Partial<LiveSessionState> = {}): LiveSessionState => ({
	awaySince: null,
	code: 'HLKA4R7P',
	gone: null,
	isDetached: false,
	kind: 'CEVSEN',
	people: [READER],
	readerPlace: { bab: 14, k: 'CEVSEN' },
	role: 'leader',
	sessionId: 's1',
	status: 'live',
	...overrides
});

describe('describeLiveStrip — the reader', () => {
	it('gives the code while nobody follows', () => {
		const look = describeLiveStrip(session(), 0, tr, 'tr');

		expect(look).toMatchObject({ isPulsing: true, lead: 'glyph', tone: 'live' });
		expect(look.title).toBe('Canlı · henüz kimse katılmadı');
		expect(look.sub).toBe('Kod: HLKA-4R7P');
	});

	it('does not double the dash of a code that arrives formatted', () => {
		expect(describeLiveStrip(session({ code: 'HLKA-4R7P' }), 0, tr, 'tr').sub).toBe('Kod: HLKA-4R7P');
	});

	it('counts followers, plural-aware, with the reader’s own place', () => {
		const one = describeLiveStrip(session({ people: [READER, FOLLOWER] }), 0, en, 'en');
		const three = describeLiveStrip(session({ people: [READER, FOLLOWER, FOLLOWER, FOLLOWER] }), 0, en, 'en');

		expect(one.title).toBe('Live · 1 person following');
		expect(three.title).toBe('Live · 3 people following');
		expect(three.sub).toBe('Cevşen · Bab 14');
	});

	it('sees its own drop as reconnecting, never a countdown', () => {
		const look = describeLiveStrip(session({ status: 'connecting' }), 0, tr, 'tr');

		expect(look).toMatchObject({ hasCountdown: false, lead: 'spinner', tone: 'calm' });
		expect(look.title).toBe('Bağlantı yeniden kuruluyor');
	});

	it('says it ended for everyone, with only the button to put it away', () => {
		const look = describeLiveStrip(session({ gone: 'expired' }), 0, tr, 'tr');

		expect(look).toMatchObject({ isEnded: true, lead: 'glyph', tone: 'done' });
		expect(look.sub).toBe('Herkes için bitti');
	});
});

describe('describeLiveStrip — a follower', () => {
	const following = (overrides: Partial<LiveSessionState> = {}) =>
		session({ people: [READER, { ...FOLLOWER, isYou: true }], role: 'follower', ...overrides });

	it('names the reader and their place', () => {
		const look = describeLiveStrip(following(), 0, tr, 'tr');

		expect(look).toMatchObject({ initials: 'AY', isPulsing: true, lead: 'initials', tone: 'live' });
		expect(look.title).toBe('Ayşe Yılmaz okuyor');
		expect(look.sub).toBe('Cevşen · 14. Bab');
	});

	it('counts down while the reader is away', () => {
		const look = describeLiveStrip(following({ awaySince: 1, status: 'away' }), 48, tr, 'tr');

		expect(look).toMatchObject({ hasCountdown: true, isPulsing: false, tone: 'warn' });
		expect(look.sub).toBe('0:48 içinde dönmezse biter');
	});

	it('says why it ended', () => {
		expect(describeLiveStrip(following({ gone: 'leader-left' }), 0, tr, 'tr').sub).toBe('Okuyucu geri dönmedi');
		expect(describeLiveStrip(following({ gone: 'ended' }), 0, tr, 'tr').sub).toBe(
			'Kendi başına okumaya devam edebilirsin'
		);
	});

	it('falls back to "a member" for a reader with no name', () => {
		const look = describeLiveStrip(
			following({ people: [{ ...READER, name: null }], status: 'connecting' }),
			0,
			tr,
			'tr'
		);

		expect(look.sub).toBe('Bir üye okumaya devam ediyor');
	});
});

describe('the strip’s rules', () => {
	it('stays silent for a join that never found a session', () => {
		expect(hasLiveStrip(null)).toBe(false);
		expect(hasLiveStrip(session({ gone: 'not-found' }))).toBe(false);
		expect(hasLiveStrip(session({ gone: 'refused' }))).toBe(false);
		expect(hasLiveStrip(session({ gone: 'ended' }))).toBe(true);
	});

	it('returns to the free reader of the session’s kind', () => {
		expect(liveReaderRouteFor('CEVSEN')).toBe('AllBabs');
		expect(liveReaderRouteFor('QURAN')).toBe('Mushaf');
	});

	it('upper-cases initials the Turkish way', () => {
		expect(initialsOf('ismail  yılmaz')).toBe('İY');
		expect(initialsOf('Zeynep')).toBe('Z');
	});

	it('announces the countdown in quarter minutes', () => {
		expect(announcedSecondsOf(60)).toBe(60);
		expect(announcedSecondsOf(48)).toBe(60);
		expect(announcedSecondsOf(45)).toBe(45);
		expect(announcedSecondsOf(1)).toBe(15);
	});
});
