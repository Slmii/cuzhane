import { BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import { NextFunction, Request, Response } from 'express';
import { prettifyError, ZodError } from 'zod';

const BODY_ERROR_MESSAGES: Partial<Record<string, string>> = {
	'entity.parse.failed': 'Malformed JSON body',
	'entity.too.large': 'Request body too large'
};

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

	// `express.json` rejects a body it cannot read (malformed, oversized, wrong charset, aborted)
	// with its own 4xx `status`, flagged `expose`; those are the client's mistake, not ours, and a
	// 500 hid that. The message is ours, not the parser's, which can quote the body back.
	const bodyError = error as { expose?: unknown; status?: unknown; type?: unknown } | null;

	if (bodyError?.expose === true && typeof bodyError.type === 'string' && typeof bodyError.status === 'number') {
		res.status(bodyError.status).json({ error: BODY_ERROR_MESSAGES[bodyError.type] ?? 'Unreadable request body' });

		return;
	}

	res.status(INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
};
