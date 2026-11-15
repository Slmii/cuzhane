import type { IconName } from '@/components/ui/Icon/Icon.types';
import type { StringKey } from '@/lib/i18n/strings';
import type { GroupKind } from '@/lib/types/domain';
import { APP_VERSION } from '@/lib/utils/appVersion';

/**
 * What "Neler yeni" shows (design P1 and P3).
 *
 * **Content, not copy.** Every line lives in `strings.ts` like the rest of the app, so release
 * notes are translated rather than written once in Turkish and left. This file holds only the
 * shape: which release, which entries, and which mark each one wears.
 */
export type ReleaseNoteEntry = {
	icon: IconName;
	titleKey: StringKey;
	bodyKey: StringKey;
	/** Wears the "YENİ" tag, and only in the full list — the sheet shows no tags. */
	isNew: boolean;
	/** The books it is for, as chips beside the title — none when it is for every group. */
	kinds?: GroupKind[];
};

export type Release = {
	/**
	 * **What the sheet is gated on, and it is never displayed.**
	 *
	 * Not the app version, deliberately. `version` is the *store's* marketing number and changes
	 * only when a binary ships; a release announced over the air lands on the version already
	 * installed. Keying the gate on the version therefore forced a choice between announcing
	 * nothing for OTA releases and bumping `version` without building — which is what made
	 * Profil's row read 1.1.0 while the App Store said 1.0.1.
	 *
	 * Bump this for every release you want to announce, OTA or not. A date-and-subject string
	 * reads better in a diff than a number that means nothing outside this file.
	 */
	id: string;
	/**
	 * The store version to show in the eyebrow. `null` on the newest, which takes the version
	 * actually running — see `APP_VERSION`. Every release below it carries its own string.
	 */
	version: string | null;
	/**
	 * The day it shipped, `YYYY-MM-DD`.
	 *
	 * **A date rather than a per-language month string.** It was `monthKey`, pointing at
	 * "Eylül 2026" / "September 2026" in the strings table — three keys per release, hand-
	 * written, and no day on any of them. `Intl` gets the day *and* the order right in each
	 * language on its own: "20 Eylül 2026", "September 20, 2026", "20 september 2026".
	 */
	releasedOn: string;
	entries: ReleaseNoteEntry[];
};

/**
 * Every release, **newest first**.
 *
 * **One list rather than a current release and a separate archive.** Shipping a release is then
 * prepending one object: nothing is moved, nothing is reshaped, and nothing is lost by forgetting
 * to move it. The previous arrangement had `CURRENT_RELEASE` overwritten each time and an
 * `EARLIER_RELEASES` you were meant to hand-copy the outgoing one into first — a step whose
 * omission looked *fine*, because the new release read correctly and only the history went
 * quietly missing.
 *
 * Older releases keep their full entries here rather than being flattened to a summary line. The
 * design draws them as one line apiece; a line reading "Sürüm 1.1 · çeşitli iyileştirmeler" says
 * less than the three things that actually changed, and P3 scrolls.
 *
 * **1.0.0 and 1.0.1 are deliberately absent.** They shipped before any of this existed and there
 * are no notes for them — writing some now would be inventing a changelog, which is the one thing
 * release notes must not do.
 *
 * To ship a release: prepend an entry here with a fresh `id`, its own keys and its month, and give
 * the release that was at the top its literal `version` string in place of `null`. **Bump
 * `app.json`'s `version` only when you are actually building** — an update that goes out over the
 * air lands on the version already installed, and saying otherwise puts the app and the store
 * listing at odds.
 */
