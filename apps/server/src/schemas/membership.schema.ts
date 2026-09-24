import { z } from 'zod';

/**
 * The cüz a joiner takes on the way in (QJ3).
 *
 * **Optional on the wire, required by a hatim.** A Cevşen group derives a share from a seat
 * and has nothing to pick, and every already-installed app posts a body without this — so
 * rejecting its absence here would break joining for both. The service asks for it only when
 * the group is a hatim, where "you cannot be in a hatim and hold no cüz" is the rule.
 */
const CuzNumbersSchema = z.array(z.number().int().min(1).max(30)).min(1).max(30).optional();

export const InviteCodeBodySchema = z.object({
	code: z.string().trim().min(1).max(16),
	cuzNumbers: CuzNumbersSchema
});

export const JoinGroupBodySchema = z.object({
	cuzNumbers: CuzNumbersSchema
});

export const InviteCodeParamsSchema = z.object({
	code: z.string().trim().min(1).max(16)
});

export const MemberUserIdParamsSchema = z.object({
	groupId: z.string().trim().min(1),
	memberUserId: z.string().trim().min(1)
});

export type InviteCodeBody = z.infer<typeof InviteCodeBodySchema>;
export type JoinGroupBody = z.infer<typeof JoinGroupBodySchema>;
export type InviteCodeParams = z.infer<typeof InviteCodeParamsSchema>;
export type MemberUserIdParams = z.infer<typeof MemberUserIdParamsSchema>;
