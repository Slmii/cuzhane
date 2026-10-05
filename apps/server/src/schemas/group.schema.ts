import { PERSONAL_PLAN_MAX_DAYS, partCountFor } from '@utils/groupKinds';
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '@utils/rounds';
import { CUZ_COUNT, PART_COUNT } from '@utils/units';
import { z } from 'zod';

/**
 * The only sizes a Cevşen group may be created with. Mirrored by `SPOTS_VALUES` on the web
 * app. A Hizb group is not held to these — see `CreateGroupBodySchema`.
 */
const SPOTS_VALUES = [5, 10, 20];

/**
 * The zone the group's day is measured in, sent by the creating client. Validated against
 * the platform's own tz database rather than trusted: it ends up in `Intl.DateTimeFormat`,
 * which throws on an unknown zone, and a group whose every round computation throws would
 * be unopenable. Falls back to the default when a client omits it.
 */
const TimeZoneSchema = z
	.string()
	.trim()
	.min(1)
	.max(64)
	.refine(isValidTimeZone, { message: 'Unknown time zone' })
	.default(DEFAULT_TIME_ZONE);

const TimeStringSchema = z
	.string()
	.regex(/^\d{2}:\d{2}$/)
	.refine(val => {
		const parts = val.split(':').map(Number);
		const hours = parts[0] ?? NaN;
		const minutes = parts[1] ?? NaN;
		return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
	}, 'Invalid time value');

const GroupVisibilitySchema = z.enum(['OPEN', 'PRIVATE']);
const GroupCycleSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);

export const GroupIdParamsSchema = z.object({
	groupId: z.string().trim().min(1).max(64)
});

export const RoundParamsSchema = z.object({
	groupId: z.string().trim().min(1).max(64),
	// Path params arrive as strings; the service rejects a round the group has not reached.
	roundIndex: z.coerce.number().int().min(0)
});

/**
 * Covering a whole block at once — the row's outstanding babs, not one per request.
 *
 * 100 is the outer bound, the Cevşen's count. A Hizb group has 32 parts, and the service
 * checks against the group's own count once it has loaded the group.
 */
export const CoverRoundBabsBodySchema = z.object({
	babNumbers: z.array(z.number().int().min(1).max(100)).min(1).max(100)
});

export const PoolSlotParamsSchema = z.object({
	groupId: z.string().trim().min(1).max(64),
	// Path params arrive as strings; the service checks the seat is actually in the pool.
	slotIndex: z.coerce.number().int().min(0).max(49)
});

/**
 * One portion of a Hizb pool block. 100 is the outer bound, the Cevşen's count; the service
 * refuses any other kind outright and checks the number against the group's own pool.
 */
export const PoolPartParamsSchema = z.object({
	groupId: z.string().trim().min(1).max(64),
	babNumber: z.coerce.number().int().min(1).max(100)
});

/** The hatim's havuz is addressed by cüz, not by seat — see `cuzPool.service`. */
export const PoolCuzParamsSchema = z.object({
	groupId: z.string().trim().min(1).max(64),
	cuzNumber: z.coerce.number().int().min(1).max(CUZ_COUNT)
});

/**
 * A unit of the group's board — a bab, a cüz or a Hizb portion. The largest count is the outer
 * bound; the service holds it to the group's own `unitCountFor`.
 */
export const ReadingPlaceParamsSchema = z.object({
	groupId: z.string().trim().min(1).max(64),
	unitNumber: z.coerce
		.number()
		.int()
		.min(1)
		.max(Math.max(...Object.values(PART_COUNT)))
});

/** The most pages a unit has: a cüz in either pagination, or a Hizb portion's blocks. */
export const READING_PLACE_MAX_PAGES = 30;

/** "Kaldığım yer" and the pages turned past, either or both. See `readingPlace.service`. */
export const SaveReadingPlaceBodySchema = z
	.object({
		position: z.number().int().min(1).max(READING_PLACE_MAX_PAGES).optional(),
		textPagesRead: z.number().int().min(0).max(READING_PLACE_MAX_PAGES).optional(),
		husrevPagesRead: z.number().int().min(0).max(READING_PLACE_MAX_PAGES).optional()
	})
	.strict()
	.refine(
		body => body.position !== undefined || body.textPagesRead !== undefined || body.husrevPagesRead !== undefined,
		{ message: 'Nothing to save' }
	);

