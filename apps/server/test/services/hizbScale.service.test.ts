import prisma from '@db/prisma';
import { CreateGroupBodySchema } from '@schemas/group.schema';
import { createGroupForUser, discoverGroups } from '@services/groups.service';
import { joinGroupForUser, leaveGroupForUser } from '@services/groupMembership.service';
import {
	enrollHizb,
	getHizbHistoryDay,
	getHizbHistoryDays,
	getHizbState,
	hizbSummary,
	updateHizbAssignment
} from '@services/hizbReading.service';
import { PLAN_SPANS, PLAN_VERSION, portionForDay, spansFor } from '@utils/hizbPlans';
import { civilDayNumber } from '@utils/rounds';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertIsTestDatabase, testDatabaseUrl } from '../support/testDatabase';
vi.mock('@utils/memberProfiles', () => ({ getMemberProfiles: async () => new Map(), FALLBACK_DISPLAY_NAME: 'Member' }));
vi.mock('@services/push.service', () => ({ sendPushToUser: async () => 0 }));
/** Every statement the services send, counted — transactions and raw SQL included. */
const sent = vi.hoisted(() => ({ queries: 0 }));
vi.mock('@db/prisma', async importOriginal => {
	const { default: client } = await importOriginal<typeof import('@db/prisma')>();
	return {
		default: client.$extends({
			query: {
				$allOperations: ({ args, query }) => {
					sent.queries += 1;
					return query(args);
				}
			}
		})
	};
});
assertIsTestDatabase(testDatabaseUrl());

/*
 * A Hizb plan group has no seat cap, so a popular one can hold hundreds of readers. The first
 * test builds its group through the real join path, twenty joins at a time as a busy invite
 * would; the rest seed the same rows in bulk (`seedReaders`) so the suite stays quick, and
 * then drive the real services on top.
 *
 * **What is asserted is the number of statements a call sends, not its time.** A query per member
 * or a per-member loop over the database is what makes a big group slow, and it shows up as a
 * count that grows with the group; a clock also measures whatever else the machine is doing, and
 * failed at 14× its usual time on a laptop running two simulators. The counts are the same at
 * 100, 200 and 500 readers; the budgets sit just above them, far below the smallest group.
 *
 * Times are still printed for reading. Measured locally (Apple silicon, Postgres in Docker),
 * readers → ms:
 *   getHizbState, one member          100 → ~25   200 → ~20   500 → ~40
 *   getHizbState, a month all read    100 → ~70   200 → ~45   500 → ~95  (was ~200 at 500)
 *   hizbSummary                       100 → ~8    200 → ~8    500 → ~20  (~55 a month all read)
 *   discoverGroups, one group         100 → ~15   200 → ~15   500 → ~50
 *   removing the idle 90%             100 → ~10   200 → ~15   500 → ~25  (was ~680 at 500)
 *   one join, returning detail        100 → ~29   200 → ~40   500 → ~75
 */
const queryBudget = { state: 20, summary: 10, discover: 15, expire: 12, historyDays: 10, historyDay: 12 };
const start = new Date('2026-10-01T10:00:00Z');
const day = (n: number) => new Date(start.getTime() + n * 86400000);
const ZONE = 'Europe/Amsterdam';
const ALL_SPANS = PLAN_SPANS.map((_, i) => i);
const BATCH = 20;

const create = async (plan: number, options: { inactivityDays?: number } = {}) => {
	vi.setSystemTime(start);
	return createGroupForUser(
		'owner',
		'Owner',
		CreateGroupBodySchema.parse({
			name: 'Big plan group',
			kind: 'HIZB',
			hizbPlan: plan,
			inactivityDays: options.inactivityDays ?? null,
			visibility: 'OPEN',
			cycle: 'DAILY',
			reminderTime: '21:00',
			timezone: ZONE
		})
	);
};
const reader = (i: number) => `reader${i}`;
const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);
const ascending = (values: readonly number[]) => [...values].sort((a, b) => a - b);
const counterFor = (plan: number) => (plan === 7 ? 'hizbNext7' : plan === 15 ? 'hizbNext15' : 'hizbNext33');

