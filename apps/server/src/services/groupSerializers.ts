import { babNumbersForRound, babNumbersForSlot, progressPercent, rangeForRound, rangeForSlot } from '@utils/babs';
import { partCountFor, type GroupKindName } from '@utils/groupKinds';
import { formatInviteCode } from '@utils/inviteCode';
import { FALLBACK_DISPLAY_NAME, type MemberProfile } from '@utils/memberProfiles';
import { civilDayNumber, roundEndsAt } from '@utils/rounds';
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
export type GroupSplitMode = 'ROTATION' | 'FIXED';
export type GroupStatus = 'GATHERING' | 'RUNNING';
export type BabRange = { start: number; end: number };
/** One source of truth: the same union the round maths takes, MONTHLY included. */
export type GroupCycle = CycleName;
export type GroupKind = GroupKindName;
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
};

export type GroupSummary = {
	id: string;
	name: string;
	dedication: string | null;
	visibility: GroupVisibility;
	splitMode: GroupSplitMode;
	cycle: GroupCycle;
	/** What the group reads. Immutable after creation. */
	kind: GroupKind;
	/**
	 * How many parts the group divides among its seats — 100 babs for the Cevşen, 33
	 * portions for the Hizb. Sent rather than derived on the client so the board, the
	 * progress and the pool are all sized by the same number the server split by.
	 */
	partCount: number;
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
};

/** One "the block you took has passed to a new member" notice, for the viewer. */
export type PoolClaimReleaseNotice = {
	id: string;
	startBab: number;
	endBab: number;
};

export type GroupInvitePreview = {
	id: string;
	name: string;
	dedication: string | null;
	visibility: GroupVisibility;
	splitMode: GroupSplitMode;
	cycle: GroupCycle;
	kind: GroupKind;
	/** See `GroupSummary.partCount`. */
	partCount: number;
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
	nextRange: BabRange | null;
	/** Babs no member is reading this round — what a joiner would pick up immediately. */
	poolBabNumbers: number[];
	/** When the current round rolls, so the preview can say what a joiner is joining into. */
	roundEndsAt: string | null;
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
	/**
	 * The first couple of members by seat, for the preview's "who is already here" line.
	 * Capped rather than complete: the line names two and counts the rest off `memberCount`,
	 * so sending a hundred names to render two would be waste.
	 */
	memberNames: string[];
};

/**
 * `FREE` is retired but still a value in the database enum, so a legacy row can carry
 * it. Nothing in the app models free-claim any more, and a fixed block is the closest
 * honest reading of such a row.
 */
export const toSplitMode = (splitMode: Group['splitMode']): GroupSplitMode =>
	splitMode === 'ROTATION' ? 'ROTATION' : 'FIXED';

/**
 * The round a group is on. Null while it is still gathering — nothing is counted yet.
 *
 * Read from the stored column rather than the clock: the rollover is what advances it, so
 * a group that has fallen behind reports the round it is actually showing. Callers put
 * `ensureCurrentRound` in front of this to make the two agree.
 */
const roundIndexFor = (group: Group): number | null =>
	group.status === 'RUNNING' && group.startedAt ? group.roundIndex : null;

/**
 * Only the fields the split actually depends on, so callers with a partial row can use it.
 * `kind` is one of them: it decides how many parts there are to split. Nothing on the board
 * records which block a seat reads — it is derived from the seat and the round, so a ROTATION
 * group's share moves without rewriting a row.
 */
type PlanShape = Pick<Group, 'spots' | 'splitMode' | 'kind'>;

/**
 * The block a seat reads in a given round.
 *
 * **Exported for the same reason `shareBabNumbersToday` below is**: a caller asking what a
 * seat owed in a *past* round has to get the same answer the serializers give for the
 * present one, and the rule is not obvious enough to restate — ROTATION advances by a
 * whole seat per round, FIXED never moves, and a group still GATHERING has no round at
 * all. `my-progress` walks the window with this; a second copy of the three-line branch
 * would be a second thing to remember to change when the split rules move.
 */
export const babNumbersInRound = (group: PlanShape, slotIndex: number, roundIndex: number | null): number[] => {
	const partCount = partCountFor(group.kind);

	if (roundIndex === null) {
		// Still gathering: the seat's own block is what has been reserved for them.
		return babNumbersForSlot(slotIndex, group.spots, partCount);
	}

	return toSplitMode(group.splitMode) === 'ROTATION'
		? babNumbersForRound(slotIndex, group.spots, roundIndex, partCount)
		: babNumbersForSlot(slotIndex, group.spots, partCount);
};

