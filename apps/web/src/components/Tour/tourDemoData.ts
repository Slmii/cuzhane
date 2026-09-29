import type { HizbAssignment, HizbReadingState } from '@/api/hizbReading.api';
import type {
	GroupBab,
	GroupCycle,
	GroupDetail,
	GroupInvitePreview,
	GroupSummary,
	GroupVisibility,
	MyProgress,
	MyProgressPeriod,
	ProfileStats,
	RoundSummary
} from '@/lib/types/domain';
import { boardPortionsOf } from '@/lib/utils/hizbPlanBoard';
import {
	hasDelailRepetition,
	hasIstighfar,
	hasSekine,
	PLAN_SPANS,
	PLAN_VERSION,
	spansFor
} from '@/lib/utils/hizbPlans';

/**
 * Stand-in data for the first-use tour, and the reason it exists: **the tour opens on an account
 * that has nothing.**
 *
 * It runs straight after onboarding, when Ana sayfa is "İlk adım" and no group screen can be
 * reached at all. Nearly every stop describes something that is not on screen, so the walkthrough
 * would be a tour of a blank app — and would pause on a spinner each time it navigated.
 *
 * So while the tour is running, the queries behind those screens answer with this instead —
 * **for everybody, not only for an empty account**. It was conditional at first, so that a reader
 * with real groups would walk their own; that made the walkthrough two different things, because
 * the copy has to describe what is on screen and what was on screen depended on who was looking.
 * The cost is that a reader with groups of their own sees these and these numbers for the minute
 * it lasts, and their own are one tap away the moment it ends — at the closing card, which already
 * stands on them.
 *
 * **Three Cevşen groups, because one is not a day.** T2 points at "Sıradaki", which reads better
 * with more behind it. The three differ in the ways shares actually differ: one owned and
 * mid-share, one joined and nearly done, one finished, which is the one under "Bugün okunanlar".
 * **One Kur'an group and one Hizb group** for those parts of the tour, which also show on Ana sayfa
 * as "Sonra" rows; and a hatim the reader has not joined, for K1's cüz picker. Everything is
 * deliberately unremarkable, because it is a demonstration rather than a brag.
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
		hideMemberNames: false,
		readSeersEnabled: false,
		createdAt: daysAgo(24),
		cycle: spec.cycle,
		// These specs are the Cevşen groups — a hundred babs split by seat. The Kur'an leg's group
		// has its own factory below (`hatimSummary`), since a hatim's board is not shaped like this.
		kind: 'CEVSEN',
		roundDays: spec.cycle === 'WEEKLY' ? 7 : 1,
		daysLeft: spec.cycle === 'WEEKLY' ? 2 : null,
		dedication: spec.dedication,
		endsAt: null,
		id: spec.id,
		isFull: spec.memberCount >= SPOTS,
		isMember: true,
		isOwner: spec.isOwner,
		memberCount: spec.memberCount,
		myBabNumbers: share,
		// Null once the share is done, which moves it to Ana sayfa's "Bugün okunanlar".
		myNextBabNumber: share[spec.readInShare] ?? null,
		mustPickCuz: false,
		myNextRoundRange: { end: nextRoundStart + SHARE_LENGTH - 1, start: nextRoundStart },
		myPoolBabNumbers: [],
		myReadCount: spec.readInShare,
		// A finished demo share reads as finished just now; an open one has no time yet.
		myShareDoneAt: spec.readInShare >= share.length ? new Date().toISOString() : null,
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
	// The tour's groups are Cevşen groups: no round skips, no cap, no boundary rule.
	boundaryPolicy: null,
	hasSkippedRound: false,
	maxPerMember: null,
	seesReaders: false,
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
			seesReaders: false,
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
		missedPartNumbers: [],
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
		// The first twelve — clear of every demo share (14, 40 and 79 onward), which were all read.
		missedPartNumbers: Array.from({ length: 12 }, (_, index) => index + 1),
		myOwedCount: SHARE_LENGTH,
		myReadCount: SHARE_LENGTH,
		partCount: 100,
		readCount: 88,
		roundIndex: 8,
		startedAt: hoursFromNow(spec.hoursLeft - 48)
	}
];

/*
 * **The Kur'an leg's group** — its own small factory, because a hatim is not a hundred babs split
 * by seat: thirty cüz, the viewer holding two of them (one read), a few nobody took waiting in
 * the havuz, and the rest held by others. Built once from these constants so its board, its
 * share, its havuz and its progress cannot disagree, the same rule as the Cevşen specs above.
 */
