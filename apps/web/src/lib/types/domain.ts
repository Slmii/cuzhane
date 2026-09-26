export type GroupVisibility = 'OPEN' | 'PRIVATE';
export type GroupSplitMode = 'ROTATION' | 'FIXED';
export type GroupStatus = 'GATHERING' | 'RUNNING';
export type BabRange = { start: number; end: number };
export type GroupCycle = 'DAILY' | 'WEEKLY' | 'MONTHLY';
/** What a group reads: the Cevşen's hundred babs or the Hizb's 33 portions. */
export type GroupKind = 'CEVSEN' | 'HIZB';
export type GroupMemberRole = 'OWNER' | 'MEMBER';

export type GroupMember = {
	id: string;
	userId: string;
	displayName: string;
	/**
	 * The member's profile photo, when they have set one — null otherwise, and the generated
	 * avatar stands in. Members only: it is never on `GroupInvitePreview`.
	 */
	imageUrl: string | null;
	role: GroupMemberRole;
	slotIndex: number;
	joinedAt: string;
	babNumbers: number[];
	readCount: number;
	/** Percentage of this member's own babs that are read, 0–100. */
	percent: number;
	cheeredByMe: boolean;
};

export type GroupBab = {
	number: number;
	assignedUserId: string | null;
	readByUserId: string | null;
	/** Who read it, by name — shown on a bab in your share that somebody else finished. */
	readByDisplayName: string | null;
	readAt: string | null;
};

/** Shape returned by list endpoints — enough to render a group card without the bab grid. */
export type GroupSummary = {
	id: string;
	name: string;
	dedication: string | null;
	visibility: GroupVisibility;
	splitMode: GroupSplitMode;
	cycle: GroupCycle;
	/** What the group reads. Immutable after creation. */
	kind: GroupKind;
	/** How many parts the group divides — 100 babs for the Cevşen, 33 portions for the Hizb. */
	partCount: number;
	/** IANA zone the group's rounds roll in — the creator's, fixed at creation. */
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
	/**
	 * Babs belonging to seats nobody took, **minus anything a member has volunteered for** —
	 * this one feeds the board, where a claimed bab is that person's work and must stop
	 * wearing the hatch. `GroupInvitePreview` carries the same name for the whole pool.
	 */
	poolBabNumbers: number[];
	/**
	 * Every bab belonging to a seat nobody took, volunteered-for ones included — what the
	 * Havuz card draws. Sent by the server rather than worked out from `assignedUserId`,
	 * which a claim stranded on a since-filled seat gets wrong.
	 */
	poolAllBabNumbers: number[];
	/** Pool babs the viewer has taken on top of their own share. */
	myPoolBabNumbers: number[];
};

/** One "the block you took has passed to a new member" notice, for the viewer. */
export type PoolClaimReleaseNotice = {
	id: string;
	startBab: number;
	endBab: number;
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
	/**
	 * Blocks the viewer volunteered for that a joiner took over, not yet acknowledged. The
	 * push is the fast path; this is what survives a denied permission or a phone that was
	 * off. Narrowed by the server to the round in progress.
	 */
	poolReleases: PoolClaimReleaseNotice[];
};

/** Unauthenticated-ish preview shown when opening an invite link or entering a code. */
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
	/**
	 * Every bab belonging to an empty seat, volunteered-for ones included — the app's
	 * "N bab sahipsiz", counted the way `PoolScreen` counts it. Not the same filter as
	 * `GroupSummary.poolBabNumbers`; what a joiner gets is `nextRange`, not this.
	 */
	poolBabNumbers: number[];
	roundEndsAt: string | null;
	/** 1-based day within the current round — "Tur 3. gününde". Null while gathering. */
	roundDayIndex: number | null;
	timezone: string;
	createdByName: string;
	/** The first couple of members by seat; the rest are counted off `memberCount`. */
	memberNames: string[];
};

/**
 * The shared pool is the share of the seats nobody took. A slot is offered whole rather
 * than bab by bab, so taking one mirrors what joining that seat would have handed you.
 */
