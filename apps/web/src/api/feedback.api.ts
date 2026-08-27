import { wrapperApi } from '@/api/wrapper.api';

export type FeedbackTopic = 'BUG' | 'IDEA' | 'OTHER';

export type CreateFeedbackInput = {
	topic: FeedbackTopic;
	message: string;
	/** Attached automatically — the form never asks for these. */
	appVersion?: string;
	platform?: string;
	locale?: string;
};

export type FeedbackReceipt = {
	reference: string;
};

export const createFeedback = async (input: CreateFeedbackInput) =>
	wrapperApi<FeedbackReceipt>('/feedback', { method: 'POST', body: JSON.stringify(input) });