const rangeInRound = (group: PlanShape, slotIndex: number, roundIndex: number): BabRange | null => {
	const partCount = partCountFor(group.kind);

	return toSplitMode(group.splitMode) === 'ROTATION'
		? rangeForRound(slotIndex, group.spots, roundIndex, partCount)
		: rangeForSlot(slotIndex, group.spots, partCount);
};

/**
 * The block a member reads today. Exported because the write paths need the same answer
 * the read paths give — "mark my whole share" has to target today's babs, and under
 * ROTATION those are not the babs carrying the member's `assignedUserId`.
 */
export const shareBabNumbersToday = (group: Group, members: GroupMemberModel[], viewerUserId: string): number[] => {
	const member = members.find(candidate => candidate.userId === viewerUserId);

	return member ? babNumbersInRound(group, member.slotIndex, roundIndexFor(group)) : [];
};

/** Seats nobody took. Their babs are the shared pool until someone takes them. */
export const poolSlotIndexes = (members: Pick<GroupMemberModel, 'slotIndex'>[], spots: number): number[] => {
	const taken = new Set(members.map(member => member.slotIndex));

	return Array.from({ length: spots }, (_, slot) => slot).filter(slot => !taken.has(slot));
};

/**
 * The blocks nobody is reading this round — the shared pool.
 *
 * **The pool rotates with everything else.** An empty seat `e` doesn't leave *its own*
 * block uncovered; in round `r` it leaves the block that seat `e` would have been reading,
 * which is `(e + r) % spots`. Taking the standing block instead gets it wrong twice over:
 * that block is being read by whichever member rotated onto it (so two people are
 * authorised for the same bab), while the genuinely uncovered block appears nowhere and
 * cannot be reached at all — making a full board unattainable through the intended shares.
 */
export const poolBlocks = (
	group: PlanShape,
	members: Pick<GroupMemberModel, 'slotIndex'>[],
	roundIndex: number
): { slotIndex: number; babNumbers: number[] }[] =>
	poolSlotIndexes(members, group.spots).map(slotIndex => ({
		slotIndex,
		babNumbers: babNumbersInRound(group, slotIndex, roundIndex)
	}));

/**
 * Flattened `poolBlocks`. Write paths check a claim against it: `assignedUserId` is only ever
 * "volunteered for this bab out of the pool, this round", and requiring the bab to sit in this
 * round's pool as well means a claim that somehow outlived its seat being empty can never
 * grant a read outside the rotated share.
 */
export const poolBabNumbers = (
	group: PlanShape,
	members: Pick<GroupMemberModel, 'slotIndex'>[],
	roundIndex: number
): number[] => poolBlocks(group, members, roundIndex).flatMap(block => block.babNumbers);

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
export const serializeBab = (bab: GroupBabModel, nameByUserId?: Map<string, string>): GroupBab => ({
	number: bab.number,
	assignedUserId: bab.assignedUserId,
	readByUserId: bab.readByUserId,
	readByDisplayName: bab.readByUserId ? nameByUserId?.get(bab.readByUserId) ?? null : null,
	readAt: bab.readAt ? bab.readAt.toISOString() : null
});

