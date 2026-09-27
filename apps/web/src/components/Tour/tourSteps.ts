import type { StringKey } from '@/lib/i18n/strings';

/**
 * The places the tour can point at. A step naming one of these draws its spotlight around
 * whatever registered under that id; a step naming none, or one whose screen has not laid out
 * yet, gets a centred card instead.
 */
export type TourTargetId =
	| 'groups'
	| 'read'
	| 'groupSummary'
	| 'myProgress'
	| 'assigned'
	| 'lastRound'
	| 'pool'
	| 'readerActions'
	| 'readerMap'
	| 'cuzActions'
	| 'cuzBookmark'
	| 'stats'
	| 'heatmap';

/**
 * Which screen a stop lives on. The tour navigates there itself before showing the card — see
 * `useTourNavigation` — because most of the stops describe things that are not on Ana sayfa.
 *
 * `group` and `reader` are the Cevşen leg's; `hatimGroup`, `cuz` and `cuzReader` the Kur'an
 * leg's — a demo hatim group, the cüz page and the Kur'an reader. Separate places because they
 * are separate screens (or the same screen for a different group), which the tour has to open.
 */
export type TourPlace = 'home' | 'group' | 'reader' | 'hatimGroup' | 'cuz' | 'cuzReader' | 'profile';

export type TourStep = {
	/** Which registered element to cut out of the scrim. Omitted → the card sits centred. */
	target?: TourTargetId;
	place: TourPlace;
	titleKey: StringKey;
	bodyKey: StringKey;
};

/**
 * Fifteen stops. The welcome card and the closing card are not steps — they carry their own
 * actions and the overlay handles them directly, which is why `TOUR_STEPS.length` is 15 and the
 * counter reads "1 / 15" rather than "2 / 17".
 *
 * **Two legs, one per reading.** Stops 3–9 walk a Cevşen group and its reader; 10–13 a Kur'an
 * group — its cüz, its havuz, a cüz's page and the Kur'an reader's bookmark.
 *
 * **What the tour leaves out is what explains itself**: the streak, sharing, the readers' Aa,
 * the inbox and its settings, and Profil's settings. Each stop is something whose use is not
 * obvious from looking at it — that Read *resumes*, that the tick strip can be dragged, what
 * marking your place in a cüz keeps.
 *
 * **A stop is one element, and the screen it is on comes with it.** Keeping `place` on the step
 * rather than in the navigation code means the order of the tour and the route it walks can
 * never disagree.
 */
export const TOUR_STEPS: readonly TourStep[] = [
	{ place: 'home', target: 'groups', titleKey: 'tour1Title', bodyKey: 'tour1Sub' },
	{ place: 'home', target: 'read', titleKey: 'tour2Title', bodyKey: 'tour2Sub' },
	{ place: 'group', target: 'groupSummary', titleKey: 'tour3Title', bodyKey: 'tour3Sub' },
	{ place: 'group', target: 'myProgress', titleKey: 'tour4Title', bodyKey: 'tour4Sub' },
	{ place: 'group', target: 'assigned', titleKey: 'tour5Title', bodyKey: 'tour5Sub' },
	{ place: 'group', target: 'lastRound', titleKey: 'tour6Title', bodyKey: 'tour6Sub' },
	{ place: 'group', target: 'pool', titleKey: 'tour7Title', bodyKey: 'tour7Sub' },
	{ place: 'reader', target: 'readerActions', titleKey: 'tour8Title', bodyKey: 'tour8Sub' },
	{ place: 'reader', target: 'readerMap', titleKey: 'tour9Title', bodyKey: 'tour9Sub' },
	{ place: 'hatimGroup', target: 'assigned', titleKey: 'tour10Title', bodyKey: 'tour10Sub' },
	{ place: 'hatimGroup', target: 'pool', titleKey: 'tour11Title', bodyKey: 'tour11Sub' },
	{ place: 'cuz', target: 'cuzActions', titleKey: 'tour12Title', bodyKey: 'tour12Sub' },
	{ place: 'cuzReader', target: 'cuzBookmark', titleKey: 'tour13Title', bodyKey: 'tour13Sub' },
	{ place: 'profile', target: 'stats', titleKey: 'tour14Title', bodyKey: 'tour14Sub' },
	{ place: 'profile', target: 'heatmap', titleKey: 'tour15Title', bodyKey: 'tour15Sub' }
] as const;

/** The three lines the welcome card previews, in the order the tour visits them. */
export const TOUR_STOPS: readonly StringKey[] = ['tourStop1', 'tourStop2', 'tourStop3'] as const;
