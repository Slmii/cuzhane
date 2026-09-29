import type { StringKey } from '@/lib/i18n/strings';

/**
 * The places the tour can point at. A stop naming one of these draws its spotlight around
 * whatever registered under that id; a stop whose screen has not laid out yet gets its card
 * without the cut-out until it has.
 */
export type TourTargetId =
	| 'nextCard'
	| 'newGroup'
	| 'assigned'
	| 'readerMap'
	| 'readMark'
	| 'cuzGrid'
	| 'cuzActions'
	| 'hizbToday'
	| 'counter';

/**
 * Which screen a stop lives on. The tour navigates there itself before showing the card — see
 * `useTourNavigation` — because most of the stops are not on Ana sayfa.
 *
 * `group` and `reader` are the Cevşen part's; `pickCuz` (a hatim you are joining) and `cuz` (one
 * you hold) the Kur'an part's; `hizbGroup` and `hizbReader` the Hizb part's.
 */
export type TourPlace = 'home' | 'groups' | 'group' | 'reader' | 'pickCuz' | 'cuz' | 'hizbGroup' | 'hizbReader';

/** The tour's parts (design T): a shared start, one per kind, and the close. */
export type TourLeg = 'start' | 'cevsen' | 'quran' | 'hizb' | 'end';

/** What Profil › Uygulama turu runs (TP): everything, or one kind's part on its own. */
export type TourChoice = 'all' | 'cevsen' | 'quran' | 'hizb';

export type TourStep = {
	leg: TourLeg;
	/**
	 * `intro` (T1) and `closing` (Z1) are centred cards with their own actions; `spot` is a card
	 * beside a spotlight.
	 */
	kind: 'intro' | 'spot' | 'closing';
	place: TourPlace;
	/** Which registered element to cut out of the scrim. Only a `spot` has one. */
	target?: TourTargetId;
	titleKey: StringKey;
	bodyKey: StringKey;
};

/**
 * Eleven stops in five parts (design T). The copy is numbered in visit order, `tour1` to `tour11`.
 *
 * **What the tour leaves out is what explains itself.** Each part shows the few things a reader of
 * that kind would not find alone: where your share is, how to mark a bab and that the strip can be
 * slid along (Cevşen), choosing a cüz and where your place is kept (Kur'an), today's reading and
 * how counting works (Hizb).
 *
 * **Two stops differ from the design's frames, on purpose.** T3 points at the Groups tab's "+"
 * (new group, or join with a code) rather than a code card on Keşfet the app does not have; and
 * the Cevşen part keeps the reader's bab strip after "Okudum", where the design's table has it
 * (C6), though its frames had dropped it.
 *
 * **A stop is one element, and the screen it is on comes with it.** Keeping `place` on the step
 * rather than in the navigation code means the order of the tour and the route it walks can
 * never disagree.
 */
export const TOUR_STEPS: readonly TourStep[] = [
	{ bodyKey: 'tour1Sub', kind: 'intro', leg: 'start', place: 'home', titleKey: 'tour1Title' },
	{ bodyKey: 'tour2Sub', kind: 'spot', leg: 'start', place: 'home', target: 'nextCard', titleKey: 'tour2Title' },
	{ bodyKey: 'tour3Sub', kind: 'spot', leg: 'start', place: 'groups', target: 'newGroup', titleKey: 'tour3Title' },
	{ bodyKey: 'tour4Sub', kind: 'spot', leg: 'cevsen', place: 'group', target: 'assigned', titleKey: 'tour4Title' },
	{ bodyKey: 'tour5Sub', kind: 'spot', leg: 'cevsen', place: 'reader', target: 'readMark', titleKey: 'tour5Title' },
	{ bodyKey: 'tour6Sub', kind: 'spot', leg: 'cevsen', place: 'reader', target: 'readerMap', titleKey: 'tour6Title' },
	{ bodyKey: 'tour7Sub', kind: 'spot', leg: 'quran', place: 'pickCuz', target: 'cuzGrid', titleKey: 'tour7Title' },
	{ bodyKey: 'tour8Sub', kind: 'spot', leg: 'quran', place: 'cuz', target: 'cuzActions', titleKey: 'tour8Title' },
	{ bodyKey: 'tour9Sub', kind: 'spot', leg: 'hizb', place: 'hizbGroup', target: 'hizbToday', titleKey: 'tour9Title' },
	{
		bodyKey: 'tour10Sub',
		kind: 'spot',
		leg: 'hizb',
		place: 'hizbReader',
		target: 'counter',
		titleKey: 'tour10Title'
	},
	{ bodyKey: 'tour11Sub', kind: 'closing', leg: 'end', place: 'home', titleKey: 'tour11Title' }
] as const;

/** Each part's label on its cards ("BAŞLANGIÇ · 2/3"). */
export const TOUR_LEG_LABEL: Record<TourLeg, StringKey> = {
	cevsen: 'tourLegCevsen',
	end: 'tourLegEnd',
	hizb: 'tourLegHizb',
	quran: 'tourLegQuran',
	start: 'tourLegStart'
};

/**
 * The run a choice makes. "Hepsi" is the whole tour; one kind is that part alone, with neither
 * the start nor the close — those introduce the app, and whoever picked a kind from Profil is
 * already in it.
 */
export const stepsFor = (choice: TourChoice): readonly TourStep[] =>
	choice === 'all' ? TOUR_STEPS : TOUR_STEPS.filter(step => step.leg === choice);

/** Which part a stop is in, and where in it: `n` of `of`, 1-based. */
export const legPosition = (run: readonly TourStep[], index: number) => {
	const leg = run[index]?.leg ?? 'end';
	const inLeg = run.filter(step => step.leg === leg);

	return { leg, n: run.slice(0, index + 1).filter(step => step.leg === leg).length, of: inLeg.length };
};

/** "Bu bölümü geç": the first stop of the next part, or the run's length when this is the last. */
export const nextLegStart = (run: readonly TourStep[], index: number) => {
	const leg = run[index]?.leg;
	const next = run.findIndex((step, position) => position > index && step.leg !== leg);

	return next === -1 ? run.length : next;
};
