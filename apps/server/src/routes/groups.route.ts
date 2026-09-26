import { CREATED, OK } from '@config/httpCodes';
import { ResponseLocals, ResponseLocalsWithBody, ResponseLocalsWithQuery } from '@interfaces/response.types';
import { createGroupRateLimit } from '@middleware/rateLimit.middleware';
import { validateData } from '@middleware/validate.middleware';
import {
	CreateGroupBody,
	CreateGroupBodySchema,
	DiscoverQuery,
	DiscoverQuerySchema,
	GroupIdParamsSchema,
	CoverRoundBabsBodySchema,
	RoundParamsSchema,
	PoolPartParamsSchema,
	PoolSlotParamsSchema,
	UpdateGroupBody,
	UpdateGroupBodySchema
} from '@schemas/group.schema';
import {
	createGroupForUser,
	deleteGroupForUser,
	discoverGroups,
	getGroupDetailForUser,
	listGroupsForUser,
	regenerateInviteCodeForUser,
	startGroupForUser,
	updateGroupForUser
} from '@services/groups.service';
import {
	listPoolSlotsForUser,
	markPoolReleasesSeenForUser,
	releasePoolPartForUser,
	releasePoolSlotForUser,
	takePoolPartForUser,
	takePoolSlotForUser
} from '@services/pool.service';
import {
	coverMissedBabsForUser,
	getMyProgressForUser,
	getRoundDetailForUser,
	listRoundsForUser
} from '@services/roundHistory.service';
import { resolveDisplayName } from '@utils/displayName';
import { NextFunction, Request, Response, Router } from 'express';

const groupsRouter = Router();

groupsRouter.get('/', async (_req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		const {
			auth: { userId }
		} = res.locals;

		const groups = await listGroupsForUser(userId);
		res.status(OK).json(groups);
	} catch (error) {
		next(error);
	}
});

groupsRouter.get(
	'/discover',
	validateData(DiscoverQuerySchema, 'query'),
	async (_req: Request, res: Response<object, ResponseLocalsWithQuery<DiscoverQuery>>, next: NextFunction) => {
		try {
			const {
				auth: { userId },
				validatedQuery
			} = res.locals;

			const groups = await discoverGroups(userId, validatedQuery);
			res.status(OK).json(groups);
		} catch (error) {
			next(error);
		}
	}
);

groupsRouter.post(
	'/',
	createGroupRateLimit,
	validateData(CreateGroupBodySchema, 'body'),
	async (req: Request, res: Response<object, ResponseLocalsWithBody<CreateGroupBody>>, next: NextFunction) => {
		try {
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			const displayName = resolveDisplayName(req);
			const group = await createGroupForUser(userId, displayName, validatedBody);
			res.status(CREATED).json(group);
		} catch (error) {
			next(error);
		}
	}
);

groupsRouter.get('/:groupId', async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		const { groupId } = GroupIdParamsSchema.parse(req.params);
		const {
			auth: { userId }
		} = res.locals;

		const group = await getGroupDetailForUser(userId, groupId);
		res.status(OK).json(group);
	} catch (error) {
		next(error);
	}
});

groupsRouter.patch(
	'/:groupId',
	validateData(UpdateGroupBodySchema, 'body'),
	async (req: Request, res: Response<object, ResponseLocalsWithBody<UpdateGroupBody>>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId },
				validatedBody
			} = res.locals;

			const group = await updateGroupForUser(userId, groupId, validatedBody);
			res.status(OK).json(group);
		} catch (error) {
			next(error);
		}
	}
);

groupsRouter.delete('/:groupId', async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		const { groupId } = GroupIdParamsSchema.parse(req.params);
		const {
			auth: { userId }
		} = res.locals;

		const result = await deleteGroupForUser(userId, groupId);
		res.status(OK).json(result);
	} catch (error) {
		next(error);
	}
});

groupsRouter.post(
	'/:groupId/invite-code',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const group = await regenerateInviteCodeForUser(userId, groupId);
			res.status(OK).json(group);
		} catch (error) {
			next(error);
		}
	}
);

groupsRouter.post(
	'/:groupId/start',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const group = await startGroupForUser(userId, groupId);
			res.status(OK).json(group);
		} catch (error) {
			next(error);
		}
	}
);

