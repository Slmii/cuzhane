import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { babNumbersForRound, babNumbersForSlot } from '../src/utils/babs';
import { CYCLES_FOR_KIND, partCountFor, requiredRepetitions, type GroupKindName } from '../src/utils/groupKinds';
import { CUZ_COUNT } from '../src/utils/units';
import { INVITE_CODE_ALPHABET } from '../src/utils/inviteCode';
import {
	civilDayNumber,
	DEFAULT_TIME_ZONE,
	ROUND_DAYS,
	roundEndsAt,
	roundIndexSince,
	roundLengthFor,
	roundStartedAtFor,
	startOfCivilDay,
	type CycleName
} from '../src/utils/rounds';
import {
	hasDelailRepetition,
	hasIstighfar,
	hasSekine,
	PLAN_VERSION,
	portionForDay,
	type PlanDays
} from '../src/utils/hizbPlans';

/**
 * Development seed. Builds one group per screen state the app can show, so every
 * scenario has a fixture for manual testing instead of an empty state:
 *
 *  1. Şifa Hatmi     — RUNNING + ROTATION, dev_user is OWNER, part-read.
 *  2. Akşam Hatmi    — RUNNING + FIXED, dev_user is a MEMBER (not owner), part-read.
 *  3. Ramazan Hatmi  — GATHERING, dev_user is OWNER, seats partly filled (creator lobby).
 *  4. Sabah Virdi    — GATHERING, dev_user is a MEMBER (not owner) — waiting on the creator.
 *  5. Gönül Hatmi    — RUNNING with unfilled seats: one pool slot available, one already
 *                      claimed by another member. dev_user is a MEMBER (not owner).
 *  6. Cuma Halkası   — RUNNING + PUBLIC, dev_user is NOT a member, seats left (joinable).
 *  7. Kandil Hatmi   — RUNNING + PUBLIC, dev_user is NOT a member, FULL.
 *  8. Şükür Hatmi    — COMPLETED: every bab read, `completedAt` set, dev_user is a MEMBER.
 *  9. Aile Hatmi     — PRIVATE, dev_user is OWNER (Discover should not surface it).
 * 10. Nur Meclisi    — GATHERING + PUBLIC, dev_user is NOT a member — the
 *                      Discover "join a lobby" flow.
 * 11. Vakit Hatmi    — GATHERING and FULL (every seat taken, owner hasn't started it),
 *                      dev_user is a MEMBER (not owner), splitMode ROTATION.
 * 12. Seher Hatmi    — RUNNING + ROTATION, dev_user has taken a pool slot on top of their
 *                      own seat and finished both for today, while the group as a whole
 *                      is not complete.
 * 13. Hicret Hatmi   — PRIVATE, dev_user is a MEMBER (not owner), part-read.
 * 14. Silsile Hatmi  — RUNNING + DAILY, dev_user is a MEMBER (not owner), part-read board.
 * 15. Havuz Hatmi    — RUNNING + ROTATION with three empty seats, so the pool holds every
 *                      state at once: one block dev_user has taken, one another member has,
 *                      and one still going. dev_user is a MEMBER (not owner).
 *
 * No seat-based Hizb groups: a Hizb group is a personal plan now (`HIZB_PLAN_GROUPS` and on,
 * below). The seat seeder still accepts `kind: 'HIZB'` for groups made before plans existed.
 *
 * Closed-round history (`pastRounds`) is spread across three of them so the Turlar screens
 * have every state to show:
 *  · Silsile Hatmi — five seats, no pool. Two finished rounds, one part-read round holding
 *    all four row shapes at once, and one nobody touched.
 *  · Akşam Hatmi   — five empty seats, so babs 71-100 are pool: one round where dev_user
 *    covered part of it, one where it stands untouched.
 *  · Gönül Hatmi   — WEEKLY, so its closed round is what proves the cadence labels read
 *    "geçen hafta" rather than "dün".
 *
 * Hizb personal plans, individual reading and a flexible board (`HIZB_PLAN_GROUPS`, below):
 *
 * 22. Hizb · 33 Günlük   — plan 33, dev_user OWNER, 40 days in: one full traversal done, two
 *                          days eksik (catch-up), today owed; five readers, coverage partial.
 * 23. Hizb · 7 Günlük    — plan 7, dev_user MEMBER, names hidden, today already read.
 * 24. Hizb · Üyeler seçsin — plan chosen per member (7/15/33 mixed); dev_user hasn't chosen.
 * 25. Hizb · Çıkarıldın  — plan 15 with a 5-day inactivity rule; dev_user was removed (rejoin).
 * 26. Bireysel · Sekine  — individual 33, today's portion holds Sekine, 7 of 19 counted.
 * 27. Bireysel · İstiğfar — individual 7, today holds the istighfar, 4 of a 33 target.
 * 28. Bireysel · Delâil  — individual 33, today holds the Delâil salawat, 1 of 3.
 *
 * The group screen's four states (design "Hizb Kişisel Plan", section W), one group each:
 *
 * 29. W1 · Başlandı      — plan 33, today's Delâil started (page 2, salavat 1/3), 3 days eksik.
 * 30. W2 · Bugün okundu  — plan 33, today read, 3 days eksik: the dark button moves to catch-up.
 * 31. W3 · Grup tamam    — plan 7, seven readers cover all 33 today, dev_user read, none eksik.
 * 32. W4 · 7 günlük      — plan 7, 34 days eksik, today unread, 33-day readers cover part of it.
 *
 * **What the account is in depends on the scenario** (`SEED_SCENARIO`, below):
 *
 *  · none (the default) — lean: dev_user is in three groups of each kind, one per situation
 *    (`LEAN_KEEP`: Her Gün Bir Bab, Gönül Hatmi, the Cevşen Ramazan Hatmi lobby; the Kur'an
 *    Ramazan Hatmi, Tamamlanan Hatim, Bekleyen Hatim; W1 · Başlandı, Hizb · Üyeler seçsin,
 *    Bireysel · Sekine). Every other group is still seeded, with a stand-in in dev_user's place,
 *    and opened so Discover shows it. Individual Hizb readings not kept are left out; a group
 *    dev_user was never in (the private Özel Hizb) is seeded as written.
 *  · `full` — everything above, exactly as listed.
 *  · `all-read` — only the all-read groups (B9b).
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set.');
}

if (process.env.NODE_ENV === 'production') {
	throw new Error('The development seed refuses to run against production.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Who the fixtures belong to.
 *
 * `dev_user` is the default and is nobody — useful for exercising the API, useless the moment
 * you open the app, because every seeded group belongs to an account you are not signed in as
 * and Ana sayfa looks empty. Pass real Clerk ids to make the fixtures yours — one run seeds
 * every account listed, each with its own copy of every group:
 *
 *   SEED_USER_IDS=user_aaa,user_bbb pnpm --filter @cuzhane/server db:seed
 *
 * (Usually set in `apps/server/.env`, which the seed runner loads.) The first account gets the
 * codes as written; each one after it gets its own namespace — see `SEED_NAMESPACE` — chosen
 * automatically. `SEED_USER_ID=user_xxx` still works for a single account.
 */
const SEED_USER_IDS = (process.env.SEED_USER_IDS ?? '')
	.split(',')
	.map(id => id.trim())
	.filter(Boolean);
const SEED_USERS = SEED_USER_IDS.length > 0 ? SEED_USER_IDS : [process.env.SEED_USER_ID ?? 'dev_user'];

/**
 * **This run's account** — set by `seed()` before each account's fixtures are built. The fixture
 * lists below are functions for that reason: they read it (and `SEED_NAMESPACE`) when called.
 */
let OWNER_USER_ID = 'dev_user';

/**
 * **A second account's fixtures, alongside the first rather than instead of it.**
 *
 * Every group below carries a fixed invite code, and `seedGroup` finds the existing row *by
 * that code* and deletes it before rebuilding. That is what makes re-running the seed safe —
 * and it also means a second run under a different `SEED_USER_ID` would hand the same
 * groups to the new account and take them off the old one. Fine when you are moving fixtures,
 * useless when you want a phone signed in as A and a phone signed in as B both looking
 * populated at once, which is what taking iOS and Android screenshots in one sitting needs.
 *
 * A namespace gives the second account its own set. It replaces the **last character** of
 * every invite code, so a run for `user_aaa` and a run for `user_bbb` with `SEED_NAMESPACE=9`
 * leave both sets standing — which is what `SEED_USER_IDS` does for you in one run. The last character rather than a prefix or an extra one because
 * `INVITE_CODE_LENGTH` is 8 and the QR emblem zone is only known to be safe at symbol version
 * 3 — `inviteCode.test.ts` pins that, and a ninth character would push the payload over.
 *
 * With `SEED_USER_IDS` the namespaces are picked for you (see `autoNamespaces`); an explicit one
 * applies to the first account. Per run, like `OWNER_USER_ID`: `seed()` sets it.
 */
let SEED_NAMESPACE: string | undefined;

/**
 * **One Ana sayfa state on its own, for an account that shows nothing else.** Most of Ana
 * sayfa's states hold in the full set — something owed, something read today — but B9b ("Hepsi
 * okundu") only shows when *every* share an account has this round is finished and none of it
 * today, which fifteen groups with work still in them never are. So a scenario seeds its own
 * groups and nothing else, meant for an account that is in no other group:
 *
 *   SEED_USER_ID=user_zzz SEED_SCENARIO=all-read pnpm --filter @cuzhane/server db:seed
 *
 * `full` seeds every fixture with the account in all of them; with none set, the lean default
 * (see the top of this file).
 */
const SEED_SCENARIO = process.env.SEED_SCENARIO;

/**
 * The code this run should use for a fixture. Unnamespaced runs get the literal code, so the
 * default fixtures keep the codes they have always had and a plain re-seed still replaces them
 * in place.
 */
const codeFor = (base: string): string => (SEED_NAMESPACE ? base.slice(0, -1) + SEED_NAMESPACE : base);

/** Runs before the first write, because half a seeded namespace is worse than none. */
const assertNamespaceIsUsable = () => {
	if (SEED_NAMESPACE === undefined) {
		return;
	}

	if (SEED_NAMESPACE.length !== 1 || !INVITE_CODE_ALPHABET.includes(SEED_NAMESPACE)) {
		throw new Error(
			`SEED_NAMESPACE must be exactly one character from ${INVITE_CODE_ALPHABET} — got ${JSON.stringify(
				SEED_NAMESPACE
			)}.`
		);
	}

	/*
	 * The base codes have distinct first seven characters, so swapping the eighth keeps them
	 * unique among themselves. Asserted rather than assumed: a fixture whose code differs from
	 * another's only in its last character would silently seed one group fewer, the second
	 * quietly deleting the first. **Every set is checked** — the hatim codes, then the Hizb plan
	 * ones, were added later and left out of this at first, which is exactly how that goes
	 * unnoticed. (Hatim fixtures carry their code already namespaced.)
	 */
	const codes = [
		...[...GROUPS(), ...ALL_READ_GROUPS()].map(spec => codeFor(spec.inviteCode)),
		...[...HATIM_GROUPS(), ...ALL_READ_HATIMS()].map(spec => spec.inviteCode),
		...[...HIZB_PLAN_GROUPS(), ...HIZB_W_GROUPS(), ...HIZB_DISCOVER_GROUPS()].map(spec => codeFor(spec.inviteCode))
	];
	const collisions = [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))];

	if (collisions.length > 0) {
		throw new Error(`SEED_NAMESPACE=${SEED_NAMESPACE} collapses invite codes: ${collisions.join(', ')}.`);
	}
};

/**
 * Namespaces for the accounts after the first, from the end of the alphabet ('9', '8', …).
 * A character that already ends some base code is skipped: that fixture's code would come out
 * unchanged, and the run would take the first account's group away. Call with no namespace set,
 * so the Hatim fixtures give their base codes.
 */
const autoNamespaces = (count: number, taken: (string | undefined)[]): string[] => {
	const baseCodes = [
		...GROUPS(),
		...ALL_READ_GROUPS(),
		...HATIM_GROUPS(),
		...ALL_READ_HATIMS(),
		...HIZB_PLAN_GROUPS(),
		...HIZB_W_GROUPS(),
		...HIZB_DISCOVER_GROUPS()
	].map(spec => spec.inviteCode);
	const unusable = new Set([...baseCodes.map(code => code.slice(-1)), ...taken]);
	const free = [...INVITE_CODE_ALPHABET].reverse().filter(character => !unusable.has(character));

	if (free.length < count) {
		throw new Error(`SEED_USER_IDS lists more accounts than there are free namespaces (${free.length + 1}).`);
	}

	return free.slice(0, count);
};

/** [display name, babs this seat has read], or `null` for a seat with no member. */
type MemberSeed = [string, number] | null;

type PoolClaim = {
	/** An empty seat whose block another member has already taken. */
	slotIndex: number;
	/** Index into `members` of the member who claimed it. */
	byMemberIndex: number;
	/** Counted from the first claimed part, in block order. */
	babsRead: number;
	/**
	 * Which of the block's parts the claim holds, by 0-based position in it. Omitted, it takes
	 * the whole block — the only way a Cevşen slot is taken. A Hizb pool is claimed portion by
	 * portion, so one block can carry several claims, each naming its own positions.
	 */
	portions?: number[];
};

/** A reader partway through a part that has to be repeated (Sekine ×19), in the current round. */
type RepetitionInProgress = {
	bySlotIndex: number;
	partNumber: number;
	/** Short of the part's requirement — a finished count is written for every seeded read anyway. */
	count: number;
};

