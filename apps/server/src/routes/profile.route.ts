import { OK } from '@config/httpCodes';
import { ResponseLocals } from '@interfaces/response.types';
import { getProfileStatsForUser } from '@services/profile.service';
import { forgetMemberProfile } from '@utils/memberProfiles';
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '@utils/rounds';
import { NextFunction, Request, Response, Router } from 'express';

const profileRouter = Router();

profileRouter.get('/stats', async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		const {
			auth: { userId }
		} = res.locals;

		// The client sends its own zone so the streak and heatmap are bucketed in the
		// reader's days. An unknown or missing value falls back to the default rather than
		// 400-ing: a bad zone string is not worth failing someone's profile screen over.
		const requested = typeof req.query.timezone === 'string' ? req.query.timezone : undefined;
		const timeZone = requested && isValidTimeZone(requested) ? requested : DEFAULT_TIME_ZONE;

		const stats = await getProfileStatsForUser(userId, timeZone);
		res.status(OK).json(stats);
	} catch (error) {
		next(error);
	}
});

/**
 * "Forget what you cached about me." Called by the client the moment it changes the signed-in
 * user's name or photo in Clerk.
 *
 * The identity comes from the session, never from the body — a request can only ever evict
 * its own caller, so this cannot be used to make somebody else's profile expensive.
 */
profileRouter.post('/refresh', (_req: Request, res: Response<object, ResponseLocals>) => {
	const {
		auth: { userId }
	} = res.locals;

	forgetMemberProfile(userId);
	res.status(OK).json({ ok: true });
});

export default profileRouter;