groupsRouter.get('/:groupId/pool', async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
	try {
		const { groupId } = GroupIdParamsSchema.parse(req.params);
		const {
			auth: { userId }
		} = res.locals;

		const slots = await listPoolSlotsForUser(userId, groupId);
		res.status(OK).json(slots);
	} catch (error) {
		next(error);
	}
});

groupsRouter.post(
	'/:groupId/pool/:slotIndex',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId, slotIndex } = PoolSlotParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const result = await takePoolSlotForUser(userId, groupId, slotIndex);
			res.status(OK).json(result);
		} catch (error) {
			next(error);
		}
	}
);

groupsRouter.delete(
	'/:groupId/pool/:slotIndex',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId, slotIndex } = PoolSlotParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const result = await releasePoolSlotForUser(userId, groupId, slotIndex);
			res.status(OK).json(result);
		} catch (error) {
			next(error);
		}
	}
);

/*
 * One portion of a Hizb pool block, rather than the whole slot. Its own path segment, so a
 * portion number is never read as a seat index — the two routes above take a seat.
 */
groupsRouter.post(
	'/:groupId/pool/parts/:babNumber',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId, babNumber } = PoolPartParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const result = await takePoolPartForUser(userId, groupId, babNumber);
			res.status(OK).json(result);
		} catch (error) {
			next(error);
		}
	}
);

groupsRouter.delete(
	'/:groupId/pool/parts/:babNumber',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId, babNumber } = PoolPartParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const result = await releasePoolPartForUser(userId, groupId, babNumber);
			res.status(OK).json(result);
		} catch (error) {
			next(error);
		}
	}
);

/*
 * Dismisses the "a joiner took over the block you volunteered for" notices. Separate from
 * the pool slot routes because it acknowledges a *past* event rather than changing who holds
 * anything — nothing about the board moves.
 */
groupsRouter.patch(
	'/:groupId/pool-releases/seen',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const result = await markPoolReleasesSeenForUser(userId, groupId);
			res.status(OK).json(result);
		} catch (error) {
			next(error);
		}
	}
);

/**
 * "Senin ilerlemen" — this member's own record, every round they have been in (F7, and the
 * banner on the group screen that opens it).
 *
 * Nothing in the query, and no window: the banner's counts and the missed list are about the
 * whole record, so a caller able to ask for a span could only disagree with them. The strip
 * is the one narrower view and it slices its own seven or eight cells off the end.
 */
groupsRouter.get(
	'/:groupId/my-progress',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const progress = await getMyProgressForUser(userId, groupId);
			res.status(OK).json(progress);
		} catch (error) {
			next(error);
		}
	}
);

groupsRouter.get(
	'/:groupId/rounds',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId } = GroupIdParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const rounds = await listRoundsForUser(userId, groupId);
			res.status(OK).json(rounds);
		} catch (error) {
			next(error);
		}
	}
);

groupsRouter.get(
	'/:groupId/rounds/:roundIndex',
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId, roundIndex } = RoundParamsSchema.parse(req.params);
			const {
				auth: { userId }
			} = res.locals;

			const detail = await getRoundDetailForUser(userId, groupId, roundIndex);
			res.status(OK).json(detail);
		} catch (error) {
			next(error);
		}
	}
);

// "Üstlen" on someone else's block, "Okudum" on your own — one write either way: the babs
// this closed round never had a reader for now have one. Sent as a block rather than per
// bab, so taking on someone's whole share is a single act.
groupsRouter.post(
	'/:groupId/rounds/:roundIndex/cover',
	validateData(CoverRoundBabsBodySchema, 'body'),
	async (req: Request, res: Response<object, ResponseLocals>, next: NextFunction) => {
		try {
			const { groupId, roundIndex } = RoundParamsSchema.parse(req.params);
			const { babNumbers } = CoverRoundBabsBodySchema.parse(req.body);
			const {
				auth: { userId }
			} = res.locals;

			const detail = await coverMissedBabsForUser(userId, groupId, roundIndex, babNumbers);
			res.status(OK).json(detail);
		} catch (error) {
			next(error);
		}
	}
);

export default groupsRouter;
