import { NO_CONTENT } from '@config/httpCodes';
import { ResponseLocals } from '@interfaces/response.types';
import {
	getUnreadCountForUser,
	listNotificationsForUser,
	markAllNotificationsReadForUser,
	markNotificationReadForUser
} from '@services/notifications.service';
import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';

const NotificationIdParamsSchema = z.object({ notificationId: z.string().trim().min(1).max(64) });

const notificationsRouter = Router();

/**
 * The inbox (design P2) and the bell's badge (P1).
 *
 * The count is its own endpoint rather than a field on the list: the bell sits on Ana sayfa and
 * is refetched with the rest of that screen, while the list is only wanted once the inbox is
 * opened. Folding them together would make every Home refresh carry a hundred rows.
 */
notificationsRouter.get('/', async (_req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		res.json(await listNotificationsForUser(res.locals.auth.userId));
	} catch (error) {
		next(error);
	}
});

notificationsRouter.get(
	'/unread-count',
	async (_req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			res.json({ count: await getUnreadCountForUser(res.locals.auth.userId) });
		} catch (error) {
			next(error);
		}
	}
);

notificationsRouter.patch(
	'/read-all',
	async (_req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			await markAllNotificationsReadForUser(res.locals.auth.userId);
			res.status(NO_CONTENT).send();
		} catch (error) {
			next(error);
		}
	}
);

notificationsRouter.patch(
	'/:notificationId/read',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { notificationId } = NotificationIdParamsSchema.parse(req.params);
			await markNotificationReadForUser(res.locals.auth.userId, notificationId);
			res.status(NO_CONTENT).send();
		} catch (error) {
			next(error);
		}
	}
);

export default notificationsRouter;
