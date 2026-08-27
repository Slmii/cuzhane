import { OK } from '@config/httpCodes';
import { ResponseLocalsWithBody } from '@interfaces/response.types';
import { cheerRateLimit } from '@middleware/rateLimit.middleware';
import { validateData } from '@middleware/validate.middleware';
import { CheerBody, CheerBodySchema } from '@schemas/cheer.schema';
import { GroupIdParamsSchema } from '@schemas/group.schema';
import { toggleCheerForUser } from '@services/cheers.service';
import { NextFunction, Request, Response, Router } from 'express';

const cheersRouter = Router();

cheersRouter.post(
	'/:groupId',
	cheerRateLimit,
	validateData(CheerBodySchema, 'body'),
	async (req: Request, res: Response<object, ResponseLocalsWithBody<CheerBody>>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			const result = await toggleCheerForUser(userId, groupId, validatedBody.toUserId);
			res.status(OK).json(result);
		} catch (error) {
			next(error);
		}
	}
);

export default cheersRouter;
