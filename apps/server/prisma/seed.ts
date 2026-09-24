import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { BAB_COUNT, babNumbersForRound, babNumbersForSlot } from '../src/utils/babs';
import { CUZ_COUNT } from '../src/utils/units';
import { INVITE_CODE_ALPHABET } from '../src/utils/inviteCode';
import { DEFAULT_TIME_ZONE, ROUND_DAYS, roundEndsAt, roundIndexSince, roundStartedAtFor } from '../src/utils/rounds';

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
 * Closed-round history (`pastRounds`) is spread across three of them so the Turlar screens
 * have every state to show:
 *  · Silsile Hatmi — five seats, no pool. Two finished rounds, one part-read round holding
 *    all four row shapes at once, and one nobody touched.
 *  · Akşam Hatmi   — five empty seats, so babs 71-100 are pool: one round where dev_user
 *    covered part of it, one where it stands untouched.
 *  · Gönül Hatmi   — WEEKLY, so its closed round is what proves the cadence labels read
 *    "geçen hafta" rather than "dün".
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
 * and Ana sayfa looks empty. Pass a real Clerk id to make the fixtures yours:
 *
 *   SEED_USER_ID=user_xxx pnpm --filter @cuzhane/server db:seed
 *
 * Which is what taking App Store screenshots needs — a populated home screen belonging to the
 * account on the device.
 */
const OWNER_USER_ID = process.env.SEED_USER_ID ?? 'dev_user';

/**
 * **A second account's fixtures, alongside the first rather than instead of it.**
 *
 * Every group below carries a fixed invite code, and `seedGroup` finds the existing row *by
 * that code* and deletes it before rebuilding. That is what makes re-running the seed safe —
 * and it also means a second run under a different `SEED_USER_ID` would hand the same fifteen
 * groups to the new account and take them off the old one. Fine when you are moving fixtures,
 * useless when you want a phone signed in as A and a phone signed in as B both looking
 * populated at once, which is what taking iOS and Android screenshots in one sitting needs.
 *
 * A namespace gives the second account its own fifteen. It replaces the **last character** of
 * every invite code, so:
 *
 *   SEED_USER_ID=user_aaa pnpm --filter @cuzhane/server db:seed
 *   SEED_USER_ID=user_bbb SEED_NAMESPACE=9 pnpm --filter @cuzhane/server db:seed
 *
 * leaves both sets standing. The last character rather than a prefix or an extra one because
 * `INVITE_CODE_LENGTH` is 8 and the QR emblem zone is only known to be safe at symbol version
 * 3 — `inviteCode.test.ts` pins that, and a ninth character would push the payload over.
 */
const SEED_NAMESPACE = process.env.SEED_NAMESPACE;

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
	 * quietly deleting the first. **Both sets are checked** — the hatim codes were added later
	 * and left out of this at first, which is exactly how that goes unnoticed.
	 */
	const codes = [...GROUPS.map(spec => codeFor(spec.inviteCode)), ...HATIM_GROUPS.map(spec => spec.inviteCode)];
	const collisions = [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))];

	if (collisions.length > 0) {
		throw new Error(`SEED_NAMESPACE=${SEED_NAMESPACE} collapses invite codes: ${collisions.join(', ')}.`);
	}
};

/** [display name, babs this seat has read], or `null` for a seat with no member. */
type MemberSeed = [string, number] | null;

type PoolClaim = {
	/** An empty seat whose block another member has already taken. */
	slotIndex: number;
	/** Index into `members` of the member who claimed it. */
	byMemberIndex: number;
	babsRead: number;
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
	spots: number;
	cycle: 'DAILY' | 'WEEKLY';
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

const GROUPS: GroupSeed[] = [
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
		// Every seat filled and every share fully read — `readCount === BAB_COUNT` below
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
	}
];

const userIdForSlot = (spec: GroupSeed, slotIndex: number) =>
	spec.slotUserIds?.[slotIndex] ?? (slotIndex === 0 ? spec.ownerUserId : `${spec.memberIdPrefix}_${slotIndex}`);

const isOccupiedSlot = (spec: GroupSeed, slotIndex: number) => (spec.members[slotIndex] ?? null) !== null;

/** Which babs a seat reads in a given round: rotated for ROTATION groups, standing for FIXED. */
const babNumbersForSeatRound = (spec: GroupSeed, slotIndex: number, roundIndex: number) =>
	spec.splitMode === 'ROTATION'
		? babNumbersForRound(slotIndex, spec.spots, roundIndex)
		: babNumbersForSlot(slotIndex, spec.spots);

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
	const roundIndex = startedAt ? roundIndexSince(startedAt, roundDays, now, DEFAULT_TIME_ZONE) : 0;
	const roundStartedAt = startedAt ? roundStartedAtFor(startedAt, roundDays, roundIndex, DEFAULT_TIME_ZONE) : null;
	// `roundDays`, not `spec.cycle`: the boundary is a number of days now, and a cadence name
	// reaching `Math.floor` is NaN — which the zone formatter then throws on.
	const endsAt = roundStartedAt ? roundEndsAt(roundStartedAt, roundDays, DEFAULT_TIME_ZONE) : undefined;

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

	const readAt = new Date();
	// Bab -> who reads it and whether it's read, for the group's *current* round — rotated
	// per seat for ROTATION groups, standing for FIXED — so an uneven `spots` (12 doesn't
	// divide 100) lands exactly where `rangeForSlot` says it does.
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

		const claimantUserId = userIdForSlot(spec, claim.byMemberIndex);

		babNumbersForSeatRound(spec, claim.slotIndex, roundIndex).forEach((number, indexInSlot) => {
			poolClaimByBab.set(number, claimantUserId);
			readAssignmentByBab.set(number, { userId: claimantUserId, isRead: indexInSlot < claim.babsRead });
		});
	}

	await prisma.groupBab.createMany({
		data: Array.from({ length: BAB_COUNT }, (_, index) => {
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

		if (historicalRoundIndex < 0) {
			throw new Error(`"${spec.name}": round ${roundIndex} has no round ${past.roundsAgo} rounds before it.`);
		}

		const historicalReadAt = new Date(now.getTime() - past.roundsAgo * 24 * 60 * 60 * 1000);
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

	const readCount = await prisma.groupBab.count({ where: { groupId: group.id, readAt: { not: null } } });

	// Mirrors `syncCompletedAt`: `completedAt` only ever agrees with a fully-read board.
	if (readCount === BAB_COUNT) {
		await prisma.group.update({ where: { id: group.id }, data: { completedAt: readAt } });
	}

	const memberCount = spec.members.filter(member => member !== null).length;

	console.log(
		`Seeded "${spec.name}" [${spec.status}/${spec.splitMode}] — ${memberCount}/${spec.spots} members, ${readCount}/${BAB_COUNT} babs read.`
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
};

/**
 * Six fixtures, covering the states the Kur'an screens can render.
 *
 * Between them: a lobby still filling, a round in progress with cüz nobody has taken, a
 * capped group, a custom length that no cadence name describes, a finished hatim, and one
 * the signed-in user belongs to without owning.
 */
const HATIM_GROUPS: HatimSeed[] = [
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
	const endsAt = roundStartedAt ? roundEndsAt(roundStartedAt, spec.roundDays, DEFAULT_TIME_ZONE) : undefined;

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

	const readAt = new Date();
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

const seed = async () => {
	assertNamespaceIsUsable();

	for (const spec of GROUPS) {
		await seedGroup(spec);
	}

	for (const spec of HATIM_GROUPS) {
		await seedHatim(spec);
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