type GroupSeed = {
	name: string;
	dedication: string;
	inviteCode: string;
	/** Seat 0's user. The signed-in user for fixtures where they own the group. */
	ownerUserId: string;
	/** Every other seat gets `${memberIdPrefix}_${slotIndex}` unless overridden below. */
	memberIdPrefix: string;
	/** Overrides the default seat -> user mapping — used to seat `dev_user` at a non-zero slot. */
	slotUserIds?: Record<number, string>;
	/** What the group reads. Defaults to the Cevşen, which most fixtures are. */
	kind?: GroupKindName;
	spots: number;
	/** A preset: a Cevşen or Hizb group is never CUSTOM, which only a hatim's typed length makes. */
	cycle: Exclude<CycleName, 'CUSTOM'>;
	reminderTime: string;
	splitMode: 'ROTATION' | 'FIXED';
	visibility: 'OPEN' | 'PRIVATE';
	status: 'GATHERING' | 'RUNNING';
	/** Days ago day 1 opened. Only meaningful (and required) when `status` is RUNNING. */
	startedDaysAgo?: number;
	autoStartWhenFull: boolean;
	/** Index is the seat; `null` marks a seat with no member (a gap or a trailing free seat). */
	members: MemberSeed[];
	/** Empty seats whose babs another member has already claimed from the pool. */
	poolClaims?: PoolClaim[];
	/** Closed rounds to backfill, so the Turlar screens have history to show. */
	pastRounds?: PastRoundSeed[];
	repetitionsInProgress?: RepetitionInProgress[];
	/** When this round's reads happened, as "HH:mm" today — see `readTimeToday`. Now if absent. */
	readAtToday?: string;
	/** Moves those reads this many days back, still inside the round — see `readTimeToday`. */
	readDaysAgo?: number;
};

/**
 * A closed round, described by what each seat managed and who covered the rest.
 *
 * Rich enough to reach every state the round screens can render: a finished round, a
 * part-read one, one nobody touched, blocks a member covered for someone else, and pool
 * blocks left standing because the seat was empty.
 */
type PastRoundSeed = {
	/** How many rounds before the current one. 1 = the round that just closed. */
	roundsAgo: number;
	/**
	 * How much of its own share each seat read. `'all'` finishes every occupied seat; a map
	 * gives a per-seat count and any seat left out read nothing at all.
	 */
	readBySlot?: 'all' | Record<number, number>;
	/**
	 * Babs read by somebody other than the seat that owed them — the "Üstlen" case. Also how
	 * a pool block gets covered, since an empty seat has no member to read it.
	 */
	covers?: { babNumbers: number[]; bySlotIndex: number }[];
};

const GROUPS = (): GroupSeed[] => [
	{
		name: 'Şifa Hatmi',
		dedication: "Fatma Hanım'ın şifası için",
		inviteCode: 'HATM4K2P',
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_member',
		spots: 20,
		cycle: 'WEEKLY',
		reminderTime: '21:30',
		splitMode: 'ROTATION',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 3,
		autoStartWhenFull: true,
		// 18 of 20 seats taken — the design advertises "2 spots left".
		members: [
			['Ayşe Yılmaz', 3],
			['Mehmet Kaya', 5],
			['Zeynep Arslan', 4],
			['Ali Demir', 2],
			['Fatma Şahin', 5],
			['Hasan Toprak', 1],
			['Elif Bulut', 3],
			['Ömer Çelik', 2],
			['Merve Aydın', 4],
			['Yusuf Koç', 1],
			['Hatice Doğan', 3],
			['İbrahim Şen', 2],
			['Sena Polat', 5],
			['Kerem Aksoy', 0],
			['Nur Erdem', 2],
			['Emre Yavuz', 3],
			['Büşra Kurt', 1],
			['Selim Ateş', 2]
		]
	},
	{
		name: 'Akşam Hatmi',
		dedication: 'Merhum babamızın ruhuna',
		inviteCode: 'AKSM7Q2L',
		ownerUserId: 'dev_aksam_owner',
		memberIdPrefix: 'dev_aksam',
		// dev_user holds a seat here but never owns the group.
		slotUserIds: { 4: OWNER_USER_ID },
		spots: 15,
		cycle: 'DAILY',
		reminderTime: '22:00',
		splitMode: 'FIXED',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 5,
		autoStartWhenFull: true,
		// 10 of 15 seats taken; slot 4 (dev_user) is mid-way through its share.
		members: [
			['Deniz Aydın', 5],
			['Cansu Er', 3],
			['Barış Kılıç', 6],
			['Gamze Toklu', 2],
			['Ece Turan', 3],
			['Serkan Bulut', 4],
			['Pınar Aksoy', 1],
			['Volkan Şahin', 5],
			['İpek Demirtaş', 0],
			['Kubilay Er', 2]
		],
		/**
		 * The pool half of the Turlar screens. Fifteen seats with five empty, so babs 71-100
		 * belonged to nobody and show as a pool row rather than anyone's miss.
		 *
		 *  1 — everyone finished their own share and dev_user covered three pool babs, so the
		 *      pool row is part-covered and dev_user's row reads "devraldığın"
		 *  2 — nobody read anything, so the pool row stands at its full 30
		 */
		pastRounds: [
			{ roundsAgo: 1, readBySlot: 'all', covers: [{ babNumbers: [71, 72, 73], bySlotIndex: 4 }] },
			{ roundsAgo: 2 }
		]
	},
	{
		name: 'Ramazan Hatmi',
		dedication: 'Ramazan-ı şerif hürmetine',
		inviteCode: 'RMZN5W8T',
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_ramazan',
		spots: 20,
		cycle: 'WEEKLY',
		reminderTime: '20:30',
		splitMode: 'ROTATION',
		visibility: 'OPEN',
		status: 'GATHERING',
		autoStartWhenFull: true,
		// 14 of 20 seats taken — the creator's own lobby, nothing counted until they start it.
		members: [
			['Ayla Ergin', 0],
			['Burcu Tan', 0],
			['Cem Aydınlı', 0],
			['Deren Koçak', 0],
			['Ebru Sancak', 0],
			['Faruk Erdoğan', 0],
			['Gözde Turgut', 0],
			['Halit Özmen', 0],
			['Irmak Baykal', 0],
			['Jale Sönmez', 0],
			['Kaya Uysal', 0],
			['Leman Güngör', 0],
			['Metin Aktaş', 0],
			['Nihan Öncel', 0]
		]
	},
	{
		name: 'Sabah Virdi',
		dedication: 'Hayırlı bir sabah virdi için',
		inviteCode: 'SBVR3K9D',
		ownerUserId: 'dev_sabah_owner',
		memberIdPrefix: 'dev_sabah',
		// dev_user is waiting in someone else's lobby for the owner to start it.
		slotUserIds: { 3: OWNER_USER_ID },
		spots: 10,
		cycle: 'DAILY',
		reminderTime: '06:00',
		splitMode: 'FIXED',
		visibility: 'OPEN',
		status: 'GATHERING',
		autoStartWhenFull: true,
		// 5 of 10 seats taken, nothing counted yet.
		members: [
			['Tolunay Ekşi', 0],
			['Sultan Gürel', 0],
			['Yiğit Baran', 0],
			['Aylin Sezer', 0],
			['Recep Doğru', 0]
		]
	},
	{
		name: 'Gönül Hatmi',
		dedication: 'Gönül ehli için',
		inviteCode: 'GNUL6X4P',
		ownerUserId: 'dev_gonul_owner',
		memberIdPrefix: 'dev_gonul',
		// dev_user holds a seat but never owns the group.
		slotUserIds: { 1: OWNER_USER_ID },
		spots: 6,
		cycle: 'WEEKLY',
		reminderTime: '21:00',
		splitMode: 'ROTATION',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 7,
		autoStartWhenFull: true,
		// Slots 0-2 are occupied; slots 3-5 have no member, so their babs are the pool.
		members: [['Kadir Yıldırım', 8], ['Derya Aksu', 5], ['Tufan Er', 6], null, null, null],
		// Slot 3's block was already taken from the pool by the member at slot 2 (Tufan Er),
		// and is partway read. Slots 4 and 5 stay untouched, so the pool shows both states.
		poolClaims: [{ slotIndex: 3, byMemberIndex: 2, babsRead: 4 }],
		// WEEKLY, so its one closed round is what proves the cadence labels: "geçen hafta"
		// rather than the "dün" a daily group shows.
		// Seat 1 owns 18-34 and read the first five, so 23-24 are genuinely still open for
		// seat 2 to cover — the seed refuses a cover of a bab its owner already read.
		pastRounds: [{ roundsAgo: 1, readBySlot: { 0: 10, 1: 5 }, covers: [{ babNumbers: [23, 24], bySlotIndex: 2 }] }]
	},
	{
		name: 'Cuma Halkası',
		dedication: 'Ailemizin selameti için',
		inviteCode: 'CUMA7T3X',
		// Owned by a stranger, so `dev_user` has no membership and no owner controls here.
		ownerUserId: 'dev_halka_owner',
		memberIdPrefix: 'dev_halka',
		// 12 seats, 7 taken: five are open, which is what makes the Discover row joinable.
		spots: 12,
		cycle: 'DAILY',
		reminderTime: '20:00',
		splitMode: 'FIXED',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 4,
		autoStartWhenFull: true,
		members: [
			['Rabia Güneş', 6],
			['Tolga Eren', 4],
			['Esra Kılıç', 8],
			['Burak Sarı', 2],
			['Leyla Acar', 5],
			['Kaan Öztürk', 0],
			['Melis Duran', 3]
		]
	},
	{
		name: 'Kandil Hatmi',
		dedication: 'Merhum dedemiz için',
		inviteCode: 'KNDL9M5R',
		ownerUserId: 'dev_kandil_owner',
		memberIdPrefix: 'dev_kandil',
		// Every seat taken, so Discover shows the full state rather than a join action.
		spots: 8,
		cycle: 'WEEKLY',
		reminderTime: '19:15',
		splitMode: 'ROTATION',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 12,
		autoStartWhenFull: true,
		members: [
			['Sümeyye Aslan', 13],
			['Furkan Taş', 13],
			['Derya Şimşek', 9],
			['Onur Bilgin', 13],
			['Zehra Uçar', 12],
			['Cem Kavak', 4],
			['Aslı Yıldız', 7],
			['Murat Genç', 12]
		]
	},
	{
		name: 'Şükür Hatmi',
		dedication: 'Rabbimize şükür için',
		inviteCode: 'SUKR2M7Y',
		ownerUserId: 'dev_sukur_owner',
		memberIdPrefix: 'dev_sukur',
		// dev_user is a member of the finished round, not its owner.
		slotUserIds: { 2: OWNER_USER_ID },
		spots: 8,
		cycle: 'WEEKLY',
		reminderTime: '19:00',
		splitMode: 'FIXED',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 20,
		autoStartWhenFull: true,
		// Every seat filled and every share fully read — `readCount === partCount` below
		// stamps `completedAt` to match the board.
		members: [
			['Onur Kaptan', 13],
			['Selin Er', 13],
			['Merve Duman', 13],
			['Talha Öz', 13],
			['Gül Aydemir', 12],
			['Ozan Kurt', 12],
			['Nazlı Ergin', 12],
			['Bora Yalçın', 12]
		]
	},
	{
		name: 'Aile Hatmi',
		dedication: 'Ailemiz için özel',
		inviteCode: 'AELF9H3Z',
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_aile',
		spots: 6,
		cycle: 'WEEKLY',
		reminderTime: '21:45',
		splitMode: 'FIXED',
		// Private, so Discover should not surface it for anyone but its owner/members.
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 1,
		autoStartWhenFull: false,
		// 4 of 6 seats taken.
		members: [
			['Naz Aydoğan', 5],
			['Kerem Solak', 3],
			['Dilara Uçar', 2],
			['Onur Peker', 0]
		]
	},
	{
		name: 'Nur Meclisi',
		dedication: 'Nur meclisimiz için',
		inviteCode: 'NURM8K3T',
		// Owned by a stranger; dev_user holds no seat — this is the Discover "join a lobby" fixture.
		ownerUserId: 'dev_nur_owner',
		memberIdPrefix: 'dev_nur',
		spots: 16,
		cycle: 'WEEKLY',
		reminderTime: '20:15',
		splitMode: 'ROTATION',
		visibility: 'OPEN',
		status: 'GATHERING',
		autoStartWhenFull: true,
		// 6 of 16 seats taken, nothing counted yet.
		members: [
			['Kaan Bilir', 0],
			['Ece Sarıkaya', 0],
			['Tolga Aydınlı', 0],
			['Sibel Korkmaz', 0],
			['Berk Yılmaz', 0],
			['Aslıhan Demirci', 0]
		]
	},
	{
		name: 'Vakit Hatmi',
		dedication: 'Bereketli vakitler için',
		inviteCode: 'VAKT5D9L',
		ownerUserId: 'dev_vakit_owner',
		memberIdPrefix: 'dev_vakit',
		// dev_user holds a seat but never owns the group.
		slotUserIds: { 3: OWNER_USER_ID },
		spots: 8,
		cycle: 'DAILY',
		reminderTime: '19:45',
		splitMode: 'ROTATION',
		visibility: 'OPEN',
		status: 'GATHERING',
		// Every seat is taken, but the owner hasn't started it — autoStartWhenFull is off,
		// which is exactly why a full lobby can still be sitting in GATHERING.
		autoStartWhenFull: false,
		members: [
			['Emrah Solmaz', 0],
			['Gizem Aktürk', 0],
			['Tarık Öney', 0],
			['Derya Aksoy', 0],
			['Uğur Baran', 0],
			['Melike Sancak', 0],
			['Hakan Türkmen', 0],
			['İlkay Duru', 0]
		]
	},
	{
		name: 'Seher Hatmi',
		dedication: 'Seher vaktinin bereketi için',
		inviteCode: 'SEHR2P7M',
		ownerUserId: 'dev_seher_owner',
		memberIdPrefix: 'dev_seher',
		// dev_user holds a seat but never owns the group.
		slotUserIds: { 1: OWNER_USER_ID },
		spots: 6,
		cycle: 'WEEKLY',
		reminderTime: '05:30',
		splitMode: 'ROTATION',
		visibility: 'OPEN',
		status: 'RUNNING',
		// 6 spots and a multiple-of-6 day count rotate dev_user's seat back onto its own
		// standing block today, so "fully read" can be expressed via that seat's own count.
		startedDaysAgo: 6,
		autoStartWhenFull: true,
		// Slot 4 has no member — its block is the pool slot dev_user (slot 1) claims below.
		members: [
			['Fikret Uslu', 2],
			['Sinem Kaya', 17],
			['Tuncay Ersoy', 3],
			['Naile Güneş', 2],
			null,
			['Bahar Ilıcak', 1]
		],
		// dev_user's own seat (slot 1, 17 babs) and the pool slot they claimed (slot 4, 16
		// babs) are both fully read; the other seats stay part-read so the round isn't done.
		poolClaims: [{ slotIndex: 4, byMemberIndex: 1, babsRead: 16 }]
	},
	{
		name: 'Hicret Hatmi',
		dedication: 'Muhacir kardeşlerimiz için',
		inviteCode: 'HICR6Q4X',
		ownerUserId: 'dev_hicret_owner',
		memberIdPrefix: 'dev_hicret',
		// dev_user holds a seat but never owns the group.
		slotUserIds: { 2: OWNER_USER_ID },
		spots: 10,
		cycle: 'DAILY',
		reminderTime: '22:15',
		splitMode: 'FIXED',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 4,
		autoStartWhenFull: true,
		// 7 of 10 seats taken.
		members: [
			['Ridvan Aktaş', 4],
			['Neslihan Bozkurt', 3],
			['Volkan Erim', 5],
			['Aysel Kurtoğlu', 2],
			['Ertan Gürbüz', 6],
			['Filiz Aydoğan', 1],
			['Coşkun Aslan', 3]
		]
	},
	{
		name: 'Silsile Hatmi',
		dedication: 'Nesilden nesile devam eden hatim için',
		inviteCode: 'SLSL8R2N',
		ownerUserId: 'dev_silsile_owner',
		memberIdPrefix: 'dev_silsile',
		// dev_user holds a seat but never owns the group.
		slotUserIds: { 2: OWNER_USER_ID },
		spots: 5,
		cycle: 'DAILY',
		reminderTime: '21:00',
		splitMode: 'FIXED',
		visibility: 'OPEN',
		status: 'RUNNING',
		// 12 days in means round 12 of a DAILY cycle — long enough to have full history behind it.
		startedDaysAgo: 12,
		autoStartWhenFull: true,
		// All 5 seats taken (20 babs each), so the two historical rounds below cover exactly 100.
		members: [
			['Tarık Emre', 8],
			['Sevgi Kaan', 12],
			['Sena Yıldız', 5],
			['Onur Baydar', 15],
			['Gül Aksoy', 0]
		],
		/**
		 * The member-to-member half of the Turlar screens. Five seats of 20 babs each and no
		 * empty seat, so every state here is about people rather than the pool:
		 *
		 *  1 & 2 — finished rounds ("TAM"), which also give the Profile streak real history
		 *  3     — a part-read round carrying every row shape at once
		 *  4     — a round nobody touched, so each row offers a whole block
		 */
		pastRounds: [
			{ roundsAgo: 1, readBySlot: 'all' },
			{ roundsAgo: 2, readBySlot: 'all' },
			{
				roundsAgo: 3,
				// Tarık part-read, Sevgi and Gül finished, dev_user part-read, Onur nothing.
				readBySlot: { 0: 5, 1: 20, 2: 5, 4: 20 },
				covers: [
					// dev_user covered two of Tarık's, so his row reads "sen üstlendin" and
					// dev_user's own row reads "devraldığın".
					{ babNumbers: [6, 7], bySlotIndex: 2 },
					// Sevgi covered two of dev_user's — the `takenByOther` cells, ringed softly
					// on the grid, and the one case a bare "read" would hide.
					{ babNumbers: [46, 47], bySlotIndex: 1 }
				]
			},
			{ roundsAgo: 4 }
		]
	},
	{
		name: 'Havuz Hatmi',
		dedication: 'Sahipsiz kalan cüzler için',
		inviteCode: 'HAVZ8N3K',
		ownerUserId: 'dev_havuz_owner',
		memberIdPrefix: 'dev_havuz',
		// dev_user holds a seat but never owns the group.
		slotUserIds: { 1: OWNER_USER_ID },
		spots: 8,
		cycle: 'DAILY',
		reminderTime: '20:15',
		splitMode: 'ROTATION',
		visibility: 'OPEN',
		status: 'RUNNING',
		/**
		 * Three days in, so the rotation offset is 3 and the pool is deliberately *not* the
		 * empty seats' standing blocks: seats 5-7 stand on 65-100 but this round they leave
		 * 1-39 uncovered. Anything that reads the pool off `rangeForSlot` instead of
		 * `poolBlocks` shows the wrong numbers here, which is the point of the fixture.
		 */
		startedDaysAgo: 3,
		autoStartWhenFull: true,
		// 5 of 8 seats taken; slots 5, 6 and 7 are empty, so their blocks make up the pool.
		members: [
			['Nazlı Ergün', 6],
			['Şeyma Ulaş', 7],
			['Kaan Doruk', 4],
			['Berk Yalçın', 9],
			['Esra Tunç', 2],
			null,
			null,
			null
		],
		/**
		 * The pool wearing all three of its states at once — the fixture the Havuz screen
		 * needs, since one claimed slot alone can't tell "mine" from "somebody else's":
		 *
		 *  slot 5 (babs 1-13)  — dev_user took it, part-read: the accent cells
		 *  slot 6 (babs 14-26) — Berk Yalçın took it: the muted cells, and the card that
		 *                        reads "… üstlendi" rather than "Üstlendin"
		 *  slot 7 (babs 27-39) — nobody has it: still hatched, still offering "Üstlen"
		 */
		poolClaims: [
			{ slotIndex: 5, byMemberIndex: 1, babsRead: 5 },
			{ slotIndex: 6, byMemberIndex: 3, babsRead: 9 }
		]
	},
	/*
	 * ── Bugün okunanlar (B8c) ─────────────────────────────────────────────────────────────
	 *
	 * Two groups whose share the signed-in user has already finished today, at different
	 * times, so Ana sayfa has a "Bugün okunanlar" list to show beside what is still owed.
	 */
	{
		// Your own seat 0 — babs 1–4 — read this morning.
		name: 'Sabah Halkası',
		dedication: 'Sabah namazından sonra',
		inviteCode: 'SBHL4K7M',
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_sabah',
		spots: 25,
		cycle: 'DAILY',
		reminderTime: '06:30',
		splitMode: 'FIXED',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 5,
		autoStartWhenFull: false,
		members: [
			['Sen', 4],
			['Zehra Uçar', 2],
			['Orhan Tekin', 4],
			['Dilek Sarı', 0],
			['Levent Işık', 1]
		],
		readAtToday: '07:12'
	},
	{
		// Seat 12 is yours — babs 61–65, the frame's own range — read after noon.
		name: 'Her Gün Bir Bab',
		dedication: 'Her gün biraz',
		inviteCode: 'HGBB6R2T',
		ownerUserId: 'dev_hgbb_owner',
		memberIdPrefix: 'dev_hgbb',
		slotUserIds: { 12: OWNER_USER_ID },
		spots: 20,
		cycle: 'DAILY',
		reminderTime: '12:30',
		splitMode: 'FIXED',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 9,
		autoStartWhenFull: false,
		members: [
			['Kübra Aslan', 5],
			['Serkan Uysal', 3],
			null,
			['Gül Ekinci', 5],
			null,
			['Tarık Soylu', 2],
			null,
			null,
			['Pınar Kaya', 5],
			null,
			null,
			null,
			['Sen', 5]
		],
		readAtToday: '13:40'
	}
];

