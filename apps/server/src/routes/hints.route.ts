import { OK } from '@config/httpCodes';
import { ResponseLocals, ResponseLocalsWithBody } from '@interfaces/response.types';
import { hintsRateLimit } from '@middleware/rateLimit.middleware';
import { validateData } from '@middleware/validate.middleware';
import { MarkHintsSeenBody, MarkHintsSeenBodySchema } from '@schemas/hints.schema';
import { getHintsForUser, type HintsState, markHintsSeenForUser, resetHintsForUser } from '@services/hints.service';
import { NextFunction, Request, Response, Router } from 'express';

const hintsRouter = Router();

hintsRouter.get('/', async (_req: Request, res: Response<HintsState, ResponseLocals>, next: NextFunction) => {
	try {
		res.status(OK).json(await getHintsForUser(res.locals.auth.userId));
	} catch (error) {
		next(error);
	}
});

hintsRouter.post(
	'/seen',
	hintsRateLimit,
	validateData(MarkHintsSeenBodySchema, 'body'),
	async (_req: Request, res: Response<HintsState, ResponseLocalsWithBody<MarkHintsSeenBody>>, next: NextFunction) => {
		try {
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			res.status(OK).json(await markHintsSeenForUser(userId, validatedBody.ids));
		} catch (error) {
			next(error);
		}
	}
);

hintsRouter.post(
	'/reset',
	hintsRateLimit,
	async (_req: Request, res: Response<HintsState, ResponseLocals>, next: NextFunction) => {
		try {
			res.status(OK).json(await resetHintsForUser(res.locals.auth.userId));
		} catch (error) {
			next(error);
		}
	}
);

export default hintsRouter;
