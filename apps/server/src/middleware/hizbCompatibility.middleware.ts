import type { Request, Response, NextFunction } from 'express';
import prisma from '@db/prisma';
import { HttpError } from '@config/httpError';
import { BAD_REQUEST, UPGRADE_REQUIRED } from '@config/httpCodes';
import type { ResponseLocals } from '@interfaces/response.types';
import { clientSupportsGroup } from '@middleware/clientCapabilities.middleware';
import { isPersonalPlan } from '@utils/groupKinds';

/**
 * A plan assignment cannot be written through a legacy shared-board endpoint — a personal Hizb
 * plan's, or a Şahsi Cevşen/Kur'an reading's. Neither has a board to read, pool or round to pick.
 */
export const hizbCompatibility = async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		const match = req.path.match(/^\/(groups|babs)\/([^/]+)(.*)$/);
		if (!match || match[2] === 'discover') {
			return next();
		}
		const group = await prisma.group.findUnique({
			where: { id: match[2]! },
			select: { kind: true, hizbPlan: true, planDays: true }
		});
		if (!group || !isPersonalPlan(group)) {
			return next();
		}
		if (!clientSupportsGroup(res, group)) {
			throw new HttpError(UPGRADE_REQUIRED, 'Update the app to open this group');
		}
		if (
			match[1] === 'babs' ||
			/^\/(pool|pool-cuz|round-cuz|round-skip|rounds|my-progress|start)(\/|$)/.test(match[3]!)
		) {
			throw new HttpError(BAD_REQUEST, 'Open your personal reading assignment');
		}
		next();
	} catch (error) {
		next(error);
	}
};
