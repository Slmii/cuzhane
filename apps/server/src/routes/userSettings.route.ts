import { OK } from '@config/httpCodes';
import { ResponseLocals, ResponseLocalsWithBody } from '@interfaces/response.types';
import { validateData } from '@middleware/validate.middleware';
import { UpdateUserSettingsBody, UpdateUserSettingsBodySchema } from '@schemas/userSettings.schema';
import { getUserSettingsForUser, updateUserSettingsForUser } from '@services/userSettings.service';
import { NextFunction, Request, Response, Router } from 'express';

const userSettingsRouter = Router();

userSettingsRouter.get('/', async (_req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		const {
			auth: { userId }
		} = res.locals;

		const settings = await getUserSettingsForUser(userId);
		res.status(OK).json(settings);
	} catch (error) {
		next(error);
	}
});

userSettingsRouter.patch(
	'/',
	validateData(UpdateUserSettingsBodySchema, 'body'),
	async (
		_req: Request,
		res: Response<object, ResponseLocalsWithBody<UpdateUserSettingsBody>>,
		next: NextFunction
	) => {
		try {
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			const settings = await updateUserSettingsForUser(userId, validatedBody);
			res.status(OK).json(settings);
		} catch (error) {
			next(error);
		}
	}
);

export default userSettingsRouter;