const HATIM_ID = 'tour-demo-hatim';
const HATIM_MINE = [7, 22];
const HATIM_MINE_READ = new Set([7]);
const HATIM_POOL = [26, 27, 28];
const HATIM_OTHERS_READ = 14;
const HATIM_HOURS_LEFT = 75;
const HATIM_ROUND = 3;
const CUZ_TOTAL = 30;

const hatimBabs = (): GroupBab[] => {
	const others = new Set<number>();

	for (let number = 1; number <= CUZ_TOTAL && others.size < HATIM_OTHERS_READ; number += 1) {
		if (!HATIM_MINE.includes(number) && !HATIM_POOL.includes(number)) {
			others.add(number);
		}
	}

	return Array.from({ length: CUZ_TOTAL }, (_, index) => {
		const number = index + 1;
		const isMine = HATIM_MINE_READ.has(number);
		const isRead = isMine || others.has(number);

		return {
			assignedUserId: null,
			number,
			readAt: isRead ? daysAgo(1) : null,
			readByDisplayName: isRead ? (isMine ? null : 'Yusuf') : null,
			readByUserId: isRead ? (isMine ? DEMO_USER_ID : 'tour-demo-other') : null
		};
	});
};

const hatimSummary = (): GroupSummary => {
	const readCount = HATIM_MINE_READ.size + HATIM_OTHERS_READ;

	return {
		completedAt: null,
		createdAt: daysAgo(24),
		cycle: 'WEEKLY',
		hideMemberNames: false,
		readSeersEnabled: false,
		kind: 'HATIM',
		partCount: CUZ_TOTAL,
		roundDays: 7,
		daysLeft: 3,
		dedication: 'Geçmişlerimiz için',
		endsAt: null,
		id: HATIM_ID,
		isFull: false,
		isMember: true,
		isOwner: false,
		memberCount: 6,
		myBabNumbers: HATIM_MINE,
		myNextBabNumber: HATIM_MINE.find(number => !HATIM_MINE_READ.has(number)) ?? null,
		mustPickCuz: false,
		myNextRoundRange: null,
		myPoolBabNumbers: [],
		myReadCount: HATIM_MINE_READ.size,
		myShareDoneAt: null,
		myRoundRange: null,
		mySlotIndex: 2,
		name: 'Ramazan Hatmi',
		openToJoin: true,
		percent: Math.round((readCount / CUZ_TOTAL) * 100),
		poolAllBabNumbers: HATIM_POOL,
		poolBabNumbers: HATIM_POOL,
		readCount,
		roundEndsAt: hoursFromNow(HATIM_HOURS_LEFT),
		roundIndex: HATIM_ROUND,
		roundStartedAt: hoursFromNow(HATIM_HOURS_LEFT - 24 * 7),
		spots: CUZ_TOTAL,
		spotsLeft: CUZ_TOTAL - 6,
		splitMode: 'FIXED',
		startedAt: daysAgo(24),
		status: 'RUNNING',
		timezone: 'Europe/Istanbul',
		visibility: 'OPEN'
	};
};

const hatimDetail = (): GroupDetail => ({
	...hatimSummary(),
	autoStartWhenFull: false,
	boundaryPolicy: 'KEEP',
	hasSkippedRound: false,
	maxPerMember: 3,
	seesReaders: false,
	babs: hatimBabs(),
	inviteCode: 'CUMA-5H3T',
	members: [
		{
			babNumbers: HATIM_MINE,
			cheeredByMe: false,
			displayName: 'Sen',
			id: `${HATIM_ID}-member`,
			imageUrl: null,
			joinedAt: daysAgo(24),
			percent: Math.round((HATIM_MINE_READ.size / HATIM_MINE.length) * 100),
			readCount: HATIM_MINE_READ.size,
			role: 'MEMBER',
			seesReaders: false,
			slotIndex: 2,
			userId: DEMO_USER_ID
		}
	],
	ownerUserId: 'tour-demo-other',
	poolReleases: [],
	reminderEnabled: true,
	reminderTime: '21:30',
	startsAt: daysAgo(24)
});

