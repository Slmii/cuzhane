import type { Request, Response, NextFunction } from 'express';
import prisma from '@db/prisma';
import { HttpError } from '@config/httpError';
import { BAD_REQUEST, UPGRADE_REQUIRED } from '@config/httpCodes';
import type { ResponseLocals } from '@interfaces/response.types';

/** A plan assignment cannot be written through a legacy shared-board endpoint. */
export const hizbCompatibility = async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		const match = req.path.match(/^\/(groups|babs)\/([^/]+)(.*)$/);
		if (!match || match[2] === 'discover') {
			return next();
		}
		const group = await prisma.group.findUnique({ where: { id: match[2]! }, select: { hizbPlan: true } });
		if (group?.hizbPlan == null) {
			return next();
		}
		if (!res.locals.hizbPlans) {
			throw new HttpError(UPGRADE_REQUIRED, 'Update the app to open this group');
		}
		if (match[1] === 'babs' || /^\/(pool|rounds|my-progress|start)(\/|$)/.test(match[3]!)) {
			throw new HttpError(BAD_REQUEST, 'Open your personal reading assignment');
		}
		next();
	} catch (error) {
		next(error);
	}
};
