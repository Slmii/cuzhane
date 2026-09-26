import { toInvitePreview } from '@services/groupSerializers';
import { describe, expect, it } from 'vitest';
import type { Group, GroupMember } from '../../src/generated/prisma/client';

/*
 * The serializer is a pure function of the rows it is handed, so these build the rows in memory
 * rather than through the database.
 */

const OWNER = 'test_owner';
const TIME_ZONE = 'Europe/Istanbul';
/** 01:00 on 31 January in Istanbul — the day a monthly group rolls on, every month it can. */
const STARTED_ON_THE_31ST = new Date('2026-01-30T22:00:00.000Z');

const group = (overrides: Partial<Group> = {}): Group => ({
	id: 'group_1',
	ownerUserId: OWNER,
	name: 'Hizb Halkası',
	dedication: null,
	visibility: 'OPEN',
	splitMode: 'ROTATION',
	status: 'RUNNING',
	cycle: 'MONTHLY',
	kind: 'HIZB',
	spots: 11,
	inviteCode: 'PREV0001',
	openToJoin: true,
	timezone: TIME_ZONE,
	reminderEnabled: true,
	reminderTime: '21:30',
	nudgeEnabled: true,
	startedAt: STARTED_ON_THE_31ST,
	autoStartWhenFull: true,
	roundIndex: 1,
	roundStartedAt: new Date('2026-02-27T21:00:00.000Z'),
	startsAt: STARTED_ON_THE_31ST,
	endsAt: null,
	completedAt: null,
	createdAt: STARTED_ON_THE_31ST,
	updatedAt: STARTED_ON_THE_31ST,
	...overrides
});

const owner: GroupMember = {
	id: 'member_1',
	groupId: 'group_1',
	userId: OWNER,
	displayName: 'Owner',
	role: 'OWNER',
	slotIndex: 0,
	joinedAt: STARTED_ON_THE_31ST
};

describe('toInvitePreview', () => {
	it('carries when the hatim began, so a monthly preview can name the start’s day', () => {
		const preview = toInvitePreview(group(), [], [owner], 'test_viewer');

		expect(preview.startedAt).toBe(STARTED_ON_THE_31ST.toISOString());
	});

	it('carries no start while the group is still gathering', () => {
		const preview = toInvitePreview(
			group({ status: 'GATHERING', startedAt: null, roundStartedAt: null, roundIndex: 0 }),
			[],
			[owner],
			'test_viewer'
		);

		expect(preview.startedAt).toBeNull();
		expect(preview.roundEndsAt).toBeNull();
	});
});
