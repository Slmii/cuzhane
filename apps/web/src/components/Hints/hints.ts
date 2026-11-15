import type { StringKey } from '@/lib/i18n/strings';

/**
 * The places a hint can point at. A screen marks one with `HintTarget`; a hint naming it waits
 * until it is registered and on screen.
 */
export type HintTargetId =
	| 'nextCard'
	| 'homeLater'
	| 'homeReadToday'
	| 'newGroup'
	| 'groupStats'
	| 'assigned'
	| 'myProgressBanner'
	| 'lastRound'
	| 'poolRow'
	| 'groupBoard'
	| 'progressStats'
	| 'progressStrip'
	| 'progressMissed'
	| 'textSize'
	| 'readerMap'
	| 'readMark'
	| 'cuzGrid'
	| 'cuzStatus'
	| 'cuzReadInApp'
	| 'cuzContents'
	| 'bookmark'
	| 'planClock'
	| 'hizbToday'
	| 'planAhead'
	| 'planCatchup'
	| 'planBanner'
	| 'planReaders'
	| 'planRounds'
	| 'planRound'
	| 'planHistory'
	| 'counter'
	| 'liveButton';

/**
 * Which screen a hint belongs to — the screen says so itself with `useHintScreen` while it is
 * focused. `group` is a seat-divided group (Cevşen, hatim, or a Hizb split by seat) and
 * `hizbGroup` one read on a personal plan; `reader` is the Cevşen's bab reader, in a group or on
 * a Şahsi plan; `freeReader` is the free Mushaf and the free Cevşen.
 *
 * `pool`, `rounds`, `roundDetail`, `hizbMissed`, `planHistory` and `groupHistory` have one
 * centred card each: it says what the page is for and points at nothing.
 */
export type HintScreen =
	| 'home'
	| 'groups'
	| 'group'
	| 'myProgress'
	| 'pool'
	| 'rounds'
	| 'roundDetail'
	| 'reader'
	| 'pickCuz'
	| 'cuz'
	| 'cuzReader'
	| 'hizbGroup'
	| 'hizbMissed'
	| 'planHistory'
	| 'groupHistory'
	| 'hizbReader'
	| 'freeReader';

export type Hint = {
	/**
	 * What the server records as seen. **Never reused and never renamed**: an account that saw a
	 * hint keeps its id, and a new hint under an old id would count as already seen.
	 */
	id: string;
	screen: HintScreen;
	/** What it points at; `null` is a centred card — the welcome, or a page's explainer. */
	target: HintTargetId | null;
	/** Its place in its screen's sequence. */
	order: number;
	titleKey: StringKey;
	bodyKey: StringKey;
};

/** What the server accepts as an id. */
export const HINT_ID_PATTERN = /^[a-z][a-zA-Z0-9.]{0,63}$/;

/** The one hint with no target: the first card the app ever shows, on Ana sayfa. */
export const WELCOME_HINT_ID = 'welcome';

/** "Birlikte oku"'s hint — once a phone-local flag, imported into the account (`liveHintSeen`). */
export const LIVE_HINT_ID = 'freeReader.live';

/**
 * Every hint, on the real screens only. A hint describes what is in front of the reader, so it
 * waits for its target rather than showing anything made up — a section that comes later (read
 * ahead, a catch-up, a later reading) gets its hint when it first appears.
 *
 * Gruplarım's + opens a native menu, which nothing can be drawn over; its items are explained
 * one by one on the + itself. Retired ids (`cuz.actions`) are never reused.
 */
