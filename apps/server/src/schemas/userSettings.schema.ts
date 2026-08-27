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
		notificationsEnabled: z.boolean().optional(),
		reminderEnabled: z.boolean().optional(),
		hasSeenOnboarding: z.boolean().optional(),
		reminderTime: TimeStringSchema.optional(),
		readerFontScale: z.number().int().min(0).max(2).optional()
	})
	.refine(body => Object.values(body).some(value => value !== undefined), {
		message: 'At least one field is required'
	});

export type UpdateUserSettingsBody = z.infer<typeof UpdateUserSettingsBodySchema>;