/**
 * The moment a fixture's current-round reads are stamped: `clock` ("07:12") today in the
 * seeding machine's zone — the device's, which is the zone Ana sayfa's "Bugün okunanlar" reads
 * its times in — so finished shares list at different times rather than all at the seed's run.
 * Never later than now, and never before the round began, which would file the read under a
 * round the board no longer shows.
 *
 * `daysAgo` moves it back — a share finished earlier in a longer round, which Ana sayfa counts
 * as done this round but not as read today (B9b).
 */
const readTimeToday = (clock: string | undefined, now: Date, roundStartedAt: Date | null, daysAgo = 0): Date => {
	if (!clock && daysAgo === 0) {
		return now;
	}

	const [hours = now.getHours(), minutes = now.getMinutes()] = clock ? clock.split(':').map(Number) : [];
	const at = new Date(now);

	at.setDate(at.getDate() - daysAgo);
	at.setHours(hours, minutes, 0, 0);

	const earliest = roundStartedAt && roundStartedAt > at ? roundStartedAt : at;

	return earliest > now ? now : earliest;
};

const userIdForSlot = (spec: GroupSeed, slotIndex: number) =>
	spec.slotUserIds?.[slotIndex] ?? (slotIndex === 0 ? spec.ownerUserId : `${spec.memberIdPrefix}_${slotIndex}`);

const isOccupiedSlot = (spec: GroupSeed, slotIndex: number) => (spec.members[slotIndex] ?? null) !== null;

const kindOf = (spec: GroupSeed): GroupKindName => spec.kind ?? 'CEVSEN';

/** Which babs a seat reads in a given round: rotated for ROTATION groups, standing for FIXED. */
const babNumbersForSeatRound = (spec: GroupSeed, slotIndex: number, roundIndex: number) =>
	spec.splitMode === 'ROTATION'
		? babNumbersForRound(slotIndex, spec.spots, roundIndex, partCountFor(kindOf(spec)))
		: babNumbersForSlot(slotIndex, spec.spots, partCountFor(kindOf(spec)));

const seedGroup = async (spec: GroupSeed) => {
	if (spec.slotUserIds?.[0]) {
		throw new Error(`"${spec.name}": seat 0 is always the owner — don't override it via slotUserIds.`);
	}

	if (spec.status === 'GATHERING' && spec.members.some(member => member && member[1] > 0)) {
		throw new Error(`"${spec.name}" is GATHERING but has reads recorded — nothing is counted before day 1.`);
	}

	if (spec.pastRounds?.length && spec.status !== 'RUNNING') {
		throw new Error(`"${spec.name}": a group that hasn't started has no closed rounds to describe.`);
	}

	if (!CYCLES_FOR_KIND[kindOf(spec)].includes(spec.cycle)) {
		throw new Error(`"${spec.name}": a ${kindOf(spec)} group cannot be created ${spec.cycle}.`);
	}

	const inviteCode = codeFor(spec.inviteCode);
	const existing = await prisma.group.findUnique({ where: { inviteCode } });

	if (existing) {
		// Cascades through members, babs, cheers and waitlist entries.
		await prisma.group.delete({ where: { id: existing.id } });
	}

	const now = new Date();
	const startedAt =
		spec.status === 'RUNNING' ? new Date(now.getTime() - (spec.startedDaysAgo ?? 0) * 24 * 60 * 60 * 1000) : null;

	// Derive the round the calendar says this fixture should already be on, using the same
	// helpers `ensureCurrentRound` does — otherwise a group "started N days ago" seeds on
	// round 0 while the first request that opens it rolls forward and wipes the reads below.
	const roundDays = ROUND_DAYS[spec.cycle];
	// The same calendar `ensureCurrentRound` reads: days, or a Hizb's calendar month.
	const length = roundLengthFor({ kind: kindOf(spec), cycle: spec.cycle, roundDays });
	const roundIndex = startedAt ? roundIndexSince(startedAt, length, now, DEFAULT_TIME_ZONE) : 0;
	const roundStartedAt = startedAt ? roundStartedAtFor(startedAt, length, roundIndex, DEFAULT_TIME_ZONE) : null;
	const endsAt = startedAt ? roundEndsAt(startedAt, length, roundIndex, DEFAULT_TIME_ZONE) : undefined;

	const group = await prisma.group.create({
		data: {
			ownerUserId: spec.ownerUserId,
			name: spec.name,
			dedication: spec.dedication,
			visibility: spec.visibility,
			splitMode: spec.splitMode,
			status: spec.status,
			startedAt,
			roundIndex,
			roundStartedAt,
			...(endsAt ? { endsAt } : {}),
			autoStartWhenFull: spec.autoStartWhenFull,
			kind: kindOf(spec),
			cycle: spec.cycle,
			// Stored, never inferred from the cadence: the column defaults to 7, so a DAILY
			// fixture that omits it seeds a group whose rounds are a week long. The backfill
			// migration only reached rows that already existed.
			roundDays,
			spots: spec.spots,
			inviteCode,
			openToJoin: true,
			reminderEnabled: true,
			reminderTime: spec.reminderTime,
			members: {
				create: spec.members.flatMap((member, slotIndex) =>
					member === null
						? []
						: [
								{
									userId: userIdForSlot(spec, slotIndex),
									displayName: member[0],
									role: slotIndex === 0 ? ('OWNER' as const) : ('MEMBER' as const),
									slotIndex
								}
						  ]
				)
			}
		}
	});

	const readAt = readTimeToday(spec.readAtToday, now, roundStartedAt, spec.readDaysAgo);
	// Bab -> who reads it and whether it's read, for the group's *current* round — rotated
	// per seat for ROTATION groups, standing for FIXED — so an uneven `spots` (12 doesn't
	// divide 100) lands exactly where `rangeForSlot` says it does.
	const partCount = partCountFor(kindOf(spec));
	const readAssignmentByBab = new Map<number, { userId: string; isRead: boolean }>();

	spec.members.forEach((member, slotIndex) => {
		if (member === null) {
			return;
		}

		const [, babsRead] = member;

		babNumbersForSeatRound(spec, slotIndex, roundIndex).forEach((number, indexInSlot) => {
			readAssignmentByBab.set(number, { userId: userIdForSlot(spec, slotIndex), isRead: indexInSlot < babsRead });
		});
	});

	// Bab -> the member who volunteered for it out of the pool this round — the one case
	// `assignedUserId` is still written, since it's a genuine claim rather than seat ownership.
	const poolClaimByBab = new Map<number, string>();

	for (const claim of spec.poolClaims ?? []) {
		if (isOccupiedSlot(spec, claim.slotIndex)) {
			throw new Error(`"${spec.name}": pool claim targets occupied seat ${claim.slotIndex}.`);
		}

		if (!isOccupiedSlot(spec, claim.byMemberIndex)) {
			throw new Error(`"${spec.name}": pool claim references empty seat ${claim.byMemberIndex}.`);
		}

		if (claim.portions && kindOf(spec) !== 'HIZB') {
			throw new Error(`"${spec.name}": only a Hizb pool is claimed portion by portion.`);
		}

		const claimantUserId = userIdForSlot(spec, claim.byMemberIndex);
		const block = babNumbersForSeatRound(spec, claim.slotIndex, roundIndex);
		const claimed: (number | undefined)[] = claim.portions
			? claim.portions.map(position => block[position])
			: block;

		claimed.forEach((number, indexInClaim) => {
			if (number === undefined || poolClaimByBab.has(number)) {
				throw new Error(
					`"${spec.name}": a claim on seat ${claim.slotIndex} names a portion outside its block or one already claimed.`
				);
			}

			poolClaimByBab.set(number, claimantUserId);
			readAssignmentByBab.set(number, { userId: claimantUserId, isRead: indexInClaim < claim.babsRead });
		});
	}

	await prisma.groupBab.createMany({
		data: Array.from({ length: partCount }, (_, index) => {
			const number = index + 1;
			const readAssignment = readAssignmentByBab.get(number);
			const claimedByUserId = poolClaimByBab.get(number);

			return {
				groupId: group.id,
				number,
				...(claimedByUserId ? { assignedUserId: claimedByUserId } : {}),
				...(readAssignment?.isRead ? { readByUserId: readAssignment.userId, readAt } : {})
			};
		})
	});

	// `GroupBab` only ever reflects the current round; `BabRead` is the permanent log the
	// Profile screen reads from, so every read the fixture creates above needs a matching row
	// here too — otherwise a seeded user shows zero babs read despite a part-read board.
	const babReadData: { groupId: string; babNumber: number; userId: string; roundIndex: number; readAt: Date }[] = [];

	for (const [number, assignment] of readAssignmentByBab) {
		if (assignment.isRead) {
			babReadData.push({ groupId: group.id, babNumber: number, userId: assignment.userId, roundIndex, readAt });
		}
	}

	for (const past of spec.pastRounds ?? []) {
		const historicalRoundIndex = roundIndex - past.roundsAgo;

		if (!startedAt || historicalRoundIndex < 0) {
			throw new Error(`"${spec.name}": round ${roundIndex} has no round ${past.roundsAgo} rounds before it.`);
		}

		// Filed inside the round it belongs to, whatever the cycle: "N days ago" only works for a
		// daily group, and a weekly or monthly round's reads dated yesterday would land in the
		// round now open on the heatmap and the streak. The middle of the round's own window is
		// inside it for every cycle, round 0's mid-afternoon start included.
		const historicalReadAt = new Date(
			(roundStartedAtFor(startedAt, length, historicalRoundIndex, DEFAULT_TIME_ZONE).getTime() +
				roundEndsAt(startedAt, length, historicalRoundIndex, DEFAULT_TIME_ZONE).getTime()) /
				2
		);
		// One reader per bab, exactly as the unique key on `BabRead` enforces. Own reads land
		// first so a cover can only ever fill what its owner left — the same rule the app's
		// "Üstlen" obeys, which keeps the fixtures honest about who did what.
		const readerByBab = new Map<number, string>();

		spec.members.forEach((member, slotIndex) => {
			if (member === null) {
				return;
			}

			const owned = babNumbersForSeatRound(spec, slotIndex, historicalRoundIndex);
			const readCount =
				past.readBySlot === 'all' ? owned.length : Math.min(past.readBySlot?.[slotIndex] ?? 0, owned.length);

			owned.slice(0, readCount).forEach(number => readerByBab.set(number, userIdForSlot(spec, slotIndex)));
		});

		for (const cover of past.covers ?? []) {
			if (!isOccupiedSlot(spec, cover.bySlotIndex)) {
				throw new Error(`"${spec.name}": seat ${cover.bySlotIndex} is empty and cannot cover anything.`);
			}

			for (const number of cover.babNumbers) {
				if (readerByBab.has(number)) {
					throw new Error(
						`"${spec.name}": bab ${number} in round ${historicalRoundIndex} was already read, so it cannot be covered.`
					);
				}

				readerByBab.set(number, userIdForSlot(spec, cover.bySlotIndex));
			}
		}

		for (const [babNumber, userId] of readerByBab) {
			babReadData.push({
				groupId: group.id,
				babNumber,
				userId,
				roundIndex: historicalRoundIndex,
				readAt: historicalReadAt
			});
		}
	}

	if (babReadData.length > 0) {
		await prisma.babRead.createMany({ data: babReadData });
	}

	// A read of a repeated part (Sekine ×19) stands on a finished count in that round — every
	// read path refuses one without it, so a fixture that skipped the row would describe a read
	// the app could never have made. The counts in progress are the fixture's own.
	const kind = kindOf(spec);
	const repetitionData = babReadData
		.filter(read => requiredRepetitions(kind, read.babNumber) > 1)
		.map(read => ({
			groupId: group.id,
			userId: read.userId,
			roundIndex: read.roundIndex,
			partNumber: read.babNumber,
			count: requiredRepetitions(kind, read.babNumber)
		}));

	for (const progress of spec.repetitionsInProgress ?? []) {
		const userId = userIdForSlot(spec, progress.bySlotIndex);
		const assignment = readAssignmentByBab.get(progress.partNumber);
		const required = requiredRepetitions(kind, progress.partNumber);

		if (
			spec.status !== 'RUNNING' ||
			required <= 1 ||
			progress.count >= required ||
			assignment?.userId !== userId ||
			assignment.isRead
		) {
			throw new Error(
				`"${spec.name}": seat ${progress.bySlotIndex} is not partway through part ${progress.partNumber} in round ${roundIndex}.`
			);
		}

		repetitionData.push({
			groupId: group.id,
			userId,
			roundIndex,
			partNumber: progress.partNumber,
			count: progress.count
		});
	}

	if (repetitionData.length > 0) {
		await prisma.groupPartRepetition.createMany({ data: repetitionData });
	}

	const readCount = await prisma.groupBab.count({ where: { groupId: group.id, readAt: { not: null } } });

	// Mirrors `syncCompletedAt`: `completedAt` only ever agrees with a fully-read board.
	if (readCount === partCount) {
		await prisma.group.update({ where: { id: group.id }, data: { completedAt: readAt } });
	}

	const memberCount = spec.members.filter(member => member !== null).length;

	console.log(
		`Seeded "${spec.name}" [${spec.status}/${spec.splitMode}] — ${memberCount}/${spec.spots} members, ${readCount}/${partCount} babs read.`
	);
};

