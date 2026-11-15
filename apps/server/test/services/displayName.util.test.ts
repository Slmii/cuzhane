import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const claims: { value: Record<string, unknown> | null } = { value: null };

vi.mock('@clerk/express', () => ({
	getAuth: () => ({ sessionClaims: claims.value })
}));

const { resolveDisplayName } = await import('@utils/displayName');

const request = {} as Request;

beforeEach(() => {
	claims.value = null;
});

describe('resolveDisplayName', () => {
	it('uses the name, then the first name', () => {
		claims.value = { name: ' Ayşe Yılmaz ', firstName: 'Ayşe', email: 'ayse@example.com' };
		expect(resolveDisplayName(request)).toBe('Ayşe Yılmaz');

		claims.value = { firstName: 'Ayşe', email: 'ayse@example.com' };
		expect(resolveDisplayName(request)).toBe('Ayşe');
	});

	it('never falls back to the email address', () => {
		claims.value = { email: 'ayse@example.com' };

		expect(resolveDisplayName(request)).toBe('Member');
	});
});