export type SaveReadingPlaceBody = z.infer<typeof SaveReadingPlaceBodySchema>;

/** A member's own cüz for the round in progress — QR1's pick. See `cuzRound.service`. */
export const PickRoundCuzBodySchema = z.object({
	cuzNumbers: z.array(z.number().int().min(1).max(CUZ_COUNT)).min(1).max(CUZ_COUNT)
});

/** What every group is told at creation, whichever kind it is. */
const CreateGroupBaseSchema = z.object({
	name: z.string().trim().min(1).max(60),
	dedication: z.string().trim().max(120).nullable().optional(),
	visibility: GroupVisibilitySchema.default('OPEN'),
	hideMemberNames: z.boolean().default(false),
	reminderEnabled: z.boolean().default(true),
	reminderTime: TimeStringSchema,
	timezone: TimeZoneSchema
});

/**
 * The Hizb's plan fields. Declared on the other kinds only so a body asking for one is **refused
 * rather than stripped** — stripped, it would quietly create a shared group the creator never
 * asked for. Those kinds ask for a Şahsi reading with `planDays` instead.
 */
const NotHizbSchema = {
	hizbIndividual: z.literal(false, { message: 'Individual reading requires Hizb' }).optional(),
	hizbPlan: z.undefined({ message: 'Personal plans require Hizb' }).optional()
};

/**
 * The three kinds are a discriminated union, not one object with optional halves.
 *
 * **Each kind's settings are meaningless to the others.** One object carrying every half
 * would hand the service a `maxPerMember` on a Cevşen group and a `splitMode` on a hatim,
 * and every one of these is immutable after creation — so a field read from the wrong half
 * is wrong for the life of the group. The union makes that *unrepresentable in the type*:
 * `input.spots` does not exist on the hatim branch, so no service can reach for it.
 *
 * A foreign field arriving over the wire is **stripped, not rejected** — Zod's default, and
 * deliberately left alone (the Hizb's plan fields aside, see `NotHizbSchema`). `.strict()`
 * would be the stronger guarantee and it cannot be used here: the shipped client posts
 * `autoStartWhenFull`, which this schema has never declared, so strict parsing would stop
 * every installed app from creating a group at all.
 *
 * `spots` and `cycle` are immutable after creation, so a value accepted here is one the
 * group keeps forever — which is why each kind's rules are enforced here rather than trusted
 * to the client. Issues land on the field, so the create sheet can put the message under the
 * control that caused it.
 */
const CreateCevsenBodySchema = CreateGroupBaseSchema.extend({
	kind: z.literal('CEVSEN'),
	// `FREE` is retired — the DB enum still carries it for legacy rows, but no new
	// group can choose it. Rotation is the design's default and comes first.
	splitMode: z.enum(['ROTATION', 'FIXED', 'FLEXIBLE']).default('ROTATION'),
	cycle: z.enum(['DAILY', 'WEEKLY']).default('WEEKLY'),
	spots: z.number().int().default(20),
	/**
	 * Şahsi reading: the hundred babs over this many days, one person's, private — so none of the
	 * sharing settings above apply. Immutable, like the kind.
	 */
	planDays: z.number().int().min(1).max(PERSONAL_PLAN_MAX_DAYS.CEVSEN).optional(),
	...NotHizbSchema
}).superRefine((body, context) => {
	// A Şahsi reading has no seats and no shared round to size.
	if (body.planDays !== undefined) {
		return;
	}
	if (body.splitMode === 'FLEXIBLE') {
		if (body.visibility !== 'OPEN') {
			context.addIssue({ code: 'custom', message: 'Flexible groups must be open', path: ['visibility'] });
		}
	} else if (!SPOTS_VALUES.includes(body.spots)) {
		/*
		 * Three sizes only. Each divides the hundred evenly — 20, 10 and 5 babs a head — so no
		 * seat carries a leftover bab. Mirrors `SPOTS_VALUES` on the client. A flexible group
		 * has no seats to size.
		 */
		context.addIssue({ code: 'custom', message: 'Spots must be 5, 10 or 20', path: ['spots'] });
	}
});

