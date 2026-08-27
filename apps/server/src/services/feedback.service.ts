import { clerkClient } from '@clerk/express';
import { INTERNAL_SERVER_ERROR } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import type { CreateFeedbackBody } from '@schemas/feedback.schema';
import { generateFeedbackReference } from '@utils/feedbackReference';
import { normalizeUserId } from '@utils/normalizeUserId';

const MAX_REFERENCE_ATTEMPTS = 8;

export type FeedbackReceipt = {
	reference: string;
};

/**
 * The account email, read at submit time so a reply has somewhere to go. Best effort on
 * purpose: Clerk being unreachable must not lose a message that has already been written,
 * so a failed lookup stores a null address rather than failing the request.
 */
const resolveAccountEmail = async (userId: string): Promise<string | null> => {
	try {
		const user = await clerkClient.users.getUser(userId);
		const primary = user.emailAddresses.find(address => address.id === user.primaryEmailAddressId);

		return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
	} catch {
		return null;
	}
};

const reserveReference = async (): Promise<string> => {
	for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
		const candidate = generateFeedbackReference();
		const existing = await prisma.feedback.findUnique({ where: { reference: candidate }, select: { id: true } });

		if (!existing) {
			return candidate;
		}
	}

	throw new HttpError(INTERNAL_SERVER_ERROR, 'Could not allocate a feedback reference');
};

export const createFeedback = async (userId: string, input: CreateFeedbackBody): Promise<FeedbackReceipt> => {
	const normalizedUserId = normalizeUserId(userId);
	const [reference, email] = await Promise.all([reserveReference(), resolveAccountEmail(normalizedUserId)]);

	const feedback = await prisma.feedback.create({
		data: {
			reference,
			userId: normalizedUserId,
			topic: input.topic,
			message: input.message,
			email,
			appVersion: input.appVersion ?? null,
			platform: input.platform ?? null,
			locale: input.locale ?? null
		},
		select: { reference: true }
	});

	return { reference: feedback.reference };
};
