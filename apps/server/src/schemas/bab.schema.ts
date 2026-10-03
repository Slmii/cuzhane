import { z } from 'zod';

export const BabParamsSchema = z.object({
	groupId: z.string().trim().min(1).max(64),
	// 100 is the outer bound, the Cevşen's count. A Hizb group has 33 parts and a hatim 30, and
	// the service checks against the group's own count once it has loaded the group.
	babNumber: z.coerce.number().int().min(1).max(100)
});

export const SetBabReadBodySchema = z.object({
	read: z.boolean()
});

/** Which round's count to read. Omitted, it is the round the group is on. */
export const PartRepetitionsQuerySchema = z.object({
	roundIndex: z.coerce.number().int().min(0).optional()
});

/**
 * An absolute count, so a retried request cannot count a recitation twice. The service bounds
 * it by the part's own required number and refuses a round the group has not reached.
 * `isOpenRound` says the named round is meant to be the one in progress, and a 409 if it is not.
 */
export const SetPartRepetitionsBodySchema = z.object({
	count: z.number().int().min(0),
	roundIndex: z.number().int().min(0).optional(),
	isOpenRound: z.boolean().optional()
});

/** A seat-divided Hizb group's round counters: which round's. Omitted, the one the group is on. */
export const RoundCountersQuerySchema = z.object({
	roundIndex: z.coerce.number().int().min(0).optional()
});

/**
 * The Delâil and istighfar counts, absolute; only the fields sent change. The service holds each to
 * its ceiling. `isOpenRound` is Sekine's precondition: a 409 once the named round has closed.
 */
export const SetRoundCountersBodySchema = z
	.object({
		delailCount: z.number().int().min(0).optional(),
		istighfarCount: z.number().int().min(0).optional(),
		istighfarTarget: z.number().int().min(1).optional(),
		roundIndex: z.number().int().min(0).optional(),
		isOpenRound: z.boolean().optional()
	})
	.refine(
		body =>
			body.delailCount !== undefined || body.istighfarCount !== undefined || body.istighfarTarget !== undefined,
		{ message: 'Nothing to count' }
	);

export type BabParams = z.infer<typeof BabParamsSchema>;
export type SetBabReadBody = z.infer<typeof SetBabReadBodySchema>;
export type PartRepetitionsQuery = z.infer<typeof PartRepetitionsQuerySchema>;
export type SetPartRepetitionsBody = z.infer<typeof SetPartRepetitionsBodySchema>;
export type RoundCountersQuery = z.infer<typeof RoundCountersQuerySchema>;
export type SetRoundCountersBody = z.infer<typeof SetRoundCountersBodySchema>;
