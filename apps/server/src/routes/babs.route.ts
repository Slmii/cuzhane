import { OK } from '@config/httpCodes';
import { ResponseLocals, ResponseLocalsWithBody } from '@interfaces/response.types';
import { validateData } from '@middleware/validate.middleware';
import { BabParamsSchema, SetBabReadBody, SetBabReadBodySchema } from '@schemas/bab.schema';
import { GroupIdParamsSchema } from '@schemas/group.schema';
import { listBabsForUser, setAssignedBabsReadForUser, setBabReadForUser } from '@services/babs.service';
import { NextFunction, Request, Response, Router } from 'express';

const babsRouter = Router();

babsRouter.get('/:groupId', async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		const { groupId } = GroupIdParamsSchema.parse(req.params);
		const {
			auth: { userId }
		} = res.locals;

		const babs = await listBabsForUser(userId, groupId);
		res.status(OK).json(babs);
	} catch (error) {
		next(error);
	}
});

// Registered before `/:groupId/:babNumber/read` so "read-all" is never parsed as a bab number.
babsRouter.patch(
	'/:groupId/read-all',
	validateData(SetBabReadBodySchema, 'body'),
	async (req: Request, res: Response<object, ResponseLocalsWithBody<SetBabReadBody>>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			const babs = await setAssignedBabsReadForUser(userId, groupId, validatedBody.read);
			res.status(OK).json(babs);
		} catch (error) {
			next(error);
		}
	}
);

babsRouter.patch(
	'/:groupId/:babNumber/read',
	validateData(SetBabReadBodySchema, 'body'),
	async (req: Request, res: Response<object, ResponseLocalsWithBody<SetBabReadBody>>, next: NextFunction) => {
		try {
			const { groupId, babNumber } = BabParamsSchema.parse(req.params);
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			const bab = await setBabReadForUser(userId, groupId, babNumber, validatedBody.read);
			res.status(OK).json(bab);
		} catch (error) {
			next(error);
		}
	}
);

export default babsRouter;