/**
 * A hatim divides thirty cüz by choice rather than a hundred babs by seat, so none of the
 * split settings above apply to it — there is no rotation to configure and no size that
 * divides evenly, because a member may hold one cüz or six.
 *
 * `spots` is therefore not asked for and not offered: **a hatim is full when all thirty cüz
 * are taken, not when thirty people have joined**, so the seat cap is pinned at `CUZ_COUNT`
 * purely as the ceiling on membership that `slotIndex` still needs. `roundDays` is the real
 * round length (QC3 offers 7, 30 or a number), and `cycle` is derived from it in the service
 * so the existing filters and labels keep working.
 */
const CreateHatimBodySchema = CreateGroupBaseSchema.extend({
	kind: z.literal('HATIM'),
	/*
	 * **Only FREE_PICK is offered, though the column admits three.** QC2 draws one
	 * distribution card now: everyone takes what they want from the map. EQUAL and
	 * JOIN_ORDER stay in the enum because they are the shapes the feature grew towards and
	 * dropping a value from a Postgres enum is destructive — but nothing can choose them, so
	 * a body sending one would configure a group by a rule no code implements.
	 */
	distribution: z.literal('FREE_PICK').default('FREE_PICK'),
	/**
	 * QC2's cap on one person's holdings in a round, and **null means there is no cap** —
	 * which is the default. The switch above the stepper is off to begin with, and a hatim
	 * with nobody capped is the ordinary case: the point of the cap is to stop one person
	 * taking twenty-nine cüz in a group that has not filled yet, not to ration a group that
	 * is working.
	 */
	maxPerMember: z.number().int().min(1).max(30).nullable().default(null),
	boundaryPolicy: z.enum(['KEEP', 'REPICK']).default('KEEP'),
	/** A quarter is already an unusually long round; beyond it the cap is arbitrary. */
	roundDays: z.number().int().min(1).max(90).default(30),
	/**
	 * The cüz the creator takes for themselves (QC4), and **at least one is required**.
	 *
	 * A hatim group whose owner holds nothing is a group that cannot start: there is nobody
	 * to read, the board is entirely pool, and the person who set it up has no way in
	 * except through a screen meant for joiners. The rule is the same one joining obeys —
	 * you cannot be in a hatim and hold no cüz — so it is enforced at the edge rather than
	 * left to the client's disabled button.
	 */
	cuzNumbers: z.array(z.number().int().min(1).max(30)).min(1).max(30).optional(),
	/**
	 * Şahsi reading: the thirty cüz over this many days, one person's, private — so none of the
	 * sharing settings above, and no cüz to pick: the plan reads them all, in order.
	 */
	planDays: z.number().int().min(1).max(PERSONAL_PLAN_MAX_DAYS.HATIM).optional(),
	...NotHizbSchema
}).superRefine((body, context) => {
	if (body.planDays === undefined && body.cuzNumbers === undefined) {
		context.addIssue({ code: 'custom', message: 'Choose at least one cüz', path: ['cuzNumbers'] });
	}
});

/**
 * A Hizb group divides 32 portions by seat, like the Cevşen, and adds a calendar month, a
 * flexible pool, personal plans (`hizbPlan`: 0 lets each member choose, otherwise 7/15/32
 * days) and individual reading (a private plan from a chosen portion).
 */
