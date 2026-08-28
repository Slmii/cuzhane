import type { StringKey } from '@/lib/i18n/strings';
import * as z from 'zod';

type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

const GROUP_NAME_MAX = 60;
const DEDICATION_MAX = 120;

/**
 * The only group sizes offered, ascending. Each divides the hundred evenly — 20, 10 and 5
 * babs a head — so nobody carries a leftover bab, which is what the "first `100 % spots`
 * seats get one extra" rule exists to handle and what these three sizes avoid entirely.
 *
 * Exported because the picker walks this exact list: a stepper with its own bounds and the
 * schema with its own would eventually disagree about what is selectable.
 */
export const SPOTS_VALUES = [5, 10, 20];

/** Mirrors the server's `CreateGroupBodySchema` so the client rejects what the API would. */
export const createGroupSchema = (t: Translate) =>
	z.object({
		name: z.string().trim().min(1, t('fieldRequired')).max(GROUP_NAME_MAX),
		dedication: z.string().trim().max(DEDICATION_MAX).default(''),
		visibility: z.enum(['OPEN', 'PRIVATE']).default('OPEN'),
		// Rotation is the design's default and the first option offered.
		splitMode: z.enum(['ROTATION', 'FIXED']).default('ROTATION'),
		spots: z
			.number()
			.int()
			.refine(value => SPOTS_VALUES.includes(value), { message: t('fieldRequired') })
			.default(20),
		cycle: z.enum(['DAILY', 'WEEKLY']).default('WEEKLY'),
		reminderEnabled: z.boolean().default(true),
		reminderTime: z
			.string()
			.regex(/^\d{2}:\d{2}$/)
			.default('21:00')
	});

export type GroupForm = z.infer<ReturnType<typeof createGroupSchema>>;

export const createJoinCodeSchema = (t: Translate) =>
	z.object({
		code: z.string().trim().length(8, t('codeIncomplete'))
	});

export type JoinCodeForm = z.infer<ReturnType<typeof createJoinCodeSchema>>;
