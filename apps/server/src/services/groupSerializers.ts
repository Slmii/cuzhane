import { progressPercent } from '@utils/babs';
import { partCountFor, type GroupKindName } from '@utils/groupKinds';
import { formatInviteCode } from '@utils/inviteCode';
import { FALLBACK_DISPLAY_NAME, type MemberProfile } from '@utils/memberProfiles';
import { civilDayNumber, roundEndsAt, roundLengthFor } from '@utils/rounds';
import { isAnonymousTo, readerSeerIdsOf, visibleUserId } from '@utils/groupPrivacy';
import type { CycleName } from '@utils/rounds';
import type {
	Cheer,
	Group,
	GroupBab as GroupBabModel,
	GroupMember as GroupMemberModel,
	PoolClaimRelease as PoolClaimReleaseModel
} from '../generated/prisma/client';

// These mirror apps/web/src/lib/types/domain.ts exactly — the server has no shared types
// package, so the contract is duplicated here on purpose. Keep the two in sync by hand.

export type GroupVisibility = 'OPEN' | 'PRIVATE';
/**
 * What a group reads: a hundred babs split by seat (Cevşen), thirty cüz picked one at a time
 * (Kur'an hatim), or 33 Hizb portions split by seat. Chosen at creation and immutable — every
 * other setting on the group hangs off it.
 */
export type GroupKind = GroupKindName;
/** What happens to a member's cüz when the round rolls — QC3's "Tur bitiminde". */
export type CuzBoundaryPolicy = 'KEEP' | 'REPICK';
export type GroupSplitMode = 'ROTATION' | 'FIXED' | 'FLEXIBLE';
export type GroupStatus = 'GATHERING' | 'RUNNING';
export type BabRange = { start: number; end: number };
/** One source of truth: the same union the round maths takes, MONTHLY included. */
export type GroupCycle = CycleName;
export type GroupMemberRole = 'OWNER' | 'MEMBER';

export type GroupBab = {
	number: number;
	assignedUserId: string | null;
	readByUserId: string | null;
	/** Who read it, by name — null when nobody has, or when the caller didn't ask for names. */
	readByDisplayName: string | null;
	readAt: string | null;
};

export type GroupMember = {
	id: string;
	userId: string;
	displayName: string;
	/**
	 * The member's own profile photo, when they have set one. Null otherwise, and the client
	 * draws its generated face instead.
	 *
	 * Members only. It is never on `GroupInvitePreview` — someone deciding whether to join a
	 * group has not been let into it, and a list of faces is more than a name and a count.
	 */
	imageUrl: string | null;
	role: GroupMemberRole;
	slotIndex: number;
	joinedAt: string;
	babNumbers: number[];
	readCount: number;
	percent: number;
	cheeredByMe: boolean;
	/** Ticked to see who read in a shared Hizb plan. Told to the owner only — false for everyone else. */
	seesReaders: boolean;
};

