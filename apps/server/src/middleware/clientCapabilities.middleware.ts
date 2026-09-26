import { PART_COUNT, type GroupKindName } from '@utils/groupKinds';
import type { NextFunction, Request, Response } from 'express';

/**
 * The header a client lists the group kinds it can draw in, e.g. `CEVSEN,HIZB`. Sent by
 * `wrapper.api.ts` on every request; a build that predates `Group.kind` sends nothing.
 */
export const CLIENT_KINDS_HEADER = 'X-Cuzhane-Kinds';

export type ClientCapabilityLocals = {
	clientKinds: ReadonlySet<GroupKindName>;
	hizbPlans?: boolean;
};

const isGroupKind = (value: string): value is GroupKindName => Object.hasOwn(PART_COUNT, value);

/**
 * Every build can draw a Cevşen group — it is the one kind older than the header — so it is in
 * the set whatever the header says, and a request with no header gets exactly that. Names this
 * server doesn't know are dropped rather than refused: a newer build may list a kind it has not
 * been taught yet.
 */
export const parseClientKinds = (header: string | undefined): Set<GroupKindName> => {
	const kinds = new Set<GroupKindName>(['CEVSEN']);

	for (const token of header?.split(',') ?? []) {
		const name = token.trim().toUpperCase();

		if (isGroupKind(name)) {
			kinds.add(name);
		}
	}

	return kinds;
};

/** Populates `res.locals.clientKinds` from the capability header, for the compatibility guard. */
export const clientCapabilities = (req: Request, res: Response<object, ClientCapabilityLocals>, next: NextFunction) => {
	res.locals.hizbPlans = req.get('X-Cuzhane-Hizb-Plans') === '1';
	res.locals.clientKinds = parseClientKinds(req.get(CLIENT_KINDS_HEADER));

	next();
};

export const clientSupportsKind = (res: { locals: ClientCapabilityLocals }, kind: GroupKindName): boolean =>
	res.locals.clientKinds.has(kind);
