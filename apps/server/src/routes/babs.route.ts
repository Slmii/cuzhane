import { OK } from '@config/httpCodes';
import { ResponseLocals, ResponseLocalsWithBody, ResponseLocalsWithQuery } from '@interfaces/response.types';
import { validateData } from '@middleware/validate.middleware';
import {
	BabParamsSchema,
	PartRepetitionsQuery,
	PartRepetitionsQuerySchema,
	SetBabReadBody,
	SetBabReadBodySchema,
	SetPartRepetitionsBody,
	SetPartRepetitionsBodySchema
} from '@schemas/bab.schema';
import { GroupIdParamsSchema } from '@schemas/group.schema';
import { listBabsForUser, setAssignedBabsReadForUser, setBabReadForUser } from '@services/babs.service';
import { getPartRepetitionsForUser, setPartRepetitionsForUser } from '@services/repetitions.service';
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

/*
 * The reader's own count on a part that must be repeated before it is marked — Sekine's
 * nineteen. Beside the read route because it gates it; `?roundIndex=` reads a closed round's
 * count, for covering that round.
 */
babsRouter.get(
	'/:groupId/:babNumber/repetitions',
	validateData(PartRepetitionsQuerySchema, 'query'),
	async (req: Request, res: Response<object, ResponseLocalsWithQuery<PartRepetitionsQuery>>, next: NextFunction) => {
		try {
			const { groupId, babNumber } = BabParamsSchema.parse(req.params);
			const {
				auth: { userId },
				validatedQuery
			} = res.locals;

			const repetitions = await getPartRepetitionsForUser(userId, groupId, babNumber, validatedQuery.roundIndex);
			res.status(OK).json(repetitions);
		} catch (error) {
			next(error);
		}
	}
);

babsRouter.put(
	'/:groupId/:babNumber/repetitions',
	validateData(SetPartRepetitionsBodySchema, 'body'),
	async (req: Request, res: Response<object, ResponseLocalsWithBody<SetPartRepetitionsBody>>, next: NextFunction) => {
		try {
			const { groupId, babNumber } = BabParamsSchema.parse(req.params);
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			const repetitions = await setPartRepetitionsForUser(userId, groupId, babNumber, validatedBody);
			res.status(OK).json(repetitions);
		} catch (error) {
			next(error);
		}
	}
);

export default babsRouter;
