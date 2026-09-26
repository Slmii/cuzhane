import { z } from 'zod';

export const BabParamsSchema = z.object({
	groupId: z.string().trim().min(1),
	// 100 is the outer bound, the Cevşen's count. A Hizb group has 33 parts, and the service
	// checks against the group's own count once it has loaded the group.
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

export type BabParams = z.infer<typeof BabParamsSchema>;
export type SetBabReadBody = z.infer<typeof SetBabReadBodySchema>;
export type PartRepetitionsQuery = z.infer<typeof PartRepetitionsQuerySchema>;
export type SetPartRepetitionsBody = z.infer<typeof SetPartRepetitionsBodySchema>;
