import prisma from '@db/prisma';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import {
	createGroupForUser,
	deleteGroupForUser,
	getGroupDetailForUser,
	updateGroupForUser
} from '@services/groups.service';
import { joinGroupForUser, leaveGroupForUser, listMembersForUser } from '@services/groupMembership.service';
import { getHizbState, hizbSummary, updateHizbAssignment } from '@services/hizbReading.service';
import { listNotificationsForUser, recordNotification } from '@services/notifications.service';
import { sendPushToUser } from '@services/push.service';
import { hizbWorksOf } from '@utils/hizbWorks';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
// Asserted on, not delivered: nobody here has a device.
vi.mock('@services/push.service', () => ({ sendPushToUser: vi.fn(async () => 0) }));
assertIsTestDatabase(testDatabaseUrl());

const start = new Date('2026-10-01T10:00:00Z');
const MEMBERS = ['m1', 'm2', 'm3'];

/** A shared seven-day plan with three members besides the owner. */
const createPlan = async () => {
	vi.setSystemTime(start);
	const group = await createGroupForUser(
		'owner',
		'Owner',
		CreateGroupBodySchema.parse({
			name: 'Vakıf',
			kind: 'HIZB',
			hizbPlan: 7,
			// Open, so members can join by id without the invite code.
			visibility: 'OPEN',
			cycle: 'DAILY',
			reminderTime: '21:00',
			timezone: 'Europe/Amsterdam'
		})
	);
	for (const member of MEMBERS) {
		await joinGroupForUser(member, member.toUpperCase(), group.id);
	}
	return group;
};

/** Marks the member's day read from the book — every portion ticked, so no counter gates it. */
const readToday = async (userId: string, groupId: string) => {
	const today = (await getHizbState(userId, groupId)).today!;
	return updateHizbAssignment(userId, groupId, today.id, {
		version: today.version,
		bookPortions: today.boardPortions
	});
};

/** The reader's "has read" rows — the joins in the set-up file rows of their own. */
const readRows = async (userId: string) =>
	(await listNotificationsForUser(userId)).filter(row => row.kind === 'SHARE_READ');

const pushedTo = () =>
	vi
		.mocked(sendPushToUser)
		.mock.calls.filter(([, message]) => (message as { data?: { kind?: string } }).data?.kind === 'group-read')
		.map(([userId]) => userId)
		.sort();

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.mocked(sendPushToUser).mockClear();
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
	await prisma.notification.deleteMany({});
	await prisma.userSettings.deleteMany({ where: { userId: { in: ['owner', ...MEMBERS] } } });
});

afterAll(async () => {
	vi.useRealTimers();
	await prisma.$disconnect();
});

describe('choosing who sees who read', () => {
	it('ticks the owner of a new shared plan, counting once "Okuma sorumluları" is on', async () => {
		const group = await createPlan();
		const detail = await getGroupDetailForUser('owner', group.id);
		expect(detail.members.find(member => member.userId === 'owner')?.seesReaders).toBe(true);
		// Off by default: the tick waits for the switch.
		expect(detail.readSeersEnabled).toBe(false);
		expect(detail.seesReaders).toBe(false);

		await updateGroupForUser('owner', group.id, { readSeersEnabled: true });
		expect((await getGroupDetailForUser('owner', group.id)).seesReaders).toBe(true);
		expect((await getGroupDetailForUser('m1', group.id)).seesReaders).toBe(false);
	});

	it('takes the switch at creation', async () => {
		vi.setSystemTime(start);
		const group = await createGroupForUser(
			'owner',
			'Owner',
			CreateGroupBodySchema.parse({
				name: 'Vakıf',
				kind: 'HIZB',
				hizbPlan: 32,
				readSeersEnabled: true,
				visibility: 'OPEN',
				cycle: 'DAILY',
				reminderTime: '21:00',
				timezone: 'Europe/Amsterdam'
			})
		);
		expect(group.readSeersEnabled).toBe(true);
		expect((await getGroupDetailForUser('owner', group.id)).seesReaders).toBe(true);
	});

	it('lets only the owner choose, at most three members, all of them in the group', async () => {
		const group = await createPlan();
		await expect(updateGroupForUser('m1', group.id, { readerSeerUserIds: ['m1'] })).rejects.toMatchObject({
			statusCode: 403
		});
		await expect(
			updateGroupForUser('owner', group.id, { readerSeerUserIds: ['owner', 'm1', 'm2', 'm3'] })
		).rejects.toMatchObject({ statusCode: 400 });
		await expect(updateGroupForUser('owner', group.id, { readerSeerUserIds: ['stranger'] })).rejects.toMatchObject({
			statusCode: 400
		});

		await updateGroupForUser('owner', group.id, { readerSeerUserIds: ['m1', 'm2'] });
		const detail = await getGroupDetailForUser('owner', group.id);
		expect(
			detail.members
				.filter(member => member.seesReaders)
				.map(member => member.userId)
				.sort()
		).toEqual(['m1', 'm2']);
		// Who is ticked is the owner's to know.
		expect((await getGroupDetailForUser('m1', group.id)).members.every(member => !member.seesReaders)).toBe(true);
	});

	it('refuses the choice outside a shared Hizb plan', async () => {
		vi.setSystemTime(start);
		const cevsen = await createGroupForUser(
			'owner',
			'Owner',
			CreateGroupBodySchema.parse({
				name: 'Cevşen',
				kind: 'CEVSEN',
				spots: 5,
				cycle: 'DAILY',
				splitMode: 'FIXED',
				visibility: 'OPEN',
				reminderTime: '21:00',
				timezone: 'Europe/Istanbul'
			})
		);
		await expect(updateGroupForUser('owner', cevsen.id, { readerSeerUserIds: ['owner'] })).rejects.toMatchObject({
			statusCode: 400
		});
	});
});

