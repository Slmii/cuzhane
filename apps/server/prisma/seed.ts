import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { BAB_COUNT, babNumbersForRound, babNumbersForSlot } from '../src/utils/babs';
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

	const existing = await prisma.group.findUnique({ where: { inviteCode: spec.inviteCode } });

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
	const endsAt = roundStartedAt ? roundEndsAt(roundStartedAt, spec.cycle, DEFAULT_TIME_ZONE) : undefined;

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
			spots: spec.spots,
			inviteCode: spec.inviteCode,
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

const seed = async () => {
	for (const spec of GROUPS) {
		await seedGroup(spec);
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
