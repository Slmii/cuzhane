import type {
	AppNotification,
	GroupBab,
	GroupCycle,
	GroupDetail,
	GroupSummary,
	GroupVisibility,
	MyProgress,
	MyProgressPeriod,
	ProfileStats,
	RoundSummary
} from '@/lib/types/domain';

/**
 * Stand-in data for the first-use tour, and the reason it exists: **the tour opens on an account
 * that has nothing.**
 *
 * It runs straight after onboarding, when Ana sayfa is `HomeEmptyState`, the group screen cannot
 * be reached at all and Profil reads zero babs over an empty month. Ten of the thirteen stops
 * describe things that are not on screen, so the walkthrough would be a tour of a blank app —
 * and the rest would pause on a spinner each time it navigated.
 *
 * So while the tour is running, the queries behind those screens answer with this instead —
 * **for everybody, not only for an empty account**. It was conditional at first, so that a reader
 * with real groups would walk their own; that made the walkthrough two different things, because
 * the copy has to describe what is on screen and what was on screen depended on who was looking.
 * The cost is that a reader with groups of their own sees these three and these numbers for the
 * minute it lasts, and their own are one tap away the moment it ends.
 *
 * **Three groups, because one is not a shelf.** Stop 2 says "each row is a group" and stop 3 says
 * Read resumes — both need a list to be pointing at. The three differ in the ways the rows
 * actually differ: one owned and mid-share, one joined and nearly done, one finished, which is
 * the row that sinks to the bottom and reads "Tamam". Everything is deliberately unremarkable,
 * because it is a demonstration rather than a brag.
 *
 * **Each group is built by one factory**, so its share, its board, its counts and its rounds
 * cannot disagree with each other — the group screen derives the assigned panel's progress from
 * the babs, not from `myReadCount`, and a hand-written pair would drift the moment either moved.
 */

/** Fixed offsets from now, so the countdowns and the heatmap read as live. */
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const DEMO_USER_ID = 'tour-demo-user';
const SHARE_LENGTH = 13;

type DemoGroupSpec = {
	id: string;
	name: string;
	dedication: string | null;
	cycle: GroupCycle;
	visibility: GroupVisibility;
	isOwner: boolean;
	openToJoin: boolean;
	memberCount: number;
	/** Where the viewer's thirteen babs start. */
	shareStart: number;
	/** How many of those thirteen are already read — 13 is a finished share. */
	readInShare: number;
	/** Babs read by everyone else, so the hundred-cell board is not almost empty. */
	othersReadCount: number;
	/** Where the seats nobody took begin, or null for a group with no pool. */
	poolStart: number | null;
	/** Hours until this group's round rolls over. */
	hoursLeft: number;
	inviteCode: string;
};

const SPOTS = 8;

const SPECS: DemoGroupSpec[] = [
	{
		cycle: 'DAILY',
		dedication: 'Ailemiz için',
		hoursLeft: 6,
		id: 'tour-demo-group-1',
		inviteCode: 'AILE-7K2M',
		isOwner: true,
		memberCount: 5,
		name: 'Aile Hatmi',
		openToJoin: true,
		othersReadCount: 39,
		poolStart: 66,
		readInShare: 2,
		shareStart: 40,
		visibility: 'PRIVATE'
	},
	{
		cycle: 'DAILY',
		dedication: 'Nesilden nesile',
		hoursLeft: 6,
		id: 'tour-demo-group-2',
		inviteCode: 'SILS-4P9C',
		isOwner: false,
		memberCount: SPOTS,
		name: 'Silsile Hatmi',
		openToJoin: true,
		othersReadCount: 55,
		poolStart: null,
		readInShare: 9,
		shareStart: 14,
		visibility: 'OPEN'
	},
	{
		cycle: 'WEEKLY',
		dedication: null,
		hoursLeft: 51,
		id: 'tour-demo-group-3',
		inviteCode: 'SUKR-2X8B',
		isOwner: false,
		memberCount: 6,
		name: 'Şükür Hatmi',
		openToJoin: false,
		othersReadCount: 61,
		poolStart: 27,
		readInShare: SHARE_LENGTH,
		shareStart: 79,
		visibility: 'PRIVATE'
	}
];