export const RELEASES: Release[] = [
	{
		id: '2026-10-sahsi',
		entries: [
			{
				bodyKey: 'rn150LiveBody',
				icon: 'mic',
				isNew: true,
				kinds: ['CEVSEN', 'HATIM'],
				titleKey: 'rn150LiveTitle'
			},
			{
				bodyKey: 'rn150SahsiBody',
				icon: 'book',
				isNew: true,
				kinds: ['CEVSEN', 'HATIM'],
				titleKey: 'rn150SahsiTitle'
			},
			{ bodyKey: 'rn150AheadBody', icon: 'calendar', isNew: true, titleKey: 'rn150AheadTitle' },
			{
				bodyKey: 'rn150ReadersBody',
				icon: 'members',
				isNew: true,
				kinds: ['HIZB'],
				titleKey: 'rn150ReadersTitle'
			},
			{
				bodyKey: 'rn150PlaceBody',
				icon: 'bookmark',
				isNew: true,
				kinds: ['HATIM', 'HIZB'],
				titleKey: 'rn150PlaceTitle'
			},
			{ bodyKey: 'rn150ProfileBody', icon: 'completed', isNew: true, titleKey: 'rn150ProfileTitle' }
		],
		releasedOn: '2026-10-02',
		version: APP_VERSION
	},
	{
		id: '2026-09-hizb',
		entries: [
			{ bodyKey: 'rn140HizbBody', icon: 'book', isNew: true, titleKey: 'rn140HizbTitle' },
			{ bodyKey: 'rn140CountBody', icon: 'countdown', isNew: true, titleKey: 'rn140CountTitle' },
			{ bodyKey: 'rn140HistoryBody', icon: 'members', isNew: true, titleKey: 'rn140HistoryTitle' },
			{ bodyKey: 'rn140PrivacyBody', icon: 'eyeOff', isNew: true, titleKey: 'rn140PrivacyTitle' }
		],
		releasedOn: '2026-09-29',
		version: '1.4.0'
	},
	{
		id: '2026-09-quran',
		entries: [
			{ bodyKey: 'rn130HatimBody', icon: 'book', isNew: true, titleKey: 'rn130HatimTitle' },
			{ bodyKey: 'rn130MushafBody', icon: 'readInApp', isNew: true, titleKey: 'rn130MushafTitle' },
			{ bodyKey: 'rn130GoBody', icon: 'goTo', isNew: true, titleKey: 'rn130GoTitle' }
		],
		releasedOn: '2026-09-26',
		version: '1.3.0'
	},
	{
		id: '2026-09-my-progress',
		entries: [
			{ bodyKey: 'rn120ProgressBody', icon: 'calendar', isNew: true, titleKey: 'rn120ProgressTitle' },
			{ bodyKey: 'rn120CatchUpBody', icon: 'claim', isNew: true, titleKey: 'rn120CatchUpTitle' },
			{ bodyKey: 'rn120NotificationBody', icon: 'bell', isNew: false, titleKey: 'rn120NotificationTitle' }
		],
		releasedOn: '2026-09-20',
		version: '1.2.0'
	},
	{
		id: '2026-09-notifications',
		entries: [
			{ bodyKey: 'rn110InboxBody', icon: 'alert', isNew: true, titleKey: 'rn110InboxTitle' },
			{ bodyKey: 'rn110SettingsBody', icon: 'settings', isNew: true, titleKey: 'rn110SettingsTitle' },
			{ bodyKey: 'rn110EventsBody', icon: 'members', isNew: true, titleKey: 'rn110EventsTitle' }
		],
		releasedOn: '2026-09-18',
		version: '1.1.0'
	}
];

/**
 * The release this build announces — what the sheet shows, and what the version gate compares
 * against. Always the head of the list.
 */
export const CURRENT_RELEASE = RELEASES[0];

/**
 * Everything before it, newest first — what "Önceki sürümler" lists.
 *
 * The filter is a guard as much as a narrowing: `null` means "read the number from the build",
 * which is only ever true of the release at the top. One left behind on a release that has been
 * pushed down is a mistake — it would print the *running* version's number beside an old
 * release's notes — so such an entry is dropped rather than rendered wrong.
 */
export const EARLIER_RELEASES = RELEASES.slice(1).filter(
	(release): release is Release & { version: string } => release.version !== null
);

/**
 * "20 Eylül 2026" — the release's day, in the reader's language.
 *
 * **Parsed field by field, not handed to `new Date('2026-09-20')`.** That form is treated as
 * UTC, so for anybody west of Greenwich it formats as the day before.
 */
export const releaseDateLabel = (releasedOn: string, language: string): string => {
	const [year, month, day] = releasedOn.split('-').map(Number);

	return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).format(
		new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
	);
};
