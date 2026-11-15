import { toGroupDetail, toInvitePreview } from '@services/groupSerializers';
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
	hideMemberNames: false,
	splitMode: 'ROTATION',
	status: 'RUNNING',
	cycle: 'MONTHLY',
	kind: 'HIZB',
	// A Hizb MONTHLY stores thirty days, but the calendar reads it as a month (`roundLengthFor`).
	roundDays: 30,
	distribution: null,
	maxPerMember: null,
	boundaryPolicy: null,
	hizbPlan: null,
	hizbIndividual: false,
	hizbStartPortion: 1,
	inactivityDays: null,
	inactivitySinceDay: null,
	hizbNext7: 0,
	hizbNext15: 0,
	hizbNext32: 0,
	hizbNextSlot: 1,
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

	it('says whether the group starts itself once it fills', () => {
		const autoStarting = toInvitePreview(group(), [], [owner], 'test_viewer');
		const ownerStarted = toInvitePreview(group({ autoStartWhenFull: false }), [], [owner], 'test_viewer');

		expect(autoStarting.autoStartWhenFull).toBe(true);
		expect(ownerStarted.autoStartWhenFull).toBe(false);
	});
});

describe('member privacy', () => {
	const reader: GroupMember = {
		...owner,
		id: 'member_2',
		userId: 'test_reader',
		displayName: 'Private Reader',
		role: 'MEMBER',
		slotIndex: 1
	};
	const anonymousGroup = () => Object.assign(group(), { hideMemberNames: true });
	const profiles = new Map([[OWNER, { displayName: 'Private Owner', imageUrl: 'https://example.com/owner.jpg' }]]);

	it('hides other members names, photos and account identifiers from members', () => {
		const detail = toGroupDetail(anonymousGroup(), [], [owner, reader], [], reader.userId, [], profiles);
		const other = detail.members[0]!;
		expect(other.displayName).not.toContain('Owner');
		expect(other.imageUrl).toBeNull();
		expect(other.userId).not.toBe(OWNER);
		expect(detail.ownerUserId).toBe(other.userId);
		expect(detail.members[1]?.userId).toBe(reader.userId);
	});

	it('keeps owner management access to members', () => {
		const detail = toGroupDetail(anonymousGroup(), [], [owner, reader], [], OWNER, [], profiles);
		expect(detail.members[1]?.displayName).toBe('Private Reader');
		expect(detail.members[1]?.userId).toBe(reader.userId);
	});

	it('does not expose names in invite previews', () => {
		const preview = toInvitePreview(anonymousGroup(), [], [owner, reader], 'test_outsider');
		expect(preview.createdByName).toBe('');
		expect(preview.memberNames).toEqual([]);
	});

	it('uses the same anonymous identifiers for board reads and members', () => {
		const now = new Date();
		const detail = toGroupDetail(
			anonymousGroup(),
			[
				{
					id: 'b1',
					groupId: 'group_1',
					number: 1,
					assignedUserId: OWNER,
					readByUserId: OWNER,
					readAt: now,
					createdAt: now,
					updatedAt: now
				}
			],
			[owner, reader],
			[],
			reader.userId
		);
		expect(detail.babs[0]?.readByUserId).toBe(detail.members[0]?.userId);
		expect(detail.babs[0]?.assignedUserId).toBe(detail.members[0]?.userId);
		expect(detail.babs[0]?.readByUserId).not.toBe(OWNER);
	});
});
