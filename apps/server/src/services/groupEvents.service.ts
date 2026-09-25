import prisma from '@db/prisma';
import type { Prisma } from '../generated/prisma/client';
import { sendPushToUser } from '@services/push.service';
import { recordNotification, type NotificationPayload } from '@services/notifications.service';
import { toPushLanguage, type PushLanguage } from '@utils/pushCopy';
import { FALLBACK_DISPLAY_NAME, getMemberProfiles } from '@utils/memberProfiles';

/**
 * "Something happened in a group you are in" — filed for every other member, pushed to those who
 * asked for it.
 *
 * Three events share this shape exactly: a block taken out of the pool, somebody joining, and
 * somebody leaving. `notifyGroupOfShareRead` and `notifyGroupOfRoundComplete` in
 * `babs.service.ts` are the same idea written out twice before there was a third; they stay where
 * they are because each carries a guard this cannot express — a share is announced once per
 * round via `ShareReadNotice`, a round once per round via `RoundCompleteNotice`. The three below
 * need no such claim: each is raised by a single write that can only happen once.
 *
 * **Filed for everyone, pushed only to those who asked.** The inbox is the record — the design's
 * rule is that in-app notifications are always on and the preferences govern only whether the
 * phone buzzes.
 *
 * **It never throws.** Every caller reaches it after the commit of a write that has already
 * succeeded, so a failed lookup here must not turn that write into a 5xx and make the client roll
 * an optimistic update back.
 */
/**
 * The `UserSettings` columns these events are gated on, **taken from the generated client** and
 * not written out as strings.
 *
 * `Extract` is doing real work: a column the client does not have drops out of the union, so
 * every caller naming it fails to compile. The `where: { [setting]: true }` below is a computed
 * key, which TypeScript cannot check against Prisma's input type — this is what checks it
 * instead, and without it a stale client type-checks clean and then throws
 * `Unknown argument \`memberJoinedEnabled\`` at runtime, which is exactly what happened.
 */
export type GroupEventSetting = Extract<
	keyof Prisma.UserSettingsWhereInput,
	'cevsenPoolClaimEnabled' | 'hatimPoolClaimEnabled' | 'memberJoinedEnabled' | 'memberLeftEnabled'
>;

type GroupEventInput = {
	groupId: string;
	/**
	 * Whose action this was. Their **live** name is resolved here and handed to `build` — every
	 * one of these events names somebody, and getting that name right is the same three-step
	 * fallback `toGroupMember` uses: Clerk first, the stored name second, "Member" only when
	 * neither has anything.
	 *
	 * It has to be looked up rather than passed straight through, and the joined notice is what
	 * proved it: `GroupMember.displayName` is written once at join time from whatever the session
	 * claims held then, so anyone who signed up before filling in their profile is stored as
	 * "Member" for good — and the row read "Member gruba katıldı".
	 */
	actorUserId: string;
	/**
	 * The actor's stored name, for the one event where they are **no longer a member** by the
	 * time this runs and so cannot be found in the group: leaving, or being removed.
	 */
	actorStoredName?: string | null;
	/**
	 * Who already knows. The actor always; for a removal, the owner who performed it as well —
	 * from the other members' side those two are one event, but neither of them needs telling.
	 */
	excludeUserIds: string[];
	/** The `UserSettings` column that governs the **push**. The row is filed regardless. */
	setting: GroupEventSetting;
	/** `data.kind` on the push payload, which the client routes on. */
	pushKind: string;
	/**
	 * What the event is about, for saying it **once per actor, per round, per subject** — the
	 * slot or cüz taken; empty for a join or a leave. See `GroupEventNotice`: without it, a
	 * take/release or join/leave loop filed a row for every member, and pushed, on every turn.
	 */
	subject?: string;
	/**
	 * Built from what the group looks like *now*, after the write — the member count in
	 * particular, which is the whole news in two of the three.
	 */
	build: (context: { actorName: string; groupName: string; memberCount: number; spots: number }) => {
		payload: NotificationPayload;
		push: (language: PushLanguage) => { body: string; title: string };
	};
};

export const notifyGroupMembers = async ({
	actorStoredName = null,
	actorUserId,
	build,
	excludeUserIds,
	groupId,
	pushKind,
	setting,
	subject = ''
}: GroupEventInput): Promise<void> => {
	try {
		const group = await prisma.group.findUnique({
			where: { id: groupId },
			select: {
				name: true,
				roundIndex: true,
				spots: true,
				members: { select: { displayName: true, userId: true } }
			}
		});

		if (group === null) {
			return;
		}

		const excluded = new Set(excludeUserIds);
		const others = group.members.filter(member => !excluded.has(member.userId));

		if (others.length === 0) {
			return;
		}

		// Said once: a second take of the same slot, or a rejoin, this round stays silent.
		const claimed = await prisma.groupEventNotice.createMany({
			data: [{ actorUserId, groupId, kind: pushKind, roundIndex: group.roundIndex, subject }],
			skipDuplicates: true
		});

		if (claimed.count === 0) {
			return;
		}

		// Clerk is the source of truth for a name; the seat's stored one is the fallback, and
		// `actorStoredName` covers the leaver, whose seat is already gone. See `getMemberProfiles`.
		const profiles = await getMemberProfiles([actorUserId]);
		const stored = group.members.find(member => member.userId === actorUserId)?.displayName;
		const actorName = profiles.get(actorUserId)?.displayName ?? stored ?? actorStoredName ?? FALLBACK_DISPLAY_NAME;

		const { payload, push } = build({
			actorName,
			groupName: group.name,
			memberCount: group.members.length,
			spots: group.spots
		});

		await recordNotification({
			groupId,
			groupName: group.name,
			payload,
			userIds: others.map(member => member.userId)
		});

		/*
		 * The preference is read before anything else is looked up, so an event nobody has opted
		 * into costs one indexed query and stops. Each recipient's language comes out of the same
		 * row rather than a lookup apiece.
		 */
		const recipients = await prisma.userSettings.findMany({
			where: { [setting]: true, userId: { in: others.map(member => member.userId) } },
			select: { language: true, userId: true }
		});

		await Promise.all(
			recipients.map(recipient =>
				sendPushToUser(recipient.userId, {
					...push(toPushLanguage(recipient.language)),
					data: { groupId, kind: pushKind }
				})
			)
		);
	} catch (error) {
		console.error(`Failed to notify a group of ${pushKind}`, error);
	}
};
