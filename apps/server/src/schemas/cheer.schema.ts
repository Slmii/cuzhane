import { z } from 'zod';

export const CheerBodySchema = z.object({
	toUserId: z.string().trim().min(1)
});

export type CheerBody = z.infer<typeof CheerBodySchema>;
