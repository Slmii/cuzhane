import { z } from 'zod';

export const InviteCodeBodySchema = z.object({
	code: z.string().trim().min(1).max(16)
});

export const InviteCodeParamsSchema = z.object({
	code: z.string().trim().min(1).max(16)
});

export const MemberUserIdParamsSchema = z.object({
	groupId: z.string().trim().min(1),
	memberUserId: z.string().trim().min(1)
});

export type InviteCodeBody = z.infer<typeof InviteCodeBodySchema>;
export type InviteCodeParams = z.infer<typeof InviteCodeParamsSchema>;
export type MemberUserIdParams = z.infer<typeof MemberUserIdParamsSchema>;
