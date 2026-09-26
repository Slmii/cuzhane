import { UPGRADE_REQUIRED } from '@config/httpCodes';
import { HttpError } from '@config/httpError';
import prisma from '@db/prisma';
import type { AuthLocals } from '@middleware/auth.middleware';
import {
	CLIENT_KINDS_HEADER,
	clientCapabilities,
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
/** What a current build sends; an old one sends nothing. */
const CURRENT_BUILD = { [CLIENT_KINDS_HEADER]: 'CEVSEN,HIZB' };

// Invite codes drawn from the invite alphabet (no I, O, 0, 1), so a typed code normalises onto them.
const HIZB_CODE = 'HZBA2345';
const CEVSEN_CODE = 'CVSN2345';

const localsFor = (header: string | undefined): { locals: ClientCapabilityLocals } => ({
	locals: { clientKinds: parseClientKinds(header) }
});
const OLD_BUILD_RES = localsFor(undefined);
const CURRENT_BUILD_RES = localsFor('CEVSEN,HIZB');

/** An open, gathering group with its owner seated and one bab row per part — what Discover lists. */
const createOpenGroup = async (kind: GroupKindName, inviteCode: string) => {
	const group = await prisma.group.create({
		data: {
			ownerUserId: OWNER,
			name: `${kind} Halkası`,
			inviteCode,
			kind,
			spots: kind === 'HIZB' ? 11 : 10,
			cycle: 'DAILY',
			splitMode: 'ROTATION',
			visibility: 'OPEN',
			openToJoin: true,
			members: { create: [{ userId: OWNER, displayName: 'Owner', role: 'OWNER', slotIndex: 0 }] }
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: kind === 'HIZB' ? 33 : 100 }, (_, index) => ({
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
	it('gives a request with no header the Cevşen alone', () => {
		expect([...parseClientKinds(undefined)]).toEqual(['CEVSEN']);
	});

	it('reads the list a current build sends', () => {
		expect([...parseClientKinds('CEVSEN,HIZB')].sort()).toEqual(['CEVSEN', 'HIZB']);
	});

	it('trims and uppercases each name', () => {
		expect([...parseClientKinds('  hizb , Cevsen ')].sort()).toEqual(['CEVSEN', 'HIZB']);
	});

	it('always keeps the Cevşen, even when the header leaves it out or is empty', () => {
		expect([...parseClientKinds('HIZB')].sort()).toEqual(['CEVSEN', 'HIZB']);
		expect([...parseClientKinds('')]).toEqual(['CEVSEN']);
	});

	it('drops names this server does not know, and empty entries', () => {
		expect([...parseClientKinds('QURAN, ,,HATIM')]).toEqual(['CEVSEN']);
	});
});

describe('filterGroupsForClient', () => {
	const groups = [
		{ id: 'a', kind: 'CEVSEN' as const },
		{ id: 'b', kind: 'HIZB' as const },
		{ id: 'c', kind: 'CEVSEN' as const }
	];

	it('removes the kinds an old build cannot draw, keeping the order', () => {
		expect(filterGroupsForClient(OLD_BUILD_RES, groups).map(group => group.id)).toEqual(['a', 'c']);
	});

	it('keeps everything for a build that declares every kind', () => {
		expect(filterGroupsForClient(CURRENT_BUILD_RES, groups).map(group => group.id)).toEqual(['a', 'b', 'c']);
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
		const response = await call('/_kinds', { headers: { 'x-CUZHANE-kinds': ' hizb ' } });

		expect(await response.json()).toEqual(['CEVSEN', 'HIZB']);
	});

	it('leaves a Hizb group out of Discover and search for a build without the header', async () => {
		const hizb = await createOpenGroup('HIZB', HIZB_CODE);
		const cevsen = await createOpenGroup('CEVSEN', CEVSEN_CODE);

		const ids = async (path: string, headers: Record<string, string> = {}) => {
			const response = await call(path, { headers });
			expect(response.status).toBe(200);

			return ((await response.json()) as { id: string }[]).map(group => group.id).sort();
		};

		expect(await ids('/groups/discover')).toEqual([cevsen.id]);
		expect(await ids('/groups/discover?search=Halka')).toEqual([cevsen.id]);
		expect(await ids('/groups/discover', CURRENT_BUILD)).toEqual([cevsen.id, hizb.id].sort());
		expect(await ids('/groups/discover?search=Halka', CURRENT_BUILD)).toEqual([cevsen.id, hizb.id].sort());
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

	it('refuses both joins into a Hizb group to a build without the header, and seats nobody', async () => {
		const hizb = await createOpenGroup('HIZB', HIZB_CODE);

		const byCode = await call('/memberships/join/code', { method: 'POST', body: { code: 'hzba-2345' } });
		expect(byCode.status).toBe(UPGRADE_REQUIRED);

		const byId = await call(`/memberships/join/${hizb.id}`, { method: 'POST' });
		expect(byId.status).toBe(UPGRADE_REQUIRED);

		expect(await viewerSeats()).toBe(0);
	});
});
