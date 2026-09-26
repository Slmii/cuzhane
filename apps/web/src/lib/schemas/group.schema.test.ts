import { describe, expect, it } from 'vitest';
import { createGroupSchema } from './group.schema';

// The message is the key itself, so a test can say which message landed without Turkish copy.
const schema = createGroupSchema(key => key);

const issuePaths = (input: Record<string, unknown>) => {
	const result = schema.safeParse({ name: 'Hatim', ...input });

	return result.success ? [] : result.error.issues.map(issue => issue.path.join('.'));
};

describe('createGroupSchema', () => {
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

	it('puts the message under the field it is about', () => {
		const result = schema.safeParse({ name: 'Hatim', kind: 'CEVSEN', spots: 7 });

		expect(result.success ? null : result.error.issues[0]?.message).toBe('fieldRequired');
	});
});
