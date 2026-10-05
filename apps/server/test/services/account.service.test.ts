import prisma from '@db/prisma';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import { deleteAccountForUser } from '@services/account.service';
import { createGroupForUser } from '@services/groups.service';
import { joinGroupForUser } from '@services/groupMembership.service';
import { getHizbState, updateHizbAssignment } from '@services/hizbReading.service';
import { DEFAULT_TIME_ZONE } from '@utils/rounds';
import { CUZ_COUNT } from '@utils/units';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'owner';
const LEAVER = 'leaver';
const OTHER = 'other';

let codes = 0;

/** A running group with its board, owned by `ownerUserId`, with the given members in seats 0… */
const createGroup = async (kind: 'CEVSEN' | 'HATIM', ownerUserId: string, memberIds: string[]) => {
	const unitCount = kind === 'HATIM' ? CUZ_COUNT : 100;
	const group = await prisma.group.create({
		data: {
			...(kind === 'HATIM' ? { boundaryPolicy: 'KEEP' as const, distribution: 'FREE_PICK' as const } : {}),
			cycle: 'DAILY',
			inviteCode: `A${String(++codes).padStart(7, '0')}`,
			kind,
			name: 'Account Hatmi',
			ownerUserId,
			roundDays: 1,
			roundIndex: 0,
			roundStartedAt: new Date(),
			spots: kind === 'HATIM' ? CUZ_COUNT : 10,
			splitMode: 'FIXED',
			startedAt: new Date(),
			startsAt: new Date(),
			status: 'RUNNING',
			timezone: DEFAULT_TIME_ZONE
		}
	});

	await prisma.groupBab.createMany({
		data: Array.from({ length: unitCount }, (_, index) => ({ groupId: group.id, number: index + 1 }))
	});
	await prisma.groupMember.createMany({
		data: [ownerUserId, ...memberIds].map((userId, slotIndex) => ({
			displayName: userId,
			groupId: group.id,
			role: slotIndex === 0 ? ('OWNER' as const) : ('MEMBER' as const),
			slotIndex,
			userId
		}))
	});

	return group;
};

/** Marks babs read by `userId` on the board and in the record, as `recordRead` would. */
const read = async (groupId: string, userId: string, numbers: number[]) => {
	await prisma.groupBab.updateMany({
		where: { groupId, number: { in: numbers } },
		data: { readAt: new Date(), readByUserId: userId }
	});
	await prisma.babRead.createMany({
		data: numbers.map(babNumber => ({ babNumber, groupId, roundIndex: 0, userId }))
	});
};

/** The account's own rows outside any group: a device, an inbox entry, settings and a message. */
const personalRows = async (userId: string) => {
	await prisma.pushToken.create({ data: { token: `ExponentPushToken[${userId}]`, userId } });
	await prisma.notification.create({
		data: { groupName: 'Account Hatmi', kind: 'MEMBER_JOINED', payload: {}, userId }
	});
	await prisma.userSettings.create({ data: { userId } });
	await prisma.feedback.create({
		data: { message: 'Hello', reference: `CV-${userId.slice(0, 4).toUpperCase()}`, topic: 'IDEA', userId }
	});
};