export const HINTS: readonly Hint[] = [
	{
		bodyKey: 'hintWelcomeBody',
		id: WELCOME_HINT_ID,
		order: 0,
		screen: 'home',
		target: null,
		titleKey: 'hintWelcomeTitle'
	},
	{
		bodyKey: 'hintHomeNextCardBody',
		id: 'home.nextCard',
		order: 1,
		screen: 'home',
		target: 'nextCard',
		titleKey: 'hintHomeNextCardTitle'
	},
	{
		bodyKey: 'hintHomeLaterBody',
		id: 'home.later',
		order: 2,
		screen: 'home',
		target: 'homeLater',
		titleKey: 'homeLater'
	},
	{
		bodyKey: 'hintHomeReadTodayBody',
		id: 'home.readToday',
		order: 3,
		screen: 'home',
		target: 'homeReadToday',
		titleKey: 'homeReadToday'
	},
	{
		bodyKey: 'hintGroupsNewGroupBody',
		id: 'groups.newGroup',
		order: 0,
		screen: 'groups',
		target: 'newGroup',
		titleKey: 'hintGroupsNewGroupTitle'
	},
	{
		bodyKey: 'hintGroupsMenuNewBody',
		id: 'groups.menuNew',
		order: 1,
		screen: 'groups',
		target: 'newGroup',
		titleKey: 'newGroup'
	},
	{
		bodyKey: 'hintGroupsMenuCodeBody',
		id: 'groups.menuCode',
		order: 2,
		screen: 'groups',
		target: 'newGroup',
		titleKey: 'haveCode'
	},
	{
		bodyKey: 'hintGroupsMenuLiveBody',
		id: 'groups.menuLive',
		order: 3,
		screen: 'groups',
		target: 'newGroup',
		titleKey: 'liveJoinMenu'
	},
	{
		bodyKey: 'hintGroupStatsBody',
		id: 'group.stats',
		order: 0,
		screen: 'group',
		target: 'groupStats',
		titleKey: 'hintGroupStatsTitle'
	},
	{
		bodyKey: 'hintGroupAssignedBody',
		id: 'group.assigned',
		order: 1,
		screen: 'group',
		target: 'assigned',
		titleKey: 'hintGroupAssignedTitle'
	},
	{
		bodyKey: 'hintGroupMyProgressBody',
		id: 'group.myProgress',
		order: 2,
		screen: 'group',
		target: 'myProgressBanner',
		titleKey: 'myProgress'
	},
	{
		bodyKey: 'hintGroupLastRoundBody',
		id: 'group.lastRound',
		order: 3,
		screen: 'group',
		target: 'lastRound',
		titleKey: 'lastRound'
	},
	{
		bodyKey: 'hintGroupPoolBody',
		id: 'group.pool',
		order: 4,
		screen: 'group',
		target: 'poolRow',
		titleKey: 'pool'
	},
	{
		bodyKey: 'hintGroupBoardBody',
		id: 'group.board',
		order: 5,
		screen: 'group',
		target: 'groupBoard',
		titleKey: 'hintGroupBoardTitle'
	},
	{
		bodyKey: 'hintProgressStatsBody',
		id: 'myProgress.stats',
		order: 0,
		screen: 'myProgress',
		target: 'progressStats',
		titleKey: 'hintProgressStatsTitle'
	},
	{
		bodyKey: 'hintProgressStripBody',
		id: 'myProgress.strip',
		order: 1,
		screen: 'myProgress',
		target: 'progressStrip',
		titleKey: 'hintProgressStripTitle'
	},
	{
		bodyKey: 'hintProgressMissedBody',
		id: 'myProgress.missed',
		order: 2,
		screen: 'myProgress',
		target: 'progressMissed',
		titleKey: 'hintProgressMissedTitle'
	},
	{
		bodyKey: 'hintPoolBody',
		id: 'pool.intro',
		order: 0,
		screen: 'pool',
		target: null,
		titleKey: 'pool'
	},
	{
		bodyKey: 'hintRoundsBody',
		id: 'rounds.intro',
		order: 0,
		screen: 'rounds',
		target: null,
		titleKey: 'rounds'
	},
	{
		bodyKey: 'hintRoundDetailBody',
		id: 'roundDetail.intro',
		order: 0,
		screen: 'roundDetail',
		target: null,
		titleKey: 'hintRoundDetailTitle'
	},
	{
		bodyKey: 'hintReaderTextSizeBody',
		id: 'reader.textSize',
		order: 0,
		screen: 'reader',
		target: 'textSize',
		titleKey: 'textSize'
	},
	{
		bodyKey: 'hintReaderMapBody',
		id: 'reader.map',
		order: 1,
		screen: 'reader',
		target: 'readerMap',
		titleKey: 'hintReaderMapTitle'
	},
	{
		bodyKey: 'hintReaderReadMarkBody',
		id: 'reader.readMark',
		order: 2,
		screen: 'reader',
		target: 'readMark',
		titleKey: 'hintReaderReadMarkTitle'
	},
	{
		bodyKey: 'hintPickCuzGridBody',
		id: 'pickCuz.grid',
		order: 0,
		screen: 'pickCuz',
		target: 'cuzGrid',
		titleKey: 'hintPickCuzGridTitle'
	},
	{
		bodyKey: 'hintCuzStatusBody',
		id: 'cuz.status',
		order: 0,
		screen: 'cuz',
		target: 'cuzStatus',
		titleKey: 'hintCuzStatusTitle'
	},
	{
		bodyKey: 'hintCuzReadInAppBody',
		id: 'cuz.readInApp',
		order: 1,
		screen: 'cuz',
		target: 'cuzReadInApp',
		titleKey: 'qReadInApp'
	},
	{
		bodyKey: 'hintCuzContentsBody',
		id: 'cuz.contents',
		order: 2,
		screen: 'cuz',
		target: 'cuzContents',
		titleKey: 'qCuzContents'
	},
	{
		bodyKey: 'hintCuzReaderBookmarkBody',
		id: 'cuzReader.bookmark',
		order: 0,
		screen: 'cuzReader',
		target: 'bookmark',
		titleKey: 'hintCuzReaderBookmarkTitle'
	},
	{
		bodyKey: 'hintPlanClockBody',
		id: 'hizbGroup.clock',
		order: 0,
		screen: 'hizbGroup',
		target: 'planClock',
		titleKey: 'hintPlanClockTitle'
	},
	{
		bodyKey: 'hintHizbGroupTodayBody',
		id: 'hizbGroup.today',
		order: 1,
		screen: 'hizbGroup',
		target: 'hizbToday',
		titleKey: 'hintHizbGroupTodayTitle'
	},
	{
		bodyKey: 'hintPlanAheadBody',
		id: 'hizbGroup.ahead',
		order: 2,
		screen: 'hizbGroup',
		target: 'planAhead',
		titleKey: 'hpAheadEyebrow'
	},
	{
		bodyKey: 'hintPlanCatchupBody',
		id: 'hizbGroup.catchup',
		order: 3,
		screen: 'hizbGroup',
		target: 'planCatchup',
		titleKey: 'hintPlanCatchupTitle'
	},
	{
		bodyKey: 'hintPlanBannerBody',
		id: 'hizbGroup.myProgress',
		order: 4,
		screen: 'hizbGroup',
		target: 'planBanner',
		titleKey: 'myProgress'
	},
	{
		bodyKey: 'hintPlanReadersBody',
		id: 'hizbGroup.readers',
		order: 5,
		screen: 'hizbGroup',
		target: 'planReaders',
		titleKey: 'hpGroupProgress'
	},
	{
		bodyKey: 'hintPlanRoundsBody',
		id: 'hizbGroup.rounds',
		order: 6,
		screen: 'hizbGroup',
		target: 'planRounds',
		titleKey: 'rounds'
	},
	{
		bodyKey: 'hintPlanRoundBody',
		id: 'hizbGroup.round',
		order: 7,
		screen: 'hizbGroup',
		target: 'planRound',
		titleKey: 'hintPlanRoundTitle'
	},
	{
		bodyKey: 'hintPlanHistoryBody',
		id: 'hizbGroup.history',
		order: 8,
		screen: 'hizbGroup',
		target: 'planHistory',
		titleKey: 'hpHistoryTitle'
	},
	{
		bodyKey: 'hintHizbMissedBody',
		id: 'hizbMissed.intro',
		order: 0,
		screen: 'hizbMissed',
		target: null,
		titleKey: 'hpMissedTitle'
	},
	{
		bodyKey: 'hintPlanHistoryIntroBody',
		id: 'planHistory.intro',
		order: 0,
		screen: 'planHistory',
		target: null,
		titleKey: 'hpAllHistory'
	},
	{
		bodyKey: 'hintGroupHistoryBody',
		id: 'groupHistory.intro',
		order: 0,
		screen: 'groupHistory',
		target: null,
		titleKey: 'hintGroupHistoryTitle'
	},
	{
		bodyKey: 'hintHizbReaderCounterBody',
		id: 'hizbReader.counter',
		order: 0,
		screen: 'hizbReader',
		target: 'counter',
		titleKey: 'hintHizbReaderCounterTitle'
	},
	{
		bodyKey: 'hintFreeReaderLiveBody',
		id: LIVE_HINT_ID,
		order: 0,
		screen: 'freeReader',
		target: 'liveButton',
		titleKey: 'hintFreeReaderLiveTitle'
	}
];

/**
 * What the server counts as seen for an account that finished the old tour (`hasSeenTour`): the
 * welcome only — every screen hint is new to existing readers too. Matches the server's list.
 */
export const LEGACY_TOUR_HINT_IDS = ['welcome'] as const;
