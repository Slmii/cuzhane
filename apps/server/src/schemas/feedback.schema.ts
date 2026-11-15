import { z } from 'zod';

export const FEEDBACK_MESSAGE_MAX_LENGTH = 600;
export const FEEDBACK_MESSAGE_MIN_LENGTH = 10;

/**
 * Topic and message are the whole form. The diagnostics below are optional because the
 * client sends what it knows about itself — never something the sender types — and a
 * build that can't name its own version should still be able to file a report.
 */
export const CreateFeedbackBodySchema = z.object({
	topic: z.enum(['BUG', 'IDEA', 'OTHER']),
	message: z.string().trim().min(FEEDBACK_MESSAGE_MIN_LENGTH).max(FEEDBACK_MESSAGE_MAX_LENGTH),
	appVersion: z.string().trim().max(64).optional(),
	platform: z.string().trim().max(32).optional(),
	locale: z.string().trim().max(16).optional(),
	// The app's last steps (screens and their numbers, app state), oldest first — see the web
	// app's `lib/utils/breadcrumbs`, whose bounds these mirror.
	trail: z.array(z.string().max(120)).max(30).optional()
});

export type CreateFeedbackBody = z.infer<typeof CreateFeedbackBodySchema>;
