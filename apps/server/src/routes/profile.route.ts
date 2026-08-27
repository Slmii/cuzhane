import { OK } from '@config/httpCodes';
import { ResponseLocals } from '@interfaces/response.types';
import { getProfileStatsForUser } from '@services/profile.service';
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

export default profileRouter;
