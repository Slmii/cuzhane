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
 * The thirty cüz of a hatim. Mirrors `CUZ_COUNT` on the server — a member may hold every one
 * of them, so it doubles as the ceiling on QC2's per-person cap.
 */
export const CUZ_COUNT = 30;

/** QC3's three presets, ascending, and the bound on what its stepper may be walked to. */
export const ROUND_DAYS_PRESETS = [1, 7, 30];
export const ROUND_DAYS_MAX = 90;

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
		cycle: z.enum(['DAILY', 'WEEKLY']).default('DAILY'),
		/*
		 * **One flat form for both kinds, even though the payload is a union.** The server takes
		 * a discriminated body — a hatim carries no `spots`, a Cevşen group no `maxPerMember` —
		 * but a *form* is a set of controls, and half of them are simply never rendered. Making
		 * the resolver a union instead would mean the fields on the unrendered branch fail
		 * validation while their step is unreachable, and `trigger` is what moves this form
		 * forward. `CreateGroupScreen` reads only the half its `kind` asked for when it submits.
		 */
		kind: z.enum(['CEVSEN', 'HATIM']).default('CEVSEN'),
		/*
		 * **One distribution, not three.** QC2 draws a single card — everyone takes what they
		 * want from the map — so this is a literal rather than a choice. The other two values
		 * survive in the database enum (dropping one is destructive) and nothing can pick them.
		 */
		distribution: z.literal('FREE_PICK').default('FREE_PICK'),
		/**
		 * Whether QC2's cap applies at all — the switch above the stepper, **off by default**.
		 * A separate field from the number rather than a nullable one: the stepper binds a
		 * value and has to keep holding it while the switch is off, or turning the cap back on
		 * would reset it to three and lose what was chosen a second earlier.
		 */
		hasMaxPerMember: z.boolean().default(false),
		/** The cap itself, read only while `hasMaxPerMember` is on. */
		maxPerMember: z.number().int().min(1).max(CUZ_COUNT).default(3),
		boundaryPolicy: z.enum(['KEEP', 'REPICK']).default('KEEP'),
		/** QC3's round length in days — 7, 30, or whatever the stepper was walked to. */
		roundDays: z.number().int().min(1).max(ROUND_DAYS_MAX).default(30)
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
