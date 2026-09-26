export type GroupVisibility = 'OPEN' | 'PRIVATE';
export type GroupSplitMode = 'ROTATION' | 'FIXED';
export type GroupStatus = 'GATHERING' | 'RUNNING';
export type BabRange = { start: number; end: number };
/**
 * How often a group comes round again — **and `CUSTOM` means it does not**.
 *
 * The three presets are cadences: a daily group rolls every day, a weekly one every seven, a
 * monthly one every thirty. `CUSTOM` is the other kind of answer, the one QC3's "Özel" gives
 * — a hatim that runs for the number of days it was given and is then finished. The server
 * pins such a group at round 0 for ever.
 *
 * MONTHLY and CUSTOM were missing here while only Cevşen groups existed, so a hatim sending
 * either was a value the client's own type said could not arrive.
 */
export type GroupCycle = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

/** Whether the group starts a new round when this one ends. False for a one-off. */
export const isRepeatingCycle = (cycle: GroupCycle) => cycle !== 'CUSTOM';
export type GroupMemberRole = 'OWNER' | 'MEMBER';

/**
 * What a group reads. A Cevşen group divides a hundred babs by seat; a hatim divides thirty
 * cüz by choice. Chosen at step 1 and immutable after — every other setting on the group
 * hangs off it.
 */
export type GroupKind = 'CEVSEN' | 'HATIM';
/** How a hatim hands out its cüz (QC2). Meaningless on a Cevşen group, which is why it is null there. */
export type CuzDistribution = 'FREE_PICK' | 'EQUAL' | 'JOIN_ORDER';
/** What happens to a member's cüz when the round rolls (QC3). */
export type CuzBoundaryPolicy = 'KEEP' | 'REPICK';

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
	/**
	 * Cevşen or hatim — what this group reads, and therefore how to draw it: a hundred cells
	 * or thirty, a share that is a range or a list of picked numbers, "bab" or "cüz".
	 *
	 * **Every number on a summary is a *unit* number**, whichever kind it is. `myBabNumbers`
	 * on a hatim is the cüz this member holds and `poolBabNumbers` the ones nobody has taken;
	 * the names kept their "bab" because renaming a wire field the whole app reads is a change
	 * of its own, and a cüz is a unit of the same board either way.
	 */
	kind: GroupKind;
	splitMode: GroupSplitMode;
	cycle: GroupCycle;
	/**
	 * How many days a round runs. **The cadence name cannot stand in for it**: a hatim may be
	 * given any length, and anything that is not 1 or 7 has no weekday to be named after.
	 */
	roundDays: number;
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
	/** The viewer chose "Bu turu atla" for the round in progress (QR1). Always false for Cevşen. */
	hasSkippedRound: boolean;
	/** How many cüz one person may hold, and what the boundary does with them. Null for Cevşen. */
	maxPerMember: number | null;
	boundaryPolicy: CuzBoundaryPolicy | null;
};

/** Unauthenticated-ish preview shown when opening an invite link or entering a code. */
export type GroupInvitePreview = {
	id: string;
	name: string;
	dedication: string | null;
	visibility: GroupVisibility;
	/** Cevşen or hatim — the preview counts to a hundred or to thirty, and names its units. */
	kind: GroupKind;
	splitMode: GroupSplitMode;
	cycle: GroupCycle;
	/** How many days a round runs, for the reset line. */
	roundDays: number;
	/**
	 * The two hatim rules QJ1 states before anyone commits: how many cüz one person may hold,
	 * and what becomes of them at the boundary. Null on a Cevşen group, which has neither.
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
	nextRange: BabRange | null;
	/**
	 * Every bab belonging to an empty seat, volunteered-for ones included — the app's
	 * "N bab sahipsiz", counted the way `PoolScreen` counts it. Not the same filter as
	 * `GroupSummary.poolBabNumbers`; what a joiner gets is `nextRange`, not this.
	 */
	poolBabNumbers: number[];
	/** Which cüz are read — hatim only, for QJ1/QJ2's map. Empty on a Cevşen preview. */
	readBabNumbers: number[];
	/*
	 * No holder names: the preview answers someone who is not in the group, so who is
	 * reading which cüz is not theirs to see. The map says which are gone, and that is what
	 * picking needs — see the same note on the server's mirror of this type.
	 */
	roundEndsAt: string | null;
	/** 1-based day within the current round — "Tur 3. gününde". Null while gathering. */
	roundDayIndex: number | null;
	timezone: string;
	createdByName: string;
};