const shareOf = (spec: DemoGroupSpec) => Array.from({ length: SHARE_LENGTH }, (_, index) => spec.shareStart + index);

const poolOf = (spec: DemoGroupSpec) =>
	spec.poolStart === null ? [] : Array.from({ length: SHARE_LENGTH }, (_, index) => spec.poolStart! + index);

/**
 * The hundred, with a believable spread of reads: the first of the viewer's own share, then as
 * many of everybody else's as the spec asks for, taken in order from the start of the cevşen so
 * the board fills from the top the way a real one does.
 */
const babsOf = (spec: DemoGroupSpec): GroupBab[] => {
	const share = new Set(shareOf(spec));
	const readShare = new Set(shareOf(spec).slice(0, spec.readInShare));
	const readOthers = new Set<number>();

	for (let number = 1; number <= 100 && readOthers.size < spec.othersReadCount; number += 1) {
		if (!share.has(number)) {
			readOthers.add(number);
		}
	}

	return Array.from({ length: 100 }, (_, index) => {
		const number = index + 1;
		const isMine = readShare.has(number);
		const isRead = isMine || readOthers.has(number);

		return {
			assignedUserId: null,
			number,
			readAt: isRead ? daysAgo(0) : null,
			readByDisplayName: isRead ? (isMine ? null : 'Yusuf') : null,
			readByUserId: isRead ? (isMine ? DEMO_USER_ID : 'tour-demo-other') : null
		};
	});
};

const summaryOf = (spec: DemoGroupSpec): GroupSummary => {
	const share = shareOf(spec);
	const pool = poolOf(spec);
	const readCount = spec.readInShare + spec.othersReadCount;
	const nextRoundStart = spec.shareStart + SHARE_LENGTH;

	return {
		completedAt: null,
		createdAt: daysAgo(24),
		cycle: spec.cycle,
		daysLeft: spec.cycle === 'WEEKLY' ? 2 : null,
		dedication: spec.dedication,
		endsAt: null,
		id: spec.id,
		isFull: spec.memberCount >= SPOTS,
		isMember: true,
		isOwner: spec.isOwner,
		kind: 'CEVSEN',
		memberCount: spec.memberCount,
		myBabNumbers: share,
		// Null once the share is done, which is what turns Ana sayfa's button into "Tamam".
		myNextBabNumber: share[spec.readInShare] ?? null,
		myNextRoundRange: { end: nextRoundStart + SHARE_LENGTH - 1, start: nextRoundStart },
		myPoolBabNumbers: [],
		myReadCount: spec.readInShare,
		myRoundRange: { end: spec.shareStart + SHARE_LENGTH - 1, start: spec.shareStart },
		mySlotIndex: 3,
		name: spec.name,
		openToJoin: spec.openToJoin,
		partCount: 100,
		percent: readCount,
		poolAllBabNumbers: pool,
		poolBabNumbers: pool,
		readCount,
		roundEndsAt: hoursFromNow(spec.hoursLeft),
		roundIndex: 9,
		roundStartedAt: hoursFromNow(spec.hoursLeft - 24),
		spots: SPOTS,
		spotsLeft: Math.max(SPOTS - spec.memberCount, 0),
		splitMode: 'ROTATION',
		startedAt: daysAgo(24),
		status: 'RUNNING',
		timezone: 'Europe/Istanbul',
		visibility: spec.visibility
	};
};

const detailOf = (spec: DemoGroupSpec): GroupDetail => ({
	...summaryOf(spec),
	autoStartWhenFull: false,
	babs: babsOf(spec),
	inviteCode: spec.inviteCode,
	members: [
		{
			babNumbers: shareOf(spec),
			cheeredByMe: false,
			displayName: 'Sen',
			id: `${spec.id}-member`,
			imageUrl: null,
			joinedAt: daysAgo(24),
			percent: Math.round((spec.readInShare / SHARE_LENGTH) * 100),
			readCount: spec.readInShare,
			role: spec.isOwner ? 'OWNER' : 'MEMBER',
			slotIndex: 3,
			userId: DEMO_USER_ID
		}
	],
	ownerUserId: spec.isOwner ? DEMO_USER_ID : 'tour-demo-other',
	poolReleases: [],
	reminderEnabled: true,
	reminderTime: '21:30',
	startsAt: daysAgo(24)
});

