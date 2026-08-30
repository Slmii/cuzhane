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
		language: z.enum(['tr', 'en']).optional(),
		reminderEnabled: z.boolean().optional(),
		hasSeenOnboarding: z.boolean().optional(),
		reminderTime: TimeStringSchema.optional(),
		readerFontSize: z.number().int().min(16).max(40).optional(),
		// Mirrors the `ReaderNumerals` / `ReaderArabicFont` enums. Kept as literal unions
		// rather than imported from the generated client so the request contract is readable
		// here and a schema change has to be made deliberately on both sides.
		readerNumerals: z.enum(['arabic', 'latin']).optional(),
		readerArabicFont: z.enum(['naskh', 'amiri', 'madinah']).optional()
	})
	.refine(body => Object.values(body).some(value => value !== undefined), {
		message: 'At least one field is required'
	});

export type UpdateUserSettingsBody = z.infer<typeof UpdateUserSettingsBodySchema>;
