import { readFileSync } from 'node:fs';
import prisma from '@db/prisma';
import { HIZB_PLAN } from '../../src/content/readingPlans';
import {
	createReadingGroup,
	joinReadingGroup,
	leaveReadingGroup,
	getReadingGroup,
	completeReadingAssignment
} from '@services/readingGroups.service';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';
assertIsTestDatabase(testDatabaseUrl());
const start = new Date('2026-01-01T12:00:00Z');
const at = (days: number) => new Date(start.getTime() + days * 86400000);
const create = () =>
	createReadingGroup('owner', 'Owner', { name: 'Hizb group', cadence: 'WEEKLY', timezone: 'UTC' }, start);
const snapshot = async (id: string) =>
	prisma.readingMembership.findUniqueOrThrow({
		where: { id },
		include: { cycles: { include: { assignments: { orderBy: { ordinal: 'asc' } } }, orderBy: { index: 'asc' } } }
	});
beforeEach(async () => {
	await prisma.readingGroup.deleteMany();
});
afterAll(async () => {
	await prisma.$disconnect();
});

describe('reading groups integration', () => {
	it('references every existing content section without copying or recreating it', () => {
		const data = JSON.parse(
			readFileSync(new URL('../../../web/src/lib/content/hizbulhakaik.data.json', import.meta.url), 'utf8')
		);
		expect(HIZB_PLAN.parts.map(p => p.title)).toEqual(data.sections.map((s: { title: string }) => s.title));
	});
	it('creates independent weekly and monthly plans and preserves Cevsen rows', async () => {
		const before = await prisma.group.count();
		const group = await create();
		expect(group.numberOfParts).toBe(HIZB_PLAN.parts.length);
		expect(group.members[0].joinSequence).toBe(1);
		expect(group.myMemberships[0].cycles[0].assignments).toHaveLength(1);
		expect(group.collective.completedParts).toBe(0);
		const monthly = await createReadingGroup(
			'owner',
			'Owner',
			{ name: 'Monthly', cadence: 'MONTHLY', timezone: 'UTC' },
			start
		);
		expect(monthly.myMemberships[0].cycles[0].endsAt).toEqual(new Date('2026-02-01T12:00:00Z'));
		expect(await prisma.group.count()).toBe(before);
	});
	it('joins before the first rotation and midway without rewriting existing state', async () => {
		const group = await create();
		const id = group.members[0].id;
		await completeReadingAssignment('owner', group.id, group.myMemberships[0].cycles[0].assignments[0].id, start);
		const before = await snapshot(id);
		await joinReadingGroup('b', 'B', group.inviteCode, start);
		expect(await snapshot(id)).toEqual(before);
		await getReadingGroup('owner', group.id, at(3));
		const midway = await snapshot(id);
		await joinReadingGroup('c', 'C', group.inviteCode, at(3));
		expect(await snapshot(id)).toEqual(midway);
		const detail = await getReadingGroup('c', group.id, at(3));
		expect(detail.myMemberships[0].cycles[0].startedAt).toEqual(at(3));
		expect(detail.members.map(m => m.joinSequence)).toEqual([1, 2, 3]);
	});
	it('serializes concurrent joins and balances offsets without consuming duplicate sequences', async () => {
		const group = await create();
		await Promise.all(
			Array.from({ length: 20 }, (_, i) => joinReadingGroup(`u${i}`, `User ${i}`, group.inviteCode, start))
		);
		const detail = await getReadingGroup('owner', group.id, start);
		expect(new Set(detail.members.map(m => m.joinSequence)).size).toBe(21);
		const counts = Array.from(
			{ length: group.numberOfParts },
			(_, i) => detail.members.filter(m => m.currentPartIndex === i).length
		);
		expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
		await Promise.all([
			joinReadingGroup('same', 'Same', group.inviteCode, start),
			joinReadingGroup('same', 'Same', group.inviteCode, start)
		]);
		expect(
			await prisma.readingMembership.count({ where: { groupId: group.id, userId: 'same', active: true } })
		).toBe(1);
	});
	it.each(['first', 'last', 'multiple', 'all'])(
		'preserves history and other members when %s members leave',
		async which => {
			const group = await create();
			for (const user of ['b', 'c']) {
				await joinReadingGroup(user, user, group.inviteCode, start);
			}
			const before = await getReadingGroup('owner', group.id, at(2));
			const complete = before.myMemberships[0].cycles[0].assignments[0];
			await completeReadingAssignment('owner', group.id, complete.id, at(2));
			const ids = before.members.map(m => m.id);
			const snapshots = await Promise.all(ids.map(snapshot));
			const leaving =
				which === 'first'
					? ['owner']
					: which === 'last'
					? ['c']
					: which === 'multiple'
					? ['b', 'c']
					: ['owner', 'b', 'c'];
			for (const user of leaving) {
				await leaveReadingGroup(user, group.id, at(2));
			}
			for (let i = 0; i < ids.length; i++) {
				const after = await snapshot(ids[i]);
				expect(after.rotationOffset).toBe(snapshots[i].rotationOffset);
				expect(after.joinSequence).toBe(snapshots[i].joinSequence);
				expect(after.cycles).toEqual(snapshots[i].cycles);
			}
			const detail = await getReadingGroup('owner', group.id, at(20));
			expect(detail.collective.completedParts).toBe(1);
			for (const user of leaving) {
				const member = await prisma.readingMembership.findFirstOrThrow({
					where: { groupId: group.id, userId: user }
				});
				expect(member.active).toBe(false);
				expect(member.leftAt).toEqual(at(2));
				expect(
					await prisma.readingAssignment.count({
						where: { cycle: { membershipId: member.id }, assignedAt: { gt: at(2) } }
					})
				).toBe(0);
			}
		}
	);
	it('fills a departed gap and appends a rejoin as a new independent membership', async () => {
		const group = await create();
		for (let i = 1; i < group.numberOfParts; i++) {
			await joinReadingGroup(`u${i}`, `U${i}`, group.inviteCode, start);
		}
		const before = await getReadingGroup('owner', group.id, start);
		const old = before.members.find(m => m.userId === 'u3')!;
		await leaveReadingGroup('u3', group.id, start);
		const oldSnapshot = await snapshot(old.id);
		const rejoined = await joinReadingGroup('u3', 'Again', group.inviteCode, start);
		const member = rejoined.members.find(m => m.userId === 'u3')!;
		expect(member.id).not.toBe(old.id);
		expect(member.joinSequence).toBe(group.numberOfParts + 1);
		expect(member.rotationOffset).toBe(old.rotationOffset);
		expect(await snapshot(old.id)).toEqual(oldSnapshot);
		expect(rejoined.myMemberships).toHaveLength(2);
	});
	it('preserves missed readings, forbids repetition, completes late and starts the next cycle once', async () => {
		const group = await create();
		const detail = await getReadingGroup('owner', group.id, at(20));
		const cycle = detail.myMemberships[0].cycles[0];
		expect(cycle.assignments).toHaveLength(group.numberOfParts);
		expect(new Set(cycle.assignments.map(a => a.partIndex)).size).toBe(group.numberOfParts);
		expect(cycle.completedAt).toBeNull();
		expect(detail.myMemberships[0].cycles).toHaveLength(1);
		for (const assignment of cycle.assignments) {
			await completeReadingAssignment('owner', group.id, assignment.id, at(20));
		}
		const done = await getReadingGroup('owner', group.id, at(20));
		expect(done.myMemberships[0].completedCycles).toBe(1);
		expect(done.myMemberships[0].cycles).toHaveLength(2);
		expect(done.myMemberships[0].cycles[1].startedAt).toEqual(at(20));
		expect(done.collective).toEqual({ completedParts: group.numberOfParts, fullReadings: 1, remainderParts: 0 });
	});
	it('makes simultaneous duplicate completion requests idempotent and retains original timestamp', async () => {
		const group = await create();
		const assignment = group.myMemberships[0].cycles[0].assignments[0];
		await Promise.all(
			Array.from({ length: 8 }, () => completeReadingAssignment('owner', group.id, assignment.id, start))
		);
		await completeReadingAssignment('owner', group.id, assignment.id, at(2));
		const detail = await getReadingGroup('owner', group.id, at(2));
		expect(detail.collective.completedParts).toBe(1);
		expect(detail.myMemberships[0].cycles[0].assignments[0].completedAt).toEqual(start);
	});
	it('allows departed members to complete due historical assignments, but outsiders cannot read or complete', async () => {
		const group = await create();
		const assignment = group.myMemberships[0].cycles[0].assignments[0];
		await joinReadingGroup('other', 'Other', group.inviteCode, start);
		await expect(completeReadingAssignment('other', group.id, assignment.id, start)).rejects.toMatchObject({
			statusCode: 404
		});
		await expect(getReadingGroup('outsider', group.id, start)).rejects.toMatchObject({ statusCode: 404 });
		await leaveReadingGroup('owner', group.id, start);
		await completeReadingAssignment('owner', group.id, assignment.id, at(2));
		expect((await getReadingGroup('owner', group.id, at(20))).myMemberships[0].cycles).toHaveLength(1);
	});
});