const roundsOf = (spec: DemoGroupSpec): RoundSummary[] => [
	{
		endsAt: hoursFromNow(spec.hoursLeft),
		isOpen: true,
		missedCount: 0,
		myOwedCount: SHARE_LENGTH,
		myReadCount: spec.readInShare,
		partCount: 100,
		readCount: spec.readInShare + spec.othersReadCount,
		roundIndex: 9,
		startedAt: hoursFromNow(spec.hoursLeft - 24)
	},
	{
		endsAt: hoursFromNow(spec.hoursLeft - 24),
		isOpen: false,
		missedCount: 12,
		myOwedCount: SHARE_LENGTH,
		myReadCount: SHARE_LENGTH,
		partCount: 100,
		readCount: 88,
		roundIndex: 8,
		startedAt: hoursFromNow(spec.hoursLeft - 48)
	}
];

export const TOUR_DEMO_GROUPS: GroupSummary[] = SPECS.map(summaryOf);

/** The group the tour walks, and the bab its reader stop opens: the first row on Ana sayfa. */
export const TOUR_DEMO_SUBJECT = {
	babNumber: SPECS[0]!.shareStart + SPECS[0]!.readInShare,
	groupId: SPECS[0]!.id
};

/** Whichever of the three was opened — the first, unless the reader was somewhere else. */
const specFor = (groupId: string) => SPECS.find(spec => spec.id === groupId) ?? SPECS[0]!;

export const tourDemoGroup = (groupId: string): GroupDetail => detailOf(specFor(groupId));
export const tourDemoBabs = (groupId: string): GroupBab[] => babsOf(specFor(groupId));
export const tourDemoRounds = (groupId: string): RoundSummary[] => roundsOf(specFor(groupId));

/**
 * Seven periods for the "Senin ilerlemen" card — the walkthrough passes over it between
 * the assigned-babs stop and the closed-round one, and without a fixture it would sit
 * there loading (or erroring) against a group id that does not exist.
 *
 * Built from the same spec as everything else, so the card cannot contradict the shelf
 * behind it: the open period carries the spec's own `readInShare`, and the six closed ones
 * are a plausible run rather than a perfect record — a strip of seven full cells would
 * show none of the three colours the legend explains.
 */
const CLOSED_READS = [13, 13, 9, 13, 0, 13];

export const tourDemoMyProgress = (groupId: string): MyProgress => {
	const spec = specFor(groupId);
	const periods: MyProgressPeriod[] = CLOSED_READS.map((readCount, index) => ({
		endsAt: hoursFromNow(spec.hoursLeft - 24 * (CLOSED_READS.length - index)),
		isOpen: false,
		missedBabs: Array.from({ length: SHARE_LENGTH - readCount }, (_, offset) => ({
			babNumber: spec.shareStart + readCount + offset,
			roundIndex: 9 - (CLOSED_READS.length - index)
		})),
		missedCount: SHARE_LENGTH - readCount,
		owedCount: SHARE_LENGTH,
		readCount,
		roundIndex: 9 - (CLOSED_READS.length - index),
		startedAt: hoursFromNow(spec.hoursLeft - 24 * (CLOSED_READS.length - index + 1))
	}));

	periods.push({
		endsAt: hoursFromNow(spec.hoursLeft),
		isOpen: true,
		missedBabs: [],
		missedCount: 0,
		owedCount: SHARE_LENGTH,
		readCount: spec.readInShare,
		roundIndex: 9,
		startedAt: hoursFromNow(spec.hoursLeft - 24)
	});

	const owedCount = periods.length * SHARE_LENGTH;
	const readCount = periods.reduce((total, period) => total + period.readCount, 0);

	return {
		cycle: 'DAILY',
		missedCount: CLOSED_READS.reduce((total, read) => total + (SHARE_LENGTH - read), 0),
		owedCount,
		periods,
		ratePercent: Math.round((readCount / owedCount) * 100),
		readCount
	};
};

/**
 * `YYYY-MM-DD` in the reader's own calendar, as `weekStrip` writes it. `toISOString` would roll
 * the key back a day for anyone west of Greenwich in the evening.
 */
