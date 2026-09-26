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

export type BabParams = z.infer<typeof BabParamsSchema>;
export type SetBabReadBody = z.infer<typeof SetBabReadBodySchema>;
