import { OK } from '@config/httpCodes';
import { ResponseLocals } from '@interfaces/response.types';
import { deleteAccountForUser } from '@services/account.service';
import { NextFunction, Request, Response, Router } from 'express';

const accountRouter = Router();

accountRouter.delete('/', async (_req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		const {
			auth: { userId }
		} = res.locals;

		const result = await deleteAccountForUser(userId);
		res.status(OK).json(result);
	} catch (error) {
		next(error);
	}
});

export default accountRouter;
