import { UPGRADE_REQUIRED } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import { clientSupportsKind, type ClientCapabilityLocals } from '@middleware/clientCapabilities.middleware';
import type { GroupKindName } from '@utils/groupKinds';
import { normalizeInviteCode } from '@utils/inviteCode';

/*
 * The compatibility guard. A build that predates `Group.kind` reads every group as a Cevşen
 * one: it would show a Hizb group as a hundred babs, join it, and mark "bab 7" read — which
 * marks Hizb portion 7 and corrupts the round. Such a build declares no kinds (see
 * `clientCapabilities.middleware.ts`), so the routes that let someone find or enter a group
 * hide or refuse any group whose kind the caller didn't list.
 */

type ClientResponse = { locals: ClientCapabilityLocals };

/** The two ways a request names a group: its id, or the invite code as typed. */
type GroupLookup = { id: string } | { inviteCode: string };

/**
 * Throws 426 when the group is of a kind the caller cannot draw. A group that doesn't exist
 * passes, so the route's own service answers it with the 404 it always has. `kind` is
 * immutable, so checking ahead of the service's own read leaves nothing to race.
 */
export const assertClientCanUseGroup = async (res: ClientResponse, where: GroupLookup): Promise<void> => {
	const group = await prisma.group.findUnique({
		where: 'id' in where ? { id: where.id } : { inviteCode: normalizeInviteCode(where.inviteCode) },
		select: { kind: true }
	});

	if (group && !clientSupportsKind(res, group.kind)) {
		throw new HttpError(UPGRADE_REQUIRED, 'Update the app to open this group');
	}
};

/** Drops the groups whose kind the caller cannot draw. */
export const filterGroupsForClient = <T extends { kind: GroupKindName }>(
	res: ClientResponse,
	groups: readonly T[]
): T[] => groups.filter(group => clientSupportsKind(res, group.kind));