/** Joins readers `from`…`from + count - 1` through the service, `BATCH` at a time concurrently. */
const joinMany = async (groupId: string, from: number, count: number) => {
	for (let i = from; i < from + count; i += BATCH) {
		const batch = range(i, Math.min(BATCH, from + count - i));
		await Promise.all(batch.map(n => joinGroupForUser(reader(n), `Reader ${n}`, groupId)));
	}
};
/**
 * The rows `count` joins leave behind, written in bulk: a member row per reader and, on a fixed
 * plan, an enrollment in join order — seat and ordinal from `hizbNextSlot` (a join takes one of
 * each), sequence from the plan's own counter. Reader `n` holds sequence `n` behind the owner's 0.
 */
const seedReaders = async (groupId: string, count: number) => {
	const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
	const today = civilDayNumber(new Date(), ZONE);
	const plan = group.hizbPlan!;
	await prisma.groupMember.createMany({
		data: range(1, count).map((n, i) => ({
			groupId,
			userId: reader(n),
			displayName: `Reader ${n}`,
			role: 'MEMBER' as const,
			slotIndex: group.hizbNextSlot + (plan === 0 ? i : 2 * i)
		}))
	});
	if (plan === 0) {
		await prisma.group.update({ where: { id: groupId }, data: { hizbNextSlot: { increment: count } } });
		return;
	}
	await prisma.hizbEnrollment.createMany({
		data: range(1, count).map((n, i) => ({
			groupId,
			userId: reader(n),
			planDays: plan,
			planVersion: PLAN_VERSION,
			sequence: group[counterFor(plan)] + i,
			ordinal: group.hizbNextSlot + 2 * i + 1,
			joinedDay: today,
			generatedThrough: today - 1
		}))
	});
	await prisma.group.update({
		where: { id: groupId },
		data: { hizbNextSlot: { increment: 2 * count }, [counterFor(plan)]: { increment: count } }
	});
};
/** Marks a reading read, meeting whatever repetition gates its portion has. */
type Reading = Awaited<ReturnType<typeof getHizbState>>['missed'][number];
const markRead = (userId: string, groupId: string, a: Reading) =>
	updateHizbAssignment(userId, groupId, a.id, {
		version: a.version,
		read: true,
		...(a.requiresSekine ? { repetitions: 19 } : {}),
		...(a.requiresDelailRepetition ? { delailRepetitions: 3 } : {}),
		...(a.requiresIstighfar ? { istighfarRepetitions: a.istighfarTarget } : {})
	});
const readToday = async (userId: string, groupId: string) => {
	const today = (await getHizbState(userId, groupId)).today!;
	await markRead(userId, groupId, today);
	return today;
};
/** A call's result, its time (printed, never asserted) and the statements it sent (asserted). */
const timed = async <T>(run: () => Promise<T>) => {
	const began = performance.now();
	const before = sent.queries;
	const result = await run();
	return { result, ms: performance.now() - began, queries: sent.queries - before };
};
/** Who reads first, second, … in a fixed-plan group: user ids by sequence. */
const inOrder = async (groupId: string) =>
	(await prisma.hizbEnrollment.findMany({ where: { groupId, endDay: null }, orderBy: { sequence: 'asc' } })).map(
		e => e.userId
	);

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	await prisma.$executeRawUnsafe('TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE');
});
afterAll(async () => {
	vi.useRealTimers();
	await prisma.$disconnect();
});

