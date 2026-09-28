import { describe, expect, it } from 'vitest';
import { createGroupSchema } from './group.schema';

// The message is the key itself, so a test can say which message landed without Turkish copy.
const schema = createGroupSchema(key => key);

const issuePaths = (input: Record<string, unknown>) => {
	const result = schema.safeParse({ name: 'Hatim', ...input });

	return result.success ? [] : result.error.issues.map(issue => issue.path.join('.'));
};

describe('createGroupSchema', () => {
	it('accepts flexible groups without restricting their internal portion count to seat capacities', () => {
		expect(
			schema.safeParse({ name: 'Open reading', kind: 'CEVSEN', spots: 100, splitMode: 'FLEXIBLE' }).success
		).toBe(true);
	});
	it('reads a group with no kind as the Cevşen', () => {
		const result = schema.safeParse({ name: 'Hatim' });

		expect(result.success && result.data.kind).toBe('CEVSEN');
	});

	it('accepts a monthly Hizb group of seven', () => {
		expect(schema.safeParse({ name: 'Hatim', kind: 'HIZB', spots: 7, cycle: 'MONTHLY' }).success).toBe(true);
	});

	it('accepts a Cevşen group on one of its own sizes and cycles', () => {
		expect(schema.safeParse({ name: 'Hatim', kind: 'CEVSEN', spots: 10, cycle: 'WEEKLY' }).success).toBe(true);
	});

	it('refuses a monthly Cevşen group, on the cycle', () => {
		expect(issuePaths({ kind: 'CEVSEN', cycle: 'MONTHLY' })).toEqual(['cycle']);
	});

	it('refuses a Cevşen group of seven, on the spots', () => {
		expect(issuePaths({ kind: 'CEVSEN', spots: 7 })).toEqual(['spots']);
	});

	it('refuses a Hizb group with more seats than portions, on the spots', () => {
		expect(issuePaths({ kind: 'HIZB', spots: 34 })).toEqual(['spots']);
	});

	it('refuses a Hizb group with no seats at all', () => {
		expect(issuePaths({ kind: 'HIZB', spots: 0 })).toEqual(['spots']);
	});

	it('asks a hatim for neither spots nor a cycle — it has a round length instead', () => {
		expect(issuePaths({ kind: 'HATIM', spots: 7, cycle: 'CUSTOM', roundDays: 15 })).toEqual([]);
	});

	it('puts the message under the field it is about', () => {
		const result = schema.safeParse({ name: 'Hatim', kind: 'CEVSEN', spots: 7 });

		expect(result.success ? null : result.error.issues[0]?.message).toBe('fieldRequired');
	});
});

describe('individual Hizb creation', () => {
	it('keeps the individual choice and starting portion', () => {
		const result = schema.parse({
			name: 'My reading',
			kind: 'HIZB',
			hizbIndividual: true,
			hizbPlan: '15',
			hizbStartPortion: 12
		});
		expect(result).toMatchObject({ hizbIndividual: true, hizbStartPortion: 12 });
	});
	it('rejects an invalid start or a mixed individual plan', () => {
		expect(issuePaths({ kind: 'HIZB', hizbIndividual: true, hizbPlan: '7', hizbStartPortion: 8 })).toContain(
			'hizbStartPortion'
		);
		expect(issuePaths({ kind: 'HIZB', hizbIndividual: true, hizbPlan: '0' })).toContain('hizbPlan');
	});
});
