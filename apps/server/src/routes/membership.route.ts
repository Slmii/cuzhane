import { CREATED, OK } from '@config/httpCodes';
import { ResponseLocals, ResponseLocalsWithBody } from '@interfaces/response.types';
import { joinRateLimit } from '@middleware/rateLimit.middleware';
import { validateData } from '@middleware/validate.middleware';
import { GroupIdParamsSchema } from '@schemas/group.schema';
import {
	InviteCodeBody,
	InviteCodeBodySchema,
	InviteCodeParamsSchema,
	MemberUserIdParamsSchema
} from '@schemas/membership.schema';
import { assertClientCanUseGroup } from '@services/clientCompatibility.service';
import {
	joinGroupByCodeForUser,
	joinGroupForUser,
	leaveGroupForUser,
	listMembersForUser,
	previewGroupByCode,
	previewGroupById,
	removeMemberForUser
} from '@services/groupMembership.service';
import { resolveDisplayName } from '@utils/displayName';
import { NextFunction, Request, Response, Router } from 'express';

const membershipRouter = Router();

/*
 * The previews and the joins are how anyone enters a group, so each asks
 * `assertClientCanUseGroup` first: a build that can't draw the group's kind is refused (426)
 * before it can see it as a hundred babs or take a seat in it.
 */

membershipRouter.get(
	'/preview/code/:code',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { code } = InviteCodeParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			await assertClientCanUseGroup(res, { inviteCode: code });
			const preview = await previewGroupByCode(userId, code);
			res.status(OK).json(preview);
		} catch (error) {
			next(error);
		}
	}
);

membershipRouter.get(
	'/preview/group/:groupId',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			await assertClientCanUseGroup(res, { id: groupId });
			const preview = await previewGroupById(userId, groupId);
			res.status(OK).json(preview);
		} catch (error) {
			next(error);
		}
	}
);

membershipRouter.post(
	'/join/code',
	joinRateLimit,
	validateData(InviteCodeBodySchema, 'body'),
	async (req: Request, res: Response<object, ResponseLocalsWithBody<InviteCodeBody>>, next: NextFunction) => {
		try {
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			await assertClientCanUseGroup(res, { inviteCode: validatedBody.code });
			const displayName = resolveDisplayName(req);
			const membership = await joinGroupByCodeForUser(userId, displayName, validatedBody.code);
			res.status(CREATED).json(membership);
		} catch (error) {
			next(error);
		}
	}
);

membershipRouter.post(
	'/join/:groupId',
	joinRateLimit,
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			await assertClientCanUseGroup(res, { id: groupId });
			const displayName = resolveDisplayName(req);
			const membership = await joinGroupForUser(userId, displayName, groupId);
			res.status(CREATED).json(membership);
		} catch (error) {
			next(error);
		}
	}
);

membershipRouter.delete(
	'/:groupId/leave',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const result = await leaveGroupForUser(userId, groupId);
			res.status(OK).json(result);
		} catch (error) {
			next(error);
		}
	}
);

membershipRouter.get(
	'/:groupId/members',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const members = await listMembersForUser(userId, groupId);
			res.status(OK).json(members);
		} catch (error) {
			next(error);
		}
	}
);

membershipRouter.delete(
	'/:groupId/members/:memberUserId',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId, memberUserId } = MemberUserIdParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const result = await removeMemberForUser(userId, groupId, memberUserId);
			res.status(OK).json(result);
		} catch (error) {
			next(error);
		}
	}
);

export default membershipRouter;
