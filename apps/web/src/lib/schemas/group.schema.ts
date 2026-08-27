import type { StringKey } from '@/lib/i18n/strings';
import * as z from 'zod';

type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

const GROUP_NAME_MAX = 60;
const DEDICATION_MAX = 120;
const SPOTS_MIN = 5;
const SPOTS_MAX = 50;

/** Mirrors the server's `CreateGroupBodySchema` so the client rejects what the API would. */
export const createGroupSchema = (t: Translate) =>
	z.object({
		name: z.string().trim().min(1, t('fieldRequired')).max(GROUP_NAME_MAX),
		dedication: z.string().trim().max(DEDICATION_MAX).default(''),
		visibility: z.enum(['OPEN', 'PRIVATE']).default('OPEN'),
		// Rotation is the design's default and the first option offered.
		splitMode: z.enum(['ROTATION', 'FIXED']).default('ROTATION'),
		spots: z.number().int().min(SPOTS_MIN).max(SPOTS_MAX).default(20),
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