/**
 * The shared pool is the share of the seats nobody took. A slot is offered whole rather
 * than bab by bab, so taking one mirrors what joining that seat would have handed you.
 */
/**
 * One cüz in a hatim's havuz — the cüz nobody joined with, plus the ones borrowed out of it
 * this round so they can be handed back.
 *
 * Not a `PoolSlot`: a slot is an empty *seat's* block, taken whole, and a hatim has no seats
 * that mean anything. Taking one of these is a **loan** — it lasts the round and goes back at
 * the boundary whatever the group's "Tur bitiminde" says.
 */
export type PoolCuz = {
	cuzNumber: number;
	/** Null while nobody has taken it — the hatched cell. */
	takenByUserId: string | null;
	takenByDisplayName: string | null;
	takenByImageUrl: string | null;
	takenByMe: boolean;
	/**
	 * Read this round. Sent, and currently drawn nowhere: the havuz map shows free, taken and
	 * yours only, because "read" and "yours" share the deep green and a legend swatch cannot
	 * carry the ring that tells them apart. Kept on the wire for whatever draws it next.
	 */
	isRead: boolean;
};

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
};

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
	/** Whether the row speaks in babs or cüz (Q8). Null once the group is gone — read as Cevşen. */
	groupKind: GroupKind | null;
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
	/*
	 * **Three switches, one pair each — Cevşen and Kuran.** They are not the same news in the
	 * two kinds: a finished share is a range of babs or a cüz, a round is a hundred or thirty,
	 * and the pools hold different things. P4 puts each pair under its own heading, and a
	 * reader in both kinds chooses separately. The server picks the column from the group's
	 * kind (`settingFor`), so nothing here has to be read in pairs.
	 */
	/**
	 * "Tell me when someone in one of my groups finishes their share." A **server** push,
	 * unlike the daily reminder, which the device schedules for itself — only the server knows
	 * when somebody else reads. Off by default; see `user.prisma`.
	 */
	cevsenGroupReadsEnabled: boolean;
	/**
	 * "Tell me when my group closes the hundred." **On by default**, unlike group reads above:
	 * it fires at most once per round per group and it is the moment the app is built around.
	 */
	cevsenRoundCompleteEnabled: boolean;
	/** Somebody took a block out of the shared pool. Off by default, like group reads. */
	cevsenPoolClaimEnabled: boolean;
	/** The same three for a hatim, with the same defaults. */
	hatimGroupReadsEnabled: boolean;
	hatimRoundCompleteEnabled: boolean;
	/** Nothing raises this yet — taking a cüz out of the havuz is Q3. */
	hatimPoolClaimEnabled: boolean;
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
export type ReaderArabicFont = 'naskh' | 'amiri' | 'uthman' | 'husrev';

/**
 * The faces that set text. `husrev` is not one: it is the Hüsrev hattı mushaf,
 * which the Kuran reader shows as its **page images** — so only that reader offers it, and
 * everything that sets Arabic in a font takes this type instead.
 */
export type ReaderTextFont = Exclude<ReaderArabicFont, 'husrev'>;

/**
 * The font to set text in. With Hüsrev saved, the Cevşen — which has no page images — falls
 * back to the default face; it must match the Prisma default, like the readers' own fallback.
 */
export const textFontFor = (font: ReaderArabicFont): ReaderTextFont => (font === 'husrev' ? 'uthman' : font);

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
	/**
	 * A hatim's cüz this round, each read or not — Q6's cells. Empty for a Cevşen group.
	 * Not read in a closed round means missed; in the open round it means still open.
	 */
	units: { number: number; isRead: boolean }[];
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
