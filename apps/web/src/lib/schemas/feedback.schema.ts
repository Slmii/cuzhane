import * as z from 'zod';

export const FEEDBACK_MESSAGE_MAX_LENGTH = 600;
export const FEEDBACK_MESSAGE_MIN_LENGTH = 10;

/**
 * No message strings: the send button is the only feedback this form gives — it names the
 * shortfall ("En az 10 karakter yaz") instead of the field turning red under the reader
 * while they are still writing the first sentence.
 */
export const createFeedbackSchema = () =>
	z.object({
		topic: z.enum(['BUG', 'IDEA', 'OTHER']),
		message: z.string().trim().min(FEEDBACK_MESSAGE_MIN_LENGTH).max(FEEDBACK_MESSAGE_MAX_LENGTH)
	});

export type FeedbackForm = z.infer<ReturnType<typeof createFeedbackSchema>>;