beforeEach(async () => {
	vi.useRealTimers();
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
	await prisma.pushToken.deleteMany();
	await prisma.notification.deleteMany();
	await prisma.userSettings.deleteMany();
	await prisma.feedback.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('deleting an account', () => {
	it('removes the groups it owns, board and members with them, and nobody else’s', async () => {
		const owned = await createGroup('CEVSEN', LEAVER, [OTHER]);
		const kept = await createGroup('CEVSEN', OTHER, []);

		await deleteAccountForUser(LEAVER);

		expect(await prisma.group.findUnique({ where: { id: owned.id } })).toBeNull();
		expect(await prisma.groupBab.count({ where: { groupId: owned.id } })).toBe(0);
		expect(await prisma.groupMember.count({ where: { groupId: owned.id } })).toBe(0);
		expect(await prisma.group.findUnique({ where: { id: kept.id } })).not.toBeNull();
		expect(await prisma.groupBab.count({ where: { groupId: kept.id } })).toBe(100);
	});

	it('frees a Cevşen seat and its pool claim, and leaves every read standing', async () => {
		const group = await createGroup('CEVSEN', OWNER, [LEAVER]);
		await read(group.id, LEAVER, [1, 2]);
		await read(group.id, OWNER, [11, 12]);
		// A block volunteered for out of the pool this round.
		await prisma.groupBab.updateMany({
			where: { groupId: group.id, number: { in: [91, 92] } },
			data: { assignedUserId: LEAVER }
		});

		await deleteAccountForUser(LEAVER);

		expect(await prisma.groupMember.findMany({ where: { groupId: group.id } })).toEqual([
			expect.objectContaining({ slotIndex: 0, userId: OWNER })
		]);
		expect(await prisma.groupBab.count({ where: { groupId: group.id, assignedUserId: { not: null } } })).toBe(0);
		// The reads were facts about the group: the leaver's and the owner's alike.
		expect(await prisma.groupBab.count({ where: { groupId: group.id, readAt: { not: null } } })).toBe(4);
		expect(await prisma.babRead.count({ where: { groupId: group.id } })).toBe(4);
	});

	it('keeps a finished round finished', async () => {
		const group = await createGroup('CEVSEN', OWNER, [LEAVER]);
		await read(
			group.id,
			LEAVER,
			Array.from({ length: 100 }, (_, index) => index + 1)
		);
		const completedAt = new Date('2026-09-01T10:00:00Z');
		await prisma.group.update({ where: { id: group.id }, data: { completedAt } });

		await deleteAccountForUser(LEAVER);

		expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).completedAt).toEqual(completedAt);
	});

	it('takes a Kur’an member’s holdings for every round, and their round skips, but no one else’s', async () => {
		const group = await createGroup('HATIM', OWNER, [LEAVER]);
		await prisma.cuzHolding.createMany({
			data: [
				{ cuzNumber: 1, groupId: group.id, roundIndex: 0, userId: LEAVER },
				{ cuzNumber: 2, groupId: group.id, roundIndex: 1, userId: LEAVER },
				{ cuzNumber: 3, groupId: group.id, roundIndex: 2, userId: LEAVER },
				{ cuzNumber: 4, groupId: group.id, roundIndex: 0, userId: OWNER }
			]
		});
		await prisma.cuzRoundSkip.create({ data: { groupId: group.id, roundIndex: 1, userId: LEAVER } });

		await deleteAccountForUser(LEAVER);

		expect(await prisma.cuzHolding.findMany({ where: { groupId: group.id } })).toEqual([
			expect.objectContaining({ cuzNumber: 4, userId: OWNER })
		]);
		expect(await prisma.cuzRoundSkip.count({ where: { userId: LEAVER } })).toBe(0);
	});

	it('closes a Hizb plan enrollment rather than deleting it, so its reading still counts', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
		const group = await createGroupForUser(
			OTHER,
			'Other',
			CreateGroupBodySchema.parse({
				cycle: 'DAILY',
				hizbPlan: 32,
				kind: 'HIZB',
				name: 'Plan',
				reminderTime: '21:00',
				timezone: 'Europe/Amsterdam',
				visibility: 'OPEN'
			})
		);
		await joinGroupForUser(LEAVER, 'Leaver', group.id);
		const today = (await getHizbState(LEAVER, group.id)).today!;
		await updateHizbAssignment(LEAVER, group.id, today.id, { read: true, version: 0 });

		await deleteAccountForUser(LEAVER);

		const enrollment = await prisma.hizbEnrollment.findFirstOrThrow({
			where: { groupId: group.id, userId: LEAVER }
		});
		expect(enrollment).toMatchObject({ reason: 'LEFT' });
		expect(enrollment.endDay).not.toBeNull();
		expect(
			await prisma.hizbAssignment.count({ where: { enrollmentId: enrollment.id, completedAt: { not: null } } })
		).toBe(1);
		expect(await prisma.groupMember.count({ where: { groupId: group.id, userId: LEAVER } })).toBe(0);
	});

	it('removes the account’s devices, inbox, settings and feedback, and only its own', async () => {
		await personalRows(LEAVER);
		await personalRows(OTHER);

		await deleteAccountForUser(LEAVER);

		for (const count of [
			prisma.pushToken.count({ where: { userId: LEAVER } }),
			prisma.notification.count({ where: { userId: LEAVER } }),
			prisma.userSettings.count({ where: { userId: LEAVER } }),
			prisma.feedback.count({ where: { userId: LEAVER } })
		]) {
			expect(await count).toBe(0);
		}
		for (const count of [
			prisma.pushToken.count({ where: { userId: OTHER } }),
			prisma.notification.count({ where: { userId: OTHER } }),
			prisma.userSettings.count({ where: { userId: OTHER } }),
			prisma.feedback.count({ where: { userId: OTHER } })
		]) {
			expect(await count).toBe(1);
		}
	});
});
