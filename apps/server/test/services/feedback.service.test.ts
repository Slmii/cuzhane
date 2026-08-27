import prisma from '@db/prisma';
import { createFeedback } from '@services/feedback.service';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';

assertIsTestDatabase(testDatabaseUrl());

const USER = 'test_feedback_user';

beforeEach(async () => {
	await prisma.feedback.deleteMany({});
});

afterAll(async () => {
	await prisma.feedback.deleteMany({});
	await prisma.$disconnect();
});

describe('createFeedback', () => {
	it("stores the message and hands back a reference in the design's shape", async () => {
		const receipt = await createFeedback(USER, {
			topic: 'BUG',
			message: 'The ring stopped animating after I switched groups.'
		});

		// `#CV-4K2P` minus the hash the screen adds — four characters from the unambiguous
		// alphabet, so a sender can read it back over the phone.
		expect(receipt.reference).toMatch(/^CV-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);

		const stored = await prisma.feedback.findUnique({ where: { reference: receipt.reference } });

		expect(stored).toMatchObject({
			userId: USER,
			topic: 'BUG',
			message: 'The ring stopped animating after I switched groups.'
		});
	});

	it('keeps the diagnostics the client attaches without being asked', async () => {
		const receipt = await createFeedback(USER, {
			topic: 'IDEA',
			message: 'A weekly digest of what the group read would be lovely.',
			appVersion: '1.4.0 (218)',
			platform: 'ios',
			locale: 'tr'
		});

		const stored = await prisma.feedback.findUnique({ where: { reference: receipt.reference } });

		expect(stored).toMatchObject({ appVersion: '1.4.0 (218)', platform: 'ios', locale: 'tr' });
	});

	it('files the message even when the account email cannot be resolved', async () => {
		// No Clerk instance answers `test_feedback_user`, which is the point: an unreachable
		// directory must not lose a message that has already been written.
		const receipt = await createFeedback(USER, {
			topic: 'OTHER',
			message: 'Just wanted to say thank you for building this.'
		});

		const stored = await prisma.feedback.findUnique({ where: { reference: receipt.reference } });

		expect(stored?.email).toBeNull();
	});

	it('never hands two messages the same reference', async () => {
		const receipts = await Promise.all(
			Array.from({ length: 12 }, (_, index) =>
				createFeedback(USER, { topic: 'OTHER', message: `Message number ${index} for the developers.` })
			)
		);

		expect(new Set(receipts.map(receipt => receipt.reference)).size).toBe(receipts.length);
	});
});
