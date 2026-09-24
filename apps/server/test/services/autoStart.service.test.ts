import prisma from '@db/prisma';
import { joinGroupForUser } from '@services/groupMembership.service';
import { createGroupForUser } from '@services/groups.service';
import { DEFAULT_TIME_ZONE } from '@utils/rounds';
import { CUZ_COUNT } from '@utils/units';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** A gathering group with its owner seated — and, for a hatim, holding `ownerCuz`. */
const gathering = async ({
	autoStartWhenFull = true,
	kind,
	ownerCuz = [],
	spots
}: {
	autoStartWhenFull?: boolean;
	kind: 'CEVSEN' | 'HATIM';
	ownerCuz?: number[];
	spots: number;
}) => {
	const isHatim = kind === 'HATIM';
	const group = await prisma.group.create({
		data: {
			autoStartWhenFull,
			boundaryPolicy: isHatim ? 'KEEP' : null,
			cycle: 'WEEKLY',
			distribution: isHatim ? 'FREE_PICK' : null,
			inviteCode: `A${Math.floor(performance.now() * 1000)
				.toString(36)
				.toUpperCase()
				.slice(-7)}`,
			kind,
			name: 'Otomatik',
			openToJoin: true,
			ownerUserId: OWNER,
			roundDays: 7,
			roundIndex: 0,
			spots,
			splitMode: isHatim ? 'FIXED' : 'ROTATION',
			status: 'GATHERING',
			timezone: DEFAULT_TIME_ZONE,
			visibility: 'OPEN'
		}
	});

	await prisma.groupBab.createMany({
		data: range(1, isHatim ? CUZ_COUNT : 100).map(number => ({ groupId: group.id, number }))
	});
	await prisma.groupMember.create({
		data: { displayName: 'Owner', groupId: group.id, role: 'OWNER', slotIndex: 0, userId: OWNER }
	});

	if (ownerCuz.length > 0) {
		await prisma.cuzHolding.createMany({
			data: ownerCuz.map(cuzNumber => ({ cuzNumber, groupId: group.id, roundIndex: 0, userId: OWNER }))
		});
	}

	return group;
};

const statusOf = async (groupId: string) => (await prisma.group.findUniqueOrThrow({ where: { id: groupId } })).status;

beforeEach(async () => {
	await prisma.cuzHolding.deleteMany();
	await prisma.groupMember.deleteMany();
	await prisma.groupBab.deleteMany();
	await prisma.group.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

/**
 * **"Full" means something different for each kind**, and auto-start has to ask the right
 * question: a Cevşen group is full when every seat is taken, a hatim when all thirty cüz are.
 * A hatim's `spots` is thirty only because `slotIndex` needs a ceiling, so counting members
 * against it asked for thirty people — a hatim of five members holding every cüz never started.
 */
describe('starting on its own once full', () => {
	it('a Cevşen group starts when its last seat is taken, and not before', async () => {
		const group = await gathering({ kind: 'CEVSEN', spots: 3 });

		await joinGroupForUser('test_a', 'A', group.id);
		expect(await statusOf(group.id)).toBe('GATHERING');

		await joinGroupForUser('test_b', 'B', group.id);
		expect(await statusOf(group.id)).toBe('RUNNING');
	});

	it('a hatim starts when the last cüz is taken, however few members hold them', async () => {
		const group = await gathering({ kind: 'HATIM', ownerCuz: range(1, 20), spots: CUZ_COUNT });

		await joinGroupForUser('test_a', 'A', group.id, range(21, 30));

		expect(await statusOf(group.id)).toBe('RUNNING');
	});

	it('a hatim keeps gathering while any cüz is still free', async () => {
		const group = await gathering({ kind: 'HATIM', ownerCuz: range(1, 20), spots: CUZ_COUNT });

		await joinGroupForUser('test_a', 'A', group.id, range(21, 29));

		expect(await statusOf(group.id)).toBe('GATHERING');
	});

	it('a hatim with the option off never starts on its own', async () => {
		const group = await gathering({
			autoStartWhenFull: false,
			kind: 'HATIM',
			ownerCuz: range(1, 20),
			spots: CUZ_COUNT
		});

		await joinGroupForUser('test_a', 'A', group.id, range(21, 30));

		expect(await statusOf(group.id)).toBe('GATHERING');
	});

	it('a hatim whose owner takes all thirty starts as it is created', async () => {
		const created = await createGroupForUser(OWNER, 'Owner', {
			boundaryPolicy: 'KEEP',
			cuzNumbers: range(1, CUZ_COUNT),
			distribution: 'FREE_PICK',
			kind: 'HATIM',
			maxPerMember: null,
			name: 'Tek Başına',
			reminderEnabled: false,
			reminderTime: '21:30',
			roundDays: 7,
			timezone: 'Europe/Istanbul',
			visibility: 'OPEN'
		});

		expect(await statusOf(created.id)).toBe('RUNNING');
	});
});
