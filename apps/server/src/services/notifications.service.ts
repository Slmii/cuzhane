import prisma from '@db/prisma';
import { normalizeUserId } from '@utils/normalizeUserId';
import type { GroupKind, NotificationKind, Prisma } from '../generated/prisma/client';

/**
 * The inbox behind design P2.
 *
 * **Recording is not sending.** Every one of these rows is written whether or not a push went
 * out — a reader who denied permission, turned a preference off, or had the phone in a drawer
 * still finds the event here. That is the design's own rule ("in-app notifications are always
 * on; the preferences only affect phone notifications") and it is why `PoolClaimRelease` was
 * built the same way long before this existed.
 *
 * **Recording never throws.** These calls sit in the same place the pushes do: after the commit
 * of a write that has already succeeded. A failure to file a notification must not turn a
 * finished read into a 5xx.
 */

/**
 * One kind's payload, with its name **constrained to the generated enum**.
 *
 * `K extends NotificationKind` is the whole point: a kind the Prisma client does not know is a
 * compile error here rather than a `PrismaClientValidationError` at runtime. That is not
 * hypothetical — `db:migrate` left the client stale once, and an `as NotificationKind` on the
 * write was enough to let the server type-check clean while being unable to file a single row.
 */
type Payload<K extends NotificationKind, Data> = { kind: K } & Data;

/** What each kind carries. The client renders the sentence; this is only the data in it. */
export type NotificationPayload =
	| Payload<'POOL_CLAIM_RELEASED', { startBab: number; endBab: number }>
	| Payload<'SHARE_READ', { readerName: string; range: string }>
	| Payload<'ROUND_COMPLETE', { roundNumber: number }>
	| Payload<'POOL_BAB_CLAIMED', { takerName: string; range: string }>
	| Payload<'MEMBER_JOINED', { memberName: string; memberCount: number; spots: number }>
	| Payload<'MEMBER_LEFT', { memberName: string; memberCount: number; spots: number }>;

type RecordInput = {
	/** Everyone who should find this in their inbox. Already filtered by the caller. */
	userIds: string[];
	groupId: string;
	groupName: string;
	payload: NotificationPayload;
};

export const recordNotification = async ({ groupId, groupName, payload, userIds }: RecordInput): Promise<void> => {
	if (userIds.length === 0) {
		return;
	}

	try {
		const { kind, ...rest } = payload;

		await prisma.notification.createMany({
			data: userIds.map(userId => ({
				groupId,
				groupName,
				kind,
				payload: rest as Prisma.InputJsonValue,
				userId: normalizeUserId(userId)
			}))
		});
	} catch (error) {
		console.error('Failed to record a notification', error);
	}
};

/**
 * How many rows the reader has not opened — what the bell's badge counts (design P1).
 *
 * Its own endpoint rather than a field on the list: the bell is on Ana sayfa and polls, while
 * the list is only fetched when the inbox is opened.
 */
export const getUnreadCountForUser = async (userId: string): Promise<number> =>
	prisma.notification.count({ where: { readAt: null, userId: normalizeUserId(userId) } });

/**
 * The shape the client renders from — `payload` flattened is deliberately *not* done here: the
 * app reads `payload` as an object, so a new kind adds fields without changing this type. Mirrors
 * `Notification` in the web app's `domain.ts`, which has to change with it — the two workspaces
 * share no package.
 */
export type NotificationRow = {
	id: string;
	kind: NotificationKind;
	groupId: string | null;
	groupName: string;
	/**
	 * Cevşen or hatim — which decides whether the row speaks in babs or cüz (Q8). Read off the
	 * group at list time rather than stored, so every row already filed gets it too. Null once
	 * the group is gone, and the client reads that as Cevşen: the one case a hatim's old rows
	 * would say "bab", accepted rather than denormalising a column for it.
	 */
	groupKind: GroupKind | null;
	payload: Record<string, unknown>;
	isRead: boolean;
	createdAt: string;
};

const serializeNotification = (row: {
	id: string;
	kind: NotificationKind;
	groupId: string | null;
	groupName: string;
	group: { kind: GroupKind } | null;
	payload: Prisma.JsonValue;
	readAt: Date | null;
	createdAt: Date;
}): NotificationRow => ({
	createdAt: row.createdAt.toISOString(),
	groupId: row.groupId,
	groupKind: row.group?.kind ?? null,
	groupName: row.groupName,
	id: row.id,
	isRead: row.readAt !== null,
	kind: row.kind,
	payload: (row.payload ?? {}) as Record<string, unknown>
});

/**
 * The newest page of the reader's inbox.
 *
 * Capped rather than paged: the design groups by "Bugün" and "Bu hafta" and offers no way to
 * reach further back, so anything older than this window has no screen to appear on. A cursor
 * can be added the day the design grows one.
 */
const INBOX_LIMIT = 100;

export const listNotificationsForUser = async (userId: string): Promise<NotificationRow[]> => {
	const rows = await prisma.notification.findMany({
		include: { group: { select: { kind: true } } },
		where: { userId: normalizeUserId(userId) },
		orderBy: { createdAt: 'desc' },
		take: INBOX_LIMIT
	});

	return rows.map(serializeNotification);
};

/** Opening a row marks it. Scoped to the caller so one reader cannot clear another's. */
export const markNotificationReadForUser = async (userId: string, notificationId: string): Promise<void> => {
	await prisma.notification.updateMany({
		where: { id: notificationId, readAt: null, userId: normalizeUserId(userId) },
		data: { readAt: new Date() }
	});
};

/** "Tümünü okundu say" — one conditional write, so a second tap costs nothing. */
export const markAllNotificationsReadForUser = async (userId: string): Promise<void> => {
	await prisma.notification.updateMany({
		where: { readAt: null, userId: normalizeUserId(userId) },
		data: { readAt: new Date() }
	});
};
