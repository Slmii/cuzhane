import { BAD_REQUEST } from '@config/httpCodes';
import { ResponseLocals, ResponseLocalsWithBody, ResponseLocalsWithQuery } from '@interfaces/response.types';
import { NextFunction, Request, Response } from 'express';
import { ZodError, treeifyError, z } from 'zod';

type ValidateTarget = 'body' | 'query';

export function validateData<T = unknown>(
	schema: z.ZodType<T>,
	target?: 'body'
): (req: Request, res: Response<object, ResponseLocalsWithBody<T>>, next: NextFunction) => void;
export function validateData<T = unknown>(
	schema: z.ZodType<T>,
	target: 'query'
): (req: Request, res: Response<object, ResponseLocalsWithQuery<T>>, next: NextFunction) => void;
export function validateData<T = unknown>(schema: z.ZodType<T>, target: ValidateTarget = 'body') {
	return (req: Request, res: Response<object, ResponseLocals<T>>, next: NextFunction) => {
		try {
			const sourceData = target === 'query' ? req.query : req.body;
			const parsedData = schema.parse(sourceData);

			if (target === 'body') {
				req.body = parsedData;
				res.locals.validatedBody = parsedData;
			} else {
				res.locals.validatedQuery = parsedData;
			}

			next();
		} catch (error) {
			if (error instanceof ZodError) {
				res.status(BAD_REQUEST).json({ error: 'Invalid data', details: treeifyError(error) });
			} else {
				res.status(BAD_REQUEST).json({ error: 'Invalid data' });
			}
		}
	};
}
