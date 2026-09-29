import prisma from '@db/prisma';
import { babRuns, formatRun } from '@utils/babs';
import { FALLBACK_DISPLAY_NAME, getMemberProfiles } from '@utils/memberProfiles';
import { settingFor } from '@utils/notificationSettings';
import { groupReadPush, toPushLanguage } from '@utils/pushCopy';
import { recordNotification } from './notifications.service';
import { sendPushToUser } from './push.service';

/**
 * "Ahmet read today" for a shared Hizb plan — the Hizb's own `notifyGroupOfShareRead`.
 *
 * **Who hears it is the group's choice first.** With "Okuma sorumluları" on it goes to the members
 * ticked to see who read (`GroupMember.seesReaders`), named even when names are hidden, and to
 * nobody else, whatever anyone's own switch says. Otherwise it goes to the members who turned the
 * group-reads notice on, without the name when names are hidden.
 *
 * **Filed only for those it is sent to**, unlike the Cevşen's, which files a row for every
 * member. A plan group is unlimited: five hundred members reading daily would otherwise file a
 * quarter of a million rows a day for news nobody asked for.
 *
 * Runs after the read's commit, once per reading (the caller claims `readNoticeSentAt` in the
 * read's own transaction), and never throws — a failed notice must not fail a finished read.
 */
export const notifyHizbRead = async (input: { groupId: string; readerId: string; portions: number[] }) => {
	const { groupId, portions, readerId } = input;

	try {
		const group = await prisma.group.findUnique({
			where: { id: groupId },
			select: {
				hideMemberNames: true,
				kind: true,
				name: true,
				readSeersEnabled: true,
				members: { select: { displayName: true, seesReaders: true, userId: true } }
			}
		});

		if (group === null) {
			return;
		}

		const toSeers = group.readSeersEnabled;
		const others = group.members.filter(member => member.userId !== readerId);
		const ticked = others.filter(member => member.seesReaders).map(member => member.userId);
		// The ticked, settings aside (read only for their language) — or whoever opted in.
		const settings = await prisma.userSettings.findMany({
			where: toSeers
				? { userId: { in: ticked } }
				: {
						[settingFor('groupReads', group.kind)]: true,
						userId: { in: others.map(member => member.userId) }
				  },
			select: { language: true, userId: true }
		});
		// A ticked member with no settings row yet still hears it — the group chose them.
		const recipientIds = toSeers ? ticked : settings.map(setting => setting.userId);

		if (recipientIds.length === 0) {
			return;
		}

		const profiles = await getMemberProfiles([readerId]);
		const stored = group.members.find(member => member.userId === readerId)?.displayName;
		const name = profiles.get(readerId)?.displayName ?? stored ?? FALLBACK_DISPLAY_NAME;
		const range = babRuns(portions).map(formatRun).join(', ');

		// Filed under the group lock, where the switch and the ticks are checked once more: only those
		// it was filed for are pushed, so a change made meanwhile reaches the phone too.
		const filedFor = await recordNotification({
			groupId,
			groupName: group.name,
			hizbRead: { toSeers },
			payload: { kind: 'SHARE_READ', range, readerName: name },
			userIds: recipientIds
		});

		if (filedFor.length === 0) {
			return;
		}

		// Asked again after filing, as the Cevşen's notice does: names hidden meanwhile stay hidden.
		const latest = toSeers
			? null
			: await prisma.group.findUnique({ where: { id: groupId }, select: { hideMemberNames: true } });
		const readerName = toSeers || latest?.hideMemberNames === false ? name : '';
		const languageOf = new Map(settings.map(setting => [setting.userId, setting.language]));

		await Promise.all(
			filedFor.map(userId =>
				sendPushToUser(userId, {
					...groupReadPush(toPushLanguage(languageOf.get(userId) ?? null), {
						groupName: group.name,
						kind: group.kind,
						portions,
						range,
						readerName
					}),
					data: { groupId, kind: 'group-read' }
				})
			)
		);
	} catch (error) {
		console.error('Failed to notify a Hizb group of a reading', error);
	}
};