const hatimRounds = (): RoundSummary[] => [
	{
		endsAt: hoursFromNow(HATIM_HOURS_LEFT),
		isOpen: true,
		missedCount: 0,
		missedPartNumbers: [],
		myOwedCount: HATIM_MINE.length,
		myReadCount: HATIM_MINE_READ.size,
		partCount: CUZ_TOTAL,
		readCount: HATIM_MINE_READ.size + HATIM_OTHERS_READ,
		roundIndex: HATIM_ROUND,
		startedAt: hoursFromNow(HATIM_HOURS_LEFT - 24 * 7)
	},
	{
		endsAt: hoursFromNow(HATIM_HOURS_LEFT - 24 * 7),
		isOpen: false,
		missedCount: 0,
		missedPartNumbers: [],
		myOwedCount: HATIM_MINE.length,
		myReadCount: HATIM_MINE.length,
		partCount: CUZ_TOTAL,
		readCount: CUZ_TOTAL,
		roundIndex: HATIM_ROUND - 1,
		startedAt: hoursFromNow(HATIM_HOURS_LEFT - 24 * 14)
	}
];

/** Three rounds, all kept: two closed with both cüz read, and this one with one of two. */
const hatimMyProgress = (): MyProgress => {
	const periods: MyProgressPeriod[] = [HATIM_ROUND - 2, HATIM_ROUND - 1, HATIM_ROUND].map(roundIndex => {
		const isOpen = roundIndex === HATIM_ROUND;
		const units = HATIM_MINE.map(number => ({ isRead: !isOpen || HATIM_MINE_READ.has(number), number }));
		const back = HATIM_ROUND - roundIndex;

		return {
			endsAt: hoursFromNow(HATIM_HOURS_LEFT - 24 * 7 * back),
			isOpen,
			missedBabs: [],
			missedCount: 0,
			owedCount: HATIM_MINE.length,
			readCount: units.filter(unit => unit.isRead).length,
			roundIndex,
			startedAt: hoursFromNow(HATIM_HOURS_LEFT - 24 * 7 * (back + 1)),
			units
		};
	});
	const owedCount = periods.reduce((total, period) => total + period.owedCount, 0);
	const readCount = periods.reduce((total, period) => total + period.readCount, 0);

	return {
		cycle: 'WEEKLY',
		missedCount: 0,
		owedCount,
		periods,
		ratePercent: Math.round((readCount / owedCount) * 100),
		readCount
	};
};

/*
 * **K1's hatim: one the reader has not joined yet.** The cüz picker is where a joiner chooses,
 * so it reads an invite preview, not a group of theirs — twenty-two of thirty taken, eight still
 * free to choose from.
 */
export const TOUR_DEMO_JOIN_HATIM_ID = 'tour-demo-hatim-join';
const JOIN_HATIM_FREE = [3, 9, 14, 18, 23, 26, 28, 30];
const JOIN_HATIM_READ = [1, 2, 4, 5, 7, 8, 10];

const joinHatimPreview = (): GroupInvitePreview => ({
	autoStartWhenFull: false,
	boundaryPolicy: 'KEEP',
	createdByName: 'Yusuf',
	cycle: 'WEEKLY',
	daysLeft: 5,
	dedication: 'Hastalarımız için',
	hideMemberNames: false,
	id: TOUR_DEMO_JOIN_HATIM_ID,
	isFull: false,
	isMember: false,
	kind: 'HATIM',
	maxPerMember: null,
	memberCount: 11,
	memberNames: [],
	name: 'Şifa Hatmi',
	nextRange: null,
	openToJoin: true,
	partCount: CUZ_TOTAL,
	percent: Math.round((JOIN_HATIM_READ.length / CUZ_TOTAL) * 100),
	poolBabNumbers: JOIN_HATIM_FREE,
	readBabNumbers: JOIN_HATIM_READ,
	readCount: JOIN_HATIM_READ.length,
	roundDayIndex: 3,
	roundDays: 7,
	roundEndsAt: hoursFromNow(24 * 5),
	spots: CUZ_TOTAL,
	spotsLeft: JOIN_HATIM_FREE.length,
	splitMode: 'FIXED',
	startedAt: daysAgo(16),
	status: 'RUNNING',
	timezone: 'Europe/Istanbul',
	visibility: 'OPEN'
});

/*
 * **H1 and H2's group: a Hizb plan where each member chose their own plan** ("Karma plan") — the
 * viewer on 33 days, on day 1 of it, part-way through the opening istighfar: four of eleven. That
 * is the reading whose card H1 points at and whose counter H2 shows, so the two stops describe
 * the same thing. Everyone else's reading today covers a believable part of the 33.
 */
