import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { ResponseLocals } from '@interfaces/response.types';
import { requestReadingHelp, listReadingHelp, actOnReadingHelp } from '@services/readingHelp.service';
const router = Router({ mergeParams: true });
const params = z.object({ groupId: z.string().min(1), requestId: z.string().min(1).optional() });
const target = z.union([
	z.object({ assignmentId: z.string().min(1) }).strict(),
	z.object({ roundIndex: z.number().int().min(0) }).strict()
]);
const action = z
	.object({ action: z.enum(['claim', 'release', 'cancel', 'complete']), version: z.number().int().min(0) })
	.strict();
const handle =
	(fn: (req: Request, user: string, group: string) => Promise<unknown>) =>
	async (req: Request, res: Response<unknown, ResponseLocals>, next: NextFunction) => {
		try {
			res.json(await fn(req, res.locals.auth.userId, params.parse(req.params).groupId));
		} catch (error) {
			next(error);
		}
	};
router.get(
	'/',
	handle((_req, user, group) => listReadingHelp(user, group))
);
router.post(
	'/',
	handle((req, user, group) => requestReadingHelp(user, group, target.parse(req.body)))
);
router.patch(
	'/:requestId',
	handle((req, user, group) => {
		const input = action.parse(req.body);
		return actOnReadingHelp(user, group, params.parse(req.params).requestId!, input.action, input.version);
	})
);
export default router;