export type GroupSummary = {
	hizbToday?: { planDays: number; portion: number; completed: boolean; assignmentId: string | null } | null;
	/** A personal-plan Hizb's board today: the canonical spans its completed readings cover. */
	hizbCoveredSpans?: number[];
	/** A personal-plan Hizb's next reading day: the next local midnight in the group's zone. */
	nextDayAt?: string;
	/** The viewer was taken out of a personal-plan Hizb's order by the inactivity rule. */
	hizbRemoved?: boolean;
	/** The rule's length when it removed the viewer; null unless `hizbRemoved`. */
	hizbRemovalDays?: number | null;
	/** Which day of the group today is, 1-based, in the group's zone. */
	hizbDay?: number;
	hizbPlan?: number | null;
	hizbIndividual?: boolean;
	hizbStartPortion?: number;
	inactivityDays?: number | null;
	hideMemberNames: boolean;
	/** "Okuma sorumluları": a shared Hizb plan's "has read" notice goes to the ticked members only. */
	readSeersEnabled: boolean;
	id: string;
	name: string;
	dedication: string | null;
	visibility: GroupVisibility;
	/** Cevşen, hatim or Hizb. The client sizes its board and names its units from this. */
	kind: GroupKind;
	splitMode: GroupSplitMode;
	cycle: GroupCycle;
	/**
	 * How many parts the group divides — 100 babs for the Cevşen, 30 cüz for a hatim, 33
	 * portions for the Hizb (`unitCountFor`). Sent rather than derived on the client so the board, the
	 * progress and the pool are all sized by the same number the server split by.
	 */
	partCount: number;
	/**
	 * How many days a round runs — 1, 7, 30, or whatever a hatim was given.
	 *
	 * **Sent because `cycle` cannot describe it.** The cadence is a label with three presets
	 * and a CUSTOM escape hatch; the length is the fact. Without it the client fell back to
	 * the weekly phrasing for anything that was not DAILY, so a fifteen-day round announced
	 * itself as "Her çarşamba" — a weekday it will land on exactly once.
	 */
	roundDays: number;
	/**
	 * IANA zone the group's rounds roll in — the creator's. The client needs it to say when
	 * the reset lands both in the group's day and in the reader's own.
	 */
	timezone: string;
	spots: number;
	memberCount: number;
	spotsLeft: number;
	isFull: boolean;
	openToJoin: boolean;
	readCount: number;
	percent: number;
	endsAt: string | null;
	daysLeft: number | null;
	completedAt: string | null;
	createdAt: string;
	isOwner: boolean;
	isMember: boolean;
	/** GATHERING until the owner starts the hatim; nothing is counted before that. */
	status: GroupStatus;
	startedAt: string | null;
	/** The round this group is on — 0 is the first. Null while gathering. */
	roundIndex: number | null;
	/** When the current round began and when it rolls over. Null while gathering. */
	roundStartedAt: string | null;
	roundEndsAt: string | null;
	/** The viewer's seat, or null if they are not a member. */
	mySlotIndex: number | null;
	/** The viewer's share for today — already rotated for a ROTATION group. */
	myBabNumbers: number[];
	myReadCount: number;
	/**
	 * The lowest bab in the viewer's share they haven't read — where "Oku" opens. Null once
	 * the share is done, or when they have none. Not derivable from `myReadCount`, which
	 * says how many are read but not which.
	 */
	myNextBabNumber: number | null;
	/**
	 * When the viewer's share for this round was finished — the last of its reads — or null
	 * while any of it is unread, or when they have none. Ana sayfa's "Bugün okunanlar" shows it.
	 */
	myShareDoneAt: string | null;
	/**
	 * A running hatim this member holds no cüz in for the round in progress, and has not chosen
	 * to sit out — they must pick before they can read (QR1). Always false for Cevşen, and for a
	 * viewer who is not a member.
	 */
	mustPickCuz: boolean;
	/**
	 * What the viewer reads this round and the next. Not "today/tomorrow": rotation moves
	 * per round, so a WEEKLY group holds one range all week.
	 */
	myRoundRange: BabRange | null;
	myNextRoundRange: BabRange | null;
	/** Babs belonging to seats nobody took, still unclaimed — the board's hatch. */
	poolBabNumbers: number[];
	/** Every bab belonging to a seat nobody took, volunteered-for ones included. */
	poolAllBabNumbers: number[];
	/** Pool babs the viewer has taken on top of their own share. */
	myPoolBabNumbers: number[];
};

export type GroupDetail = GroupSummary & {
	ownerUserId: string;
	inviteCode: string | null;
	reminderEnabled: boolean;
	reminderTime: string;
	autoStartWhenFull: boolean;
	startsAt: string;
	babs: GroupBab[];
	members: GroupMember[];
	/** Blocks the viewer volunteered for that a joiner took over, not yet acknowledged. */
	poolReleases: PoolClaimReleaseNotice[];
	/**
	 * The viewer chose "Bu turu atla" for the round in progress (QR1). A hatim member holding no
	 * cüz is stopped at the round-start screen; this is the one chosen way past it, so the group
	 * opens with nothing to read. Always false for a Cevşen group, and for any earlier round.
	 */
	hasSkippedRound: boolean;
	/**
	 * The two hatim rules QR1 works from: how many cüz one person may hold, and what the round
	 * boundary does with them. Null on a Cevşen group, which has neither. The invite preview has
	 * carried these since QJ1; a member needs them once a new round asks them to choose again.
	 */
	maxPerMember: number | null;
	boundaryPolicy: 'KEEP' | 'REPICK' | null;
	/**
	 * The viewer is one of the ticked members and "Okuma sorumluları" is on: they get every "has
	 * read" notice, and with hidden names see names as the owner does.
	 */
	seesReaders: boolean;
};

/** One "the block you took has passed to a new member" notice, for the viewer. */
export type PoolClaimReleaseNotice = {
	id: string;
	startBab: number;
	endBab: number;
};

