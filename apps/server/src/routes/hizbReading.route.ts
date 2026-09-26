import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { ResponseLocals } from '@interfaces/response.types';
import { enrollHizb, getHizbState, getHizbAssignment, updateHizbAssignment } from '@services/hizbReading.service';
const router = Router({ mergeParams: true });
const params = z.object({ groupId: z.string().min(1), assignmentId: z.string().min(1).optional() });
const update = z
	.object({
		version: z.number().int().min(0),
		read: z.boolean().optional(),
		istighfarRepetitions: z.number().int().min(0).max(100).optional(),
		istighfarTarget: z.union([z.literal(11), z.literal(33), z.literal(100)]).optional(),
		delailRepetitions: z.number().int().min(0).max(3).optional(),
		repetitions: z.number().int().min(0).max(19).optional(),
		bookmark: z.number().int().min(0).max(1000).optional()
	})
	.refine(
		v =>
			v.delailRepetitions !== undefined ||
			v.read !== undefined ||
			v.repetitions !== undefined ||
			v.bookmark !== undefined ||
			v.istighfarRepetitions !== undefined ||
			v.istighfarTarget !== undefined
	);
const handle =
	(work: (req: Request, user: string, groupId: string) => Promise<object>) =>
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			res.json(await work(req, res.locals.auth.userId, params.parse(req.params).groupId));
		} catch (error) {
			next(error);
		}
	};
router.get(
	'/',
	handle((req, user, id) => getHizbState(user, id, z.string().min(1).optional().parse(req.query.cursor)))
);
router.post(
	'/enroll',
	handle((req, user, id) =>
		enrollHizb(
			user,
			id,
			z.object({ planDays: z.union([z.literal(7), z.literal(15), z.literal(33)]) }).parse(req.body).planDays
		)
	)
);
router.get(
	'/assignments/:assignmentId',
	handle((req, user, id) => getHizbAssignment(user, id, params.parse(req.params).assignmentId!))
);
router.patch(
	'/assignments/:assignmentId',
	handle((req, user, id) =>
		updateHizbAssignment(user, id, params.parse(req.params).assignmentId!, update.parse(req.body))
	)
);
export default router;
