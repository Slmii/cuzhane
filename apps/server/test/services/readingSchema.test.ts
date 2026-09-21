import { describe, expect, it } from 'vitest';
import { CreateReadingGroupSchema, JoinReadingGroupSchema } from '@schemas/reading.schema';

describe('reading API inputs', () => {
	it('accepts weekly/monthly and validates timezone', () => {
		for (const cadence of ['WEEKLY', 'MONTHLY']) {
			expect(
				CreateReadingGroupSchema.safeParse({ name: 'Group', cadence, timezone: 'Europe/Amsterdam' }).success
			).toBe(true);
		}
		for (const body of [
			{ name: '' },
			{ name: 'Group', cadence: 'DAILY' },
			{ name: 'Group', timezone: 'unknown' },
			{ name: 'Group', numberOfParts: 7 }
		]) {
			expect(CreateReadingGroupSchema.safeParse(body).success).toBe(false);
		}
	});
	it('normalizes and requires a full invite code', () => {
		expect(JoinReadingGroupSchema.parse({ inviteCode: 'abcd-2345' }).inviteCode).toBe('ABCD2345');
		expect(JoinReadingGroupSchema.safeParse({ inviteCode: 'bad' }).success).toBe(false);
	});
});