export type GroupInvitePreview = {
	hizbPlan?: number | null;
	/** See `GroupSummary` — the same fields, from `hizbSummary`. */
	hizbCoveredSpans?: number[];
	nextDayAt?: string;
	hizbRemoved?: boolean;
	hizbRemovalDays?: number | null;
	hizbDay?: number;
	hizbIndividual?: boolean;
	hizbStartPortion?: number;
	inactivityDays?: number | null;
	hideMemberNames: boolean;
	id: string;
	name: string;
	dedication: string | null;
	visibility: GroupVisibility;
	/** Cevşen, hatim or Hizb — the preview counts to a hundred, thirty or 33, and names its units. */
	kind: GroupKind;
	splitMode: GroupSplitMode;
	cycle: GroupCycle;
	/** See `GroupSummary.partCount`. */
	partCount: number;
	/** How many days a round runs, for the reset line. See `GroupSummary.roundDays`. */
	roundDays: number;
	/**
	 * The two hatim rules QJ1 states before anyone commits: how many cüz one person may hold,
	 * and what becomes of them at the boundary. Null on a Cevşen group, which has neither.
	 *
	 * On the preview rather than derived after joining, because they are exactly what someone
	 * deciding whether to join is weighing — a cap of one is a different group from no cap.
	 */
	maxPerMember: number | null;
	boundaryPolicy: CuzBoundaryPolicy | null;
	spots: number;
	memberCount: number;
	spotsLeft: number;
	isFull: boolean;
	openToJoin: boolean;
	readCount: number;
	percent: number;
	daysLeft: number | null;
	isMember: boolean;
	status: GroupStatus;
	/**
	 * Whether the group starts itself the moment its last seat fills. A gathering Hizb preview
	 * (HJ1) promises that start only when it is true — otherwise the creator is the only way in.
	 */
	autoStartWhenFull: boolean;
	nextRange: BabRange | null;
	/** Babs no member is reading this round — what a joiner would pick up immediately. */
	poolBabNumbers: number[];
	/**
	 * Which units are read — **hatim only**, and only because QJ1/QJ2 draw a map rather than
	 * a bar. Thirty numbers at most; a Cevşen preview shows a percentage and gets `[]`.
	 */
	readBabNumbers: number[];
	/**
	 * **Legacy, and always empty.** The 1.2.0 app reads `memberNames.length` on the invite preview
	 * and crashed without it once names were taken off; an empty list keeps that build working and
	 * still names nobody. Drop it once no 1.2.0 install is left.
	 */
	memberNames: [];
	/*
	 * **Who holds which cüz is deliberately absent.** The frame writes a holder's name under
	 * every taken cell on QJ3, and it was built that way and taken out again: this payload
	 * answers a *non-member*, and who is reading what is the group's business rather than a
	 * prospective joiner's. The map still says which cüz are gone, which is the whole of
	 * what someone picking needs. Nor are the members' names: a non-member sees how many are
	 * there, never who — `memberNames` (the first two by seat) was removed for that reason.
	 */
	/** When the current round rolls, so the preview can say what a joiner is joining into. */
	roundEndsAt: string | null;
	/**
	 * When the hatim began, null while it is still gathering. A MONTHLY group rolls on this day of
	 * every month, and `roundEndsAt` alone cannot say which: clamped to a short month, a group
	 * started on the 31st rolls on the 28th, and the preview would name a different day from the
	 * group screen's.
	 */
	startedAt: string | null;
	/**
	 * Which day of the current round today is, 1-based — "Tur 3. gününde". Always 1 for a
	 * DAILY group, and null while the group is still gathering. Derived here rather than on
	 * the client: the boundary is a local midnight in the group's zone, and that maths is
	 * deliberately server-only.
	 */
	roundDayIndex: number | null;
	timezone: string;
	/** The creator's display name, for the preview's "Kuran" row. */
	createdByName: string;
};

/*
 * **The seat-split helpers live in `unitPlan` now, and are re-exported from here.**
 *
 * They used to be defined in this file, which made it impossible for the unit plan to use
 * them: the plan is what answers "whose unit is this" for *both* reading types, and a Cevşen
 * group's answer is exactly this seat arithmetic — so the plan had to import from the
 * serializers while the serializers imported the plan. Moving the pure half down and
 * re-exporting it keeps every existing caller (`pool.service`, `roundHistory.service`,
 * `groupMembership.service`, `babs.service`) importing the name from where it always was.
 */
export { babNumbersInRound, poolBabNumbers, poolBlocks, poolSlotIndexes, shareBabNumbersToday } from './unitPlan';

import {
	babNumbersInRound,
	type PlanHolding,
	rangeInRound,
	resolveUnitPlan,
	roundIndexFor,
	toSplitMode,
	type UnitPlan
} from './unitPlan';

export { toSplitMode };

