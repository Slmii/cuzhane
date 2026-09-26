import { CYCLES_FOR_KIND, partCountFor } from '@utils/groupKinds';
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '@utils/rounds';
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
	groupId: z.string().trim().min(1)
});

export const RoundParamsSchema = z.object({
	groupId: z.string().trim().min(1),
	// Path params arrive as strings; the service rejects a round the group has not reached.
	roundIndex: z.coerce.number().int().min(0)
});

/**
 * Covering a whole block at once — the row's outstanding babs, not one per request.
 *
 * 100 is the outer bound, the Cevşen's count. A Hizb group has 33 parts, and the service
 * checks against the group's own count once it has loaded the group.
 */
export const CoverRoundBabsBodySchema = z.object({
	babNumbers: z.array(z.number().int().min(1).max(100)).min(1).max(100)
});

export const PoolSlotParamsSchema = z.object({
	groupId: z.string().trim().min(1),
	// Path params arrive as strings; the service checks the seat is actually in the pool.
	slotIndex: z.coerce.number().int().min(0).max(49)
});

/**
 * One portion of a Hizb pool block. 100 is the outer bound, the Cevşen's count; the service
 * refuses a Cevşen group outright and checks the number against the group's own pool.
 */
export const PoolPartParamsSchema = z.object({
	groupId: z.string().trim().min(1),
	babNumber: z.coerce.number().int().min(1).max(100)
});

export const CreateGroupBodySchema = z
	.object({
		name: z.string().trim().min(1).max(60),
		dedication: z.string().trim().max(120).nullable().optional(),
		visibility: GroupVisibilitySchema.default('OPEN'),
		/** What the group reads, and so how many parts it divides. Immutable after creation. */
		kind: z.enum(['CEVSEN', 'HIZB']).default('CEVSEN'),
		// `FREE` is retired — the DB enum still carries it for legacy rows, but no new
		// group can choose it. Rotation is the design's default and comes first.
		splitMode: z.enum(['ROTATION', 'FIXED']).default('ROTATION'),
		// Which cycles are allowed depends on the kind, so that is checked below.
		cycle: GroupCycleSchema.default('WEEKLY'),
		// Which sizes are allowed depends on the kind too. 20 stays the default because it is
		// valid for both: the Cevşen's largest size, and 20 of the Hizb's 33.
		spots: z.number().int().default(20),
		reminderEnabled: z.boolean().default(true),
		reminderTime: TimeStringSchema,
		timezone: TimeZoneSchema
	})
	/*
	 * `spots` and `cycle` are immutable after creation, so a value accepted here is one the
	 * group keeps forever — which is why each kind's rules are enforced here rather than
	 * trusted to the client. Issues land on the field, so the create sheet can put the
	 * message under the control that caused it.
	 */
	.superRefine((body, context) => {
		if (body.kind === 'CEVSEN') {
			/*
			 * Three sizes only. Each divides the hundred evenly — 20, 10 and 5 babs a head — so
			 * no seat carries a leftover bab. Mirrors `SPOTS_VALUES` on the client.
			 */
			if (!SPOTS_VALUES.includes(body.spots)) {
				context.addIssue({ code: 'custom', message: 'Spots must be 5, 10 or 20', path: ['spots'] });
			}
		} else {
			/*
			 * Any size from one to the part count. An uneven split is already handled — the
			 * first `33 % spots` seats take one more — and past 33 a seat would hold nothing.
			 */
			const partCount = partCountFor(body.kind);

			if (body.spots < 1 || body.spots > partCount) {
				context.addIssue({
					code: 'custom',
					message: `Spots must be between 1 and ${partCount}`,
					path: ['spots']
				});
			}
		}

		if (!CYCLES_FOR_KIND[body.kind].includes(body.cycle)) {
			context.addIssue({ code: 'custom', message: 'This cycle is not available for this kind', path: ['cycle'] });
		}
	});

export const UpdateGroupBodySchema = z
	.object({
		name: z.string().trim().min(1).max(60).optional(),
		dedication: z.string().trim().max(120).nullable().optional(),
		visibility: GroupVisibilitySchema.optional(),
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
export type DiscoverQuery = z.infer<typeof DiscoverQuerySchema>;
export type GroupIdParams = z.infer<typeof GroupIdParamsSchema>;
