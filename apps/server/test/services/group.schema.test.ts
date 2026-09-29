import { CreateGroupBodySchema, DiscoverQuerySchema, UpdateGroupBodySchema } from '@schemas/group.schema';
import { describe, expect, it } from 'vitest';

const base = { name: 'Hizb Halkası', reminderTime: '21:30' };

/** The paths a rejected body's issues point at — what the create sheet binds its messages to. */
const issuePaths = (body: unknown): string[] => {
	const result = CreateGroupBodySchema.safeParse(body);

	return result.success ? [] : result.error.issues.map(issue => issue.path.join('.'));
};

describe('CreateGroupBodySchema', () => {
	it('defaults an omitted kind to the Cevşen', () => {
		const parsed = CreateGroupBodySchema.parse({ ...base, spots: 10 });

		expect(parsed.kind).toBe('CEVSEN');
	});

	it('refuses a monthly Cevşen, on the cycle', () => {
		expect(issuePaths({ ...base, kind: 'CEVSEN', cycle: 'MONTHLY' })).toEqual(['cycle']);
	});

	it('keeps the Cevşen to its three sizes, on the spots', () => {
		expect(issuePaths({ ...base, kind: 'CEVSEN', spots: 7 })).toEqual(['spots']);
	});

	it('accepts any Hizb size that leaves every seat a portion', () => {
		expect(CreateGroupBodySchema.safeParse({ ...base, kind: 'HIZB', spots: 7 }).success).toBe(true);
		expect(CreateGroupBodySchema.safeParse({ ...base, kind: 'HIZB', spots: 1 }).success).toBe(true);
		expect(CreateGroupBodySchema.safeParse({ ...base, kind: 'HIZB', spots: 33 }).success).toBe(true);
	});

	it('refuses a Hizb seat with nothing to read, on the spots', () => {
		expect(issuePaths({ ...base, kind: 'HIZB', spots: 34 })).toEqual(['spots']);
		expect(issuePaths({ ...base, kind: 'HIZB', spots: 0 })).toEqual(['spots']);
	});

	it('gives the Hizb a monthly round', () => {
		const parsed = CreateGroupBodySchema.parse({ ...base, kind: 'HIZB', spots: 11, cycle: 'MONTHLY' });

		expect(parsed.kind === 'HIZB' && parsed.cycle).toBe('MONTHLY');
	});

	it('keeps the default size valid for a Hizb that names none', () => {
		expect(CreateGroupBodySchema.safeParse({ ...base, kind: 'HIZB' }).success).toBe(true);
	});

	it('refuses a kind it does not know', () => {
		expect(issuePaths({ ...base, kind: 'QURAN' })).toEqual(['kind']);
	});

	it("knows the Kur'an hatim, which picks cüz rather than a size", () => {
		expect(CreateGroupBodySchema.safeParse({ ...base, kind: 'HATIM', cuzNumbers: [1] }).success).toBe(true);
	});

	it('refuses a personal plan or individual reading on any kind but the Hizb', () => {
		expect(issuePaths({ ...base, kind: 'CEVSEN', hizbPlan: 7 })).toEqual(['hizbPlan']);
		expect(issuePaths({ ...base, kind: 'HATIM', cuzNumbers: [1], hizbIndividual: true })).toEqual([
			'hizbIndividual'
		]);
	});
});

describe('DiscoverQuerySchema', () => {
	it('filters on a monthly round', () => {
		expect(DiscoverQuerySchema.parse({ cycle: 'MONTHLY' }).cycle).toBe('MONTHLY');
	});
});

describe('UpdateGroupBodySchema — responsible members', () => {
	it('takes the switch on its own, and up to three members', () => {
		expect(UpdateGroupBodySchema.safeParse({ readSeersEnabled: true }).success).toBe(true);
		expect(UpdateGroupBodySchema.safeParse({ readerSeerUserIds: ['a', 'b', 'c'] }).success).toBe(true);
		// Unticking everyone is a choice too.
		expect(UpdateGroupBodySchema.safeParse({ readerSeerUserIds: [] }).success).toBe(true);
	});

	it('refuses a fourth member and ids that are not ids', () => {
		expect(UpdateGroupBodySchema.safeParse({ readerSeerUserIds: ['a', 'b', 'c', 'd'] }).success).toBe(false);
		expect(UpdateGroupBodySchema.safeParse({ readerSeerUserIds: [''] }).success).toBe(false);
		expect(UpdateGroupBodySchema.safeParse({ readerSeerUserIds: ['x'.repeat(65)] }).success).toBe(false);
		expect(UpdateGroupBodySchema.safeParse({ readSeersEnabled: 'yes' }).success).toBe(false);
	});
});
