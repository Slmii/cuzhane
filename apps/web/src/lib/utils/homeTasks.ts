import { isRepeatingCycle, type GroupKind, type GroupSummary } from '@/lib/types/domain';
import { formatBabRange } from '@/lib/utils/babs';
import { shareSlices } from '@/lib/utils/groups';
import { boardPortionsOf } from '@/lib/utils/hizbPlanBoard';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** One group's share for today, as Ana sayfa lists it (B8). */
export type HomeTask = {
	groupId: string;
	groupName: string;
	kind: GroupKind;
	/**
	 * A running hatim in which the reader holds no cüz yet and must pick one (QR1) — a task with
	 * no units, whose way in is the round-start screen rather than a reader.
	 */
	mustPick: boolean;
	/**
	 * A group with nothing handed out to choose from yet: a FLEXIBLE group where the reader holds
	 * nothing, or a Hizb personal plan not yet begun. Its way in is the group screen, like a pick.
	 * Null otherwise.
	 */
	mustChoose: 'flexible' | 'plan' | null;
	/**
	 * A Hizb personal plan. It has no board, so the portion reader's group mode can't open it —
	 * today's own assignment opens in the plan reader instead.
	 */
	isPlan: boolean;
	/** A plan's reading for today, still owed; null once read (or when there is none yet). */
	planAssignmentId: string | null;
	/**
	 * What the heading names: the stretch being read for a Cevşen share ("21–23"), the cüz being
	 * read for a Kur'an one ("7") — and, once the share is done, all of it ("61–65", "7, 22").
	 */
	range: string;
	/** Stretches of a Cevşen or Hizb share beyond the one named — a pool claim on top — as `SliceChip` counts. */
	moreCount: number;
	/** Every unit in the share, and how many of them are read. */
	unitNumbers: number[];
	done: number;
	total: number;
	/** Where reading resumes — the lowest unread unit — or null once the share is done. */
	nextNumber: number | null;
	roundEndsAt: string | null;
	/** Whether the group comes round again; a one-off ("Özel") never leaves its round. */
	repeats: boolean;
	/** A daily round — whose finished share is today's, see `buildHomeTasks`. */
	isDaily: boolean;
	/** The round in progress — a cüz's reading progress only counts in the round it was made in. */
	roundIndex: number | null;
	/** When the share was finished, for "Bugün okunanlar". */
	doneAt: string | null;
};

export type HomeTasks = {
	/** Still owed, soonest deadline first — "teslim sırasına göre". The first is "Sıradaki". */
	pending: HomeTask[];
	/** Finished today, in the order they were finished. */
	readToday: HomeTask[];
	/** Running groups that hand the reader a share this round, and how many of those are finished (B9b). */
	shareCount: number;
	finishedCount: number;
};

const isSameLocalDay = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const deadlineOf = (task: HomeTask) =>
	task.roundEndsAt === null ? Number.POSITIVE_INFINITY : new Date(task.roundEndsAt).getTime();

/**
 * Today's tasks: every running group with a share this round that is **still owed, or was
 * finished today** — and every running hatim that is waiting for the reader to pick a cüz.
 * A weekly share finished on Monday is neither on Wednesday — nothing is owed, and it was not
 * read today — so it counts toward neither "görev kaldı" nor "4 / 4 okundu".
 *
 * **"Today" for a daily group is its round, not the phone's day.** A daily round ends at
 * midnight in the group's zone, which is not the phone's midnight for a reader abroad: a share
 * finished after the group's boundary is this round's, and it stays "read today" until the
 * group rolls over, rather than dropping out at the phone's midnight and leaving the group in
 * neither list. The share's finish time is only ever the current round's, so a finished daily
 * share *is* today's.
 */
