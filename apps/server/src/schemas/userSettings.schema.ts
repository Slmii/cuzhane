import { z } from 'zod';

const TimeStringSchema = z
	.string()
	.regex(/^\d{2}:\d{2}$/)
	.refine(val => {
		const parts = val.split(':').map(Number);
		const hours = parts[0] ?? NaN;
		const minutes = parts[1] ?? NaN;
		return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
	}, 'Invalid time value');

export const UpdateUserSettingsBodySchema = z
	.object({
		language: z.enum(['tr', 'en', 'nl']).optional(),
		reminderEnabled: z.boolean().optional(),
		// Three switches, one pair each: P4 puts them under a Kuran heading and a Cevşen one,
		// because "someone finished their share" is a different event in each.
		cevsenGroupReadsEnabled: z.boolean().optional(),
		cevsenRoundCompleteEnabled: z.boolean().optional(),
		cevsenPoolClaimEnabled: z.boolean().optional(),
		hatimGroupReadsEnabled: z.boolean().optional(),
		hatimRoundCompleteEnabled: z.boolean().optional(),
		hatimPoolClaimEnabled: z.boolean().optional(),
		// The same three Cevşen switches under their 1.2.0 names — that build still sends them.
		// See `serializeSettings`; the new name wins when both arrive.
		groupReadsEnabled: z.boolean().optional(),
		roundCompleteEnabled: z.boolean().optional(),
		poolClaimEnabled: z.boolean().optional(),
		memberJoinedEnabled: z.boolean().optional(),
		memberLeftEnabled: z.boolean().optional(),
		hasSeenOnboarding: z.boolean().optional(),
		hasSeenTour: z.boolean().optional(),
		reminderTime: TimeStringSchema.optional(),
		readerFontSize: z.number().int().min(16).max(40).optional(),
		// Mirrors the `ReaderNumerals` / `ReaderArabicFont` enums. Kept as literal unions
		// rather than imported from the generated client so the request contract is readable
		// here and a schema change has to be made deliberately on both sides.
		readerNumerals: z.enum(['arabic', 'latin']).optional(),
		readerArabicFont: z.enum(['naskh', 'amiri', 'uthman', 'husrev']).optional()
	})
	.refine(body => Object.values(body).some(value => value !== undefined), {
		message: 'At least one field is required'
	});

export type UpdateUserSettingsBody = z.infer<typeof UpdateUserSettingsBodySchema>;
