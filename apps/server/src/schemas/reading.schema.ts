import { z } from 'zod';
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '@utils/rounds';
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '@utils/inviteCode';

export const CreateReadingGroupSchema = z.strictObject({
	name: z.string().trim().min(1).max(60),
	cadence: z.enum(['WEEKLY', 'MONTHLY']).default('WEEKLY'),
	timezone: z.string().trim().max(64).refine(isValidTimeZone).default(DEFAULT_TIME_ZONE)
});
export const JoinReadingGroupSchema = z.strictObject({
	inviteCode: z
		.string()
		.max(32)
		.transform(normalizeInviteCode)
		.refine(code => code.length === INVITE_CODE_LENGTH)
});
export const ReadingParamsSchema = z.object({ groupId: z.string().min(1).max(128) });
export const ReadingAssignmentParamsSchema = ReadingParamsSchema.extend({ assignmentId: z.string().min(1).max(128) });
