import type {
	GroupBab,
	GroupCycle,
	GroupDetail,
	GroupSummary,
	GroupVisibility,
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
