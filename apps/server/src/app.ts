import { hizbCompatibility } from '@middleware/hizbCompatibility.middleware';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { env } from '@config/env';
import { UNAUTHORIZED } from '@config/httpCodes';
import { populateAuthLocals } from '@middleware/auth.middleware';
import { clientCapabilities } from '@middleware/clientCapabilities.middleware';
import { errorHandler, notFoundHandler } from '@middleware/error.middleware';
import accountRouter from '@routes/account.route';
import babsRouter from '@routes/babs.route';
import cheersRouter from '@routes/cheers.route';
import feedbackRouter from '@routes/feedback.route';
import groupsRouter from '@routes/groups.route';
import healthRouter from '@routes/health.route';
import membershipRouter from '@routes/membership.route';
import notificationsRouter from '@routes/notifications.route';
import profileRouter from '@routes/profile.route';
import pushTokenRouter from '@routes/pushToken.route';
import quranRouter from '@routes/quran.route';
import userSettingsRouter from '@routes/userSettings.route';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { resolve } from 'node:path';

// API-style auth gate: returns 401 JSON instead of redirecting unauthenticated requests.
const requireAuthApi = (req: Request, res: Response, next: NextFunction) => {
	const { userId } = getAuth(req);

	if (!userId) {
		res.status(UNAUTHORIZED).json({ error: 'Unauthorized' });
		return;
	}

	next();
};

export const createApp = () => {
	const app = express();

	app.use(helmet());
	app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN }));
	app.use(express.json({ limit: '300kb' }));

	// Clerk session parsing (runs on every request, does NOT reject unauthenticated)
	app.use(clerkMiddleware());

	// Public routes
	app.use(healthRouter);

	// Protected routes — require a valid Clerk session
	app.use('/api', requireAuthApi, populateAuthLocals);
	app.use(
		'/api/mushaf',
		express.static(resolve(import.meta.dirname, '../mushaf'), {
			immutable: true,
			maxAge: '365d',
			setHeaders: res => {
				res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
				res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
			}
		})
	);
	// Which group kinds this build can draw, for the guard in `clientCompatibility.service.ts`
	app.use('/api', clientCapabilities, hizbCompatibility);
	app.use('/api/groups', groupsRouter);
	app.use('/api/memberships', membershipRouter);
	app.use('/api/babs', babsRouter);
	app.use('/api/cheers', cheersRouter);
	app.use('/api/user-settings', userSettingsRouter);
	app.use('/api/notifications', notificationsRouter);
	app.use('/api/push-tokens', pushTokenRouter);
	app.use('/api/profile', profileRouter);
	app.use('/api/account', accountRouter);
	app.use('/api/feedback', feedbackRouter);
	app.use('/api/quran', quranRouter);

	// Error handling middleware should be registered after all routes
	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
};