/*
 * ── Kur'an (hatim) fixtures ──────────────────────────────────────────────────────────────
 *
 * **A separate builder, not a `kind` flag through `seedGroup`.** That function derives every
 * bab from a seat and a rotation — which block a seat reads, which blocks an empty seat
 * leaves in the pool, who owed what in a closed round. None of it applies here: a hatim's
 * thirty cüz are *chosen*, stored one `CuzHolding` row at a time, and a member may hold six
 * or one. Threading a branch through all of that would have left two rules tangled in one
 * function; the two divide differently, so the fixtures do too.
 */

/**
 * A member and the cüz they hold, with how many of those they have read. `loanCuz` marks the
 * ones taken out of the havuz — loans, which the rollover never carries forward.
 */
type HatimMemberSeed = { name: string; cuz: number[]; readCuz?: number[]; loanCuz?: number[] } | null;

type HatimSeed = {
	name: string;
	dedication: string;
	inviteCode: string;
	ownerUserId: string;
	memberIdPrefix: string;
	/** Seat -> user override, for fixtures where the signed-in user is not the owner. */
	slotUserIds?: Record<number, string>;
	/** How many days a round runs. */
	roundDays: number;
	/**
	 * Whether the hatim comes round again — QC3's three cadences do, "Tek seferlik" does not.
	 *
	 * **Stated, not inferred from `roundDays`.** The cycle used to be derived from the number
	 * alone: 1, 7 and 30 were cadences and everything else was CUSTOM. That reads fine until
	 * a fixture wants a repeating fifteen-day round and silently gets a one-off — the seed
	 * would have been describing a group the create flow cannot produce, and nothing would
	 * have said so.
	 */
	repeats: boolean;
	/** Null means QC2's cap is off, which is the default a group is created with. */
	maxPerMember: number | null;
	boundaryPolicy: 'KEEP' | 'REPICK';
	visibility: 'OPEN' | 'PRIVATE';
	status: 'GATHERING' | 'RUNNING';
	startedDaysAgo?: number;
	autoStartWhenFull: boolean;
	members: HatimMemberSeed[];
	/**
	 * What each seat held and read in the round **before** the one in progress, seat for seat
	 * with `members` (only `cuz`, `readCuz` and `loanCuz` are read from it). For the round-start
	 * screens: QR1 lists last round's cüz and offers them again, and Q7 celebrates a round that
	 * closed complete. A fixture with one also dates its members' joining to that round's start,
	 * so they count as having been there — a member who joined this round has no last round.
	 */
	previousRound?: HatimMemberSeed[];
	/** When this round's reads happened, as "HH:mm" today — see `readTimeToday`. Now if absent. */
	readAtToday?: string;
	/** Moves those reads this many days back, still inside the round — see `readTimeToday`. */
	readDaysAgo?: number;
};

/**
 * The fixtures covering the states the Kur'an screens can render.
 *
 * Between them: a lobby still filling, a round in progress with cüz nobody has taken, a
 * capped group, a custom length that no cadence name describes, a finished hatim, one the
 * signed-in user belongs to without owning, and a lobby they have joined but do not own
 * ("Bekleyen Hatim") — the waiting side, with no Başlat.
 */
