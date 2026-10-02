import type { StringKey } from '@/lib/i18n/strings';
import { CYCLES_FOR_KIND, PERSONAL_PLAN_MAX_DAYS, SPOTS_FOR_KIND } from '@/lib/utils/groupKinds';
import { CUZ_COUNT } from '@/lib/utils/units';
import * as z from 'zod';

type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

const GROUP_NAME_MAX = 60;
const DEDICATION_MAX = 120;

/**
 * The Cevşen's group sizes, ascending — `SPOTS_FOR_KIND.CEVSEN`. Each divides the hundred
 * evenly (20, 10 and 5 babs a head), so nobody carries a leftover bab. Kept under its old name
 * for the Cevşen's picker; the schema itself checks every kind against `SPOTS_FOR_KIND`.
 */
export const SPOTS_VALUES = SPOTS_FOR_KIND.CEVSEN;

/**
 * The thirty cüz of a hatim — a member may hold every one of them, so it doubles as the
 * ceiling on QC2's per-person cap. Re-exported from `units.ts`, where it is defined.
 */
export { CUZ_COUNT };

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
		visibility: z.enum(['OPEN', 'PRIVATE']),
		// Hizb personal plans only; the sheet renders these for no other group.
		inactivityEnabled: z.boolean().default(false),
		inactivityDays: z.number().int().min(1).max(365).default(10)
	});

export type EditGroupForm = z.infer<ReturnType<typeof editGroupSchema>>;

/** Mirrors the server's `CreateGroupBodySchema` so the client rejects what the API would. */
export const createGroupSchema = (t: Translate) =>
	z
		.object({
			name: z.string().trim().min(1, t('fieldRequired')).max(GROUP_NAME_MAX),
			dedication: z.string().trim().max(DEDICATION_MAX).default(''),
			visibility: z.enum(['OPEN', 'PRIVATE']).default('OPEN'),
			hideMemberNames: z.boolean().default(false),
			/*
			 * **One flat form for every kind, even though the payload is a union.** The server
			 * takes a discriminated body — a hatim carries no `spots`, a Cevşen group no
			 * `maxPerMember` — but a *form* is a set of controls, and most of them are simply never
			 * rendered. Making the resolver a union instead would mean the fields on the unrendered
			 * branch fail validation while their step is unreachable, and `trigger` is what moves
			 * this form forward. `CreateGroupScreen` reads only the part its `kind` asked for when
			 * it submits. What the group reads is immutable once created.
			 */
			kind: z.enum(['CEVSEN', 'HATIM', 'HIZB']).default('CEVSEN'),
			// "Şahsi okuma" — the Hizb's individual plan, or a Cevşen/Kur'an read alone over `planDays`.
			hizbIndividual: z.boolean().default(false),
			/** A Şahsi Cevşen or Kur'an reading's length; each kind's own ceiling is checked below. */
			planDays: z.number().int().min(1).default(30),
			hizbStartPortion: z.number().int().min(1).max(33).default(1),
			hizbPlan: z.enum(['0', '7', '15', '33']).default('33'),
			inactivityEnabled: z.boolean().default(false),
			inactivityDays: z.number().int().min(1).max(365).default(10),
			// "Okuma sorumluları", a shared Hizb plan's only.
			readSeersEnabled: z.boolean().default(false),
			// Rotation is the design's default and the first option offered.
			splitMode: z.enum(['ROTATION', 'FIXED', 'FLEXIBLE']).default('ROTATION'),
			// Which sizes and cycles are allowed depends on the kind, so both are checked below.
			spots: z.number().int().default(20),
			cycle: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']).default('DAILY'),
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
		})
		/*
		 * The kind's own sizes and cycles, from `groupKinds.ts` — the lists the create sheet's
		 * controls walk, so a control cannot offer what this refuses. Issues land on the field,
		 * which is what puts the message under the control that caused it; `spots` and `cycle`
		 * are immutable after creation, so a wrong one is refused here rather than kept forever.
		 *
		 * A hatim is asked neither: it sends no `spots`, and its cycle is derived from
		 * `roundDays`, so its fields are the unrendered half of the form and left alone. Nor is a
		 * Şahsi Cevşen or Kur'an reading — it is asked only how many days, within its kind's range.
		 */
		.superRefine((form, context) => {
			if (form.kind !== 'HIZB' && form.hizbIndividual) {
				if (form.planDays > PERSONAL_PLAN_MAX_DAYS[form.kind]) {
					context.addIssue({ code: 'custom', message: t('fieldRequired'), path: ['planDays'] });
				}

				return;
			}

			if (form.kind === 'HATIM') {
				return;
			}

			if (form.kind === 'HIZB' && form.hizbIndividual) {
				if (form.hizbPlan === '0') {
					context.addIssue({ code: 'custom', message: t('fieldRequired'), path: ['hizbPlan'] });
				}
				if (form.hizbStartPortion > Number(form.hizbPlan)) {
					context.addIssue({ code: 'custom', message: t('fieldRequired'), path: ['hizbStartPortion'] });
				}
			}
			if (form.splitMode !== 'FLEXIBLE' && !SPOTS_FOR_KIND[form.kind].includes(form.spots)) {
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