const daysLeftFrom = (endsAt: Date | null): number | null => {
	if (!endsAt) {
		return null;
	}

	const msRemaining = endsAt.getTime() - Date.now();

	return Math.max(0, Math.floor(msRemaining / (24 * 60 * 60 * 1000)));
};

/** Mirrors groupAccess.service's nextFreeSlotIndex, but synchronous over an already-loaded member list. */
const nextFreeSlotFromMembers = (members: GroupMemberModel[], spots: number): number | null => {
	const taken = new Set(members.map(member => member.slotIndex));

	for (let slot = 0; slot < spots; slot++) {
		if (!taken.has(slot)) {
			return slot;
		}
	}

	return null;
};

/**
 * `nameByUserId` names whoever read the bab, for the one row that has to say so: a bab in
 * your own share that somebody else finished before it was yours. An id can't be shown to a
 * person, and the client has no member list on that screen to join against — the members
 * query belongs to a sheet that is usually closed.
 *
 * Optional so the paths that don't need a name don't pay for a profile lookup.
 */
/**
 * **`assignedUserId` on the wire is "who is responsible for this unit", which is not the
 * same question the column answers.**
 *
 * For a Cevşen or Hizb group the column is the whole answer: it records a pool block somebody
 * volunteered for this round, and a seat's own block is derived rather than stored. For a
 * hatim there is no volunteering — taking a cüz *is* holding it — so the responsible person
 * is the `CuzHolding` row, which the plan resolves. The column is left untouched there and
 * stays what CLAUDE.md says it is.
 *
 * The client's board asks one question of every cell ("mine, someone else's, or free?"), and
 * this is what lets it keep asking it once.
 *
 * `privacy` hides who is who from the other members of a group with `hideMemberNames` —
 * ids become per-group stand-ins and the reader's name "Member".
 */
export const serializeBab = (
	bab: GroupBabModel,
	nameByUserId?: Map<string, string>,
	privacy?: { group: Group; viewerUserId: string },
	plan?: UnitPlan
): GroupBab => {
	const assignedUserId = plan ? plan.holderOf(bab.number) : bab.assignedUserId;

	return {
		number: bab.number,
		assignedUserId: privacy ? visibleUserId(privacy.group, privacy.viewerUserId, assignedUserId) : assignedUserId,
		readByUserId: privacy ? visibleUserId(privacy.group, privacy.viewerUserId, bab.readByUserId) : bab.readByUserId,
		readByDisplayName: bab.readByUserId
			? privacy && isAnonymousTo(privacy.group, privacy.viewerUserId, bab.readByUserId)
				? FALLBACK_DISPLAY_NAME
				: nameByUserId?.get(bab.readByUserId) ?? null
			: null,
		readAt: bab.readAt ? bab.readAt.toISOString() : null
	};
};