export type PoolSlot = {
	slotIndex: number;
	start: number;
	end: number;
	babNumbers: number[];
	/** Null while the slot is still unclaimed. */
	takenByUserId: string | null;
	takenByDisplayName: string | null;
	/** The taker's profile photo, when they have one — members only. */
	takenByImageUrl: string | null;
	takenByMe: boolean;
	readCount: number;
	/** Which of this slot's babs are read — the board needs *which*, not just how many. */
	readBabNumbers: number[];
	/**
	 * Who holds each of the slot's parts, in order. A Cevşen slot is taken whole, so every part
	 * names one taker; a Hizb slot can be taken a portion at a time by several members, and the
	 * slot-level `takenBy*` fields above name only the first of them.
	 */
	parts: PoolSlotPart[];
};

/** One part of a pool slot and who holds it this round. Mirrors the server's `PoolSlot['parts']`. */
export type PoolSlotPart = {
	number: number;
	takenByUserId: string | null;
	takenByDisplayName: string | null;
	takenByImageUrl: string | null;
	takenByMe: boolean;
	isRead: boolean;
};

/**
 * How far one reader has got with a part that must be repeated before it counts — Sekine's
 * nineteen. The reader's own and the round's own. Mirrors the server's `PartRepetitions`.
 */
export type PartRepetitions = { count: number; required: number };

/** What an inbox row is about. Mirrors the server's `NotificationKind` enum. */
export type NotificationKind =
	| 'POOL_CLAIM_RELEASED'
	| 'SHARE_READ'
	| 'ROUND_COMPLETE'
	| 'POOL_BAB_CLAIMED'
	| 'MEMBER_JOINED'
	| 'MEMBER_LEFT';

/**
 * One row of the notification inbox (design P2).
 *
 * **`payload` carries data, not a sentence.** The app composes the wording from its own strings
 * table, so a row reads in whatever language the reader is in now and picks up copy changes —
 * storing rendered text would freeze both. `groupName` is denormalised on the server so a row
 * still reads correctly after a rename or a deletion.
 */
export type AppNotification = {
	id: string;
	kind: NotificationKind;
	/** Null once the group is gone; the row survives so the history has no gap. */
	groupId: string | null;
	groupName: string;
	/**
	 * What the group reads, so the row can say "bab" or "bölüm" — `groupKind` because `kind`
	 * is what the notification is. `CEVSEN` once the group is gone.
	 */
	groupKind: GroupKind;
	payload: Record<string, unknown>;
	isRead: boolean;
	createdAt: string;
};

export type UserSettings = {
	id: string;
	userId: string;
	language: 'tr' | 'en' | 'nl';
	// No account-wide notifications switch: `reminderEnabled` is the only one, because it
	// is the only one the app gives anybody a way to set. See `user.prisma`.
	reminderEnabled: boolean;
	reminderTime: string;
	/**
	 * "Tell me when someone in one of my groups reads a bab." A **server** push, unlike the
	 * daily reminder, which the device schedules for itself — only the server knows when
	 * somebody else reads. Off by default; see `user.prisma`.
	 */
	groupReadsEnabled: boolean;
	/**
	 * "Tell me when my group closes the hundred." **On by default**, unlike `groupReadsEnabled`
	 * above: it fires at most once per round per group and it is the moment the app is built
	 * around. See `user.prisma`.
	 */
	roundCompleteEnabled: boolean;
	/** Somebody took a block out of the shared pool. Off by default, like group reads. */
	poolClaimEnabled: boolean;
	/** Somebody joined a group of mine. */
	memberJoinedEnabled: boolean;
	/** Somebody left a group of mine, or was removed from it. */
	memberLeftEnabled: boolean;
	hasSeenOnboarding: boolean;
	hasSeenTour: boolean;
	// The reader's typography, set from E2a and applied to every bab.
	/** The Arabic's point size in the reader, 16–40. */
	readerFontSize: number;
	readerNumerals: ReaderNumerals;
	readerArabicFont: ReaderArabicFont;
	createdAt: string;
	updatedAt: string;
};

