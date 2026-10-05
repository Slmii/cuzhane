import { CREATED } from '@config/httpCodes';
import { ResponseLocalsWithBody } from '@interfaces/response.types';
import type { AuthLocals } from '@middleware/auth.middleware';
import {
	liveListenRateLimit,
	liveLookupRateLimit,
	liveStartRateLimit,
	liveTurnRateLimit,
	liveVoiceRateLimit
} from '@middleware/rateLimit.middleware';
import { validateData } from '@middleware/validate.middleware';
import {
	AnswerLiveVoiceBodySchema,
	LiveCodeParamsSchema,
	LiveSessionIdParamsSchema,
	StartLiveSessionBodySchema,
	StartLiveVoiceBodySchema,
	StopListeningBodySchema,
	type AnswerLiveVoiceBody,
	type StartLiveSessionBody,
	type StartLiveVoiceBody,
	type StopListeningBody
} from '@schemas/live.schema';
import {
	endLiveSession,
	getLiveSessionPreview,
	serializeLiveSession,
	startLiveSession,
	type LiveSessionPreview
} from '@services/liveSession.service';
import {
	answerLiveVoice,
	listenLiveVoice,
	startLiveVoice,
	stopListeningLiveVoice,
	stopLiveVoice,
	type ListeningVoice,
	type StartedVoice
} from '@services/liveVoice.service';
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

/*
 * The reader's voice (`liveVoice.service.ts`). The audio itself goes through Cloudflare; these
 * only let the reader in to send and a follower in to listen.
 */
liveRouter.post(
	'/:sessionId/voice',
	liveVoiceRateLimit,
	liveTurnRateLimit,
	validateData(StartLiveVoiceBodySchema, 'body'),
	async (
		req: Request,
		res: Response<StartedVoice, ResponseLocalsWithBody<StartLiveVoiceBody>>,
		next: NextFunction
	) => {
		try {
			const { sessionId } = LiveSessionIdParamsSchema.parse(req.params);

			res.json(await startLiveVoice(res.locals.auth.userId, sessionId, res.locals.validatedBody));
		} catch (error) {
			next(error);
		}
	}
);

liveRouter.delete(
	'/:sessionId/voice',
	liveVoiceRateLimit,
	async (req: Request, res: Response<{ success: true }, AuthLocals>, next: NextFunction) => {
		try {
			const { sessionId } = LiveSessionIdParamsSchema.parse(req.params);

			await stopLiveVoice(res.locals.auth.userId, sessionId);
			res.json({ success: true });
		} catch (error) {
			next(error);
		}
	}
);

liveRouter.post(
	'/:sessionId/voice/listen',
	liveListenRateLimit,
	liveTurnRateLimit,
	async (req: Request, res: Response<ListeningVoice, AuthLocals>, next: NextFunction) => {
		try {
			const { sessionId } = LiveSessionIdParamsSchema.parse(req.params);

			res.json(await listenLiveVoice(res.locals.auth.userId, sessionId));
		} catch (error) {
			next(error);
		}
	}
);

liveRouter.put(
	'/:sessionId/voice/listen',
	liveListenRateLimit,
	validateData(AnswerLiveVoiceBodySchema, 'body'),
	async (
		req: Request,
		res: Response<{ success: true }, ResponseLocalsWithBody<AnswerLiveVoiceBody>>,
		next: NextFunction
	) => {
		try {
			const { sessionId } = LiveSessionIdParamsSchema.parse(req.params);

			await answerLiveVoice(res.locals.auth.userId, sessionId, res.locals.validatedBody);
			res.json({ success: true });
		} catch (error) {
			next(error);
		}
	}
);

liveRouter.delete(
	'/:sessionId/voice/listen',
	liveListenRateLimit,
	validateData(StopListeningBodySchema, 'body'),
	async (
		req: Request,
		res: Response<{ success: true }, ResponseLocalsWithBody<StopListeningBody>>,
		next: NextFunction
	) => {
		try {
			const { sessionId } = LiveSessionIdParamsSchema.parse(req.params);

			stopListeningLiveVoice(res.locals.auth.userId, sessionId, res.locals.validatedBody.listenerSessionId);
			res.json({ success: true });
		} catch (error) {
			next(error);
		}
	}
);

export default liveRouter;
