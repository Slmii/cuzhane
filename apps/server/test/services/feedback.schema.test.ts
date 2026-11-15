import { CreateFeedbackBodySchema } from '@schemas/feedback.schema';
import { describe, expect, it } from 'vitest';

const body = { topic: 'BUG' as const, message: 'The reader closed by itself.' };

describe('CreateFeedbackBodySchema — the trail', () => {
	it('takes up to thirty lines, or none', () => {
		expect(CreateFeedbackBodySchema.safeParse(body).success).toBe(true);
		expect(
			CreateFeedbackBodySchema.safeParse({ ...body, trail: Array(30).fill('22:41:05 app active') }).success
		).toBe(true);
	});

	it('refuses more lines, or longer ones, than the app ever keeps', () => {
		expect(CreateFeedbackBodySchema.safeParse({ ...body, trail: Array(31).fill('x') }).success).toBe(false);
		expect(CreateFeedbackBodySchema.safeParse({ ...body, trail: ['x'.repeat(121)] }).success).toBe(false);
		expect(CreateFeedbackBodySchema.safeParse({ ...body, trail: 'not a list' }).success).toBe(false);
	});
});
