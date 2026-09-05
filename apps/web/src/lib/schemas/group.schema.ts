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

/**
 * The three things a group can still be told after it exists — Yönet's "Grup bilgileri".
 * Everything else about a group is either immutable (`spots`, `splitMode`, `cycle`, which the
 * hundred is divided by) or a switch that saves on the spot rather than through a form.
 *
 * The same constraints as creation, deliberately: a name that could be typed at step 1 must
 * stay typeable later, and the server validates both with one schema.
 */
export const editGroupSchema = (t: Translate) =>
	z.object({
		name: z.string().trim().min(1, t('fieldRequired')).max(GROUP_NAME_MAX),
		dedication: z.string().trim().max(DEDICATION_MAX).default(''),
		visibility: z.enum(['OPEN', 'PRIVATE'])
	});

export type EditGroupForm = z.infer<ReturnType<typeof editGroupSchema>>;

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
		cycle: z.enum(['DAILY', 'WEEKLY']).default('DAILY')
		/*
		 * No `reminderEnabled` / `reminderTime`. The server's body schema still has them and
		 * still requires the time, but they stopped being *form* fields when the reminder came
		 * off step 3 — nothing on the screen sets them, so a field here would only be a default
		 * pretending to be an answer. `CreateGroupScreen` passes the same two values as
		 * literals, which is where the fact that the API wants them belongs.
		 */
	});

export type GroupForm = z.infer<ReturnType<typeof createGroupSchema>>;

export const createJoinCodeSchema = (t: Translate) =>
	z.object({
		code: z.string().trim().length(8, t('codeIncomplete'))
	});

export type JoinCodeForm = z.infer<ReturnType<typeof createJoinCodeSchema>>;