it('account deletion removes the user data from reading groups without deleting other owners groups', async () => {
	const { deleteAccountForUser } = await import('@services/account.service');
	const owned = await create();
	const other = await createReadingGroup(
		'other',
		'Other',
		{ name: 'Other', cadence: 'WEEKLY', timezone: 'UTC' },
		start
	);
	await joinReadingGroup('owner', 'Owner', other.inviteCode, start);
	await deleteAccountForUser('owner');
	expect(await prisma.readingGroup.findUnique({ where: { id: owned.id } })).toBeNull();
	expect(await prisma.readingMembership.count({ where: { userId: 'owner' } })).toBe(0);
	expect(await prisma.readingGroup.findUnique({ where: { id: other.id } })).not.toBeNull();
});

it.each(['WEEKLY', 'MONTHLY'] as const)(
	'starts the next %s cycle only at its boundary and stamps simultaneous final reads once',
	async cadence => {
		const group = await createReadingGroup('owner', 'Owner', { name: 'Boundary', cadence, timezone: 'UTC' }, start);
		const end = cadence === 'WEEKLY' ? at(7) : new Date('2026-02-01T12:00:00Z');
		const justBefore = new Date(end.getTime() - 1);
		const detail = await getReadingGroup('owner', group.id, justBefore);
		const assignments = detail.myMemberships[0].cycles[0].assignments;
		await Promise.all(assignments.map(a => completeReadingAssignment('owner', group.id, a.id, justBefore)));
		const before = await getReadingGroup('owner', group.id, justBefore);
		expect(before.myMemberships[0].cycles).toHaveLength(1);
		expect(before.myMemberships[0].completedCycles).toBe(1);
		const next = await getReadingGroup('owner', group.id, end);
		expect(next.myMemberships[0].cycles).toHaveLength(2);
		expect(next.myMemberships[0].cycles[1].assignments).toHaveLength(1);
		expect(next.myMemberships[0].cycles[1].assignments[0].partIndex).toBe(assignments[0].partIndex);
		expect(next.myMemberships[0].rotationOffset).toBe(group.myMemberships[0].rotationOffset);
		expect(next.collective.completedParts).toBe(group.numberOfParts);
	}
);