export const toGroupSummary = (
	group: Group,
	babs: GroupBabModel[],
	members: GroupMemberModel[],
	viewerUserId: string,
	/**
	 * This round's cüz holdings — empty for a Cevşen group, which has none, and **required
	 * rather than optional on purpose**: a hatim serialized without them reports nobody
	 * holding anything and every cüz free, which is wrong in a way nothing would raise.
	 * `holdingsFor` is the scoped read; the compiler is what makes every caller do it.
	 */
	holdings: PlanHolding[],
	/**
	 * Whether the viewer chose "Bu turu atla" for the round in progress. Only the viewer's own
	 * list and detail know it; anywhere else they are not a member, and `mustPickCuz` is false.
	 */
	hasSkippedRound = false
): GroupSummary => {
	const readCount = babs.filter(bab => bab.readAt !== null).length;
	const memberCount = members.length;
	const spotsLeft = Math.max(0, group.spots - memberCount);
	const roundIndex = roundIndexFor(group);
	const isHatim = group.kind === 'HATIM';
	const plan = resolveUnitPlan({ group, holdings, members, roundIndex });

	const viewerMember = members.find(member => member.userId === viewerUserId);
	const mySlotIndex = viewerMember ? viewerMember.slotIndex : null;

	/*
	 * A Cevşen share is derived from the seat, not from `assignedUserId` — under ROTATION the
	 * two diverge in every round after the first. A hatim's is the cüz this member actually
	 * picked, which no arithmetic can produce. The plan answers both.
	 */
	const myShare = plan.unitsFor(viewerUserId);

	// Volunteered babs are extra: they sit outside the rotation entirely, which is exactly
	// why they are the one thing `assignedUserId` records. No need to intersect with the
	// pool any more — a name on a bab *is* a claim, and claims never outlive their round.
	const poolNumbers = new Set(plan.poolUnits);
	// A hatim has no volunteering: taking a cüz out of the pool *is* holding it, so it is
	// already in `myShare` and there is no second, unconnected list to add.
	const myPoolBabNumbers = isHatim
		? []
		: babs
				.filter(bab => bab.assignedUserId === viewerUserId)
				.map(bab => bab.number)
				.sort((a, b) => a - b);

	// Deduplicated: a rotation can land a member on a pool block they had already taken, and
	// the two sources would otherwise list it twice.
	const myBabNumbers = [...new Set([...myShare, ...myPoolBabNumbers])].sort((a, b) => a - b);
	// Counted over exactly the babs shown as "mine", so the fraction on screen can never
	// read 6/5 — counting every `assignedUserId` match would include the member's standing
	// seat, which on a later rotation day is somebody else's work.
	const myBabNumberSet = new Set(myBabNumbers);
	const myReadCount = babs.filter(bab => bab.readAt !== null && myBabNumberSet.has(bab.number)).length;
	// Where "Oku" goes. Derived here rather than on the client because the list payload
	// carries a *count* of what's read, not which ones — a caller holding only
	// `myReadCount` cannot tell 3/5 read-in-order from 3/5 read out of order, and would
	// send the reader to a bab they had already finished.
	const readNumbers = new Set(babs.filter(bab => bab.readAt !== null).map(bab => bab.number));
	const myNextBabNumber = myBabNumbers.find(number => !readNumbers.has(number)) ?? null;
	/*
	 * When the share was finished: its latest read, once every unit of it is read — over the
	 * same babs `myReadCount` counts, and from the same round's board. Nothing to report while
	 * any of it is open, or for a member with no share.
	 */
	const myReadTimes = babs.filter(bab => myBabNumberSet.has(bab.number)).map(bab => bab.readAt?.getTime() ?? null);
	const myShareDoneAt =
		myBabNumbers.length > 0 &&
		myReadTimes.length === myBabNumbers.length &&
		myReadTimes.every(time => time !== null)
			? new Date(Math.max(...(myReadTimes as number[]))).toISOString()
			: null;
	// Holding nothing in a running hatim, and not sitting the round out: Ana sayfa's "Cüz seç".
	const mustPickCuz =
		isHatim && group.status === 'RUNNING' && viewerMember !== undefined && myShare.length === 0 && !hasSkippedRound;

	return {
		id: group.id,
		hizbPlan: group.hizbPlan,
		hizbIndividual: group.hizbIndividual,
		hizbStartPortion: group.hizbStartPortion,
		inactivityDays: group.inactivityDays,
		hideMemberNames: group.hideMemberNames,
		readSeersEnabled: group.readSeersEnabled,
		name: group.name,
		dedication: group.dedication,
		visibility: group.visibility,
		kind: group.kind,
		splitMode: toSplitMode(group.splitMode),
		cycle: group.cycle,
		partCount: partCountFor(group.kind),
		roundDays: group.roundDays,
		timezone: group.timezone,
		spots: group.spots,
		memberCount,
		spotsLeft,
		/*
		 * **A hatim is full when every cüz is taken, not when every seat is.** Its `spots` is
		 * pinned at thirty as the ceiling `slotIndex` needs and divides nothing — one member
		 * may hold six cüz, so a group of five can leave the hundred-per-cent of it covered
		 * with twenty-five seats still empty, and one of thirty people can leave cüz free.
		 * Seats are the wrong question there; the pool is the right one. A flexible group has
		 * no seats to fill at all.
		 */
		isFull: isHatim ? plan.poolUnits.length === 0 : group.splitMode !== 'FLEXIBLE' && spotsLeft === 0,
		openToJoin: group.openToJoin,
		readCount,
		percent: progressPercent(readCount, babs.length),
		endsAt: group.endsAt ? group.endsAt.toISOString() : null,
		daysLeft: daysLeftFrom(group.endsAt),
		completedAt: group.completedAt ? group.completedAt.toISOString() : null,
		createdAt: group.createdAt.toISOString(),
		isOwner: group.ownerUserId === viewerUserId,
		isMember: viewerMember !== undefined,
		status: group.status,
		startedAt: group.startedAt ? group.startedAt.toISOString() : null,
		roundIndex,
		roundStartedAt: group.roundStartedAt ? group.roundStartedAt.toISOString() : null,
		roundEndsAt: group.startedAt
			? roundEndsAt(group.startedAt, roundLengthFor(group), group.roundIndex, group.timezone).toISOString()
			: null,
		mySlotIndex,
		myBabNumbers,
		myReadCount,
		myNextBabNumber,
		myShareDoneAt,
		mustPickCuz,
		/*
		 * **Null for a hatim, and it has to be.** A range is the shape of a seat's block —
		 * "1–13". Held cüz are `7 · 22`: not contiguous, so no start-and-end can describe
		 * them without claiming the fourteen numbers in between. The client reads `kind` and
		 * lists them instead.
		 */
		myRoundRange: isHatim || mySlotIndex === null ? null : rangeInRound(group, mySlotIndex, roundIndex ?? 0),
		myNextRoundRange:
			isHatim || mySlotIndex === null ? null : rangeInRound(group, mySlotIndex, (roundIndex ?? 0) + 1),
		// For a hatim the plan's pool is already only what nobody holds — there is no
		// separate claim column to subtract.
		poolBabNumbers: isHatim
			? plan.poolUnits
			: babs
					.filter(bab => poolNumbers.has(bab.number) && bab.assignedUserId === null)
					.map(bab => bab.number)
					.sort((a, b) => a - b),
		/**
		 * The whole pool, claimed parts included — what the Havuz card draws.
		 *
		 * Sent rather than inferred. The card used to work the pool out client-side as "every
		 * bab carrying an `assignedUserId`", which held only while a claim could not outlive
		 * the seat being empty. A claim left over from before joining released them — or any
		 * future path that strands one — put babs on the card that the Havuz screen, which
		 * asks the server, correctly left out. Two boards of one pool, disagreeing.
		 */
		/*
		 * **The whole havuz, loans included** — the free cüz plus the ones borrowed out of it
		 * this round. The Havuz row on the group screen counts this, and counting only the free
		 * ones made the row disappear the moment the last one was borrowed, taking with it the
		 * only way back to the screen that could undo it. The same reason the Cevşen count is
		 * the whole pool rather than the unclaimed part.
		 */
		poolAllBabNumbers: isHatim
			? [...plan.poolUnits, ...holdings.filter(holding => holding.isLoan).map(holding => holding.cuzNumber)].sort(
					(a, b) => a - b
			  )
			: babs
					.filter(bab => poolNumbers.has(bab.number))
					.map(bab => bab.number)
					.sort((a, b) => a - b),
		myPoolBabNumbers
	};
};

