import { BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND, REQUEST_TOO_LONG } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import { NextFunction, Request, Response } from 'express';
import { prettifyError, ZodError } from 'zod';

export const notFoundHandler = (_req: Request, res: Response) => {
	res.status(NOT_FOUND).json({ error: 'Route not found' });
};

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
	const err = error instanceof Error ? error : new Error(String(error));
	console.error({ name: err.name, message: err.message, stack: err.stack });

	if (error instanceof ZodError) {
		res.status(BAD_REQUEST).json({
			error: 'Validation failed',
			details: prettifyError(error)
		});

		return;
	}

	if (error instanceof HttpError) {
		res.status(error.statusCode).json({
			error: error.message,
			details: error.details
		});

		return;
	}

	// `express.json` rejects a malformed or oversized body with its own `type`; those are the
	// client's mistake, not ours, and a 500 hid that.
	const bodyErrorType = (error as { type?: unknown } | null)?.type;

	if (bodyErrorType === 'entity.parse.failed') {
		res.status(BAD_REQUEST).json({ error: 'Malformed JSON body' });

		return;
	}

	if (bodyErrorType === 'entity.too.large') {
		res.status(REQUEST_TOO_LONG).json({ error: 'Request body too large' });

		return;
	}

	res.status(INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
};