describe.each([100, 200, 500])('a Hizb plan group with %i readers', size => {
	// Joining 500 through the service takes ~25 s locally; leave a slow runner room.
	const timeout = 20000 + size * 250;

	it(
		'gives concurrent joiners an unbroken reading order and a balanced, fully covered board',
		async () => {
			const group = await create(33);
			await joinMany(group.id, 1, size);

			// One active enrollment each; sequences 0…size with no gap or repeat; ordinals unique.
			const enrollments = await prisma.hizbEnrollment.findMany({ where: { groupId: group.id } });
			expect(enrollments).toHaveLength(size + 1);
			expect(new Set(enrollments.map(e => e.userId)).size).toBe(size + 1);
			expect(ascending(enrollments.map(e => e.sequence))).toEqual(range(0, size + 1));
			expect(new Set(enrollments.map(e => e.ordinal)).size).toBe(size + 1);
			const counters = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
			expect(counters.hizbNext33).toBe(size + 1);
			expect(counters.hizbNextSlot).toBeGreaterThan(Math.max(...enrollments.map(e => e.ordinal)));
			const members = await prisma.groupMember.findMany({ where: { groupId: group.id } });
			expect(members).toHaveLength(size + 1);
			expect(new Set(members.map(m => m.slotIndex)).size).toBe(size + 1);

			// The readers list: everyone, the viewer once, the 33 portions shared out evenly.
			const order = await inOrder(group.id);
			const last = order.at(-1)!;
			const {
				result: state,
				ms: stateMs,
				queries: stateQueries
			} = await timed(() => getHizbState(last, group.id));
			expect(state.members).toHaveLength(size + 1);
			expect(state.members.filter(m => m.isMe)).toHaveLength(1);
			expect(state.members.find(m => m.isMe)?.portion).toBe(state.today?.portion);
			expect(state.members.every(m => m.displayName !== null)).toBe(true);
			const holders = new Map<number, number>();
			for (const m of state.members) {
				holders.set(m.portion, (holders.get(m.portion) ?? 0) + 1);
			}
			expect(holders.size).toBe(33);
			expect(Math.max(...holders.values()) - Math.min(...holders.values())).toBeLessThanOrEqual(1);

			// A partial board: the first ten in order read ten different portions.
			for (const userId of order.slice(0, 10)) {
				await readToday(userId, group.id);
			}
			const partial = await getHizbState('owner', group.id);
			const partialSummary = await hizbSummary(group.id, 'owner');
			expect(ascending(partial.coveredSpans)).toEqual(ascending(partialSummary.hizbCoveredSpans));
			expect(partial.coverage.complete).toBe(false);
			expect(partialSummary.completedAt).toBeNull();
			expect(partial.members.filter(m => m.completed)).toHaveLength(10);

			// The rest of the first 33 read: the board is whole, and says so everywhere.
			for (const userId of order.slice(10, 33)) {
				await readToday(userId, group.id);
			}
			const full = await getHizbState(last, group.id);
			const {
				result: summary,
				ms: summaryMs,
				queries: summaryQueries
			} = await timed(() => hizbSummary(group.id, last));
			expect(ascending(full.coveredSpans)).toEqual(ALL_SPANS);
			expect(ascending(summary.hizbCoveredSpans)).toEqual(ALL_SPANS);
			expect(full.coverage).toMatchObject({ complete: true, covered: PLAN_SPANS.length });
			expect(full.members.filter(m => m.completed)).toHaveLength(33);
			expect(summary).toMatchObject({ percent: 100, memberCount: size + 1, myShareDoneAt: null });
			expect(summary.completedAt).not.toBeNull();
			expect((await hizbSummary(group.id, order[0]!)).myShareDoneAt).toBe(start.toISOString());

			// Discover for an outsider: every reader counted, the board full.
			const {
				result: shelf,
				ms: discoverMs,
				queries: discoverQueries
			} = await timed(() => discoverGroups('outsider', {}));
			expect(shelf.find(g => g.id === group.id)).toMatchObject({ memberCount: size + 1, percent: 100 });

			console.info(
				`[hizb ${size}] getHizbState ${stateMs.toFixed(
					0
				)} ms, ${stateQueries} queries · hizbSummary ${summaryMs.toFixed(
					0
				)} ms, ${summaryQueries} queries · discoverGroups ${discoverMs.toFixed(
					0
				)} ms, ${discoverQueries} queries`
			);
			expect(stateQueries).toBeLessThanOrEqual(queryBudget.state);
			expect(summaryQueries).toBeLessThanOrEqual(queryBudget.summary);
			expect(discoverQueries).toBeLessThanOrEqual(queryBudget.discover);
		},
		timeout
	);

	it(
		'hides names from other members, but not from the owner or the reader themselves',
		async () => {
			const group = await create(33);
			await seedReaders(group.id, size);
			await prisma.group.update({ where: { id: group.id }, data: { hideMemberNames: true } });
			const asReader = await getHizbState(reader(1), group.id);
			expect(asReader.members).toHaveLength(size + 1);
			expect(asReader.members.flatMap(m => (m.displayName === null ? [] : [m.displayName]))).toEqual([
				'Reader 1'
			]);
			const asOwner = await getHizbState('owner', group.id);
			expect(asOwner.members.every(m => m.displayName !== null)).toBe(true);
		},
		timeout
	);

	it(
		'keeps a separate, unbroken order per plan in a members-choose group',
		async () => {
			const group = await create(0);
			const plans = [7, 15, 33] as const;
			const planOf = (n: number) => plans[n % 3]!;
			// Most readers chose earlier (seeded); the last sixty choose now, twenty at a time.
			const late = 60;
			await seedReaders(group.id, size);
			const seeded = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
			const counts = { 7: 0, 15: 0, 33: 0 };
			await prisma.hizbEnrollment.createMany({
				data: range(1, size - late).map((n, i) => ({
					groupId: group.id,
					userId: reader(n),
					planDays: planOf(n),
					planVersion: PLAN_VERSION,
					sequence: counts[planOf(n)]++,
					ordinal: seeded.hizbNextSlot + i,
					joinedDay: civilDayNumber(start, ZONE),
					generatedThrough: civilDayNumber(start, ZONE) - 1
				}))
			});
			await prisma.group.update({
				where: { id: group.id },
				data: {
					hizbNextSlot: { increment: size - late },
					hizbNext7: counts[7],
					hizbNext15: counts[15],
					hizbNext33: counts[33]
				}
			});
			for (let n = size - late + 1; n <= size; n += BATCH) {
				await Promise.all(range(n, BATCH).map(m => enrollHizb(reader(m), group.id, planOf(m))));
			}

			const enrollments = await prisma.hizbEnrollment.findMany({ where: { groupId: group.id } });
			expect(enrollments).toHaveLength(size);
			expect(new Set(enrollments.map(e => e.ordinal)).size).toBe(size);
			const counters = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
			for (const plan of plans) {
				const onPlan = enrollments.filter(e => e.planDays === plan);
				expect(onPlan.every(e => e.planDays === planOf(Number(e.userId.slice('reader'.length))))).toBe(true);
				expect(ascending(onPlan.map(e => e.sequence))).toEqual(range(0, onPlan.length));
				expect(counters[counterFor(plan)]).toBe(onPlan.length);
			}
			// Each plan's readers spread over that plan's own portions.
			const state = await getHizbState(reader(1), group.id);
			expect(state.members).toHaveLength(size);
			for (const plan of plans) {
				expect(new Set(state.members.filter(m => m.planDays === plan).map(m => m.portion)).size).toBe(plan);
			}
		},
		timeout
	);

	it(
		'covers the whole text on a 7-day plan once the first seven in order read',
		async () => {
			const group = await create(7);
			await seedReaders(group.id, size);
			const portions = [];
			for (const userId of (await inOrder(group.id)).slice(0, 7)) {
				portions.push((await readToday(userId, group.id)).portion);
			}
			expect(ascending(portions)).toEqual([1, 2, 3, 4, 5, 6, 7]);
			expect(ascending(portions.flatMap(p => spansFor(7, p)))).toEqual(ALL_SPANS);
			const state = await getHizbState(reader(size), group.id);
			expect(ascending(state.coveredSpans)).toEqual(ALL_SPANS);
			expect(state.members.filter(m => m.completed)).toHaveLength(7);
			expect((await hizbSummary(group.id, reader(size))).percent).toBe(100);
		},
		timeout
	);

	it(
		'counts missed days per reader, removes the inactive ones and appends a rejoin at the tail',
		async () => {
			const group = await create(33, { inactivityDays: 3 });
			await seedReaders(group.id, size);
			// A tenth read on the first day; everyone else never opens the group.
			const readers = range(1, size / 10).map(reader);
			for (const userId of readers) {
				await readToday(userId, group.id);
			}

			// Day 2: a reader owes day 1, an idle member days 0–1. A catch-up moves only its own count.
			vi.setSystemTime(day(2));
			const idle = reader(size);
			const [first, catcher] = readers as [string, string];
			expect((await getHizbState(first, group.id)).missedCount).toBe(1);
			expect((await getHizbState(idle, group.id)).missedCount).toBe(2);
			const owed = (await getHizbState(catcher, group.id)).missed[0]!;
			await markRead(catcher, group.id, owed);
			expect((await getHizbState(catcher, group.id)).missedCount).toBe(0);
			expect((await getHizbState(first, group.id)).missedCount).toBe(1);
			expect((await getHizbState(idle, group.id)).missedCount).toBe(2);

			// Day 3: three days without a read ends every idle enrollment in one pass; readers stay.
			vi.setSystemTime(day(3));
			const { ms: expireMs, queries: expireQueries } = await timed(() => hizbSummary(group.id, 'outsider'));
			const active = await prisma.hizbEnrollment.findMany({ where: { groupId: group.id, endDay: null } });
			expect(active.map(e => e.userId).sort()).toEqual([...readers].sort());
			const removed = await prisma.hizbEnrollment.findMany({
				where: { groupId: group.id, reason: 'INACTIVITY' }
			});
			expect(removed).toHaveLength(size + 1 - readers.length);
			expect(removed.every(e => e.endDay === e.joinedDay + 3 && e.removalDays === 3)).toBe(true);
			const idleSummary = await hizbSummary(group.id, idle);
			expect(idleSummary).toMatchObject({
				hizbRemoved: true,
				hizbRemovalDays: 3,
				hizbToday: null,
				memberCount: size + 1
			});
			// Taken out of the order, not out of the group.
			expect(await prisma.groupMember.count({ where: { groupId: group.id } })).toBe(size + 1);
			// Their unread days stay for catching up.
			expect((await getHizbState(idle, group.id)).missedCount).toBe(3);

			// Coming back takes the next number after everyone, never a freed one.
			await enrollHizb(idle, group.id, 33);
			const back = await prisma.hizbEnrollment.findFirstOrThrow({
				where: { groupId: group.id, userId: idle, endDay: null }
			});
			expect(back.sequence).toBe(size + 1);
			console.info(
				`[hizb ${size}] removing ${removed.length} idle readers: ${expireMs.toFixed(
					0
				)} ms, ${expireQueries} queries`
			);
			expect(expireQueries).toBeLessThanOrEqual(queryBudget.expire);

			// Forty days on, the history is still thirty-one bars.
			vi.setSystemTime(day(40));
			expect((await getHizbState(first, group.id)).dailyHistory).toHaveLength(31);
		},
		timeout
	);

	it(
		'keeps everyone’s place when a tenth leave, and appends newcomers after the last',
		async () => {
			const group = await create(33);
			await seedReaders(group.id, size);
			const before = new Map(
				(await prisma.hizbEnrollment.findMany({ where: { groupId: group.id } })).map(e => [
					e.userId,
					e.sequence
				])
			);
			const leavers = range(0, size / 10).map(i => reader(i * 10 + 1));
			for (let i = 0; i < leavers.length; i += BATCH) {
				await Promise.all(leavers.slice(i, i + BATCH).map(userId => leaveGroupForUser(userId, group.id)));
			}
			await joinMany(group.id, size + 1, BATCH);

			const after = await prisma.hizbEnrollment.findMany({ where: { groupId: group.id, endDay: null } });
			expect(after).toHaveLength(size + 1 - leavers.length + BATCH);
			expect(after.filter(e => before.has(e.userId)).every(e => e.sequence === before.get(e.userId))).toBe(true);
			const newcomers = after.filter(e => !before.has(e.userId)).map(e => e.sequence);
			expect(ascending(newcomers)).toEqual(range(size + 1, BATCH));
			const state = await getHizbState('owner', group.id);
			expect(state.members.map(m => m.id).sort()).toEqual(after.map(e => e.id).sort());
		},
		timeout
	);

	it(
		'stays quick after a month in which everyone read every day',
		async () => {
			const group = await create(33);
			await seedReaders(group.id, size);
			vi.setSystemTime(day(30));
			const today = civilDayNumber(new Date(), ZONE);
			const anchor = today - 30;
			// The heaviest the group screen gets: 31 read days per member inside its 30-day window.
			const enrollments = await prisma.hizbEnrollment.findMany({ where: { groupId: group.id } });
			await prisma.hizbAssignment.deleteMany({ where: { enrollment: { groupId: group.id } } });
			await prisma.hizbAssignment.createMany({
				data: enrollments.flatMap(e =>
					range(anchor, 31).map(d => ({
						enrollmentId: e.id,
						day: d,
						portion: portionForDay(33, e.sequence, d - anchor),
						traversal: 0,
						repetitions: 19,
						delailRepetitions: 3,
						istighfarRepetitions: 11,
						completedAt: day(d - anchor)
					}))
				)
			});
			await prisma.hizbEnrollment.updateMany({
				where: { groupId: group.id },
				data: { generatedThrough: today, lastReadDay: today }
			});

			const {
				result: state,
				ms: stateMs,
				queries: stateQueries
			} = await timed(() => getHizbState(reader(size), group.id));
			const {
				result: summary,
				ms: summaryMs,
				queries: summaryQueries
			} = await timed(() => hizbSummary(group.id, reader(size)));
			expect(state.members).toHaveLength(size + 1);
			expect(state.members.every(m => m.completed)).toBe(true);
			expect(state.dailyHistory).toHaveLength(31);
			expect(state.dailyHistory.every(d => d.complete)).toBe(true);
			expect(state.missedCount).toBe(0);
			expect(ascending(state.coveredSpans)).toEqual(ALL_SPANS);
			expect(summary).toMatchObject({ percent: 100, memberCount: size + 1 });
			console.info(
				`[hizb ${size}] a full month read: getHizbState ${stateMs.toFixed(
					0
				)} ms, ${stateQueries} queries · hizbSummary ${summaryMs.toFixed(0)} ms, ${summaryQueries} queries`
			);
			expect(stateQueries).toBeLessThanOrEqual(queryBudget.state);
			expect(summaryQueries).toBeLessThanOrEqual(queryBudget.summary);

			// "Tüm geçmiş": the month's days, then one full day of every reader.
			const { result: history, queries: daysQueries } = await timed(() =>
				getHizbHistoryDays(reader(size), group.id)
			);
			expect(history.days).toHaveLength(30);
			expect(history.days.every(d => d.read === size + 1 && d.readers === size + 1)).toBe(true);
			const { result: oneDay, queries: dayQueries } = await timed(() =>
				getHizbHistoryDay(reader(size), group.id, anchor)
			);
			expect(oneDay.members).toHaveLength(size + 1);
			expect(oneDay.members.every(m => m.completed)).toBe(true);
			expect(daysQueries).toBeLessThanOrEqual(queryBudget.historyDays);
			expect(dayQueries).toBeLessThanOrEqual(queryBudget.historyDay);
		},
		timeout
	);
});
