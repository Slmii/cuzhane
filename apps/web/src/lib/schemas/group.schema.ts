import type { StringKey } from '@/lib/i18n/strings';
import { CYCLES_FOR_KIND, SPOTS_FOR_KIND } from '@/lib/utils/groupKinds';
import * as z from 'zod';

type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

const GROUP_NAME_MAX = 60;
const DEDICATION_MAX = 120;

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
	z
		.object({
			name: z.string().trim().min(1, t('fieldRequired')).max(GROUP_NAME_MAX),
			dedication: z.string().trim().max(DEDICATION_MAX).default(''),
			visibility: z.enum(['OPEN', 'PRIVATE']).default('OPEN'),
			/** What the group reads, and so how many parts it divides. Immutable once created. */
			kind: z.enum(['CEVSEN', 'HIZB']).default('CEVSEN'),
			// Rotation is the design's default and the first option offered.
			splitMode: z.enum(['ROTATION', 'FIXED']).default('ROTATION'),
			// Which sizes and cycles are allowed depends on the kind, so both are checked below.
			spots: z.number().int().default(20),
			cycle: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('DAILY')
			/*
			 * No `reminderEnabled` / `reminderTime`. The server's body schema still has them and
			 * still requires the time, but they stopped being *form* fields when the reminder came
			 * off step 3 — nothing on the screen sets them, so a field here would only be a default
			 * pretending to be an answer. `CreateGroupScreen` passes the same two values as
			 * literals, which is where the fact that the API wants them belongs.
			 */
		})
		/*
		 * The kind's own sizes and cycles, from `groupKinds.ts` — the lists the create sheet's
		 * controls walk, so a control cannot offer what this refuses. Issues land on the field,
		 * which is what puts the message under the control that caused it; `spots` and `cycle`
		 * are immutable after creation, so a wrong one is refused here rather than kept forever.
		 */
		.superRefine((form, context) => {
			if (!SPOTS_FOR_KIND[form.kind].includes(form.spots)) {
				context.addIssue({ code: 'custom', message: t('fieldRequired'), path: ['spots'] });
			}

			if (!CYCLES_FOR_KIND[form.kind].includes(form.cycle)) {
				context.addIssue({ code: 'custom', message: t('fieldRequired'), path: ['cycle'] });
			}
		});

export type GroupForm = z.infer<ReturnType<typeof createGroupSchema>>;

export const createJoinCodeSchema = (t: Translate) =>
	z.object({
		code: z.string().trim().length(8, t('codeIncomplete'))
	});

export type JoinCodeForm = z.infer<ReturnType<typeof createJoinCodeSchema>>;
