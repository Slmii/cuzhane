import { INTERNAL_SERVER_ERROR, TOO_MANY_REQUESTS } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import type { AuthLocals } from '@middleware/auth.middleware';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

const userKey = (_req: Request, res: Response<object, Partial<AuthLocals>>) => {
	const userId = res.locals.auth?.userId;

	if (!userId) {
		throw new HttpError(INTERNAL_SERVER_ERROR, 'Rate limit requires authenticated user');
	}

	return userId;
};

const tooManyRequestsHandler = (_req: Request, res: Response) => {
	res.status(TOO_MANY_REQUESTS).json({ error: 'Too many requests, please slow down.' });
};

export const joinRateLimit = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	limit: 10, // 10 requests per minute
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

export const createGroupRateLimit = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	limit: 10, // 10 requests per hour
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

/** Starting a live reading — a person needs a handful an hour; a loop needs more. */
export const liveStartRateLimit = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 20,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

/** Looking a live reading up by its code: a wall against guessing codes, not against people. */
export const liveLookupRateLimit = rateLimit({
	windowMs: 60 * 1000,
	limit: 20,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

/**
 * The reader turning their voice on and off — each a call to Cloudflare. A reconnecting app starts
 * it again, so more than a person would tap, still far below a loop.
 */
export const liveVoiceRateLimit = rateLimit({
	windowMs: 60 * 1000,
	limit: 20,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

/** A follower starting to listen and answering Cloudflare's offer — two calls per listen, all to Cloudflare. */
export const liveListenRateLimit = rateLimit({
	windowMs: 60 * 1000,
	limit: 30,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

/** Taking and releasing pool slots and cüz — generous for real use, a wall against a loop. */
export const poolRateLimit = rateLimit({
	windowMs: 60 * 1000,
	limit: 30,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

/** Opening the next day's Hizb portion to read ahead — a row per day, so a wall against a loop. */
export const readAheadRateLimit = rateLimit({
	windowMs: 60 * 1000,
	limit: 30,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

/** Saving the reader's place, written as pages turn — generous for reading, a wall against a loop. */
export const readingPlaceRateLimit = rateLimit({
	windowMs: 60 * 1000,
	limit: 120,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

/** Things that call a third party or write a row per request: the verse meal and push-token registration. */
export const externalCallRateLimit = rateLimit({
	windowMs: 60 * 1000,
	limit: 30,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

/** Feedback: a message is written by hand, so ten an hour is more than anyone sends. */
export const feedbackRateLimit = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 10,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});

export const cheerRateLimit = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	limit: 30, // 30 requests per minute
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	keyGenerator: userKey,
	handler: tooManyRequestsHandler
});
