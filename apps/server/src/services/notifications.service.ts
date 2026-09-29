import prisma from '@db/prisma';
import type { GroupKindName } from '@utils/groupKinds';
import { normalizeUserId } from '@utils/normalizeUserId';
import { anonymousNotificationPayload } from '@utils/groupPrivacy';
import type { NotificationKind, Prisma } from '../generated/prisma/client';

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
	/**
	 * A Hizb plan's "has read" notice, prepared for "Okuma sorumluları" on (`toSeers`) or off. Filed
	 * only if the switch is still that way, and when on, only for members ticked to see who read
	 * *at the moment of filing*, with the name kept even when names are hidden. Checked under the
	 * lock, so a switch or an untick made while the notice was on its way holds, either direction.
	 */
	hizbRead?: { toSeers: boolean };
};

/** Files the rows and answers with whom they were filed for — the only ones a push may then reach. */
export const recordNotification = async ({
	groupId,
	groupName,
	hizbRead,
	payload,
	userIds
}: RecordInput): Promise<string[]> => {
	if (userIds.length === 0) {
		return [];
	}

	try {
		const { kind, ...rest } = payload;
		return await prisma.$transaction(async tx => {
			// Privacy updates take this row lock too: a named event cannot land after their scrub.
			await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id" = ${groupId} FOR UPDATE`;
			const group = await tx.group.findUnique({
				where: { id: groupId },
				select: { hideMemberNames: true, readSeersEnabled: true }
			});
			if (!group || (hizbRead && hizbRead.toSeers !== group.readSeersEnabled)) {
				return [];
			}
			let filedFor = userIds.map(normalizeUserId);
			let storedPayload: Record<string, unknown> = group.hideMemberNames
				? anonymousNotificationPayload(rest)
				: rest;
			if (hizbRead?.toSeers) {
				const seers = await tx.groupMember.findMany({
					where: { groupId, seesReaders: true, userId: { in: filedFor } },
					select: { userId: true }
				});
				const ticked = new Set(seers.map(seer => seer.userId));
				filedFor = filedFor.filter(userId => ticked.has(userId));
				// Named for the ticked; marked while names are hidden, so a row whose group is later
				// deleted still keeps its name to itself (see listing).
				storedPayload = group.hideMemberNames ? { ...rest, seersOnly: true } : rest;
			}
			await tx.notification.createMany({
				data: filedFor.map(userId => ({
					groupId,
					groupName,
					kind,
					payload: storedPayload as Prisma.InputJsonValue,
					userId
				}))
			});
			return filedFor;
		});
	} catch (error) {
		console.error('Failed to record a notification', error);
		return [];
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
	 * What the group reads, so the row can say "bab", "cüz" or "bölüm" (Q8). Named `groupKind`
	 * because `kind` is already what the *notification* is.
	 *
	 * Joined from the live group rather than stored on the row, unlike `groupName`, so every row
	 * already filed gets it too. Once the group is deleted `groupId` goes null and there is
	 * nothing left to join, so such a row reads as a Cevşen one — which is also how the 1.3.0
	 * app drew a row with no kind, so every build reads it the same.
	 */
	groupKind: GroupKindName;
	payload: Record<string, unknown>;
	isRead: boolean;
	createdAt: string;
};

const serializeNotification = (row: {
	id: string;
	kind: NotificationKind;
	groupId: string | null;
	groupName: string;
	/** `members` holds only the viewer's own row, if they are still in the group. */
	group: {
		kind: GroupKindName;
		hideMemberNames: boolean;
		readSeersEnabled: boolean;
		members: { seesReaders: boolean }[];
	} | null;
	payload: Prisma.JsonValue;
	readAt: Date | null;
	createdAt: Date;
}): NotificationRow => ({
	createdAt: row.createdAt.toISOString(),
	groupId: row.groupId,
	groupKind: row.group?.kind ?? 'CEVSEN',
	groupName: row.groupName,
	id: row.id,
	isRead: row.readAt !== null,
	kind: row.kind,
	// Names stay only for a member ticked to see who read, and only while they still are — and a
	// seers-only row whose group is gone keeps its name to itself for good.
	payload: (() => {
		const payload = (row.payload ?? {}) as Record<string, unknown>;
		const isHidden = row.group
			? row.group.hideMemberNames && !(row.group.readSeersEnabled && row.group.members[0]?.seesReaders === true)
			: payload.seersOnly === true;
		return isHidden ? anonymousNotificationPayload(payload) : payload;
	})()
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
	const user = normalizeUserId(userId);
	const rows = await prisma.notification.findMany({
		where: { userId: user },
		orderBy: { createdAt: 'desc' },
		take: INBOX_LIMIT,
		include: {
			group: {
				select: {
					kind: true,
					hideMemberNames: true,
					readSeersEnabled: true,
					members: { where: { userId: user }, select: { seesReaders: true } }
				}
			}
		}
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