export const buildHomeTasks = (groups: readonly GroupSummary[], now: Date): HomeTasks => {
	const tasks = groups
		.filter(
			group =>
				group.status === 'RUNNING' &&
				(group.myBabNumbers.length > 0 ||
					group.mustPickCuz ||
					group.splitMode === 'FLEXIBLE' ||
					group.hizbPlan != null)
		)
		.map((group): HomeTask => {
			/*
			 * **A Hizb personal plan is one portion a day**, read from `hizbToday` rather than a seat's
			 * share — and until the plan has begun there is no portion, only the choosing of it.
			 */
			if (group.hizbPlan != null) {
				const today = group.hizbToday ?? null;
				const portions = today ? boardPortionsOf(today.planDays, today.portion) : [];

				return {
					doneAt: today?.completed ? group.myShareDoneAt : null,
					done: today?.completed ? 1 : 0,
					groupId: group.id,
					groupName: group.name,
					isDaily: true,
					isPlan: true,
					planAssignmentId: today && !today.completed ? today.assignmentId : null,
					kind: group.kind,
					moreCount: 0,
					mustChoose: today ? null : 'plan',
					mustPick: false,
					nextNumber: today && !today.completed ? today.portion : null,
					// Named by the board's 33, as on the group's card: a 15-day plan's fifth day is "11–13",
					// not "5" — the plan's own count read as a second meaning of "bölüm".
					range: today ? formatBabRange(portions) : '',
					repeats: isRepeatingCycle(group.cycle),
					roundEndsAt: group.roundEndsAt,
					roundIndex: group.roundIndex,
					total: today ? 1 : 0,
					// The 33 the day covers, so a caption can count them ("3 bölüm", not the one reading).
					unitNumbers: portions
				};
			}

			const isDone = group.myBabNumbers.length > 0 && group.myReadCount >= group.myBabNumbers.length;
			const next = isDone ? null : group.myNextBabNumber ?? group.myBabNumbers[0] ?? null;
			const isHatim = group.kind === 'HATIM';
			const slices = isHatim || next === null ? null : shareSlices(group.myBabNumbers, next);
			/*
			 * **A hatim is one cüz plus a count**, like a Cevşen share is one slice plus a count:
			 * the cüz being read (or, once all are read, the first) and how many others there are.
			 * Open, the others are the ones still unread; finished, every other cüz held.
			 */
			const hatimMore = isDone
				? group.myBabNumbers.length - 1
				: Math.max(0, group.myBabNumbers.length - group.myReadCount - 1);

			return {
				doneAt: group.myShareDoneAt,
				done: group.myReadCount,
				groupId: group.id,
				groupName: group.name,
				isDaily: group.cycle === 'DAILY',
				isPlan: false,
				planAssignmentId: null,
				kind: group.kind,
				moreCount: isHatim ? hatimMore : slices?.moreCount ?? 0,
				mustChoose: group.splitMode === 'FLEXIBLE' && group.myBabNumbers.length === 0 ? 'flexible' : null,
				mustPick: group.mustPickCuz && group.myBabNumbers.length === 0,
				nextNumber: next,
				range: isHatim
					? String((isDone ? group.myBabNumbers[0] : next) ?? '')
					: isDone
					? formatBabRange(group.myBabNumbers)
					: slices?.current ?? '',
				repeats: isRepeatingCycle(group.cycle),
				roundEndsAt: group.roundEndsAt,
				roundIndex: group.roundIndex,
				total: group.myBabNumbers.length,
				unitNumbers: group.myBabNumbers
			};
		});
	const isFinished = (task: HomeTask) => !task.mustPick && task.mustChoose === null && task.done >= task.total;

	return {
		finishedCount: tasks.filter(isFinished).length,
		shareCount: tasks.length,
		/*
		 * Nothing past its deadline **for a one-off** ("Özel"): it never leaves its round, so once
		 * its length has run out an unread share would sit in "Sıradaki" for good, counting down
		 * from zero. A repeating group's past deadline only means the list has not refetched since
		 * the boundary — dropping it then emptied Ana sayfa for a moment every midnight.
		 * `sort` is stable, so groups due at the same moment keep the list's own order.
		 */
		pending: tasks
			.filter(task => !isFinished(task) && (task.repeats || deadlineOf(task) > now.getTime()))
			.sort((a, b) => deadlineOf(a) - deadlineOf(b)),
		readToday: tasks
			.filter(
				task =>
					isFinished(task) &&
					task.doneAt !== null &&
					(task.isDaily || isSameLocalDay(new Date(task.doneAt), now))
			)
			.sort((a, b) => new Date(a.doneAt ?? 0).getTime() - new Date(b.doneAt ?? 0).getTime())
	};
};

/**
 * Which of Ana sayfa's states to draw — one answer, so the title, the card and the sheet cannot
 * disagree about it.
 *
 * - `noGroups` — B9, "İlk adım".
 * - `next` — B8 / B8c, something is still owed.
 * - `dayDone` — B8b, nothing owed and something was read today.
 * - `allRead` — B9b, nothing owed, nothing today, and every share this round finished earlier.
 * - `waiting` — in groups, with nothing to count: every group still gathering, a one-off that
 *   ran out unfinished, or a round sat out.
 */
export type HomeState = 'noGroups' | 'next' | 'dayDone' | 'allRead' | 'waiting';

export const homeStateFor = (hasGroups: boolean, tasks: HomeTasks): HomeState => {
	if (!hasGroups) {
		return 'noGroups';
	}

	if (tasks.pending.length > 0) {
		return 'next';
	}

	if (tasks.readToday.length > 0) {
		return 'dayDone';
	}

	return tasks.shareCount > 0 && tasks.finishedCount === tasks.shareCount ? 'allRead' : 'waiting';
};

