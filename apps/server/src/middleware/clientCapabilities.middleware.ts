import { PART_COUNT, type GroupKindName } from '@utils/groupKinds';
import type { NextFunction, Request, Response } from 'express';

/**
 * The header a client lists the group kinds it can draw in, e.g. `CEVSEN,HATIM,HIZB`. Sent by
 * `wrapper.api.ts` on every request; a build that predates the Hizb sends nothing.
 */
export const CLIENT_KINDS_HEADER = 'X-Cuzhane-Kinds';

/**
 * The header a client lists the kinds it can draw a Şahsi (one-person plan) reading of, e.g.
 * `CEVSEN,HATIM`. A build without it would open such a group as an empty board.
 */
export const PERSONAL_KINDS_HEADER = 'X-Cuzhane-Personal-Kinds';

/**
 * The header a client states the Hizb division it draws in. The book moved from 33 portions to 32;
 * 1.4.0 draws 33, sends nothing, and cannot take the change over the air — so a build that does not
 * say `32` is treated as one that cannot draw the Hizb at all.
 */
export const HIZB_PORTIONS_HEADER = 'X-Cuzhane-Hizb-Portions';
export const HIZB_PORTIONS = '32';

export type ClientCapabilityLocals = {
	clientKinds: ReadonlySet<GroupKindName>;
	hizbPlans?: boolean;
	/** The kinds whose Şahsi reading this build can draw; none without the header. */
	personalKinds?: ReadonlySet<GroupKindName>;
};

const isGroupKind = (value: string): value is GroupKindName => Object.hasOwn(PART_COUNT, value);

/**
 * The kinds every build can draw, header or not: the Cevşen, and the Kur'an hatim that shipped
 * (1.3.0) before this header existed. Those builds send nothing and must keep seeing their
 * hatim groups, so a request with no header gets exactly this set — only a kind newer than the
 * header (the Hizb) has to be listed to be served.
 */
const KINDS_BEFORE_THE_HEADER: readonly GroupKindName[] = ['CEVSEN', 'HATIM'];

/**
 * The base set is always in, whatever the header says. Names this server doesn't know are
 * dropped rather than refused: a newer build may list a kind it has not been taught yet.
 */
export const parseClientKinds = (header: string | undefined): Set<GroupKindName> => {
	const kinds = new Set<GroupKindName>(KINDS_BEFORE_THE_HEADER);

	for (const token of header?.split(',') ?? []) {
		const name = token.trim().toUpperCase();

		if (isGroupKind(name)) {
			kinds.add(name);
		}
	}

	return kinds;
};

/** The kinds named in `X-Cuzhane-Personal-Kinds`; unknown names are dropped, as above. */
export const parsePersonalKinds = (header: string | undefined): Set<GroupKindName> =>
	new Set((header?.split(',') ?? []).map(token => token.trim().toUpperCase()).filter(isGroupKind));

/** Populates `res.locals.clientKinds` from the capability headers, for the compatibility guard. */
export const clientCapabilities = (req: Request, res: Response<object, ClientCapabilityLocals>, next: NextFunction) => {
	res.locals.hizbPlans = req.get('X-Cuzhane-Hizb-Plans') === '1';
	const kinds = parseClientKinds(req.get(CLIENT_KINDS_HEADER));
	if (req.get(HIZB_PORTIONS_HEADER) !== HIZB_PORTIONS) {
		kinds.delete('HIZB');
	}
	res.locals.clientKinds = kinds;
	res.locals.personalKinds = parsePersonalKinds(req.get(PERSONAL_KINDS_HEADER));

	next();
};

export const clientSupportsKind = (res: { locals: ClientCapabilityLocals }, kind: GroupKindName): boolean =>
	res.locals.clientKinds.has(kind);

/**
 * Whether the caller can draw this group: its kind, and the plan it is read by — a personal Hizb
 * plan, or a Şahsi Cevşen/Kur'an reading — which older builds would show as a shared board.
 */
export const clientSupportsGroup = (
	res: { locals: ClientCapabilityLocals },
	group: { kind: GroupKindName; hizbPlan?: number | null; planDays?: number | null }
): boolean =>
	clientSupportsKind(res, group.kind) &&
	(group.hizbPlan == null || res.locals.hizbPlans === true) &&
	(group.planDays == null || res.locals.personalKinds?.has(group.kind) === true);