export const toGroupSummary = (
	group: Group,
	babs: GroupBabModel[],
	members: GroupMemberModel[],
	viewerUserId: string
): GroupSummary => {
	const readCount = babs.filter(bab => bab.readAt !== null).length;
	const memberCount = members.length;
	const spotsLeft = Math.max(0, group.spots - memberCount);
	const roundIndex = roundIndexFor(group);

	const viewerMember = members.find(member => member.userId === viewerUserId);
	const mySlotIndex = viewerMember ? viewerMember.slotIndex : null;

	// This round's share is derived from the seat, not from `assignedUserId` — under
	// ROTATION the two diverge in every round after the first.
	const myShare = mySlotIndex === null ? [] : babNumbersInRound(group, mySlotIndex, roundIndex);

	// Volunteered babs are extra: they sit outside the rotation entirely, which is exactly
	// why they are the one thing `assignedUserId` records. No need to intersect with the
	// pool any more — a name on a bab *is* a claim, and claims never outlive their round.
	const poolNumbers = new Set(poolBabNumbers(group, members, roundIndex ?? 0));
	const myPoolBabNumbers = babs
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

	return {
		id: group.id,
		name: group.name,
		dedication: group.dedication,
		visibility: group.visibility,
		splitMode: toSplitMode(group.splitMode),
		cycle: group.cycle,
		kind: group.kind,
		partCount: partCountFor(group.kind),
		timezone: group.timezone,
		spots: group.spots,
		memberCount,
		spotsLeft,
		isFull: spotsLeft === 0,
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
			? roundEndsAt(group.startedAt, group.cycle, group.roundIndex, group.timezone).toISOString()
			: null,
		mySlotIndex,
		myBabNumbers,
		myReadCount,
		myNextBabNumber,
		myRoundRange: mySlotIndex === null ? null : rangeInRound(group, mySlotIndex, roundIndex ?? 0),
		myNextRoundRange: mySlotIndex === null ? null : rangeInRound(group, mySlotIndex, (roundIndex ?? 0) + 1),
		poolBabNumbers: babs
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
		poolAllBabNumbers: babs
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
	profiles?: Map<string, MemberProfile>
): GroupMember => {
	// The member list shows what each person is reading *today*, so it goes through the same
	// rotation the viewer's own share does. Filtering by `assignedUserId` would show every
	// member their day-1 block forever.
	const babNumbers = babNumbersInRound(group, member.slotIndex, roundIndexFor(group));
	const babNumberSet = new Set(babNumbers);
	const memberBabs = babs.filter(bab => babNumberSet.has(bab.number));
	const readCount = memberBabs.filter(bab => bab.readAt !== null).length;

	const profile = profiles?.get(member.userId);

	return {
		id: member.id,
		userId: member.userId,
		/*
		 * Clerk first, the stored name second, and "Member" only when neither has anything.
		 * `GroupMember.displayName` is written once at join time from whatever the session
		 * claims held then, so anyone who signed up before filling in their profile was stored
		 * as "Member" and stayed that way however often they set a name afterwards.
		 */
		displayName: profile?.displayName ?? member.displayName ?? FALLBACK_DISPLAY_NAME,
		imageUrl: profile?.imageUrl ?? null,
		role: member.role,
		slotIndex: member.slotIndex,
		joinedAt: member.joinedAt.toISOString(),
		babNumbers,
		readCount,
		percent: progressPercent(readCount, babNumbers.length),
		cheeredByMe: cheers.some(cheer => cheer.fromUserId === viewerUserId && cheer.toUserId === member.userId)
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
	profiles?: Map<string, MemberProfile>
): GroupDetail => {
	const summary = toGroupSummary(group, babs, members, viewerUserId);
	const roundIndex = roundIndexFor(group) ?? 0;

	return {
		...summary,
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
		ownerUserId: group.ownerUserId,
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
		startsAt: group.startsAt.toISOString(),
		babs: babs
			.slice()
			.sort((a, b) => a.number - b.number)
			.map(bab => serializeBab(bab)),
		members: members
			.slice()
			.sort((a, b) => a.slotIndex - b.slotIndex)
			.map(member => toGroupMember(group, member, babs, cheers, viewerUserId, profiles))
	};
};

/** How many members the preview names before falling back to "+N". */
const PREVIEW_MEMBER_NAMES = 2;

export const toInvitePreview = (
	group: Group,
	babs: GroupBabModel[],
	members: GroupMemberModel[],
	viewerUserId: string
): GroupInvitePreview => {
	const readCount = babs.filter(bab => bab.readAt !== null).length;
	const memberCount = members.length;
	const spotsLeft = Math.max(0, group.spots - memberCount);
	const isFull = spotsLeft === 0;
	const nextFreeSlot = nextFreeSlotFromMembers(members, group.spots);
	// The seat a joiner would take, and the block it reads on the day they land in it.
	const nextRange =
		!isFull && nextFreeSlot !== null ? rangeInRound(group, nextFreeSlot, roundIndexFor(group) ?? 0) : null;
	const poolNumbersForPreview = new Set(poolBabNumbers(group, members, roundIndexFor(group) ?? 0));

	return {
		id: group.id,
		name: group.name,
		dedication: group.dedication,
		visibility: group.visibility,
		splitMode: toSplitMode(group.splitMode),
		cycle: group.cycle,
		kind: group.kind,
		partCount: partCountFor(group.kind),
		spots: group.spots,
		memberCount,
		spotsLeft,
		isFull,
		openToJoin: group.openToJoin,
		readCount,
		percent: progressPercent(readCount, babs.length),
		daysLeft: daysLeftFrom(group.endsAt),
		isMember: members.some(member => member.userId === viewerUserId),
		status: group.status,
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
		roundEndsAt: group.startedAt
			? roundEndsAt(group.startedAt, group.cycle, group.roundIndex, group.timezone).toISOString()
			: null,
		roundDayIndex: group.roundStartedAt
			? civilDayNumber(new Date(), group.timezone) - civilDayNumber(group.roundStartedAt, group.timezone) + 1
			: null,
		timezone: group.timezone,
		createdByName: members.find(member => member.userId === group.ownerUserId)?.displayName ?? '',
		memberNames: members
			.slice()
			.sort((a, b) => a.slotIndex - b.slotIndex)
			.slice(0, PREVIEW_MEMBER_NAMES)
			.map(member => member.displayName),
		nextRange
	};
};
