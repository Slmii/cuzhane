import type { StringKey } from '@/lib/i18n/strings';

/**
 * The places the tour can point at. A step naming one of these draws its spotlight around
 * whatever registered under that id; a step naming none, or one whose screen has not laid out
 * yet, gets a centred card instead.
 */
export type TourTargetId =
	| 'streak'
	| 'groups'
	| 'read'
	| 'groupSummary'
	| 'myProgress'
	| 'assigned'
	| 'lastRound'
	| 'pool'
	| 'share'
	| 'readerActions'
	| 'readerFont'
	| 'inbox'
	| 'notifications'
	| 'stats'
	| 'heatmap'
	| 'settings';

/**
 * Which screen a stop lives on. The tour navigates there itself before showing the card — see
 * `useTourNavigation` — because most of the stops describe things that are not on Ana sayfa.
 *
 * `inbox` is the bell tab, `reminders` the settings one push inside it. Two places rather than
 * one because they are two screens: the inbox is a record of what happened, the settings decide
 * what reaches the phone, and a single card in front of both would have to describe neither.
 */
export type TourPlace = 'home' | 'group' | 'reader' | 'inbox' | 'reminders' | 'profile';

export type TourStep = {
	/** Which registered element to cut out of the scrim. Omitted → the card sits centred. */
	target?: TourTargetId;
	place: TourPlace;
	titleKey: StringKey;
	bodyKey: StringKey;
};

/**
 * Sixteen stops. The welcome card and the closing card are not steps — they carry their own
 * actions and the overlay handles them directly, which is why `TOUR_STEPS.length` is 16 and the
 * counter reads "1 / 16" rather than "2 / 18".
 *
 * **One of section O's stops is gone and seven are new.** The design's own list is
 * `streak · groups · tabs · mine · pool · rd · settings`; the bottom bar went because it names
 * itself under every icon. Added: the Read button (that it *resumes* is the one thing about
 * that row nobody guesses), the group's summary card, the closed round, sharing, the reader's
 * type controls split from its action bar, and Profil's numbers split from its settings — one
 * element each, in the order they are met on screen.
 *
 * **A stop is one element, and the screen it is on comes with it.** Keeping `place` on the step
 * rather than in the navigation code means the order of the tour and the route it walks can
 * never disagree.
 */
export const TOUR_STEPS: readonly TourStep[] = [
	{ place: 'home', target: 'streak', titleKey: 'tour1Title', bodyKey: 'tour1Sub' },
	{ place: 'home', target: 'groups', titleKey: 'tour2Title', bodyKey: 'tour2Sub' },
	{ place: 'home', target: 'read', titleKey: 'tour3Title', bodyKey: 'tour3Sub' },
	{ place: 'group', target: 'groupSummary', titleKey: 'tour4Title', bodyKey: 'tour4Sub' },
	{ place: 'group', target: 'myProgress', titleKey: 'tour5Title', bodyKey: 'tour5Sub' },
	{ place: 'group', target: 'assigned', titleKey: 'tour6Title', bodyKey: 'tour6Sub' },
	{ place: 'group', target: 'lastRound', titleKey: 'tour7Title', bodyKey: 'tour7Sub' },
	{ place: 'group', target: 'pool', titleKey: 'tour8Title', bodyKey: 'tour8Sub' },
	{ place: 'group', target: 'share', titleKey: 'tour9Title', bodyKey: 'tour9Sub' },
	{ place: 'reader', target: 'readerActions', titleKey: 'tour10Title', bodyKey: 'tour10Sub' },
	{ place: 'reader', target: 'readerFont', titleKey: 'tour11Title', bodyKey: 'tour11Sub' },
	{ place: 'inbox', target: 'inbox', titleKey: 'tour12Title', bodyKey: 'tour12Sub' },
	{ place: 'reminders', target: 'notifications', titleKey: 'tour13Title', bodyKey: 'tour13Sub' },
	{ place: 'profile', target: 'stats', titleKey: 'tour14Title', bodyKey: 'tour14Sub' },
	{ place: 'profile', target: 'heatmap', titleKey: 'tour15Title', bodyKey: 'tour15Sub' },
	{ place: 'profile', target: 'settings', titleKey: 'tour16Title', bodyKey: 'tour16Sub' }
] as const;

/** The three lines the welcome card previews, in the order the tour visits them. */
export const TOUR_STOPS: readonly StringKey[] = ['tourStop1', 'tourStop2', 'tourStop3'] as const;
