import { UPGRADE_REQUIRED } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import type { AuthLocals } from '@middleware/auth.middleware';
import {
	CLIENT_KINDS_HEADER,
	clientCapabilities,
	HIZB_PORTIONS_HEADER,
	parseClientKinds,
	type ClientCapabilityLocals
} from '@middleware/clientCapabilities.middleware';
import { errorHandler } from '@middleware/error.middleware';
import groupsRouter from '@routes/groups.route';
import membershipRouter from '@routes/membership.route';
import { assertClientCanUseGroup, filterGroupsForClient } from '@services/clientCompatibility.service';
import type { GroupKindName } from '@utils/groupKinds';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';
const VIEWER = 'test_viewer';
/** What a current build sends; an old one (1.3.0 and before) sends nothing. */
const CURRENT_BUILD = { [CLIENT_KINDS_HEADER]: 'CEVSEN,HATIM,HIZB', [HIZB_PORTIONS_HEADER]: '32' };
/** 1.4.0: lists the Hizb, but draws its old 33 portions and says nothing of them. */
const BUILD_1_4 = { [CLIENT_KINDS_HEADER]: 'CEVSEN,HATIM,HIZB' };

// Invite codes drawn from the invite alphabet (no I, O, 0, 1), so a typed code normalises onto them.
const HIZB_CODE = 'HZBA2345';
const CEVSEN_CODE = 'CVSN2345';
const HATIM_CODE = 'HTMA2345';

const localsFor = (header: string | undefined): { locals: ClientCapabilityLocals } => ({
	locals: { clientKinds: parseClientKinds(header) }
});
const OLD_BUILD_RES = localsFor(undefined);
const CURRENT_BUILD_RES = localsFor('CEVSEN,HATIM,HIZB');

/** One bab row per unit — a hundred babs, thirty cüz or 32 portions. */
const UNIT_COUNT: Record<GroupKindName, number> = { CEVSEN: 100, HATIM: 30, HIZB: 32 };

/** An open, gathering group with its owner seated and one bab row per part — what Discover lists. */
const createOpenGroup = async (kind: GroupKindName, inviteCode: string) => {
	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: `${kind} Halkası`,
			inviteCode,
			kind,
			spots: kind === 'HIZB' ? 11 : kind === 'HATIM' ? 30 : 10,
			cycle: 'DAILY',
			roundDays: 1,
			splitMode: 'ROTATION',
			visibility: 'OPEN',
			openToJoin: true,
			members: { create: [{ userId: OWNER, displayName: 'Owner', role: 'OWNER', slotIndex: 0 }] }
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: UNIT_COUNT[kind] }, (_, index) => ({
			groupId: group.id,
			number: index + 1
		}))
	});

	return group;
};

