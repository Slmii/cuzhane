import prisma from '@db/prisma';
import { createGroupForUser } from '@services/groups.service';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const OWNER = 'test_owner';

const base = {
	name: 'Ramazan Hatmi',
	reminderEnabled: true,
	reminderTime: '21:30',
	timezone: 'Europe/Istanbul',
	visibility: 'OPEN' as const
};

beforeEach(async () => {
	await prisma.cuzHolding.deleteMany();
	await prisma.groupMember.deleteMany();
	await prisma.groupBab.deleteMany();
	await prisma.group.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe('creating a hatim (Q1 · QC2 · QC3)', () => {
	it('seeds thirty units and pins the seat cap to thirty', async () => {
		const group = await createGroupForUser(OWNER, 'Selami', {
			...base,
			boundaryPolicy: 'KEEP',
			cuzNumbers: [7, 22],
			distribution: 'FREE_PICK',
			kind: 'HATIM',
			maxPerMember: 3,
			roundDays: 30
		});

		const row = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });

		expect(await prisma.groupBab.count({ where: { groupId: group.id } })).toBe(30);
		// Full means "every cüz is taken", so the seat cap is only the ceiling `slotIndex`
		// needs — never a divisor of anything.
		expect(row.spots).toBe(30);
		expect(row.maxPerMember).toBe(3);
		expect(row.boundaryPolicy).toBe('KEEP');
		expect(row.distribution).toBe('FREE_PICK');

		// The creator holds what QC4 picked, from round 0 — a hatim has no derivable share,
		// so a group created without these rows has an owner who reads nothing.
		const holdings = await prisma.cuzHolding.findMany({
			orderBy: { cuzNumber: 'asc' },
			where: { groupId: group.id }
		});

		expect(holdings.map(holding => holding.cuzNumber)).toEqual([7, 22]);
		expect(holdings.every(holding => holding.userId === OWNER && holding.roundIndex === 0)).toBe(true);
	});

	it('refuses a hatim whose creator took no cüz', () => {
		// The same rule joining obeys: you cannot be in a hatim and hold nothing.
		expect(() => CreateGroupBodySchema.parse({ ...base, cuzNumbers: [], kind: 'HATIM' })).toThrow();
	});

	it('derives the cadence label from the length QC3 sent', async () => {
		const lengths = [1, 7, 30, 10] as const;
		const cycles: string[] = [];

		for (const roundDays of lengths) {
			const group = await createGroupForUser(OWNER, 'Selami', {
				...base,
				boundaryPolicy: 'REPICK',
				cuzNumbers: [1],
				distribution: 'FREE_PICK',
				kind: 'HATIM',
				maxPerMember: 1,
				roundDays
			});

			const row = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });

			cycles.push(row.cycle);
			expect(row.roundDays).toBe(roundDays);
		}

		// The three presets keep their names; a typed number is CUSTOM, which no `ROUND_DAYS`
		// lookup could have answered for.
		expect(cycles).toEqual(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']);
	});

	it('still creates a Cevşen group from a body with no kind at all', () => {
		// Every already-installed app sends exactly this. A discriminated union rejects it
		// unless the discriminator is filled in first — which is what the preprocess does.
		const parsed = CreateGroupBodySchema.parse({ ...base, cycle: 'WEEKLY', spots: 10 });

		expect(parsed).toMatchObject({ kind: 'CEVSEN', spots: 10 });
	});

	it('drops a setting belonging to the other kind rather than acting on it', () => {
		// Stripped, not rejected — `.strict()` is unavailable while the shipped client posts an
		// `autoStartWhenFull` this schema never declared. What matters is that neither value
		// survives into the service, where it would be immutably wrong for the group's life.
		expect(CreateGroupBodySchema.parse({ ...base, kind: 'CEVSEN', maxPerMember: 3 })).not.toHaveProperty(
			'maxPerMember'
		);
		expect(CreateGroupBodySchema.parse({ ...base, cuzNumbers: [1], kind: 'HATIM', spots: 10 })).not.toHaveProperty(
			'spots'
		);
	});
});
