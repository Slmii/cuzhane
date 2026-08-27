import { CREATED } from '@config/httpCodes';
import { ResponseLocalsWithBody } from '@interfaces/response.types';
import { validateData } from '@middleware/validate.middleware';
import { CreateFeedbackBody, CreateFeedbackBodySchema } from '@schemas/feedback.schema';
import { createFeedback, type FeedbackReceipt } from '@services/feedback.service';
import { NextFunction, Request, Response, Router } from 'express';

const feedbackRouter = Router();

feedbackRouter.post(
	'/',
	validateData(CreateFeedbackBodySchema, 'body'),
	async (
		_req: Request,
		res: Response<FeedbackReceipt, ResponseLocalsWithBody<CreateFeedbackBody>>,
		next: NextFunction
	) => {
		try {
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			const receipt = await createFeedback(userId, validatedBody);

			res.status(CREATED).json(receipt);
		} catch (error) {
			next(error);
		}
	}
);

export default feedbackRouter;