const HIZB_ID = 'tour-demo-hizb';
const HIZB_PLAN_DAYS = 33;
const HIZB_PORTION = 1;
const HIZB_ASSIGNMENT_ID = 'tour-demo-hizb-today';
const HIZB_MEMBERS = 312;
const HIZB_READERS = 290;
const HIZB_READ_TODAY = 140;
/** Portions somebody finished today — the board's green cells. */
const HIZB_BOARD_READ = [2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 15, 16, 17, 18, 19, 21, 22, 24, 25, 27, 28];

const hizbCoveredSpans = () => [...new Set(HIZB_BOARD_READ.flatMap(portion => spansFor(HIZB_PLAN_DAYS, portion)))];

const hizbAssignment = (): HizbAssignment => ({
	bookmark: 0,
	boardPortions: boardPortionsOf(HIZB_PLAN_DAYS, HIZB_PORTION),
	completedAt: null,
	date: localKey(new Date()),
	day: 1,
	delailRepetitions: 0,
	id: HIZB_ASSIGNMENT_ID,
	istighfarRepetitions: 4,
	istighfarTarget: 11,
	planDays: HIZB_PLAN_DAYS,
	planVersion: PLAN_VERSION,
	portion: HIZB_PORTION,
	readFrom: null,
	readPortions: [],
	repetitions: 0,
	requiresDelailRepetition: hasDelailRepetition(HIZB_PLAN_DAYS, HIZB_PORTION),
	requiresIstighfar: hasIstighfar(HIZB_PLAN_DAYS, HIZB_PORTION),
	requiresSekine: hasSekine(HIZB_PLAN_DAYS, HIZB_PORTION),
	round: 1,
	traversal: 0,
	version: 0
});

const hizbSummary = (): GroupSummary => {
	const spans = hizbCoveredSpans();

	return {
		completedAt: null,
		createdAt: daysAgo(40),
		cycle: 'DAILY',
		daysLeft: null,
		dedication: 'Her gün bir bölüm',
		endsAt: null,
		hideMemberNames: false,
		hizbCoveredSpans: spans,
		hizbDay: 41,
		hizbIndividual: false,
		hizbPlan: 0,
		hizbStartPortion: 1,
		hizbToday: {
			assignmentId: HIZB_ASSIGNMENT_ID,
			completed: false,
			planDays: HIZB_PLAN_DAYS,
			portion: HIZB_PORTION
		},
		id: HIZB_ID,
		inactivityDays: null,
		isFull: false,
		isMember: true,
		isOwner: false,
		kind: 'HIZB',
		memberCount: HIZB_MEMBERS,
		myBabNumbers: [],
		myNextBabNumber: null,
		myNextRoundRange: null,
		myPoolBabNumbers: [],
		myReadCount: 0,
		myRoundRange: null,
		myShareDoneAt: null,
		mySlotIndex: null,
		mustPickCuz: false,
		name: 'Cuma Hizbi',
		nextDayAt: hoursFromNow(9),
		openToJoin: true,
		partCount: 33,
		percent: Math.round((HIZB_BOARD_READ.length / 33) * 100),
		poolAllBabNumbers: [],
		poolBabNumbers: [],
		readCount: HIZB_BOARD_READ.length,
		readSeersEnabled: false,
		roundDays: 1,
		roundEndsAt: hoursFromNow(9),
		roundIndex: 40,
		roundStartedAt: hoursFromNow(-15),
		spots: 33,
		spotsLeft: 0,
		splitMode: 'FLEXIBLE',
		startedAt: daysAgo(40),
		status: 'RUNNING',
		timezone: 'Europe/Istanbul',
		visibility: 'OPEN'
	};
};

const hizbDetail = (): GroupDetail => ({
	...hizbSummary(),
	autoStartWhenFull: false,
	babs: [],
	boundaryPolicy: null,
	hasSkippedRound: false,
	inviteCode: 'CUMA-8H2Z',
	maxPerMember: null,
	members: [],
	ownerUserId: 'tour-demo-other',
	poolReleases: [],
	reminderEnabled: true,
	reminderTime: '21:30',
	seesReaders: false,
	startsAt: daysAgo(40)
});

/** Fixed first names for the readers list's avatars — the first few rows are all it shows. */
const HIZB_READER_NAMES = ['Ahmet', 'Meryem', 'Ömer', 'Zehra', 'Yusuf', 'Hatice'];