beforeEach(async () => {
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('parseClientKinds', () => {
	it('gives a request with no header the kinds that shipped before it: the Cevşen and the hatim', () => {
		expect([...parseClientKinds(undefined)].sort()).toEqual(['CEVSEN', 'HATIM']);
	});

	it('reads the list a current build sends', () => {
		expect([...parseClientKinds('CEVSEN,HATIM,HIZB')].sort()).toEqual(['CEVSEN', 'HATIM', 'HIZB']);
	});

	it('trims and uppercases each name', () => {
		expect([...parseClientKinds('  hizb , Cevsen ')].sort()).toEqual(['CEVSEN', 'HATIM', 'HIZB']);
	});

	it('always keeps the Cevşen and the hatim, even when the header leaves them out or is empty', () => {
		expect([...parseClientKinds('HIZB')].sort()).toEqual(['CEVSEN', 'HATIM', 'HIZB']);
		expect([...parseClientKinds('')].sort()).toEqual(['CEVSEN', 'HATIM']);
	});

	it('drops names this server does not know, and empty entries', () => {
		expect([...parseClientKinds('QURAN, ,,HATIM')].sort()).toEqual(['CEVSEN', 'HATIM']);
	});
});

describe('filterGroupsForClient', () => {
	const groups = [
		{ id: 'a', kind: 'CEVSEN' as const },
		{ id: 'b', kind: 'HIZB' as const },
		{ id: 'c', kind: 'CEVSEN' as const },
		{ id: 'd', kind: 'HATIM' as const }
	];

	it('removes the kinds an old build cannot draw, keeping the order', () => {
		expect(filterGroupsForClient(OLD_BUILD_RES, groups).map(group => group.id)).toEqual(['a', 'c', 'd']);
	});

	it('keeps everything for a build that declares every kind', () => {
		expect(filterGroupsForClient(CURRENT_BUILD_RES, groups).map(group => group.id)).toEqual(['a', 'b', 'c', 'd']);
	});
});

describe('assertClientCanUseGroup', () => {
	it('refuses a Hizb group to a build without the header, by id and by a code as typed', async () => {
		const hizb = await createOpenGroup('HIZB', HIZB_CODE);

		await expect(assertClientCanUseGroup(OLD_BUILD_RES, { id: hizb.id })).rejects.toMatchObject({
			statusCode: UPGRADE_REQUIRED
		});
		await expect(assertClientCanUseGroup(OLD_BUILD_RES, { inviteCode: 'hzba-2345' })).rejects.toBeInstanceOf(
			HttpError
		);
	});

	it('lets a build that declares the Hizb through', async () => {
		const hizb = await createOpenGroup('HIZB', HIZB_CODE);

		await expect(assertClientCanUseGroup(CURRENT_BUILD_RES, { id: hizb.id })).resolves.toBeUndefined();
		await expect(assertClientCanUseGroup(CURRENT_BUILD_RES, { inviteCode: HIZB_CODE })).resolves.toBeUndefined();
	});

	it('always lets a Cevşen group through', async () => {
		const cevsen = await createOpenGroup('CEVSEN', CEVSEN_CODE);

		await expect(assertClientCanUseGroup(OLD_BUILD_RES, { id: cevsen.id })).resolves.toBeUndefined();
		await expect(assertClientCanUseGroup(OLD_BUILD_RES, { inviteCode: CEVSEN_CODE })).resolves.toBeUndefined();
	});

	it('lets a hatim through to a build without the header — 1.3.0 shipped it', async () => {
		const hatim = await createOpenGroup('HATIM', HATIM_CODE);

		await expect(assertClientCanUseGroup(OLD_BUILD_RES, { id: hatim.id })).resolves.toBeUndefined();
		await expect(assertClientCanUseGroup(OLD_BUILD_RES, { inviteCode: HATIM_CODE })).resolves.toBeUndefined();
	});

	it('passes a group that does not exist, leaving the 404 to the route', async () => {
		await expect(assertClientCanUseGroup(OLD_BUILD_RES, { id: 'no-such-group' })).resolves.toBeUndefined();
		await expect(assertClientCanUseGroup(OLD_BUILD_RES, { inviteCode: 'ZZZZ9999' })).resolves.toBeUndefined();
	});
});

/*
 * The guard lives in the routes, so this drives the real routers over HTTP. The chain mirrors
 * `createApp`'s `/api` one, except that a stub stands in for Clerk (`requireAuthApi` +
 * `populateAuthLocals`), whose middleware needs a real session. Only paths that stop before
 * `resolveDisplayName` — which asks Clerk too — are exercised, which is every refusal.
 */
describe('the guarded routes', () => {
	let server: Server;
	let baseUrl: string;

	const stubAuth = (_req: Request, res: Response<object, AuthLocals>, next: NextFunction) => {
		res.locals.auth = { userId: VIEWER, isAuthenticated: true };
		next();
	};

	type CallOptions = { method?: string; headers?: Record<string, string>; body?: unknown };

	const call = (path: string, { method = 'GET', headers = {}, body }: CallOptions = {}) =>
		fetch(`${baseUrl}/api${path}`, {
			method,
			headers: { 'Content-Type': 'application/json', ...headers },
			...(body === undefined ? {} : { body: JSON.stringify(body) })
		});

	const viewerSeats = () => prisma.groupMember.count({ where: { userId: VIEWER } });

	beforeAll(async () => {
		const app = express();
		app.use(express.json());
		app.use('/api', stubAuth);
		app.use('/api', clientCapabilities);
		app.get('/api/_kinds', (_req, res: Response<object, ClientCapabilityLocals>) => {
			res.json([...res.locals.clientKinds].sort());
		});
		app.use('/api/groups', groupsRouter);
		app.use('/api/memberships', membershipRouter);
		app.use(errorHandler);

		server = await new Promise<Server>(resolve => {
			const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
		});
		baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		await new Promise(resolve => server.close(resolve));
	});

	beforeEach(() => {
		// The error handler logs every refusal; they are the expected outcome here.
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('reads the header whatever case its name is sent in', async () => {
		const response = await call('/_kinds', {
			headers: { 'x-CUZHANE-kinds': ' hizb ', 'x-cuzhane-HIZB-portions': '32' }
		});

		expect(await response.json()).toEqual(['CEVSEN', 'HATIM', 'HIZB']);
	});

	it('takes the Hizb away from a build that does not draw its 32 portions', async () => {
		const kinds = async (headers: Record<string, string>) => (await call('/_kinds', { headers })).json();

		expect(await kinds(BUILD_1_4)).toEqual(['CEVSEN', 'HATIM']);
		expect(await kinds({ ...BUILD_1_4, [HIZB_PORTIONS_HEADER]: '33' })).toEqual(['CEVSEN', 'HATIM']);
		expect(await kinds(CURRENT_BUILD)).toEqual(['CEVSEN', 'HATIM', 'HIZB']);
	});

	it('refuses a Hizb group’s previews and joins to a 1.4.0 build, and seats nobody', async () => {
		const hizb = await createOpenGroup('HIZB', HIZB_CODE);

		expect((await call(`/memberships/preview/code/${HIZB_CODE}`, { headers: BUILD_1_4 })).status).toBe(
			UPGRADE_REQUIRED
		);
		expect((await call(`/memberships/preview/group/${hizb.id}`, { headers: BUILD_1_4 })).status).toBe(
			UPGRADE_REQUIRED
		);
		const join = await call(`/memberships/join/${hizb.id}`, { method: 'POST', headers: BUILD_1_4 });
		expect(join.status).toBe(UPGRADE_REQUIRED);
		expect(await viewerSeats()).toBe(0);

		expect((await call(`/memberships/preview/group/${hizb.id}`, { headers: CURRENT_BUILD })).status).toBe(200);
	});

	it('leaves a Hizb group out of Discover and search for a build without the header, but not a hatim', async () => {
		// A personal-plan group: Discover lists no other Hizb, whatever the build.
		const hizb = await prisma.group.update({
			where: { id: (await createOpenGroup('HIZB', HIZB_CODE)).id },
			data: { hizbPlan: 32, splitMode: 'FLEXIBLE', status: 'RUNNING', startedAt: new Date() }
		});
		const cevsen = await createOpenGroup('CEVSEN', CEVSEN_CODE);
		const hatim = await createOpenGroup('HATIM', HATIM_CODE);

		const ids = async (path: string, headers: Record<string, string> = {}) => {
			const response = await call(path, { headers });
			expect(response.status).toBe(200);

			return ((await response.json()) as { id: string }[]).map(group => group.id).sort();
		};

		expect(await ids('/groups/discover')).toEqual([cevsen.id, hatim.id].sort());
		expect(await ids('/groups/discover?search=Halka')).toEqual([cevsen.id, hatim.id].sort());
		// The current app also says it draws personal plans, which is all a Hizb in Discover is now.
		const planBuild = { ...CURRENT_BUILD, 'X-Cuzhane-Hizb-Plans': '1' };
		expect(await ids('/groups/discover', planBuild)).toEqual([cevsen.id, hatim.id, hizb.id].sort());
		expect(await ids('/groups/discover?search=Halka', planBuild)).toEqual([cevsen.id, hatim.id, hizb.id].sort());
	});

	it('refuses both previews of a Hizb group to a build without the header', async () => {
		const hizb = await createOpenGroup('HIZB', HIZB_CODE);

		const byCode = await call(`/memberships/preview/code/${HIZB_CODE}`);
		expect(byCode.status).toBe(UPGRADE_REQUIRED);
		expect(await byCode.json()).toEqual({ error: 'Update the app to open this group' });
		expect((await call(`/memberships/preview/group/${hizb.id}`)).status).toBe(UPGRADE_REQUIRED);

		expect((await call(`/memberships/preview/code/${HIZB_CODE}`, { headers: CURRENT_BUILD })).status).toBe(200);
		expect((await call(`/memberships/preview/group/${hizb.id}`, { headers: CURRENT_BUILD })).status).toBe(200);
	});

	it('still previews a Cevşen group for a build without the header', async () => {
		await createOpenGroup('CEVSEN', CEVSEN_CODE);

		expect((await call(`/memberships/preview/code/${CEVSEN_CODE}`)).status).toBe(200);
	});

	it('previews a hatim for a build without the header, by code and by id', async () => {
		const hatim = await createOpenGroup('HATIM', HATIM_CODE);

		expect((await call(`/memberships/preview/code/${HATIM_CODE}`)).status).toBe(200);
		expect((await call(`/memberships/preview/group/${hatim.id}`)).status).toBe(200);
	});

	it('never answers a hatim join from a build without the header with 426', async () => {
		const hatim = await createOpenGroup('HATIM', HATIM_CODE);

		// Past the guard the join asks Clerk for a name, which this harness has no session for —
		// so the answer is whatever that says, and never the upgrade wall.
		const byCode = await call('/memberships/join/code', {
			method: 'POST',
			body: { code: HATIM_CODE, cuzNumbers: [5] }
		});
		expect(byCode.status).not.toBe(UPGRADE_REQUIRED);

		const byId = await call(`/memberships/join/${hatim.id}`, { method: 'POST', body: { cuzNumbers: [6] } });
		expect(byId.status).not.toBe(UPGRADE_REQUIRED);
	});

	it('refuses both joins into a Hizb group to a build without the header, and seats nobody', async () => {
		const hizb = await createOpenGroup('HIZB', HIZB_CODE);

		const byCode = await call('/memberships/join/code', { method: 'POST', body: { code: 'hzba-2345' } });
		expect(byCode.status).toBe(UPGRADE_REQUIRED);

		const byId = await call(`/memberships/join/${hizb.id}`, { method: 'POST' });
		expect(byId.status).toBe(UPGRADE_REQUIRED);

		expect(await viewerSeats()).toBe(0);
	});
});