/**
 * The first round boundary still ahead of the last time the list was fetched — when the shelf's
 * data goes stale and must be fetched again, so the rollover is shown rather than guessed at.
 */
export const nextBoundaryAfter = (groups: readonly GroupSummary[], fetchedAt: number): number | null => {
	const ahead = groups
		.filter(group => group.status === 'RUNNING' && group.roundEndsAt !== null)
		.map(group => new Date(group.roundEndsAt ?? 0).getTime())
		.filter(endsAt => endsAt > fetchedAt);

	return ahead.length === 0 ? null : Math.min(...ahead);
};

/** Whether a deadline falls on today's date — Ana sayfa draws that one in red. */
export const isDueToday = (roundEndsAt: string | null, now: Date): boolean => {
	if (roundEndsAt === null) {
		return false;
	}

	const endsAt = new Date(roundEndsAt);

	// A round ending at the stroke of midnight belongs to the day before it, which it closes.
	return isSameLocalDay(new Date(endsAt.getTime() - 1), now);
};

/** "Yarın sıradaki" — the share a group hands the reader when its next round opens. */
export type TomorrowTask = { groupName: string; kind: GroupKind; range: string };

/**
 * The first share of tomorrow: among groups whose round rolls over within a day — so the next
 * one really does open tomorrow — the one that rolls first, with the range it opens on. Null
 * when no group's next round is that close, or none says what it will hand over.
 */
export const tomorrowTask = (groups: readonly GroupSummary[], now: Date): TomorrowTask | null => {
	const candidates = groups
		// A one-off has no next round, whatever `myNextRoundRange` says: it never leaves round 0.
		.filter(
			group =>
				group.status === 'RUNNING' &&
				isRepeatingCycle(group.cycle) &&
				group.myNextRoundRange !== null &&
				group.roundEndsAt !== null
		)
		.map(group => ({ endsAt: new Date(group.roundEndsAt ?? 0).getTime(), group }))
		.filter(({ endsAt }) => endsAt > now.getTime() && endsAt - now.getTime() <= DAY_MS)
		.sort((a, b) => a.endsAt - b.endsAt);
	const first = candidates[0]?.group;
	const range = first?.myNextRoundRange;

	if (first === undefined || range === null || range === undefined) {
		return null;
	}

	return {
		groupName: first.name,
		kind: first.kind,
		range: range.start === range.end ? String(range.start) : `${range.start}–${range.end}`
	};
};

/** How long is left until `roundEndsAt`: whole days past a day, hours and minutes inside one. */
export type TimeLeft = { days: number } | { hours: number; minutes: number };

export const timeLeftUntil = (roundEndsAt: string | null, now: Date): TimeLeft | null => {
	if (roundEndsAt === null) {
		return null;
	}

	const remaining = Math.max(0, new Date(roundEndsAt).getTime() - now.getTime());

	return remaining >= DAY_MS
		? { days: Math.floor(remaining / DAY_MS) }
		: { hours: Math.floor(remaining / HOUR_MS), minutes: Math.floor((remaining % HOUR_MS) / MINUTE_MS) };
};

/*
 * The last word of a number as it is said, and the vowel and final sound that pick its
 * ablative: "yirmi iki" → "22'den", "kırk" → "40'tan". Only the last word counts, so a number is
 * read from its lowest non-zero place up.
 */
export type TurkishAblativeSuffix = 'den' | 'dan' | 'ten' | 'tan';

const UNIT_SUFFIX: readonly TurkishAblativeSuffix[] = [
	'den',
	'den',
	'den',
	'ten',
	'ten',
	'ten',
	'dan',
	'den',
	'den',
	'dan'
];
const TEN_SUFFIX: readonly TurkishAblativeSuffix[] = [
	'den',
	'dan',
	'den',
	'dan',
	'tan',
	'den',
	'tan',
	'ten',
	'den',
	'dan'
];

/**
 * The Turkish ablative ending for a numeral — "Bab 22’den devam", "Sayfa 40’tan". Vowel harmony
 * and the hard consonant of the number's spoken last word decide it, so it cannot be one
 * suffix in the string table.
 */
export const turkishAblativeSuffix = (value: number): TurkishAblativeSuffix => {
	const units = value % 10;
	const tens = Math.floor(value / 10) % 10;

	if (units !== 0) {
		return UNIT_SUFFIX[units] ?? 'den';
	}

	if (tens !== 0) {
		return TEN_SUFFIX[tens] ?? 'den';
	}

	// "sıfır" is back-vowelled: "0’dan".
	if (value === 0) {
		return 'dan';
	}

	// "yüz", "bin" — both front-vowelled, neither hard-ended.
	return 'den';
};
