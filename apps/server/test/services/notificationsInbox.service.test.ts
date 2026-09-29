import prisma from '@db/prisma';
import {
	getUnreadCountForUser,
	markAllNotificationsReadForUser,
	markNotificationReadForUser
} from '@services/notifications.service';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const ME = 'reader';
const SOMEONE = 'someone';

const inbox = (userId: string, count: number) =>
	Promise.all(
		Array.from({ length: count }, () =>
			prisma.notification.create({ data: { groupName: 'Hatim', kind: 'MEMBER_JOINED', payload: {}, userId } })
		)
	);

beforeEach(async () => {
	await prisma.notification.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('the inbox', () => {
	it('counts only the caller’s unread rows', async () => {
		const [first] = await inbox(ME, 3);
		await inbox(SOMEONE, 2);
		await prisma.notification.update({ where: { id: first!.id }, data: { readAt: new Date() } });

		expect(await getUnreadCountForUser(ME)).toBe(2);
		expect(await getUnreadCountForUser(SOMEONE)).toBe(2);
	});

	it('marks one row read — the caller’s, never someone else’s — and keeps its first reading time', async () => {
		const [mine] = await inbox(ME, 1);
		const [theirs] = await inbox(SOMEONE, 1);

		await markNotificationReadForUser(ME, mine!.id);
		const readAt = (await prisma.notification.findUniqueOrThrow({ where: { id: mine!.id } })).readAt;
		expect(readAt).not.toBeNull();

		// A second tap does not move the time; someone else's id changes nothing.
		await markNotificationReadForUser(ME, mine!.id);
		await markNotificationReadForUser(ME, theirs!.id);
		expect((await prisma.notification.findUniqueOrThrow({ where: { id: mine!.id } })).readAt).toEqual(readAt);
		expect((await prisma.notification.findUniqueOrThrow({ where: { id: theirs!.id } })).readAt).toBeNull();
	});

	it('marks all of the caller’s rows read and leaves everyone else’s', async () => {
		await inbox(ME, 4);
		await inbox(SOMEONE, 3);

		await markAllNotificationsReadForUser(ME);

		expect(await getUnreadCountForUser(ME)).toBe(0);
		expect(await getUnreadCountForUser(SOMEONE)).toBe(3);
	});
});
