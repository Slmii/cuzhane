import type { StringKey } from '@/lib/i18n/strings';
import * as z from 'zod';

type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

export const createProfileSchema = (t: Translate) =>
	z.object({
		firstName: z.string().trim().min(1, t('fieldRequired')),
		lastName: z.string().trim().min(1, t('fieldRequired'))
	});

export type ProfileForm = z.infer<ReturnType<typeof createProfileSchema>>;

export const createRemindersSchema = () =>
	z.object({
		reminderTime: z.string().regex(/^\d{2}:\d{2}$/),
		reminderEnabled: z.boolean()
	});

export type RemindersForm = z.infer<ReturnType<typeof createRemindersSchema>>;