export const toGroupMember = (
	group: Group,
	member: GroupMemberModel,
	babs: GroupBabModel[],
	cheers: Cheer[],
	viewerUserId: string,
	/** Live names and photos by user id — see `getMemberProfiles`. Absent where a caller has
	 *  not looked them up, in which case the stored name stands on its own. */
	profiles?: Map<string, MemberProfile>,
	/** This round's cüz holdings; empty for a Cevşen group. */
	holdings: PlanHolding[] = []
): GroupMember => {
	/*
	 * The member list shows what each person is reading *today*. A Cevşen or Hizb member's
	 * share goes through the same rotation the viewer's own does — filtering by `assignedUserId`
	 * would show every member their day-1 block forever. **A hatim member's is what they hold
	 * this round**: the seat maths would hand them a slice of the hundred that names no cüz
	 * anyone holds, and it would always read 0%. A flexible group has no blocks, so a member's
	 * share there is whatever they took from the pool or read.
	 */
	const babNumbers =
		group.kind === 'HATIM'
			? holdings
					.filter(holding => holding.userId === member.userId)
					.map(holding => holding.cuzNumber)
					.sort((a, b) => a - b)
			: group.splitMode === 'FLEXIBLE'
			? babs
					.filter(bab => bab.assignedUserId === member.userId || bab.readByUserId === member.userId)
					.map(bab => bab.number)
			: babNumbersInRound(group, member.slotIndex, roundIndexFor(group));
	const babNumberSet = new Set(babNumbers);
	const memberBabs = babs.filter(bab => babNumberSet.has(bab.number));
	const readCount = memberBabs.filter(bab => bab.readAt !== null).length;

	const profile = profiles?.get(member.userId);
	const anonymous = isAnonymousTo(group, viewerUserId, member.userId);

	return {
		id: anonymous ? visibleUserId(group, viewerUserId, member.userId)! : member.id,
		userId: visibleUserId(group, viewerUserId, member.userId)!,
		/*
		 * Clerk first, the stored name second, and "Member" only when neither has anything.
		 * `GroupMember.displayName` is written once at join time from whatever the session
		 * claims held then, so anyone who signed up before filling in their profile was stored
		 * as "Member" and stayed that way however often they set a name afterwards.
		 */
		displayName: anonymous ? 'Member' : profile?.displayName ?? member.displayName ?? FALLBACK_DISPLAY_NAME,
		imageUrl: anonymous ? null : profile?.imageUrl ?? null,
		role: member.role,
		slotIndex: member.slotIndex,
		joinedAt: member.joinedAt.toISOString(),
		babNumbers,
		readCount,
		percent: progressPercent(readCount, babNumbers.length),
		cheeredByMe: cheers.some(cheer => cheer.fromUserId === viewerUserId && cheer.toUserId === member.userId),
		seesReaders: viewerUserId === group.ownerUserId && member.seesReaders
	};
};