it('retains an empty group and appends a new member after everyone leaves', async () => {
	const group = await create();
	await leaveReadingGroup('owner', group.id, start);
	const before = await snapshot(group.members[0].id);
	const joined = await joinReadingGroup('new', 'New', group.inviteCode, at(40));
	expect(joined.members.map(m => m.joinSequence)).toEqual([2]);
	expect(await snapshot(group.members[0].id)).toEqual(before);
	expect(joined.myMemberships[0].cycles[0].startedAt).toEqual(at(40));
});

it('does not let a missed reading in one membership delay anyone else', async () => {
	const group = await create();
	await joinReadingGroup('reader', 'Reader', group.inviteCode, start);
	const atEnd = await getReadingGroup('reader', group.id, at(7));
	for (const assignment of atEnd.myMemberships[0].cycles[0].assignments) {
		await completeReadingAssignment('reader', group.id, assignment.id, at(7));
	}
	const owner = await getReadingGroup('owner', group.id, at(8));
	const reader = await getReadingGroup('reader', group.id, at(8));
	expect(owner.myMemberships[0].cycles).toHaveLength(1);
	expect(owner.myMemberships[0].completedCycles).toBe(0);
	expect(reader.myMemberships[0].cycles).toHaveLength(2);
	expect(reader.myMemberships[0].completedCycles).toBe(1);
});