/** Which digits the verse ornaments carry. Mirrors the server's `ReaderNumerals` enum. */
export type ReaderNumerals = 'arabic' | 'latin';

/**
 * The face the reader sets the Arabic in. Named after the script rather than the font file,
 * so shipping a different family for `naskh` is a client change and not a migration.
 */
export type ReaderArabicFont = 'naskh' | 'amiri' | 'uthman';

export type ProfileStats = {
	babsRead: number;
	roundsCompleted: number;
	streakDays: number;
	/** The longest run of consecutive reading days, ever — what the current streak is measured against. */
	longestStreakDays: number;
	memberSince: string;
	/** Exactly 30 entries, oldest first — read counts per day for the heatmap. */
	last30Days: { date: string; count: number }[];
};

export type PushToken = {
	id: string;
	userId: string;
	token: string;
};

/** One pass at the hundred, as the Turlar list shows it. Mirrors the server's RoundSummary. */
export type RoundSummary = {
	roundIndex: number;
	startedAt: string;
	endsAt: string;
	/** How many parts the round had to cover — what `readCount` and `missedCount` are out of. */
	partCount: number;
	readCount: number;
	/** Always 0 for the open round — the day isn't over, so nothing is missing yet. */
	missedCount: number;
	myReadCount: number;
	myOwedCount: number;
	isOpen: boolean;
};

/** A single bab within a round: who owed it, and who ended up reading it. */
export type RoundBab = {
	number: number;
	readByUserId: string | null;
	readAt: string | null;
	/** Null when the block belonged to an empty seat, so nobody owed it. */
	owedByUserId: string | null;
	owedBySlotIndex: number | null;
	isPool: boolean;
};

export type RoundDetail = {
	roundIndex: number;
	startedAt: string;
	endsAt: string;
	isOpen: boolean;
	/** See `RoundSummary.partCount`; `babs` has exactly this many entries. */
	partCount: number;
	readCount: number;
	missedCount: number;
	missedPeopleCount: number;
	babs: RoundBab[];
};

/**
 * One period of "Senin ilerlemen" — a single cell of F7's strip. Mirrors the server's
 * MyProgressPeriod.
 *
 * A cell is always **one round**, so it means a day in a DAILY group and a week in a
 * WEEKLY one. The design's frame carries a Günlük/Haftalık toggle that is deliberately
 * not built: a group has one cycle, so the other tab would have nothing real behind it.
 */
export type MyProgressPeriod = {
	roundIndex: number;
	/** How many of `missedBabs` there are — the same quantity the list shows. */
	missedCount: number;
	/**
	 * When the round opened. The strip's label is formatted from this on the client —
	 * a weekday for DAILY, the round number for WEEKLY — using the group's own `timezone`,
	 * because naming a weekday is localisation and the server has no locale.
	 */
	startedAt: string;
	endsAt: string;
	isOpen: boolean;
	/**
	 * How many babs this seat owed. **Not a constant**: `100 / spots`, the first
	 * `100 % spots` seats get one more, and the rotation moves the seat each round.
	 */
	owedCount: number;
	/** Of those, read by this member — whenever they read them, catching up included. */
	readCount: number;
	/**
	 * Owed and read by nobody — what the missed list offers. Always empty while open.
	 *
	 * Each carries its round explicitly: the pill hands it to the reader, which covers that
	 * round rather than today's board — where the rotation has already moved the bab on.
	 */
	missedBabs: { babNumber: number; roundIndex: number }[];
};

/** Mirrors the server's MyProgress. */
export type MyProgress = {
	cycle: GroupCycle;
	/** Oldest first, ending on the open round — the order the strip draws. */
	periods: MyProgressPeriod[];
	readCount: number;
	owedCount: number;
	/** Closed rounds only; the open one cannot have been missed yet. */
	missedCount: number;
	ratePercent: number;
};