export const toGroupDetail = (
	group: Group,
	babs: GroupBabModel[],
	members: GroupMemberModel[],
	cheers: Cheer[],
	viewerUserId: string,
	poolReleases: PoolClaimReleaseModel[] = [],
	/** Members' live names and photos, looked up by the caller — see `getMemberProfiles`. */
	profiles?: Map<string, MemberProfile>,
	/** This round's cüz holdings; empty for a Cevşen group. See `toGroupSummary`. */
	holdings: PlanHolding[] = [],
	/** Rounds the viewer skipped in this group — only the one in progress counts. */
	skippedRoundIndexes: number[] = []
): GroupDetail => {
	const summary = toGroupSummary(
		group,
		babs,
		members,
		viewerUserId,
		holdings,
		skippedRoundIndexes.includes(group.roundIndex)
	);
	const roundIndex = roundIndexFor(group) ?? 0;
	/*
	 * **Only a hatim's board is resolved through the plan.** For a Cevşen group `holderOf`
	 * answers with the *seat* holder, which is not what `assignedUserId` means on the wire —
	 * it means a pool claim there, and substituting the seat would make every bab on the
	 * board look volunteered-for and empty the pool. The two kinds ask their board the same
	 * question and get it from different places; this is the one line where that is decided.
	 */
	const boardPlan = group.kind === 'HATIM' ? resolveUnitPlan({ group, holdings, members, roundIndex }) : undefined;
	// Who sees names here: the owner, and in a shared Hizb plan the members ticked to see who read.
	const readerSeerIds = readerSeerIdsOf(group, members);
	const seen = { ...group, readerSeerIds };

	return {
		...summary,
		seesReaders: readerSeerIds.includes(viewerUserId),
		/*
		 * Blocks the viewer had volunteered for that a joiner took over, still unacknowledged.
		 *
		 * Filtered to the round in progress: the rollover clears the board and reassigns
		 * everything anyway, so a release from a closed round is no longer something anyone
		 * can act on — surfacing it would describe a rota that no longer runs.
		 */
		poolReleases: poolReleases
			.filter(release => release.userId === viewerUserId && release.seenAt === null)
			.filter(release => release.roundIndex === roundIndex)
			.map(release => ({ id: release.id, startBab: release.startBab, endBab: release.endBab })),
		ownerUserId: visibleUserId(seen, viewerUserId, group.ownerUserId)!,
		/*
		 * Every member's to share, not just the owner's.
		 *
		 * This detail is only ever built for somebody who is in the group, so reaching it at
		 * all is the permission. Owner-only left the Paylaş sheet — which the group screen
		 * offers to members and owners alike — with an empty card and a copy button that did
		 * nothing. Withholding it protected nothing either: an OPEN group is already listed in
		 * Keşfet, and filling the empty seats is the whole group's business, which is the same
		 * premise the shared pool rests on. Regenerating the code stays the owner's alone.
		 */
		inviteCode: formatInviteCode(group.inviteCode),
		reminderEnabled: group.reminderEnabled,
		reminderTime: group.reminderTime,
		autoStartWhenFull: group.autoStartWhenFull,
		hasSkippedRound: group.kind === 'HATIM' && skippedRoundIndexes.includes(group.roundIndex),
		maxPerMember: group.maxPerMember,
		boundaryPolicy: group.boundaryPolicy,
		startsAt: group.startsAt.toISOString(),
		babs: babs
			.slice()
			.sort((a, b) => a.number - b.number)
			.map(bab => serializeBab(bab, undefined, { group: seen, viewerUserId }, boardPlan)),
		members: members
			.slice()
			.sort((a, b) => a.slotIndex - b.slotIndex)
			.map(member => toGroupMember(seen, member, babs, cheers, viewerUserId, profiles, holdings))
	};
};