const hizbReadingState = (): HizbReadingState => {
	const spans = hizbCoveredSpans();
	const today = new Date();
	const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
	const coverage = { complete: spans.length === PLAN_SPANS.length, covered: spans.length, total: PLAN_SPANS.length };

	return {
		assignments: [],
		completedTraversals: 0,
		coverage,
		coveredSpans: spans,
		currentRound: { days: 1, number: 1, read: 0 },
		dailyHistory: Array.from({ length: 31 }, (_, index) => {
			const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - index);
			const covered = index === 0 ? spans.length : Math.min(PLAN_SPANS.length, 24 + ((index * 7) % 12));

			return { complete: covered === PLAN_SPANS.length, covered, date: localKey(date), total: PLAN_SPANS.length };
		}),
		date: localKey(today),
		enrollment: {
			endDay: null,
			id: 'tour-demo-hizb-enrollment',
			joinedDate: localKey(today),
			planDays: HIZB_PLAN_DAYS,
			reason: null,
			removalDays: null,
			sequence: 0
		},
		isReturnedToday: false,
		members: Array.from({ length: HIZB_READERS }, (_, index) => ({
			completed: index < HIZB_READ_TODAY,
			displayName: index === 0 ? null : HIZB_READER_NAMES[index % HIZB_READER_NAMES.length] ?? null,
			id: `tour-demo-hizb-reader-${index}`,
			isMe: index === 0,
			planDays: [33, 15, 7][index % 3] ?? 33,
			portion: (index % 33) + 1,
			started: false
		})).map(member =>
			member.isMe ? { ...member, completed: false, portion: HIZB_PORTION, started: true } : member
		),
		missed: [],
		missedCount: 0,
		nextCursor: null,
		nextDayAt: hoursFromNow(9),
		previousDay: {
			complete: false,
			coveredSpans: spans.slice(0, 28),
			covered: 28,
			date: localKey(yesterday),
			total: PLAN_SPANS.length
		},
		readsFromBook: false,
		startedDate: localKey(new Date(Date.now() - 40 * 86_400_000)),
		today: hizbAssignment()
	};
};

/** H1's group, and the reading H2 opens: today's. */
export const TOUR_DEMO_HIZB_SUBJECT = { assignmentId: HIZB_ASSIGNMENT_ID, groupId: HIZB_ID };

export const tourDemoHizbReading = (): HizbReadingState => hizbReadingState();
export const tourDemoHizbAssignment = (): HizbAssignment => hizbAssignment();
export const tourDemoPreview = (): GroupInvitePreview => joinHatimPreview();

export const TOUR_DEMO_GROUPS: GroupSummary[] = [...SPECS.map(summaryOf), hatimSummary(), hizbSummary()];

/** The group the tour walks, and the bab its reader stop opens: the first row on Ana sayfa. */
export const TOUR_DEMO_SUBJECT = {
	babNumber: SPECS[0]!.shareStart + SPECS[0]!.readInShare,
	groupId: SPECS[0]!.id
};

/** The Kur'an leg's group, and the cüz its cüz page and reader open: the one still unread. */
export const TOUR_DEMO_HATIM_SUBJECT = {
	cuzNumber: HATIM_MINE.find(number => !HATIM_MINE_READ.has(number)) ?? HATIM_MINE[0]!,
	groupId: HATIM_ID
};

const isHatim = (groupId: string) => groupId === HATIM_ID;

/** Whichever Cevşen group was opened — the first, unless the reader was somewhere else. */
const specFor = (groupId: string) => SPECS.find(spec => spec.id === groupId) ?? SPECS[0]!;

export const tourDemoGroup = (groupId: string): GroupDetail =>
	groupId === HIZB_ID ? hizbDetail() : isHatim(groupId) ? hatimDetail() : detailOf(specFor(groupId));
export const tourDemoBabs = (groupId: string): GroupBab[] =>
	isHatim(groupId) ? hatimBabs() : babsOf(specFor(groupId));
export const tourDemoRounds = (groupId: string): RoundSummary[] =>
	isHatim(groupId) ? hatimRounds() : roundsOf(specFor(groupId));

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
	if (isHatim(groupId)) {
		return hatimMyProgress();
	}

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
		startedAt: hoursFromNow(spec.hoursLeft - 24 * (CLOSED_READS.length - index + 1)),
		// The tour's groups are Cevşen groups, whose periods carry no cüz cells.
		units: []
	}));

	periods.push({
		endsAt: hoursFromNow(spec.hoursLeft),
		isOpen: true,
		missedBabs: [],
		missedCount: 0,
		owedCount: SHARE_LENGTH,
		readCount: spec.readInShare,
		roundIndex: 9,
		startedAt: hoursFromNow(spec.hoursLeft - 24),
		units: []
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