describe('names with names hidden', () => {
	it('shows names to the owner and the ticked, and to nobody else', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, {
			hideMemberNames: true,
			readSeersEnabled: true,
			readerSeerUserIds: ['m1']
		});

		const namesSeenBy = async (userId: string) =>
			(await getHizbState(userId, group.id)).members.filter(member => member.displayName !== null).length;
		expect(await namesSeenBy('m1')).toBe(4);
		// The owner unticked still manages the group by name.
		expect(await namesSeenBy('owner')).toBe(4);
		// Everyone else: only their own.
		expect(await namesSeenBy('m2')).toBe(1);

		const listedBy = async (userId: string) =>
			(await listMembersForUser(userId, group.id)).filter(member => member.displayName !== 'Member').length;
		expect(await listedBy('m1')).toBe(4);
		expect(await listedBy('m2')).toBe(1);

		// "Okuma sorumluları" off: the tick is kept, but no longer shows names.
		await updateGroupForUser('owner', group.id, { readSeersEnabled: false });
		expect(await namesSeenBy('m1')).toBe(1);
		expect((await getGroupDetailForUser('m1', group.id)).seesReaders).toBe(false);
	});

	it('counts today’s readers for the cards — how many read, of everyone on a plan', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, { hideMemberNames: true });
		const readers = (await getHizbState('owner', group.id)).members.length;
		expect((await hizbSummary(group.id, 'm2')).hizbReaders).toEqual({ read: 0, total: readers });

		await readToday('m1', group.id);
		await readToday('m3', group.id);
		expect((await hizbSummary(group.id, 'm2')).hizbReaders).toEqual({ read: 2, total: readers });

		// One who leaves after reading is no longer a reader of the group's day.
		await leaveGroupForUser('m3', group.id);
		expect((await hizbSummary(group.id, 'm2')).hizbReaders).toEqual({ read: 1, total: readers - 1 });
	});

	it('gives every reader today’s read time — a hidden one too, still without the name', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, { hideMemberNames: true });
		vi.setSystemTime(new Date('2026-10-01T11:30:00Z'));
		await readToday('m1', group.id);

		const members = (await getHizbState('m2', group.id)).members;
		const m1 = members.find(member => member.completed);
		expect(m1).toMatchObject({ completedAt: '2026-10-01T11:30:00.000Z', displayName: null, isMe: false });
		expect(members.filter(member => !member.completed).every(member => member.completedAt === null)).toBe(true);
	});
});

