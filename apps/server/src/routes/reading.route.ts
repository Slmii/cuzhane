import { Router } from 'express';
import { createGroupRateLimit } from '@middleware/rateLimit.middleware';
import { validateData } from '@middleware/validate.middleware';
import {
	CreateReadingGroupSchema,
	JoinReadingGroupSchema,
	ReadingParamsSchema,
	ReadingAssignmentParamsSchema
} from '@schemas/reading.schema';
import {
	createReadingGroup,
	joinReadingGroup,
	getReadingGroup,
	listReadingGroups,
	leaveReadingGroup,
	completeReadingAssignment
} from '@services/readingGroups.service';
import { resolveDisplayName } from '@utils/displayName';
import type { ResponseLocals } from '@interfaces/response.types';
import type { Response } from 'express';

const router = Router();
router.get('/', async (_req, res: Response<object, ResponseLocals>, next) => {
	try {
		res.json(await listReadingGroups(res.locals.auth.userId));
	} catch (error) {
		next(error);
	}
});
router.post(
	'/',
	createGroupRateLimit,
	validateData(CreateReadingGroupSchema),
	async (req, res: Response<object, ResponseLocals>, next) => {
		try {
			res.status(201).json(
				await createReadingGroup(
					res.locals.auth.userId,
					resolveDisplayName(req),
					CreateReadingGroupSchema.parse(req.body)
				)
			);
		} catch (error) {
			next(error);
		}
	}
);
router.post('/join', validateData(JoinReadingGroupSchema), async (req, res: Response<object, ResponseLocals>, next) => {
	try {
		res.json(
			await joinReadingGroup(
				res.locals.auth.userId,
				resolveDisplayName(req),
				JoinReadingGroupSchema.parse(req.body).inviteCode
			)
		);
	} catch (error) {
		next(error);
	}
});
router.get('/:groupId', async (req, res: Response<object, ResponseLocals>, next) => {
	try {
		const { groupId } = ReadingParamsSchema.parse(req.params);
		res.json(await getReadingGroup(res.locals.auth.userId, groupId));
	} catch (error) {
		next(error);
	}
});
router.post('/:groupId/leave', async (req, res: Response<object, ResponseLocals>, next) => {
	try {
		const { groupId } = ReadingParamsSchema.parse(req.params);
		res.json(await leaveReadingGroup(res.locals.auth.userId, groupId));
	} catch (error) {
		next(error);
	}
});
router.post(
	'/:groupId/assignments/:assignmentId/complete',
	async (req, res: Response<object, ResponseLocals>, next) => {
		try {
			const { groupId, assignmentId } = ReadingAssignmentParamsSchema.parse(req.params);
			res.json(await completeReadingAssignment(res.locals.auth.userId, groupId, assignmentId));
		} catch (error) {
			next(error);
		}
	}
);
export default router;