export const toInvitePreview = (
	group: Group,
	babs: GroupBabModel[],
	members: GroupMemberModel[],
	viewerUserId: string,
	/** This round's holdings; empty for a Cevşen group. Required for the same reason as elsewhere. */
	holdings: PlanHolding[] = []
): GroupInvitePreview => {
	const readCount = babs.filter(bab => bab.readAt !== null).length;
	const memberCount = members.length;
	const spotsLeft = Math.max(0, group.spots - memberCount);
	/*
	 * **Full means something different to a hatim** — every cüz taken rather than every seat
	 * filled, which is the same rule `toGroupSummary` follows. QJ2 is the screen for exactly
	 * this state, and a seat count would never have reached it: five members hold thirty cüz
	 * with twenty-five seats still open. A flexible group is never full.
	 */
	const isHatim = group.kind === 'HATIM';
	/*
	 * **A hatim's free cüz come from its holdings, not from its seats.**
	 *
	 * This asked `poolBabNumbers`, which is seat arithmetic: the blocks belonging to seats
	 * nobody took. On a hatim every seat past the members is empty — its `spots` is thirty —
	 * so the preview would have reported almost the whole mushaf free while most of it was
	 * spoken for, and QJ1's map is the one screen whose entire job is showing what is left.
	 */
	const poolNumbersForPreview = new Set(
		resolveUnitPlan({ group, holdings, members, roundIndex: roundIndexFor(group) }).poolUnits
	);
	const isFull = isHatim ? poolNumbersForPreview.size === 0 : group.splitMode !== 'FLEXIBLE' && spotsLeft === 0;
	const nextFreeSlot = nextFreeSlotFromMembers(members, group.spots);
	/*
	 * The seat a joiner would take, and the block it reads on the day they land in it.
	 * **Null for a hatim**, which hands out no block: a joiner picks cüz, and the numbers
	 * they pick are not a range.
	 */
	const nextRange =
		!isHatim && !isFull && nextFreeSlot !== null
			? rangeInRound(group, nextFreeSlot, roundIndexFor(group) ?? 0)
			: null;

	return {
		id: group.id,
		hizbPlan: group.hizbPlan,
		hizbIndividual: group.hizbIndividual,
		hizbStartPortion: group.hizbStartPortion,
		inactivityDays: group.inactivityDays,
		name: group.name,
		dedication: group.dedication,
		visibility: group.visibility,
		kind: group.kind,
		splitMode: toSplitMode(group.splitMode),
		cycle: group.cycle,
		partCount: partCountFor(group.kind),
		roundDays: group.roundDays,
		maxPerMember: group.maxPerMember,
		boundaryPolicy: group.boundaryPolicy,
		spots: group.spots,
		memberCount,
		spotsLeft,
		isFull,
		openToJoin: group.openToJoin,
		readCount,
		percent: progressPercent(readCount, babs.length),
		daysLeft: daysLeftFrom(group.endsAt),
		isMember: members.some(member => member.userId === viewerUserId),
		memberNames: [],
		status: group.status,
		autoStartWhenFull: group.autoStartWhenFull,
		/**
		 * **The whole pool here, unlike `GroupSummary.poolBabNumbers`** — every bab belonging
		 * to a seat nobody is sitting in, whether or not a member has volunteered to cover it.
		 *
		 * That is what "N bab sahipsiz" means everywhere else in the app: `PoolScreen` counts
		 * its slots the same way, claimed ones included, because a volunteer is covering for
		 * an empty seat rather than filling it. Filtering to the unvolunteered part made the
		 * preview say "0 bab sahipsiz" for a group whose Havuz screen said 16.
		 *
		 * The summary's copy stays filtered: it feeds the board, where a claimed bab is that
		 * person's work and must stop wearing the hatch.
		 */
		poolBabNumbers: babs
			.filter(bab => poolNumbersForPreview.has(bab.number))
			.map(bab => bab.number)
			.sort((a, b) => a - b),
		readBabNumbers: isHatim
			? babs
					.filter(bab => bab.readAt !== null)
					.map(bab => bab.number)
					.sort((a, b) => a - b)
			: [],
		roundEndsAt: group.startedAt
			? roundEndsAt(group.startedAt, roundLengthFor(group), group.roundIndex, group.timezone).toISOString()
			: null,
		startedAt: group.startedAt ? group.startedAt.toISOString() : null,
		roundDayIndex: group.roundStartedAt
			? civilDayNumber(new Date(), group.timezone) - civilDayNumber(group.roundStartedAt, group.timezone) + 1
			: null,
		timezone: group.timezone,
		hideMemberNames: group.hideMemberNames,
		// A group that hides its members hides its creator from a non-member too.
		createdByName: group.hideMemberNames
			? ''
			: members.find(member => member.userId === group.ownerUserId)?.displayName ?? '',
		nextRange
	};
};