describe('the "has read" notice', () => {
	it('with responsible members, goes to the ticked only — whatever anyone’s own switch says', async () => {
		const group = await createPlan();
		// Names shown: responsible members work without hidden names too.
		await updateGroupForUser('owner', group.id, { readSeersEnabled: true, readerSeerUserIds: ['owner', 'm1'] });
		// m1 turned the notice off, m3 turned it on: the group's choice wins both ways.
		await prisma.userSettings.createMany({
			data: [
				{ userId: 'm1', hizbGroupReadsEnabled: false },
				{ userId: 'm3', hizbGroupReadsEnabled: true }
			]
		});

		await readToday('m2', group.id);

		expect(pushedTo()).toEqual(['m1', 'owner']);
		const [row] = await readRows('m1');
		expect(row).toMatchObject({ payload: { readerName: 'M2' } });
		expect(await readRows('m3')).toHaveLength(0);
	});

	it('with names hidden and no responsible members, goes to those who turned it on, without the name', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, { hideMemberNames: true, readerSeerUserIds: ['m1'] });
		await prisma.userSettings.createMany({ data: [{ userId: 'm3', hizbGroupReadsEnabled: true }] });

		await readToday('m2', group.id);

		// The tick means nothing while "Okuma sorumluları" is off.
		expect(pushedTo()).toEqual(['m3']);
		expect((await readRows('m3'))[0]?.payload).toMatchObject({ readerName: '', anonymous: true });
		const push = vi.mocked(sendPushToUser).mock.calls[0]?.[1] as { body?: string };
		expect(push.body).not.toContain('M2');
	});

	it('with names shown, goes to those who turned it on', async () => {
		const group = await createPlan();
		await prisma.userSettings.createMany({
			data: [
				{ userId: 'm1', hizbGroupReadsEnabled: true },
				{ userId: 'm3', hizbGroupReadsEnabled: false }
			]
		});

		await readToday('m2', group.id);

		expect(pushedTo()).toEqual(['m1']);
		// Filed only for those it went to: a large plan group must not file one row per member.
		expect(await readRows('m1')).toHaveLength(1);
		expect(await readRows('m3')).toHaveLength(0);
		expect(await readRows('owner')).toHaveLength(0);
	});

	it('answers to the Hizb switch, not the Cevşen one', async () => {
		const group = await createPlan();
		await prisma.userSettings.createMany({
			data: [
				{ userId: 'm1', cevsenGroupReadsEnabled: true, hizbGroupReadsEnabled: false },
				{ userId: 'm3', cevsenGroupReadsEnabled: false, hizbGroupReadsEnabled: true }
			]
		});

		await readToday('m2', group.id);

		expect(pushedTo()).toEqual(['m3']);
	});

	it('reaches a responsible member whose own Hizb switch is off', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, { readSeersEnabled: true, readerSeerUserIds: ['m1'] });
		await prisma.userSettings.createMany({ data: [{ userId: 'm1', hizbGroupReadsEnabled: false }] });

		await readToday('m2', group.id);

		expect(pushedTo()).toEqual(['m1']);
		expect(await readRows('m1')).toHaveLength(1);
	});

	it('is sent once for a day, however often it is undone and read again', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, { readSeersEnabled: true, readerSeerUserIds: ['owner'] });

		const read = await readToday('m2', group.id);
		await updateHizbAssignment('m2', group.id, read.id, { version: read.version, read: false });
		await readToday('m2', group.id);

		expect(pushedTo()).toEqual(['owner']);
	});

	it('stays quiet for a missed day made up later', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, { readSeersEnabled: true, readerSeerUserIds: ['owner'] });
		const yesterday = (await getHizbState('m2', group.id)).today!;
		vi.setSystemTime(new Date(start.getTime() + 86400000));

		await updateHizbAssignment('m2', group.id, yesterday.id, {
			version: yesterday.version,
			bookPortions: yesterday.boardPortions
		});

		expect(pushedTo()).toEqual([]);
	});

	it('drops the name from a member’s inbox once they are unticked', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, {
			hideMemberNames: true,
			readSeersEnabled: true,
			readerSeerUserIds: ['m1']
		});
		await readToday('m2', group.id);
		expect((await readRows('m1'))[0]?.payload).toMatchObject({ readerName: 'M2' });

		await updateGroupForUser('owner', group.id, { readerSeerUserIds: [] });

		expect((await readRows('m1'))[0]?.payload).toMatchObject({ readerName: '', anonymous: true });
	});

	it('keeps the name hidden once the group is deleted', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, {
			hideMemberNames: true,
			readSeersEnabled: true,
			readerSeerUserIds: ['m1']
		});
		await readToday('m2', group.id);
		await updateGroupForUser('owner', group.id, { readerSeerUserIds: [] });

		await deleteGroupForUser('owner', group.id);

		// The row outlives its group; with no group left to ask, its own mark keeps the name back.
		expect((await readRows('m1'))[0]?.payload).toMatchObject({ readerName: '', anonymous: true });
	});

	it('files a named notice only for those still ticked when it is filed', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, {
			hideMemberNames: true,
			readSeersEnabled: true,
			readerSeerUserIds: ['m1']
		});

		// As if m3 were chosen a moment before an untick landed: the filing checks again.
		const filedFor = await recordNotification({
			groupId: group.id,
			groupName: 'Vakıf',
			hizbRead: { toSeers: true },
			payload: { kind: 'SHARE_READ', range: '1', readerName: 'M2' },
			userIds: ['m1', 'm3']
		});

		expect(filedFor).toEqual(['m1']);
		expect(await readRows('m3')).toHaveLength(0);
	});

	it('files nothing when the switch moved while the notice was on its way', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, { readSeersEnabled: true, readerSeerUserIds: ['owner'] });

		// Prepared while it was off, for someone who had opted in; filed after it went on.
		const filedFor = await recordNotification({
			groupId: group.id,
			groupName: 'Vakıf',
			hizbRead: { toSeers: false },
			payload: { kind: 'SHARE_READ', range: '1', readerName: 'M2' },
			userIds: ['m3']
		});

		expect(filedFor).toEqual([]);
		expect(await readRows('m3')).toHaveLength(0);
	});

	it('keeps the name in a responsible member’s inbox when names are hidden later', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, { readSeersEnabled: true, readerSeerUserIds: ['m1'] });
		await readToday('m2', group.id);

		await updateGroupForUser('owner', group.id, { hideMemberNames: true });

		expect((await readRows('m1'))[0]?.payload).toMatchObject({ readerName: 'M2' });
		// And once m1 is no longer responsible, it is theirs no more.
		await updateGroupForUser('owner', group.id, { readerSeerUserIds: [] });
		expect((await readRows('m1'))[0]?.payload).toMatchObject({ readerName: '', anonymous: true });
	});

	it('pushes the name and the work to the responsible, even with names hidden', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, {
			hideMemberNames: true,
			readSeersEnabled: true,
			readerSeerUserIds: ['owner']
		});

		const read = await readToday('m2', group.id);

		const [call] = vi.mocked(sendPushToUser).mock.calls.filter(([userId]) => userId === 'owner');
		const body = (call?.[1] as { body: string }).body;
		expect(body).toContain('M2');
		// The day's works by name, in the owner's language (English, with no settings of their own).
		expect(body).toContain(hizbWorksOf(read.boardPortions, 'en'));
	});

	it('never tells the reader about their own reading', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, { readSeersEnabled: true, readerSeerUserIds: ['owner', 'm1'] });

		await readToday('m1', group.id);

		expect(pushedTo()).toEqual(['owner']);
		expect(await readRows('m1')).toHaveLength(0);
	});

	it('stops telling a responsible member who left', async () => {
		const group = await createPlan();
		await updateGroupForUser('owner', group.id, { readSeersEnabled: true, readerSeerUserIds: ['owner', 'm1'] });
		await leaveGroupForUser('m1', group.id);

		await readToday('m2', group.id);

		expect(pushedTo()).toEqual(['owner']);
	});
});

describe('an individual plan', () => {
	it('has no responsible members and tells nobody', async () => {
		vi.setSystemTime(start);
		const group = await createGroupForUser(
			'owner',
			'Owner',
			CreateGroupBodySchema.parse({
				name: 'Kendi okumam',
				kind: 'HIZB',
				hizbPlan: 7,
				hizbIndividual: true,
				readSeersEnabled: true,
				visibility: 'PRIVATE',
				cycle: 'DAILY',
				reminderTime: '21:00',
				timezone: 'Europe/Amsterdam'
			})
		);
		// The switch is not taken at creation, nor afterwards.
		expect(group.readSeersEnabled).toBe(false);
		await expect(updateGroupForUser('owner', group.id, { readSeersEnabled: true })).rejects.toMatchObject({
			statusCode: 400
		});

		const today = (await getHizbState('owner', group.id)).today!;
		await updateHizbAssignment('owner', group.id, today.id, {
			version: today.version,
			bookPortions: today.boardPortions
		});

		expect(pushedTo()).toEqual([]);
	});
});