const CreateHizbBodySchema = CreateGroupBaseSchema.extend({
	kind: z.literal('HIZB'),
	hizbIndividual: z.boolean().default(false),
	hizbStartPortion: z.number().int().min(1).max(32).default(1),
	hizbPlan: z.union([z.literal(0), z.literal(7), z.literal(15), z.literal(32)]).optional(),
	// Refused rather than stripped, as `NotHizbSchema` does the other way round: a Hizb plan is `hizbPlan`.
	planDays: z.undefined({ message: 'A plan length in days is for Cevşen and Kur’an groups' }).optional(),
	inactivityDays: z.number().int().min(1).max(365).nullable().optional(),
	// "Okuma sorumluları" — a shared plan's "has read" notice to the ticked members only.
	readSeersEnabled: z.boolean().default(false),
	splitMode: z.enum(['ROTATION', 'FIXED', 'FLEXIBLE']).default('ROTATION'),
	cycle: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('WEEKLY'),
	// 20 stays the default because it is valid for both seat-based kinds: the Cevşen's
	// largest size, and 20 of the Hizb's 32.
	spots: z.number().int().default(20)
}).superRefine((body, context) => {
	if (body.hizbIndividual && (!body.hizbPlan || body.hizbStartPortion > body.hizbPlan)) {
		context.addIssue({
			code: 'custom',
			message: 'Individual reading needs a fixed Hizb plan and a valid starting portion',
			path: ['hizbStartPortion']
		});
	}
	if (!body.hizbIndividual && body.hizbStartPortion !== 1) {
		context.addIssue({
			code: 'custom',
			message: 'Only individual reading can choose a starting portion',
			path: ['hizbStartPortion']
		});
	}
	// A personal plan has no seats and no shared round to size.
	if (body.hizbPlan !== undefined) {
		return;
	}
	if (body.splitMode === 'FLEXIBLE') {
		if (body.visibility !== 'OPEN') {
			context.addIssue({ code: 'custom', message: 'Flexible groups must be open', path: ['visibility'] });
		}
		return;
	}
	/*
	 * Any size from one to the part count. An uneven split is already handled — the first
	 * `32 % spots` seats take one more — and past 32 a seat would hold nothing.
	 */
	const partCount = partCountFor('HIZB');

	if (body.spots < 1 || body.spots > partCount) {
		context.addIssue({ code: 'custom', message: `Spots must be between 1 and ${partCount}`, path: ['spots'] });
	}
});

/**
 * A missing `kind` is a Cevşen group, filled in **before** the union sees the body rather
 * than as a `.default()` on the literal: a discriminator is read to *choose* a branch, so a
 * body with no `kind` matches neither and is rejected outright. Every already-installed app
 * sends exactly that body, and they must keep being able to create groups.
 */
export const CreateGroupBodySchema = z.preprocess(
	body => (typeof body === 'object' && body !== null && !('kind' in body) ? { ...body, kind: 'CEVSEN' } : body),
	z.discriminatedUnion('kind', [CreateCevsenBodySchema, CreateHatimBodySchema, CreateHizbBodySchema])
);

export const UpdateGroupBodySchema = z
	.object({
		inactivityDays: z.number().int().min(1).max(365).nullable().optional(),
		name: z.string().trim().min(1).max(60).optional(),
		dedication: z.string().trim().max(120).nullable().optional(),
		visibility: GroupVisibilitySchema.optional(),
		hideMemberNames: z.boolean().optional(),
		readerSeerUserIds: z.array(z.string().trim().min(1).max(64)).max(3).optional(),
		readSeersEnabled: z.boolean().optional(),
		openToJoin: z.boolean().optional(),
		reminderEnabled: z.boolean().optional(),
		reminderTime: TimeStringSchema.optional(),
		autoStartWhenFull: z.boolean().optional()
	})
	.refine(body => Object.values(body).some(value => value !== undefined), {
		message: 'At least one field is required'
	});

export const DiscoverQuerySchema = z.object({
	search: z.string().trim().max(60).optional(),
	cycle: GroupCycleSchema.optional()
});

export type CreateGroupBody = z.infer<typeof CreateGroupBodySchema>;
export type UpdateGroupBody = z.infer<typeof UpdateGroupBodySchema>;
export type PickRoundCuzBody = z.infer<typeof PickRoundCuzBodySchema>;
export type DiscoverQuery = z.infer<typeof DiscoverQuerySchema>;
export type GroupIdParams = z.infer<typeof GroupIdParamsSchema>;
