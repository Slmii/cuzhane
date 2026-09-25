import { NO_CONTENT } from '@config/httpCodes';
import { ResponseLocalsWithBody } from '@interfaces/response.types';
import { validateData } from '@middleware/validate.middleware';
import { RegisterPushTokenBody, RegisterPushTokenBodySchema } from '@schemas/pushToken.schema';
import { registerPushToken, removePushToken } from '@services/pushToken.service';
import { NextFunction, Request, Response, Router } from 'express';
import { externalCallRateLimit } from '@middleware/rateLimit.middleware';

const pushTokenRouter = Router();

pushTokenRouter.post(
	'/',
	externalCallRateLimit,
	validateData(RegisterPushTokenBodySchema, 'body'),
	async (_req: Request, res: Response<object, ResponseLocalsWithBody<RegisterPushTokenBody>>, next: NextFunction) => {
		try {
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			await registerPushToken(userId, validatedBody.token);
			res.status(NO_CONTENT).send();
		} catch (error) {
			next(error);
		}
	}
);

pushTokenRouter.delete(
	'/',
	validateData(RegisterPushTokenBodySchema, 'body'),
	async (_req: Request, res: Response<object, ResponseLocalsWithBody<RegisterPushTokenBody>>, next: NextFunction) => {
		try {
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			await removePushToken(userId, validatedBody.token);
			res.status(NO_CONTENT).send();
		} catch (error) {
			next(error);
		}
	}
);

export default pushTokenRouter;
