import { CREATED } from '@config/httpCodes';
import { ResponseLocalsWithBody } from '@interfaces/response.types';
import type { AuthLocals } from '@middleware/auth.middleware';
import { liveLookupRateLimit, liveStartRateLimit } from '@middleware/rateLimit.middleware';
import { validateData } from '@middleware/validate.middleware';
import {
	LiveCodeParamsSchema,
	LiveSessionIdParamsSchema,
	StartLiveSessionBodySchema,
	type StartLiveSessionBody
} from '@schemas/live.schema';
import {
	endLiveSession,
	getLiveSessionPreview,
	serializeLiveSession,
	startLiveSession,
	type LiveSessionPreview
} from '@services/liveSession.service';
import { NextFunction, Request, Response, Router } from 'express';

/**
 * Live reading ("Birlikte oku"): starting one, looking one up by its code, ending one. Following
 * it happens on the socket (`liveSocket.service.ts`); these are the parts that are ordinary
 * requests, so they get the ordinary auth, validation and rate limits.
 */
const liveRouter = Router();

liveRouter.post(
	'/',
	liveStartRateLimit,
	validateData(StartLiveSessionBodySchema, 'body'),
	async (
		_req: Request,
		res: Response<LiveSessionPreview, ResponseLocalsWithBody<StartLiveSessionBody>>,
		next: NextFunction
	) => {
		try {
			const {
				auth: { userId },
				validatedBody
			} = res.locals;
			const session = await startLiveSession(userId, validatedBody.kind);

			res.status(CREATED).json(await serializeLiveSession(session, userId));
		} catch (error) {
			next(error);
		}
	}
);

liveRouter.get(
	'/:code',
	liveLookupRateLimit,
	async (req: Request, res: Response<LiveSessionPreview, AuthLocals>, next: NextFunction) => {
		try {
			const { code } = LiveCodeParamsSchema.parse(req.params);

			res.json(await getLiveSessionPreview(code, res.locals.auth.userId));
		} catch (error) {
			next(error);
		}
	}
);

liveRouter.delete(
	'/:sessionId',
	async (req: Request, res: Response<{ success: true }, AuthLocals>, next: NextFunction) => {
		try {
			const { sessionId } = LiveSessionIdParamsSchema.parse(req.params);

			await endLiveSession(res.locals.auth.userId, sessionId);
			// A body like every other delete: the app's client parses one.
			res.json({ success: true });
		} catch (error) {
			next(error);
		}
	}
);

export default liveRouter;
