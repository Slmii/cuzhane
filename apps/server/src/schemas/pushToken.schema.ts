import { z } from 'zod';

export const RegisterPushTokenBodySchema = z.object({
	token: z.string().trim().min(1).max(512)
});

export type RegisterPushTokenBody = z.infer<typeof RegisterPushTokenBodySchema>;