const HATIM_GROUPS = (): HatimSeed[] => [
	{
		name: 'Ramazan Hatmi',
		dedication: 'Ramazan ayı için',
		inviteCode: codeFor('QURN1A2B'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_a',
		// Thirty days, so the cadence label reads "Aylık" — the preset QC3 offers.
		roundDays: 30,
		repeats: true,
		maxPerMember: 3,
		boundaryPolicy: 'KEEP',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 6,
		autoStartWhenFull: false,
		// 21 of 30 taken, 9 still in the pool — the state Q4 exists for.
		members: [
			{ name: 'Sen', cuz: [7, 22], readCuz: [7] },
			{ name: 'Ayşe Yılmaz', cuz: [1, 2, 3], readCuz: [1, 2, 3] },
			{ name: 'Mehmet Kaya', cuz: [4, 5], readCuz: [4] },
			{ name: 'Zeynep Arslan', cuz: [6, 8, 9] },
			{ name: 'Ali Demir', cuz: [10, 11, 12], readCuz: [10, 11] },
			{ name: 'Fatma Şahin', cuz: [13, 14] },
			{ name: 'Hasan Toprak', cuz: [15, 16, 17], readCuz: [15] },
			{ name: 'Elif Çetin', cuz: [18, 19, 20] },
			{ name: 'Burak Aydın', cuz: [21, 23] }
		]
	},
	{
		name: 'Hatim Halkası',
		dedication: 'Her hafta bir hatim',
		inviteCode: codeFor('QURN2C3D'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_b',
		// Seven days: the one length that returns to the same weekday, so its reset line
		// names one. The fifteen-day group below is what the other phrasing is for.
		roundDays: 7,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'REPICK',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 2,
		autoStartWhenFull: true,
		// No cap: one member holds eight, which is what "kapalıysa herkes dilediği kadar alır"
		// actually looks like.
		members: [
			{ name: 'Sen', cuz: [1, 2, 3, 4, 5, 6, 7, 8], readCuz: [1, 2, 3, 4, 5] },
			{ name: 'Kerem Ateş', cuz: [9, 10, 11, 12], readCuz: [9, 10] },
			{ name: 'Nur Aksoy', cuz: [13, 14, 15, 16, 17, 18] },
			{ name: 'Hatice Bulut', cuz: [19, 20, 21, 22, 23, 24, 25], readCuz: [19, 20, 21] },
			{ name: 'Yusuf Kara', cuz: [26, 27, 28, 29, 30], readCuz: [26] }
		]
	},
	{
		name: 'Kırk Günlük Hatim',
		dedication: 'Merhum dedem için',
		inviteCode: codeFor('QURN3E4F'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_c',
		/*
		 * Fifteen days — **a one-off, and the fixture the reset line was getting wrong.** No
		 * cadence describes it: the hatim runs fifteen days and is then finished, so the line
		 * has to read "… tarihinde biter" rather than naming a weekday it meets exactly once.
		 */
		roundDays: 15,
		repeats: false,
		maxPerMember: 2,
		// Inert on a one-off — there is no next round to keep cüz for. Stored as the default
		// the create flow sends when it stops asking.
		boundaryPolicy: 'KEEP',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 1,
		autoStartWhenFull: false,
		members: [
			{ name: 'Sen', cuz: [30], readCuz: [] },
			{ name: 'İbrahim Yücel', cuz: [1, 2], readCuz: [1] },
			{ name: 'Sema Doğan', cuz: [3, 4] }
		]
	},
	{
		name: 'Günlük Cüz',
		dedication: 'Her gün bir cüz',
		inviteCode: codeFor('QURN4G5H'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_d',
		// One day, so the reset line reads "Her gün 00:00" — the third phrasing.
		roundDays: 1,
		repeats: true,
		maxPerMember: 1,
		boundaryPolicy: 'REPICK',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 4,
		autoStartWhenFull: true,
		// Capped at one each, so the pool is most of the map — the "sahipsiz" warning's case.
		members: [
			{ name: 'Sen', cuz: [12] },
			{ name: 'Rabia Şen', cuz: [1], readCuz: [1] },
			{ name: 'Ömer Kılıç', cuz: [2] }
		]
	},
	{
		// "Bugün okunanlar" (B8c) for a Kur'an share: your one cüz, already read this morning.
		name: 'Gün Sonu Hatmi',
		dedication: 'Günün bereketi için',
		inviteCode: codeFor('QURN7D3S'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_gs',
		roundDays: 1,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'KEEP',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 2,
		autoStartWhenFull: false,
		members: [
			{ name: 'Sen', cuz: [14], readCuz: [14] },
			{ name: 'Yasin Er', cuz: [1, 2], readCuz: [1] },
			{ name: 'Selin Koç', cuz: [3] }
		],
		readAtToday: '10:05'
	},
	{
		name: 'Tamamlanan Hatim',
		dedication: 'Şükür için',
		inviteCode: codeFor('QURN5I6J'),
		ownerUserId: 'dev_hatim_e_0',
		memberIdPrefix: 'dev_hatim_e',
		// The signed-in user is a member here, not the owner — the non-owner group screen.
		slotUserIds: { 2: OWNER_USER_ID },
		roundDays: 7,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'KEEP',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 3,
		autoStartWhenFull: false,
		// Every cüz taken and read: `completedAt` is stamped, and the board is the "tamam" state.
		members: [
			{
				name: 'Osman Bilgin',
				cuz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
				readCuz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			},
			{
				name: 'Meryem Ergin',
				cuz: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
				readCuz: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
			},
			{
				name: 'Sen',
				cuz: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
				readCuz: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
			}
		]
	},
	/*
	 * ── Tur başı (Q7 · QR1) ─────────────────────────────────────────────────────────────
	 *
	 * **Six groups on their second round**, one for each way a new round can open. Each started
	 * eight days ago on a weekly round, so round 2 has just begun and round 1 is closed behind
	 * it; `previousRound` is what each seat held and read there. Q7 for the round in progress
	 * is "Tamamlanan Hatim" above.
	 */
	{
		// "Yeniden seçilir": you hold nothing, and last round's 7 and 22 are both free again —
		// QR1 must be answered, and "Aynı cüzlerle devam" is on offer.
		name: 'Tur Başı · Yeniden',
		dedication: 'Yeni turda cüzünü seç',
		inviteCode: codeFor('QURNC5Y7'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_l',
		roundDays: 7,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'REPICK',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 8,
		autoStartWhenFull: false,
		members: [
			{ name: 'Sen', cuz: [] },
			{ name: 'Kerem Ateş', cuz: [1, 2, 3] },
			{ name: 'Nur Aksoy', cuz: [10, 11] }
		],
		previousRound: [
			{ name: 'Sen', cuz: [7, 22], readCuz: [7, 22] },
			{ name: 'Kerem Ateş', cuz: [1, 2], readCuz: [1] },
			{ name: 'Nur Aksoy', cuz: [10] }
		]
	},
	{
		// "Cüzler korunur": 3 and 15 were carried into this round — QR1 as a note, once.
		name: 'Tur Başı · Korunan',
		dedication: 'Cüzlerin seninle kalır',
		inviteCode: codeFor('QURND6Z8'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_m',
		roundDays: 7,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'KEEP',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 8,
		autoStartWhenFull: false,
		members: [
			{ name: 'Sen', cuz: [3, 15] },
			{ name: 'Ali Demir', cuz: [4, 5] }
		],
		previousRound: [
			{ name: 'Sen', cuz: [3, 15], readCuz: [3] },
			{ name: 'Ali Demir', cuz: [4, 5], readCuz: [4, 5] }
		]
	},
	{
		// "Cüzler korunur", but your only cüz last round was a havuz loan — loans go back at the
		// boundary, so you hold nothing and QR1 must be answered after all.
		name: 'Tur Başı · Emanet',
		dedication: 'Emanet cüz havuza döndü',
		inviteCode: codeFor('QURNE7A9'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_n',
		roundDays: 7,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'KEEP',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 8,
		autoStartWhenFull: false,
		members: [
			{ name: 'Sen', cuz: [] },
			{ name: 'Hasan Toprak', cuz: [1, 2] }
		],
		previousRound: [
			{ name: 'Sen', cuz: [9], readCuz: [9], loanCuz: [9] },
			{ name: 'Hasan Toprak', cuz: [1, 2], readCuz: [1, 2] }
		]
	},
	{
		// Every cüz already taken this round, nothing free to pick — "Bu turda boş cüz kalmadı".
		name: 'Tur Başı · Boş Yok',
		dedication: 'Bu turda yer kalmadı',
		inviteCode: codeFor('QURNF8B2'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_o',
		roundDays: 7,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'REPICK',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 8,
		autoStartWhenFull: false,
		members: [
			{ name: 'Sen', cuz: [] },
			{ name: 'Yakup Erdem', cuz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
			{ name: 'Rukiye Yıldız', cuz: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] }
		],
		previousRound: [
			{ name: 'Sen', cuz: [5], readCuz: [5] },
			{ name: 'Yakup Erdem', cuz: [1, 2, 3, 4], readCuz: [1, 2] },
			{ name: 'Rukiye Yıldız', cuz: [16, 17] }
		]
	},
	{
		// Last round closed with all thirty read, and you have not opened the group since — Q7
		// for round 1 first, then QR1 ("Yeniden seçilir", holding nothing).
		name: 'Geçen Tur Bitti',
		dedication: 'Geçen hafta hatim tamamlandı',
		inviteCode: codeFor('QURNG9C3'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_p',
		roundDays: 7,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'REPICK',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 8,
		autoStartWhenFull: false,
		members: [
			{ name: 'Sen', cuz: [] },
			{ name: 'Meryem Ergin', cuz: [1, 2] },
			{ name: 'Osman Bilgin', cuz: [] }
		],
		previousRound: [
			{ name: 'Sen', cuz: [28, 29, 30], readCuz: [28, 29, 30] },
			{
				name: 'Meryem Ergin',
				cuz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
				readCuz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
			},
			{
				name: 'Osman Bilgin',
				cuz: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
				readCuz: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
			}
		]
	},
	{
		// The same completed round under "Cüzler korunur" — Q7 first, then the carried note.
		name: 'Geçen Tur Bitti · Korunan',
		dedication: 'Tamamlandı, cüzler korundu',
		inviteCode: codeFor('QURNH2D4'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_q',
		roundDays: 7,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'KEEP',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 8,
		autoStartWhenFull: false,
		members: [
			{ name: 'Sen', cuz: [28, 29, 30] },
			{ name: 'Meryem Ergin', cuz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
			{ name: 'Osman Bilgin', cuz: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27] }
		],
		previousRound: [
			{ name: 'Sen', cuz: [28, 29, 30], readCuz: [28, 29, 30] },
			{
				name: 'Meryem Ergin',
				cuz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
				readCuz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
			},
			{
				name: 'Osman Bilgin',
				cuz: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
				readCuz: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
			}
		]
	},
	/*
	 * ── Keşfet ──────────────────────────────────────────────────────────────────────────
	 *
	 * **The four below have no seat for the signed-in user, and that is the whole point.**
	 * Discover lists OPEN groups you are *not* in, so every fixture above — where slot 0 is
	 * yours — is invisible there by construction. Without these the catalogue was Cevşen
	 * only, and the mixed list the type chip and the kind filter exist for could not be seen
	 * at all.
	 */
	{
		name: 'Şehir Hatmi',
		dedication: 'Mahallemiz için',
		inviteCode: codeFor('QURN7M8N'),
		// Somebody else's group, all the way down — `ownerUserId` is not the seeded user.
		ownerUserId: 'dev_hatim_g_0',
		memberIdPrefix: 'dev_hatim_g',
		roundDays: 7,
		repeats: true,
		maxPerMember: 3,
		boundaryPolicy: 'KEEP',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 2,
		autoStartWhenFull: false,
		// Nineteen taken, eleven free: joinable, with room to pick from.
		members: [
			{ name: 'Emine Korkmaz', cuz: [1, 2, 3], readCuz: [1, 2] },
			{ name: 'Salih Öztürk', cuz: [4, 5, 6], readCuz: [4] },
			{ name: 'Havva Güneş', cuz: [7, 8, 9, 10] },
			{ name: 'Bilal Kurt', cuz: [11, 12, 13], readCuz: [11, 12, 13] },
			{ name: 'Zehra Aslan', cuz: [14, 15, 16, 17, 18, 19] }
		]
	},
	{
		name: 'Dolu Hatim',
		dedication: 'Otuz cüz de alındı',
		inviteCode: codeFor('QURN8P9R'),
		ownerUserId: 'dev_hatim_h_0',
		memberIdPrefix: 'dev_hatim_h',
		roundDays: 30,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'KEEP',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 9,
		autoStartWhenFull: false,
		/*
		 * **Full, and full in the way only a hatim can be**: every cüz taken while seats are
		 * still free. A Cevşen group is full when its seats are gone; this one has five
		 * members in thirty seats and nothing left to pick, which is exactly the case
		 * `isFull` was rewritten for.
		 */
		members: [
			{ name: 'Yakup Erdem', cuz: [1, 2, 3, 4, 5, 6], readCuz: [1, 2, 3] },
			{ name: 'Sümeyye Acar', cuz: [7, 8, 9, 10, 11, 12], readCuz: [7, 8] },
			{ name: 'Harun Polat', cuz: [13, 14, 15, 16, 17, 18], readCuz: [13] },
			{ name: 'Rukiye Yıldız', cuz: [19, 20, 21, 22, 23, 24] },
			{ name: 'Davut Şimşek', cuz: [25, 26, 27, 28, 29, 30], readCuz: [25, 26, 27, 28] }
		]
	},
	{
		name: 'Kırk Gün Hatmi',
		dedication: 'Kırk günde bir hatim',
		inviteCode: codeFor('QURN9S2T'),
		ownerUserId: 'dev_hatim_i_0',
		memberIdPrefix: 'dev_hatim_i',
		// A one-off in the catalogue, so Keşfet shows a card whose line reads "… biter"
		// rather than a rhythm.
		roundDays: 40,
		repeats: false,
		maxPerMember: 5,
		boundaryPolicy: 'KEEP',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 5,
		autoStartWhenFull: false,
		members: [
			{ name: 'Mustafa Eren', cuz: [1, 2, 3, 4, 5], readCuz: [1] },
			{ name: 'Leyla Çakır', cuz: [6, 7, 8] }
		]
	},
	{
		name: 'Biten Hatim',
		dedication: 'On gün sürdü, bitti',
		inviteCode: codeFor('QURNBW4X'),
		ownerUserId: 'dev_hatim_k_0',
		memberIdPrefix: 'dev_hatim_k',
		/*
		 * **A one-off whose days are already up** — the state only this kind reaches.
		 *
		 * A cadence always has a next round, so "the time is over" is not a thing a Cevşen
		 * group or a repeating hatim can be. This one started twelve days ago and ran for ten:
		 * `endsAt` is in the past, `roundIndex` is still 0 because it never rolls, and four of
		 * its cüz were never read. Nothing rescues them — that is what finishing incomplete
		 * looks like, and it is the case `qPoolWarn` warns about.
		 */
		roundDays: 10,
		repeats: false,
		maxPerMember: null,
		boundaryPolicy: 'KEEP',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 12,
		autoStartWhenFull: false,
		members: [
			{
				name: 'Ahmet Solmaz',
				cuz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
				readCuz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
			},
			{
				name: 'Fadime Uçar',
				cuz: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
				readCuz: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]
			}
		]
	},
	{
		name: 'Toplanan Hatim',
		dedication: 'Başlamayı bekliyor',
		inviteCode: codeFor('QURNAU3V'),
		ownerUserId: 'dev_hatim_j_0',
		memberIdPrefix: 'dev_hatim_j',
		roundDays: 7,
		repeats: true,
		maxPerMember: 2,
		boundaryPolicy: 'REPICK',
		visibility: 'OPEN',
		status: 'GATHERING',
		autoStartWhenFull: true,
		// A lobby to join from Keşfet — the flow that ends on the joined-welcome screen.
		members: [
			{ name: 'Necmi Aydoğan', cuz: [5, 6] },
			{ name: 'Şule Kaplan', cuz: [12] }
		]
	},
	{
		name: 'Yeni Hatim',
		dedication: 'Kodu paylaş, cüzler dolsun',
		inviteCode: codeFor('QURN6K7L'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_f',
		roundDays: 30,
		repeats: true,
		maxPerMember: 3,
		boundaryPolicy: 'KEEP',
		visibility: 'OPEN',
		status: 'GATHERING',
		autoStartWhenFull: true,
		// Still filling: the lobby's cüz map, part taken and mostly free.
		members: [
			{ name: 'Sen', cuz: [22] },
			{ name: 'Talha Ünal', cuz: [1, 2] }
		]
	},
	{
		name: 'Bekleyen Hatim',
		dedication: 'Başlatılmasını bekliyoruz',
		inviteCode: codeFor('QURNJ3E5'),
		ownerUserId: 'dev_hatim_w_0',
		memberIdPrefix: 'dev_hatim_w',
		// The signed-in user joined somebody else's lobby: a member, not the owner, before the
		// start — the lobby's waiting side, where there is no Başlat to press.
		slotUserIds: { 1: OWNER_USER_ID },
		roundDays: 7,
		repeats: true,
		maxPerMember: 3,
		boundaryPolicy: 'KEEP',
		visibility: 'PRIVATE',
		status: 'GATHERING',
		autoStartWhenFull: false,
		members: [
			{ name: 'Hüseyin Arslan', cuz: [3, 4] },
			{ name: 'Sen', cuz: [9, 10] },
			{ name: 'Merve Çelik', cuz: [17] }
		]
	}
];

/**
 * The cadence column, from what the fixture said it wanted. Mirrors `planColumnsFor`.
 *
 * A repeating hatim has to be one of QC3's three presets, because those are the only lengths
 * the create flow offers as cadences — asked for anything else it throws rather than seeding
 * a group the app could not have made.
 */
const cycleForSpec = (spec: Pick<HatimSeed, 'name' | 'repeats' | 'roundDays'>) => {
	if (!spec.repeats) {
		return 'CUSTOM' as const;
	}

	if (spec.roundDays === 1) {
		return 'DAILY' as const;
	}

	if (spec.roundDays === 7) {
		return 'WEEKLY' as const;
	}

	if (spec.roundDays === 30) {
		return 'MONTHLY' as const;
	}

	throw new Error(
		`"${spec.name}": a repeating hatim must run 1, 7 or 30 days — ${spec.roundDays} is only reachable as a one-off.`
	);
};

const hatimUserIdForSlot = (spec: HatimSeed, slotIndex: number) =>
	spec.slotUserIds?.[slotIndex] ?? (slotIndex === 0 ? spec.ownerUserId : `${spec.memberIdPrefix}_${slotIndex}`);

const seedHatim = async (spec: HatimSeed) => {
	const inviteCode = spec.inviteCode;
	const existing = await prisma.group.findUnique({ where: { inviteCode }, select: { id: true } });

	if (existing) {
		await prisma.group.delete({ where: { id: existing.id } });
	}

	const now = new Date();
	const startedAt =
		spec.status === 'RUNNING' ? new Date(now.getTime() - (spec.startedDaysAgo ?? 0) * 24 * 60 * 60 * 1000) : null;

	/*
	 * The same helpers `ensureCurrentRound` uses, so a fixture "started N days ago" seeds on
	 * the round the calendar already says it is on rather than being rolled forward — and
	 * wiped — by the first request that opens it.
	 *
	 * **Including the rule that a one-off never leaves round 0.** Without it a ten-day
	 * one-off started twelve days ago seeded on round 1, which no code path can produce: the
	 * first request would have read a group whose stored round the server would never have
	 * advanced it to, with its holdings and reads filed under a round nobody is on.
	 */
	const rolls = spec.repeats && startedAt !== null;
	const roundIndex = rolls ? roundIndexSince(startedAt, spec.roundDays, now, DEFAULT_TIME_ZONE) : 0;
	const roundStartedAt = rolls
		? roundStartedAtFor(startedAt, spec.roundDays, roundIndex, DEFAULT_TIME_ZONE)
		: startedAt;
	const endsAt = startedAt ? roundEndsAt(startedAt, spec.roundDays, roundIndex, DEFAULT_TIME_ZONE) : undefined;

	// The round before this one, when the fixture describes it — it has to exist to be described.
	if (spec.previousRound && (!rolls || roundIndex < 1)) {
		throw new Error(`"${spec.name}": previousRound needs a repeating hatim past its first round.`);
	}

	const previousRoundStartedAt =
		spec.previousRound && startedAt
			? roundStartedAtFor(startedAt, spec.roundDays, roundIndex - 1, DEFAULT_TIME_ZONE)
			: null;

	/** One round's holdings: in range, each cüz held once, and reads and loans only of held cüz. */
	const assertRound = (label: string, members: HatimMemberSeed[]) => {
		const held = new Set<number>();

		members.forEach(member => {
			member?.cuz.forEach(number => {
				if (number < 1 || number > CUZ_COUNT) {
					throw new Error(`"${spec.name}" (${label}): cüz ${number} is outside 1..${CUZ_COUNT}.`);
				}

				if (held.has(number)) {
					throw new Error(`"${spec.name}" (${label}): cüz ${number} is held twice.`);
				}

				held.add(number);
			});

			[...(member?.readCuz ?? []), ...(member?.loanCuz ?? [])].forEach(number => {
				if (!member?.cuz.includes(number)) {
					throw new Error(
						`"${spec.name}" (${label}): ${member?.name} read or borrowed cüz ${number} without holding it.`
					);
				}
			});
		});

		return held;
	};

	const taken = assertRound('this round', spec.members);

	if (spec.previousRound) {
		assertRound('previous round', spec.previousRound);
	}

	const group = await prisma.group.create({
		data: {
			ownerUserId: spec.ownerUserId,
			name: spec.name,
			dedication: spec.dedication,
			visibility: spec.visibility,
			kind: 'HATIM',
			// A hatim divides nothing by seat: `spots` is only the ceiling `slotIndex` needs,
			// and `splitMode` records the value that never moves. See `planColumnsFor`.
			splitMode: 'FIXED',
			spots: CUZ_COUNT,
			cycle: cycleForSpec(spec),
			roundDays: spec.roundDays,
			distribution: 'FREE_PICK',
			maxPerMember: spec.maxPerMember,
			boundaryPolicy: spec.boundaryPolicy,
			status: spec.status,
			startedAt,
			roundIndex,
			roundStartedAt,
			...(endsAt ? { endsAt } : {}),
			autoStartWhenFull: spec.autoStartWhenFull,
			inviteCode,
			openToJoin: true,
			reminderEnabled: true,
			reminderTime: '21:30',
			timezone: DEFAULT_TIME_ZONE,
			startsAt: startedAt ?? now,
			members: {
				create: spec.members.flatMap((member, slotIndex) =>
					member === null
						? []
						: [
								{
									userId: hatimUserIdForSlot(spec, slotIndex),
									displayName: member.name,
									role: slotIndex === 0 ? ('OWNER' as const) : ('MEMBER' as const),
									slotIndex,
									// There for last round, or the round-start screens treat them
									// as having joined this one and have nothing to look back on.
									...(previousRoundStartedAt ? { joinedAt: previousRoundStartedAt } : {})
								}
						  ]
				)
			}
		}
	});

	const readAt = readTimeToday(spec.readAtToday, now, roundStartedAt, spec.readDaysAgo);
	const readerByCuz = new Map<number, string>();

	spec.members.forEach((member, slotIndex) => {
		member?.readCuz?.forEach(number => {
			readerByCuz.set(number, hatimUserIdForSlot(spec, slotIndex));
		});
	});

	// Thirty rows, one per cüz — the board. `assignedUserId` stays null: a hatim records who
	// holds what in `CuzHolding`, and that column means a pool claim on a Cevşen board.
	await prisma.groupBab.createMany({
		data: Array.from({ length: CUZ_COUNT }, (_, index) => {
			const number = index + 1;
			const readByUserId = readerByCuz.get(number) ?? null;

			return {
				groupId: group.id,
				number,
				assignedUserId: null,
				readByUserId,
				readAt: readByUserId ? readAt : null
			};
		})
	});

	// The holdings themselves, for the round the group is on.
	await prisma.cuzHolding.createMany({
		data: spec.members.flatMap((member, slotIndex) =>
			(member?.cuz ?? []).map(cuzNumber => ({
				cuzNumber,
				groupId: group.id,
				isLoan: member?.loanCuz?.includes(cuzNumber) ?? false,
				roundIndex,
				userId: hatimUserIdForSlot(spec, slotIndex)
			}))
		)
	});

	/*
	 * **The round before, as the rollover would have left it** — its holdings (loans flagged, so
	 * "Cüzler korunur" is seen not to have carried them) and its reads, dated inside it. Only
	 * `BabRead` keeps a closed round's reads; the board above is this round's alone.
	 */
	if (spec.previousRound && previousRoundStartedAt) {
		const previousReadAt = new Date(previousRoundStartedAt.getTime() + 24 * 60 * 60 * 1000);

		await prisma.cuzHolding.createMany({
			data: spec.previousRound.flatMap((member, slotIndex) =>
				(member?.cuz ?? []).map(cuzNumber => ({
					cuzNumber,
					groupId: group.id,
					isLoan: member?.loanCuz?.includes(cuzNumber) ?? false,
					roundIndex: roundIndex - 1,
					userId: hatimUserIdForSlot(spec, slotIndex)
				}))
			)
		});
		await prisma.babRead.createMany({
			data: spec.previousRound.flatMap((member, slotIndex) =>
				(member?.readCuz ?? []).map(babNumber => ({
					babNumber,
					groupId: group.id,
					readAt: previousReadAt,
					roundIndex: roundIndex - 1,
					userId: hatimUserIdForSlot(spec, slotIndex)
				}))
			)
		});
	}

	// `BabRead` is the record the rollover never clears — without it the reads above would
	// vanish from every history and streak the moment the round turned over.
	if (readerByCuz.size > 0) {
		await prisma.babRead.createMany({
			data: [...readerByCuz].map(([number, userId]) => ({
				groupId: group.id,
				roundIndex,
				babNumber: number,
				userId,
				readAt
			}))
		});
	}

	// Mirrors `syncCompletedAt`: the stamp only ever agrees with a fully-read board.
	if (readerByCuz.size === CUZ_COUNT) {
		await prisma.group.update({ where: { id: group.id }, data: { completedAt: readAt } });
	}

	console.log(
		`Seeded "${spec.name}" [${spec.status}/${cycleForSpec(spec)}] — ${spec.members.length} members, ${
			taken.size
		}/${CUZ_COUNT} cüz taken, ${readerByCuz.size} read.`
	);
};

/*
 * ── Scenario `all-read` (B9b) ───────────────────────────────────────────────────────────
 *
 * Three groups on longer rounds, each with the signed-in user's share finished on an earlier
 * day of the round in progress: nothing owed, nothing read today, "3 / 3 hatim bitti".
 */
const ALL_READ_GROUPS = (): GroupSeed[] => [
	{
		name: 'Haftalık Halka',
		dedication: 'Haftanın payı',
		inviteCode: 'HFTL6P2M',
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_haftalik',
		spots: 10,
		cycle: 'WEEKLY',
		reminderTime: '20:00',
		splitMode: 'FIXED',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 3,
		autoStartWhenFull: false,
		members: [
			['Sen', 10],
			['Hüseyin Ak', 6],
			['Ebru Tan', 10],
			['Murat Eren', 2]
		],
		readAtToday: '20:15',
		readDaysAgo: 2
	},
	{
		name: 'Bitirenler Hatmi',
		dedication: 'Erken bitirenler için',
		inviteCode: 'BTTN3R7K',
		ownerUserId: 'dev_bitiren_owner',
		memberIdPrefix: 'dev_bitiren',
		slotUserIds: { 2: OWNER_USER_ID },
		spots: 20,
		cycle: 'WEEKLY',
		reminderTime: '07:00',
		splitMode: 'FIXED',
		visibility: 'OPEN',
		status: 'RUNNING',
		startedDaysAgo: 4,
		autoStartWhenFull: false,
		members: [
			['Kenan Işık', 5],
			['Aslı Bora', 1],
			['Sen', 5],
			['Rıza Tok', 3]
		],
		readAtToday: '07:40',
		readDaysAgo: 1
	}
];

const ALL_READ_HATIMS = (): HatimSeed[] => [
	{
		name: 'Haftalık Hatim',
		dedication: 'Her hafta bir hatim',
		inviteCode: codeFor('QURN8B4T'),
		ownerUserId: OWNER_USER_ID,
		memberIdPrefix: 'dev_hatim_hf',
		roundDays: 7,
		repeats: true,
		maxPerMember: null,
		boundaryPolicy: 'KEEP',
		visibility: 'PRIVATE',
		status: 'RUNNING',
		startedDaysAgo: 3,
		autoStartWhenFull: false,
		members: [
			{ name: 'Sen', cuz: [5, 6], readCuz: [5, 6] },
			{ name: 'Sevda Kurt', cuz: [1, 2], readCuz: [1] },
			{ name: 'Cemil Aras', cuz: [3, 4] }
		],
		readAtToday: '21:30',
		readDaysAgo: 1
	}
];

/**
 * A reader in a personal-plan Hizb group. Days are counted back from today (0 = today).
 *
 * Everything from the join up to yesterday is read unless it is in `missedDaysAgo` — or, for a
 * sparse reader, only what `readDaysAgo` lists. `removed` ends the enrollment for inactivity.
 */
type PlanReader = {
	userId: string;
	name: string;
	planDays: PlanDays;
	joinedDaysAgo: number;
	readsToday?: boolean;
	missedDaysAgo?: number[];
	readDaysAgo?: number[];
	/** Ended by the inactivity rule; `rejoinedToday` then enrolls again today, as "Yeniden katıl" does. */
	removed?: { lastReadDaysAgo: number; removalDays: number; rejoinedToday?: boolean };
	/** Today's counters, part-way — the reader's panels mid-count. */
	today?: {
		repetitions?: number;
		istighfarRepetitions?: number;
		istighfarTarget?: 11 | 33 | 100;
		delailRepetitions?: number;
		/** The page the reader is on, 0-based — "Başlandı · Sayfa 2 / 4". */
		bookmark?: number;
	};
};

type PlanGroupSeed = {
	name: string;
	inviteCode: string;
	dedication?: string;
	ownerUserId: string;
	/** 0 lets each member choose; otherwise every enrollment follows it. */
	hizbPlan: 0 | PlanDays;
	/** Owner-only: `startOn` picks the start portion that puts that repetition on today. */
	individual?: { startOn: 'sekine' | 'istighfar' | 'delail' };
	startedDaysAgo: number;
	inactivityDays?: number;
	hideMemberNames?: boolean;
	visibility?: 'OPEN' | 'PRIVATE';
	readers: PlanReader[];
	/** Members of a plan-0 group who haven't chosen a plan yet. */
	unenrolled?: { userId: string; name: string; joinedDaysAgo: number }[];
};

const HIZB_PLAN_GROUPS = (): PlanGroupSeed[] => [
	{
		name: 'Hizb · 33 Günlük',
		inviteCode: 'HZPA3K7D',
		dedication: 'Ailemiz için',
		ownerUserId: OWNER_USER_ID,
		hizbPlan: 33,
		startedDaysAgo: 40,
		inactivityDays: 10,
		visibility: 'OPEN',
		readers: [
			// One full traversal behind them (days 40…8), two days eksik since, today owed.
			{ userId: OWNER_USER_ID, name: 'Sen', planDays: 33, joinedDaysAgo: 40, missedDaysAgo: [3, 6] },
			{ userId: 'dev_hp33_ahmet', name: 'Ahmet', planDays: 33, joinedDaysAgo: 40, readsToday: true },
			{ userId: 'dev_hp33_fatma', name: 'Fatma', planDays: 33, joinedDaysAgo: 30, readDaysAgo: [4, 9, 12, 20] },
			{ userId: 'dev_hp33_yusuf', name: 'Yusuf', planDays: 33, joinedDaysAgo: 18, readsToday: true },
			{ userId: 'dev_hp33_zeynep', name: 'Zeynep', planDays: 33, joinedDaysAgo: 5 }
		]
	},
	{
		name: 'Hizb · 7 Günlük',
		inviteCode: 'HZPB7K3D',
		ownerUserId: 'dev_hp07_owner',
		hizbPlan: 7,
		startedDaysAgo: 16,
		hideMemberNames: true,
		visibility: 'OPEN',
		readers: [
			{ userId: 'dev_hp07_owner', name: 'Hüseyin', planDays: 7, joinedDaysAgo: 16, readsToday: true },
			// Joined nine days ago and read every day, today included — the "done for today" state.
			{ userId: OWNER_USER_ID, name: 'Sen', planDays: 7, joinedDaysAgo: 9, readsToday: true },
			{ userId: 'dev_hp07_meryem', name: 'Meryem', planDays: 7, joinedDaysAgo: 12, missedDaysAgo: [1, 2] }
		]
	},
	{
		name: 'Hizb · Üyeler seçsin',
		inviteCode: 'HZPC5K3D',
		ownerUserId: 'dev_hp00_owner',
		hizbPlan: 0,
		startedDaysAgo: 3,
		visibility: 'OPEN',
		readers: [
			{ userId: 'dev_hp00_owner', name: 'Osman', planDays: 33, joinedDaysAgo: 3, readsToday: true },
			{ userId: 'dev_hp00_ali', name: 'Ali', planDays: 7, joinedDaysAgo: 3 },
			{ userId: 'dev_hp00_hatice', name: 'Hatice', planDays: 15, joinedDaysAgo: 2, readsToday: true }
		],
		// In the group, no plan chosen yet — Home's "choose a plan" task and the group's picker.
		unenrolled: [{ userId: OWNER_USER_ID, name: 'Sen', joinedDaysAgo: 1 }]
	},
	{
		name: 'Hizb · Çıkarıldın',
		inviteCode: 'HZPD6K3D',
		ownerUserId: 'dev_hprm_owner',
		hizbPlan: 15,
		startedDaysAgo: 25,
		inactivityDays: 5,
		visibility: 'OPEN',
		readers: [
			{ userId: 'dev_hprm_owner', name: 'Kerem', planDays: 15, joinedDaysAgo: 25, readsToday: true },
			// Last read twelve days ago, so the five-day rule ended the reading six days ago.
			{
				userId: OWNER_USER_ID,
				name: 'Sen',
				planDays: 15,
				joinedDaysAgo: 20,
				readDaysAgo: [20, 19, 17, 14, 12],
				removed: { lastReadDaysAgo: 12, removalDays: 5 }
			}
		]
	},
	{
		name: 'Hizb · Yeniden katıldın',
		inviteCode: 'HZPN4K3D',
		ownerUserId: 'dev_hprj_owner',
		hizbPlan: 15,
		startedDaysAgo: 25,
		inactivityDays: 5,
		visibility: 'OPEN',
		readers: [
			{ userId: 'dev_hprj_owner', name: 'Selim', planDays: 15, joinedDaysAgo: 25, readsToday: true },
			// Removed six days ago, back in this morning — the welcome-back note (S3b).
			{
				userId: OWNER_USER_ID,
				name: 'Sen',
				planDays: 15,
				joinedDaysAgo: 20,
				readDaysAgo: [20, 19, 17, 14, 12],
				removed: { lastReadDaysAgo: 12, removalDays: 5, rejoinedToday: true }
			}
		]
	},
	{
		name: 'Hizb · İlk gün',
		inviteCode: 'HZPP5K3D',
		ownerUserId: 'dev_hpfd_owner',
		hizbPlan: 33,
		startedDaysAgo: 0,
		visibility: 'OPEN',
		readers: [
			// A shared group that began today: "Bugün · 1. gün", no history or rounds yet (S5).
			{ userId: 'dev_hpfd_owner', name: 'Emre', planDays: 33, joinedDaysAgo: 0, readsToday: true },
			{ userId: OWNER_USER_ID, name: 'Sen', planDays: 33, joinedDaysAgo: 0 },
			{ userId: 'dev_hpfd_aysel', name: 'Aysel', planDays: 33, joinedDaysAgo: 0 }
		]
	},
	{
		name: 'Hizb · İsimler gizli',
		inviteCode: 'HZPQ6K3D',
		ownerUserId: OWNER_USER_ID,
		hizbPlan: 33,
		startedDaysAgo: 8,
		hideMemberNames: true,
		visibility: 'OPEN',
		readers: [
			// Your own group with names hidden — the owner's note on Okuyanlar (S4).
			{ userId: OWNER_USER_ID, name: 'Sen', planDays: 33, joinedDaysAgo: 8, missedDaysAgo: [2] },
			{ userId: 'dev_hphn_kadir', name: 'Kadir', planDays: 33, joinedDaysAgo: 8, readsToday: true },
			{ userId: 'dev_hphn_sema', name: 'Sema', planDays: 33, joinedDaysAgo: 6, readsToday: true },
			{ userId: 'dev_hphn_bilal', name: 'Bilal', planDays: 33, joinedDaysAgo: 4 }
		]
	},
	{
		name: 'Bireysel · Sekine',
		inviteCode: 'HZPE8K3D',
		ownerUserId: OWNER_USER_ID,
		hizbPlan: 33,
		individual: { startOn: 'sekine' },
		startedDaysAgo: 6,
		readers: [
			{
				userId: OWNER_USER_ID,
				name: 'Sen',
				planDays: 33,
				joinedDaysAgo: 6,
				missedDaysAgo: [2],
				today: { repetitions: 7 }
			}
		]
	},
	{
		name: 'Bireysel · İstiğfar',
		inviteCode: 'HZPF9K3D',
		ownerUserId: OWNER_USER_ID,
		hizbPlan: 7,
		individual: { startOn: 'istighfar' },
		startedDaysAgo: 0,
		readers: [
			{
				userId: OWNER_USER_ID,
				name: 'Sen',
				planDays: 7,
				joinedDaysAgo: 0,
				today: { istighfarRepetitions: 4, istighfarTarget: 33 }
			}
		]
	},
	{
		name: 'Bireysel · Delâil',
		inviteCode: 'HZPG2K3D',
		ownerUserId: OWNER_USER_ID,
		hizbPlan: 33,
		individual: { startOn: 'delail' },
		startedDaysAgo: 2,
		readers: [
			{ userId: OWNER_USER_ID, name: 'Sen', planDays: 33, joinedDaysAgo: 2, today: { delailRepetitions: 1 } }
		]
	}
];

/** Names for the crowds below — enough that a long list doesn't repeat itself at a glance. */
const CROWD_NAMES = [
	'Ahmet',
	'Ayşe',
	'Mehmet',
	'Fatma',
	'Ali',
	'Zeynep',
	'Mustafa',
	'Elif',
	'Hasan',
	'Meryem',
	'Hüseyin',
	'Hatice',
	'İbrahim',
	'Emine',
	'Yusuf',
	'Rabia',
	'Ömer',
	'Esra',
	'Osman',
	'Sümeyye'
];

/** `count` readers on one plan, all joined together, each shaped by `shape(index)`. */
const crowd = (
	prefix: string,
	planDays: PlanDays,
	count: number,
	joinedDaysAgo: number,
	shape: (index: number) => Partial<PlanReader>
): PlanReader[] =>
	Array.from({ length: count }, (_, index) => ({
		userId: `${prefix}_${index}`,
		name:
			CROWD_NAMES[index % CROWD_NAMES.length]! +
			(index >= CROWD_NAMES.length ? ` ${Math.floor(index / CROWD_NAMES.length) + 1}` : ''),
		planDays,
		joinedDaysAgo,
		...shape(index)
	}));

/**
 * Section W of the design, one group each. Day counts are chosen so each lands on the state drawn:
 * W1's day 14 is the Delâil (a salavat to count three times); W4's plan-7 day 3 covers portions
 * 8–13, and on day 51 the 33-day readers at positions 25 and 27 read 11 and 13 — "11 ve 13
 * başkalarınca okundu".
 */
const HIZB_W_GROUPS = (): PlanGroupSeed[] => [
	{
		name: 'W1 · Başlandı',
		inviteCode: 'HZPJ5K3D',
		ownerUserId: OWNER_USER_ID,
		hizbPlan: 33,
		startedDaysAgo: 13,
		visibility: 'OPEN',
		readers: [
			{
				userId: OWNER_USER_ID,
				name: 'Sen',
				planDays: 33,
				joinedDaysAgo: 13,
				missedDaysAgo: [4, 6, 9],
				today: { bookmark: 1, delailRepetitions: 1 }
			},
			// Twenty of them read today, none of them portion 14: yours stays open on the board.
			...crowd('dev_w1', 33, 25, 13, index => ({ readDaysAgo: [], readsToday: index < 20 }))
		]
	},
	{
		name: 'W2 · Bugün okundu',
		inviteCode: 'HZPK6K3D',
		ownerUserId: OWNER_USER_ID,
		hizbPlan: 33,
		startedDaysAgo: 20,
		visibility: 'OPEN',
		readers: [
			{
				userId: OWNER_USER_ID,
				name: 'Sen',
				planDays: 33,
				joinedDaysAgo: 20,
				missedDaysAgo: [2, 5, 8],
				readsToday: true
			},
			...crowd('dev_w2', 33, 15, 20, () => ({ readDaysAgo: [], readsToday: true }))
		]
	},
	{
		name: 'W3 · Grup tamam',
		inviteCode: 'HZPL7K3D',
		ownerUserId: OWNER_USER_ID,
		hizbPlan: 7,
		startedDaysAgo: 9,
		visibility: 'OPEN',
		readers: [
			{ userId: OWNER_USER_ID, name: 'Sen', planDays: 7, joinedDaysAgo: 9, readsToday: true },
			// Six more on the 7-day plan, so today's seven portions cover all 33.
			...crowd('dev_w3', 7, 6, 9, () => ({ readsToday: true }))
		]
	},
	{
		name: 'W4 · 7 günlük',
		inviteCode: 'HZPM8K3D',
		ownerUserId: 'dev_w4_owner',
		hizbPlan: 0,
		startedDaysAgo: 51,
		visibility: 'OPEN',
		readers: [
			// 16 days spread so no 7-day round is ever whole, and the day before yesterday: 34 eksik,
			// no round completed, round 8 at 1 / 3.
			{
				userId: OWNER_USER_ID,
				name: 'Sen',
				planDays: 7,
				joinedDaysAgo: 51,
				readDaysAgo: [...[0, 1, 2, 7, 8, 9, 14, 15, 21, 22, 28, 29, 35, 36, 42, 43].map(day => 51 - day), 2]
			},
			...crowd('dev_w4', 33, 28, 51, index => ({
				readDaysAgo: [],
				readsToday: index < 10 || index === 25 || index === 27,
				...(index === 0 ? { userId: 'dev_w4_owner' } : {})
			}))
		]
	}
];

/**
 * Section 5 — Keşfet's Hizb card and the invite preview. Open plan groups dev_user is *not* in
 * (Keşfet lists only those), one per card state, plus a private one reached by its code (P4).
 * A reader joined later than the group started keeps the rows few; `readsToday` sets the 33.
 */
const HIZB_DISCOVER_GROUPS = (): PlanGroupSeed[] => [
	{
		// 01: a fixed plan early in the day — 4 / 33.
		name: 'Seher Hizbi',
		inviteCode: 'HZDA2K3D',
		dedication: 'Şifa bekleyen bütün hastalar için',
		ownerUserId: 'dev_hd01_0',
		hizbPlan: 33,
		startedDaysAgo: 40,
		visibility: 'OPEN',
		readers: crowd('dev_hd01', 33, 10, 12, index => ({ readsToday: index < 4 }))
	},
	{
		// 02: most of the day covered.
		name: 'Hakaik Halkası',
		inviteCode: 'HZDB3K3D',
		dedication: 'Ümmetin selameti için',
		ownerUserId: 'dev_hd02_0',
		hizbPlan: 15,
		startedDaysAgo: 117,
		visibility: 'OPEN',
		readers: crowd('dev_hd02', 15, 15, 20, index => ({ readsToday: index < 13 }))
	},
	{
		// 03: all 33 read today — the green band; still open to join.
		name: 'Mahalle Hizbi',
		inviteCode: 'HZDC4K3D',
		dedication: 'Mahallemizin huzuru için',
		ownerUserId: 'dev_hd03_0',
		hizbPlan: 7,
		startedDaysAgo: 8,
		visibility: 'OPEN',
		readers: crowd('dev_hd03', 7, 7, 8, () => ({ readsToday: true }))
	},
	{
		// 04: a mixed plan — the joiner picks 7, 15 or 33.
		name: 'Cuma Hizbi',
		inviteCode: 'HZDD5K3D',
		dedication: 'Her gün tam bir Hizb, birlikte',
		ownerUserId: 'dev_hd04a_0',
		hizbPlan: 0,
		startedDaysAgo: 203,
		visibility: 'OPEN',
		readers: [
			...crowd('dev_hd04a', 7, 3, 15, index => ({ readsToday: index < 2 })),
			...crowd('dev_hd04b', 15, 4, 15, index => ({ readsToday: index < 3 })),
			...crowd('dev_hd04c', 33, 8, 15, index => ({ readsToday: index < 6 }))
		]
	},
	{
		// 05: started today, one member, nothing read — "Bugün başladı", no intention line.
		name: 'Ailece Hizb',
		inviteCode: 'HZDE6K3D',
		ownerUserId: 'dev_hd05_0',
		hizbPlan: 33,
		startedDaysAgo: 0,
		visibility: 'OPEN',
		readers: crowd('dev_hd05', 33, 1, 0, () => ({}))
	},
	{
		// 06: a large group, two years in.
		name: 'Avrupa Hizb Halkası',
		inviteCode: 'HZDF7K3D',
		dedication: 'Gurbetteki kardeşlerimiz için',
		ownerUserId: 'dev_hd06_0',
		hizbPlan: 33,
		startedDaysAgo: 800,
		visibility: 'OPEN',
		readers: crowd('dev_hd06', 33, 148, 3, index => ({ readsToday: index < 17 }))
	},
	{
		// 07: an inactivity rule and hidden names — the card's two labels, P1's rules card.
		name: 'Talebe Halkası',
		inviteCode: 'HZDG8K3D',
		dedication: 'İlim yolunda sebat için',
		ownerUserId: 'dev_hd07_0',
		hizbPlan: 15,
		startedDaysAgo: 20,
		inactivityDays: 21,
		hideMemberNames: true,
		visibility: 'OPEN',
		readers: crowd('dev_hd07', 15, 12, 20, index => ({ readsToday: index < 6 }))
	},
	{
		// 08: a long name and a long intention — three lines and two, then "…".
		name: 'Merhum Hacı Mehmet Efendi ve bütün ehl-i imanın ruhları için Hizbü’l-Hakaik Halkası',
		inviteCode: 'HZDH9K3D',
		dedication:
			'Rahmetle andığımız büyüklerimizin, anne babalarımızın ve bu yolda emeği geçen herkesin ruhuna hediye olsun; okuyan, okutan ve dua eden her kardeşimiz de bu halkaya dahildir.',
		ownerUserId: 'dev_hd08_0',
		hizbPlan: 33,
		startedDaysAgo: 301,
		visibility: 'OPEN',
		readers: crowd('dev_hd08', 33, 30, 10, index => ({ readsToday: index < 25 }))
	},
	{
		// P4: private — never in Keşfet; open it with its code (HZDJ2K3D) from the join sheet.
		name: 'Özel Hizb',
		inviteCode: 'HZDJ2K3D',
		ownerUserId: 'dev_hd09_0',
		hizbPlan: 33,
		startedDaysAgo: 5,
		visibility: 'PRIVATE',
		readers: crowd('dev_hd09', 33, 3, 5, index => ({ readsToday: index < 1 }))
	}
];

const REPETITION_RULES = { delail: hasDelailRepetition, istighfar: hasIstighfar, sekine: hasSekine } as const;

/** Mid-morning of a group-local day, so a completion never lands on the boundary itself. */
const onDay = (day: number, hour = 9) => new Date(startOfCivilDay(day, DEFAULT_TIME_ZONE).getTime() + hour * 3600000);

const seedHizbPlanGroup = async (spec: PlanGroupSeed) => {
	const inviteCode = codeFor(spec.inviteCode);
	const existing = await prisma.group.findUnique({ where: { inviteCode } });

	if (existing) {
		await prisma.group.delete({ where: { id: existing.id } });
	}

	const today = civilDayNumber(new Date(), DEFAULT_TIME_ZONE);
	const startedAt = onDay(today - spec.startedDaysAgo, 8);
	const anchor = civilDayNumber(startedAt, DEFAULT_TIME_ZONE);

	/*
	 * An individual reading's start portion is chosen so today's portion carries the repetition
	 * the fixture is for — found by trying each, with the same arithmetic the service uses.
	 */
	let startPortion = 1;

	if (spec.individual) {
		const days = spec.hizbPlan as PlanDays;
		const rule = REPETITION_RULES[spec.individual.startOn];
		const found = Array.from({ length: days }, (_, index) => index + 1).find(start =>
			rule(days, portionForDay(days, start - 1, today - anchor))
		);

		if (found === undefined) {
			throw new Error(`"${spec.name}": no ${days}-day portion carries ${spec.individual.startOn}.`);
		}

		startPortion = found;
	}

	const sequences: Record<PlanDays, number> = { 7: 0, 15: 0, 33: 0 };
	const enrolled = spec.readers.map(reader => ({ ...reader, sequence: sequences[reader.planDays]++ }));
	// A rejoin is a new enrollment at the end of the queue, after every first one.
	const rejoins = enrolled
		.filter(reader => reader.removed?.rejoinedToday)
		.map(reader => ({ reader, sequence: sequences[reader.planDays]++ }));
	const memberCount = spec.readers.length + (spec.unenrolled?.length ?? 0);

	const group = await prisma.group.create({
		data: {
			ownerUserId: spec.ownerUserId,
			name: spec.name,
			dedication: spec.dedication ?? null,
			kind: 'HIZB',
			cycle: 'DAILY',
			roundDays: 1,
			splitMode: 'FLEXIBLE',
			status: 'RUNNING',
			startedAt,
			startsAt: startedAt,
			roundIndex: today - anchor,
			roundStartedAt: startOfCivilDay(today, DEFAULT_TIME_ZONE),
			endsAt: startOfCivilDay(today + 1, DEFAULT_TIME_ZONE),
			spots: 33,
			autoStartWhenFull: false,
			visibility: spec.individual ? 'PRIVATE' : spec.visibility ?? 'OPEN',
			openToJoin: !spec.individual,
			hideMemberNames: spec.hideMemberNames ?? false,
			hizbPlan: spec.hizbPlan,
			hizbIndividual: spec.individual !== undefined,
			hizbStartPortion: startPortion,
			inactivityDays: spec.inactivityDays ?? null,
			hizbNext7: sequences[7],
			hizbNext15: sequences[15],
			hizbNext33: sequences[33],
			hizbNextSlot: memberCount + rejoins.length + 1,
			timezone: DEFAULT_TIME_ZONE,
			inviteCode
		}
	});

	const everyone = [
		...spec.readers.map(reader => ({
			userId: reader.userId,
			name: reader.name,
			joinedDaysAgo: reader.joinedDaysAgo
		})),
		...(spec.unenrolled ?? [])
	];

	await prisma.groupMember.createMany({
		data: everyone.map((member, slotIndex) => ({
			groupId: group.id,
			userId: member.userId,
			displayName: member.name,
			role: member.userId === spec.ownerUserId ? 'OWNER' : 'MEMBER',
			slotIndex,
			joinedAt: onDay(today - member.joinedDaysAgo, 8)
		}))
	});

	for (const [ordinal, reader] of enrolled.entries()) {
		const joinedDay = today - reader.joinedDaysAgo;
		const lastReadDay = reader.removed ? today - reader.removed.lastReadDaysAgo : undefined;
		const endDay =
			reader.removed && lastReadDay !== undefined ? lastReadDay + 1 + reader.removed.removalDays : null;

		if (endDay !== null && endDay > today) {
			throw new Error(`"${spec.name}": ${reader.name}'s removal would not have happened yet.`);
		}

		const generatedThrough = endDay === null ? today : endDay - 1;
		const isRead = (day: number) => {
			const daysAgo = today - day;

			if (daysAgo === 0) {
				return reader.readsToday === true;
			}

			return reader.readDaysAgo ? reader.readDaysAgo.includes(daysAgo) : !reader.missedDaysAgo?.includes(daysAgo);
		};

		const days = Array.from({ length: generatedThrough - joinedDay + 1 }, (_, index) => joinedDay + index);
		const readDays = days.filter(isRead);

		const enrollment = await prisma.hizbEnrollment.create({
			data: {
				groupId: group.id,
				userId: reader.userId,
				planDays: reader.planDays,
				planVersion: PLAN_VERSION,
				sequence: reader.sequence,
				ordinal,
				joinedDay,
				endDay,
				reason: reader.removed ? 'INACTIVITY' : null,
				removalDays: reader.removed?.removalDays ?? null,
				lastReadDay: readDays.at(-1) ?? null,
				generatedThrough,
				createdAt: onDay(joinedDay, 8)
			}
		});

		await prisma.hizbAssignment.createMany({
			data: days.map(day => {
				const portion = portionForDay(reader.planDays, reader.sequence + startPortion - 1, day - anchor);
				const done = isRead(day);
				const partial = day === today && !done ? reader.today : undefined;

				return {
					enrollmentId: enrollment.id,
					day,
					portion,
					traversal: Math.floor((day - joinedDay) / reader.planDays),
					// A completed day met its repetitions; today's counters show a count in progress.
					repetitions: done && hasSekine(reader.planDays, portion) ? 19 : partial?.repetitions ?? 0,
					istighfarRepetitions:
						done && hasIstighfar(reader.planDays, portion) ? 11 : partial?.istighfarRepetitions ?? 0,
					istighfarTarget: partial?.istighfarTarget ?? 11,
					delailRepetitions:
						done && hasDelailRepetition(reader.planDays, portion) ? 3 : partial?.delailRepetitions ?? 0,
					bookmark: partial?.bookmark ?? 0,
					completedAt: done ? onDay(day, day === today ? 7 : 20) : null
				};
			})
		});
	}

	// Back in today: the fresh enrollment owes only today's portion, unread (S3b).
	for (const [index, { reader, sequence }] of rejoins.entries()) {
		const enrollment = await prisma.hizbEnrollment.create({
			data: {
				groupId: group.id,
				userId: reader.userId,
				planDays: reader.planDays,
				planVersion: PLAN_VERSION,
				sequence,
				ordinal: enrolled.length + index,
				joinedDay: today,
				endDay: null,
				generatedThrough: today,
				createdAt: onDay(today, 8)
			}
		});

		await prisma.hizbAssignment.create({
			data: {
				enrollmentId: enrollment.id,
				day: today,
				portion: portionForDay(reader.planDays, sequence + startPortion - 1, today - anchor),
				traversal: 0
			}
		});
	}
};

/**
 * **The lean default: three groups of each kind are yours, the rest wait in Keşfet.**
 *
 * `SEED_SCENARIO=full` seeds every fixture as written — the signed-in user in most of them, one
 * per state. Without a scenario the same fixtures are seeded, but the user stays only in these
 * nine; in every other group a stand-in takes their seat and the group opens to Keşfet, so it can
 * be joined — which is how the post-join screens are reached. Base codes, before `codeFor`.
 */
const LEAN_KEEP = new Set([
	// Cevşen: today's share in a daily group · a weekly one with a pool and last week's history ·
	// your own lobby, not started.
	'HGBB6R2T',
	'GNUL6X4P',
	'RMZN5W8T',
	// Kur'an: your cüz part-read in a running round · a lobby you joined, waiting · a round every
	// cüz of which is read (Hatim duası).
	'QURN1A2B',
	'QURN5I6J',
	'QURNJ3E5',
	// Hizb: a fixed plan under way with missed days (W1) · members choose, yours not picked (S1) ·
	// an individual reading (S6).
	'HZPJ5K3D',
	'HZPC5K3D',
	'HZPE8K3D'
]);
/** Whether a fixture keeps the user in the lean default — by its code as this run writes it. */
const isKeptInLean = (namespacedCode: string) => [...LEAN_KEEP].some(base => codeFor(base) === namespacedCode);
/** Who sits where the user would have, in a group they're not in by default. */
const STAND_IN_NAME = 'Kerim Aksoy';

/** Seats (0 = the owner's) the user holds in a seat-based fixture — a Cevşen group or a hatim. */
const viewerSeats = (spec: { ownerUserId: string; slotUserIds?: Record<number, string> }) =>
	new Set([
		...(spec.ownerUserId === OWNER_USER_ID ? [0] : []),
		...Object.entries(spec.slotUserIds ?? {})
			.filter(([, userId]) => userId === OWNER_USER_ID)
			.map(([seat]) => Number(seat))
	]);

/**
 * The same seat-based fixture with the user's seats given to stand-ins: seat 0 takes the prefix's
 * own id, any other seat its default one. A group the user was in opens to Keşfet.
 */
const withoutViewerSeats = <Spec extends GroupSeed | HatimSeed>(spec: Spec): Spec => {
	const seats = viewerSeats(spec);

	if (seats.size === 0) {
		return spec;
	}

	return {
		...spec,
		ownerUserId: seats.has(0) ? `${spec.memberIdPrefix}_0` : spec.ownerUserId,
		slotUserIds: Object.fromEntries(
			Object.entries(spec.slotUserIds ?? {}).filter(([, userId]) => userId !== OWNER_USER_ID)
		),
		visibility: 'OPEN'
	};
};

const leanGroup = (spec: GroupSeed): GroupSeed => {
	const seats = viewerSeats(spec);

	return {
		...withoutViewerSeats(spec),
		members: spec.members.map((member, seat) =>
			member && seats.has(seat) && member[0] === 'Sen' ? [STAND_IN_NAME, member[1]] : member
		)
	};
};

const leanHatim = (spec: HatimSeed): HatimSeed => {
	const seats = viewerSeats(spec);
	const rename = (members: HatimMemberSeed[]) =>
		members.map((member, seat) =>
			member && seats.has(seat) && member.name === 'Sen' ? { ...member, name: STAND_IN_NAME } : member
		);

	return {
		...withoutViewerSeats(spec),
		members: rename(spec.members),
		...(spec.previousRound ? { previousRound: rename(spec.previousRound) } : {})
	};
};

/**
 * A plan group without the user: their reading and membership go to a stand-in, the group opens to
 * Keşfet. An individual reading is the owner's alone and can't be found or joined, so it is left
 * out entirely (null).
 */
const leanPlanGroup = (spec: PlanGroupSeed): PlanGroupSeed | null => {
	if (spec.individual) {
		return null;
	}

	const standIn = `dev_standin_${spec.inviteCode.toLowerCase()}`;
	const isViewer = (userId: string) => userId === OWNER_USER_ID;
	const wasIn =
		isViewer(spec.ownerUserId) ||
		spec.readers.some(reader => isViewer(reader.userId)) ||
		(spec.unenrolled ?? []).some(member => isViewer(member.userId));

	if (!wasIn) {
		return spec;
	}

	const nameFor = (name: string) => (name === 'Sen' ? STAND_IN_NAME : name);

	return {
		...spec,
		ownerUserId: isViewer(spec.ownerUserId) ? standIn : spec.ownerUserId,
		readers: spec.readers.map(reader =>
			isViewer(reader.userId) ? { ...reader, name: nameFor(reader.name), userId: standIn } : reader
		),
		...(spec.unenrolled
			? {
					unenrolled: spec.unenrolled.map(member =>
						isViewer(member.userId) ? { ...member, name: nameFor(member.name), userId: standIn } : member
					)
			  }
			: {}),
		visibility: 'OPEN'
	};
};

const SCENARIOS = ['full', 'all-read'] as const;

const seed = async () => {
	if (SEED_SCENARIO && !(SCENARIOS as readonly string[]).includes(SEED_SCENARIO)) {
		throw new Error(`SEED_SCENARIO=${SEED_SCENARIO} is not a scenario; they are ${SCENARIOS.join(', ')}.`);
	}

	const explicitNamespace = process.env.SEED_NAMESPACE;
	const namespaces = [explicitNamespace, ...autoNamespaces(SEED_USERS.length - 1, [explicitNamespace])];
	const runs = SEED_USERS.map((userId, index) => ({ userId, namespace: namespaces[index] }));

	// Every namespace checked before the first write, because half a seeded run is worse than none.
	for (const run of runs) {
		SEED_NAMESPACE = run.namespace;
		assertNamespaceIsUsable();
	}

	for (const run of runs) {
		OWNER_USER_ID = run.userId;
		SEED_NAMESPACE = run.namespace;
		console.log(`Seeding ${run.userId}${run.namespace ? ` (namespace ${run.namespace})` : ''}…`);
		await seedRun();
	}
};

/** One account's fixtures, for the `OWNER_USER_ID` and `SEED_NAMESPACE` set by `seed()`. */
const seedRun = async () => {
	const isAllRead = SEED_SCENARIO === 'all-read';
	// No scenario: the lean default. `full`: every fixture as written.
	const isLean = SEED_SCENARIO === undefined;

	for (const spec of isAllRead ? ALL_READ_GROUPS() : GROUPS()) {
		await seedGroup(isLean && !isKeptInLean(codeFor(spec.inviteCode)) ? leanGroup(spec) : spec);
	}

	for (const spec of isAllRead ? ALL_READ_HATIMS() : HATIM_GROUPS()) {
		// Hatim fixtures carry their code already namespaced.
		await seedHatim(isLean && !isKeptInLean(spec.inviteCode) ? leanHatim(spec) : spec);
	}

	if (!isAllRead) {
		for (const spec of [...HIZB_PLAN_GROUPS(), ...HIZB_W_GROUPS(), ...HIZB_DISCOVER_GROUPS()]) {
			const seeded = isLean && !isKeptInLean(codeFor(spec.inviteCode)) ? leanPlanGroup(spec) : spec;

			if (seeded) {
				await seedHizbPlanGroup(seeded);
			} else {
				// Left out this run: drop a copy an earlier run may have left behind.
				await prisma.group.deleteMany({ where: { inviteCode: codeFor(spec.inviteCode) } });
			}
		}
	}

	await prisma.userSettings.upsert({
		where: { userId: OWNER_USER_ID },
		update: { hasSeenOnboarding: true, language: 'tr' },
		create: { userId: OWNER_USER_ID, hasSeenOnboarding: true, language: 'tr' }
	});
};

seed()
	.catch(error => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