const localKey = (date: Date): string => {
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');

	return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * **The demo's month ends on the most recent Friday, not on today.**
 *
 * Home's week strip is the calendar week containing the last entry, Monday first, with the days
 * still ahead drawn faint — so a month that ended on a Monday gave a card reading "6 gün" over
 * six blank squares, which is the opposite of what that stop is pointing at. Ending on a Friday
 * shows a week taking shape: five days behind and two ahead, whatever day the tour is opened on.
 */
const DEMO_WEEKDAY = 5;

const demoToday = () => {
	const now = new Date();
	const back = (now.getDay() - DEMO_WEEKDAY + 7) % 7;

	return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
};

/**
 * Days before that Friday which were read: the six-day run the card counts, a break, a short run
 * before it, and the nine-day run that is the "longest ever" the card compares against.
 */
const READ_DAY_OFFSETS = new Set([0, 1, 2, 3, 4, 5, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
const BABS_PER_DAY = [5, 7, 4, 6, 3];

const DEMO_LAST_30_DAYS = Array.from({ length: 30 }, (_, index) => {
	const offset = 29 - index;
	const base = demoToday();
	const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset);

	return {
		count: READ_DAY_OFFSETS.has(offset) ? BABS_PER_DAY[offset % BABS_PER_DAY.length] ?? 0 : 0,
		date: localKey(date)
	};
});

export const TOUR_DEMO_PROFILE_STATS: ProfileStats = {
	// The month's own total, so the tile and the heatmap under it cannot disagree.
	babsRead: DEMO_LAST_30_DAYS.reduce((total, day) => total + day.count, 0),
	last30Days: DEMO_LAST_30_DAYS,
	longestStreakDays: 9,
	memberSince: daysAgo(24),
	roundsCompleted: 3,
	streakDays: 6
};

/**
 * The inbox the tour walks through (design P2).
 *
 * **Built from the same three groups as everything else**, so a row cannot name a group the
 * shelf behind it does not have — the reason every fixture in this file comes off one set of
 * specs. The ranges are the blocks those groups actually divide, and the names are the members
 * the demo group screen lists.
 *
 * Four rows rather than one of each kind: the stop is about the inbox being a *record*, and a
 * single row reads as a one-off. They cover the three shapes a reader meets most — somebody
 * finishing, a round closing, somebody joining — plus an unread one at the top, which is what
 * the bell's badge is counting.
 *
 * The first two are unread so the screen shows both weights of row, and the timestamps are
 * minutes and hours rather than fixed dates so the relative ages read correctly whenever the
 * tour is opened.
 */
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const TOUR_DEMO_NOTIFICATIONS: AppNotification[] = [
	{
		createdAt: minutesAgo(12),
		groupId: 'tour-demo-group-2',
		groupName: 'Silsile Hatmi',
		id: 'tour-demo-notification-1',
		isRead: false,
		kind: 'SHARE_READ',
		payload: { range: '14–26', readerName: 'Zeynep' }
	},
	{
		createdAt: minutesAgo(95),
		groupId: 'tour-demo-group-1',
		groupName: 'Aile Hatmi',
		id: 'tour-demo-notification-2',
		isRead: false,
		kind: 'MEMBER_JOINED',
		payload: { memberCount: 5, memberName: 'Yusuf', spots: SPOTS }
	},
	{
		createdAt: minutesAgo(60 * 20),
		groupId: 'tour-demo-group-3',
		groupName: 'Şükür Hatmi',
		id: 'tour-demo-notification-3',
		isRead: true,
		kind: 'ROUND_COMPLETE',
		payload: { roundNumber: 3 }
	},
	{
		createdAt: minutesAgo(60 * 30),
		groupId: 'tour-demo-group-1',
		groupName: 'Aile Hatmi',
		id: 'tour-demo-notification-4',
		isRead: true,
		kind: 'POOL_BAB_CLAIMED',
		payload: { range: '66–78', takerName: 'Elif' }
	}
];

/** What the bell tab's badge counts during the tour — the unread rows above, and nothing else. */
export const TOUR_DEMO_UNREAD_COUNT = TOUR_DEMO_NOTIFICATIONS.filter(row => !row.isRead).length;
