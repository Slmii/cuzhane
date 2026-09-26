import prisma from '@db/prisma';
import { normalizeUserId } from '@utils/normalizeUserId';

export const deleteAccountForUser = async (userId: string): Promise<{ success: true }> => {
	const normalizedUserId = normalizeUserId(userId);

	await prisma.$transaction(async tx => {
		// Groups this user owns — cascades to their members, babs, cheers and waitlist.
		await tx.group.deleteMany({ where: { ownerUserId: normalizedUserId } });

		// Groups this user merely joined survive; free up whatever they held there.
		const remainingMemberships = await tx.groupMember.findMany({
			where: { userId: normalizedUserId },
			select: { groupId: true }
		});
		const remainingGroupIds = remainingMemberships.map(membership => membership.groupId);

		if (remainingGroupIds.length > 0) {
			await tx.groupBab.updateMany({
				where: { groupId: { in: remainingGroupIds }, assignedUserId: normalizedUserId },
				data: { assignedUserId: null, readByUserId: null, readAt: null }
			});
			await tx.groupBab.updateMany({
				where: { groupId: { in: remainingGroupIds }, readByUserId: normalizedUserId },
				data: { readByUserId: null, readAt: null }
			});

			// Freeing their reads can drop a finished group back below a full board, so any group
			// that is no longer complete has to lose its stamp — otherwise it stays
			// flagged "completed" while showing unread babs on the board.
			await tx.group.updateMany({
				where: {
					id: { in: remainingGroupIds },
					completedAt: { not: null },
					babs: { some: { readAt: null } }
				},
				data: { completedAt: null }
			});
		}

		await tx.groupMember.deleteMany({ where: { userId: normalizedUserId } });

		await tx.cheer.deleteMany({
			where: { OR: [{ fromUserId: normalizedUserId }, { toUserId: normalizedUserId }] }
		});
		await tx.groupWaitlistEntry.deleteMany({ where: { userId: normalizedUserId } });
		// Sekine counts in groups they merely joined; those they owned went with the group.
		await tx.groupPartRepetition.deleteMany({ where: { userId: normalizedUserId } });
		await tx.pushToken.deleteMany({ where: { userId: normalizedUserId } });
		/*
		 * The inbox goes too. `Notification` has no foreign key on `userId` — there is no user
		 * table, the id is Clerk's — and its group relation is `SetNull` so history does not gap
		 * when a group is deleted, which together meant nothing ever collected these. Every row
		 * carries a group name and often another member's display name, and the delete-account
		 * copy promises the lot is gone.
		 *
		 * `ShareReadNotice` is left alone deliberately: it is a claim that an announcement was
		 * already made for a (group, user, round), it names nobody, and deleting it would let the
		 * same round announce itself a second time for whoever is still in that group.
		 */
		await tx.notification.deleteMany({ where: { userId: normalizedUserId } });
		await tx.userSettings.deleteMany({ where: { userId: normalizedUserId } });
		// The delete-account copy promises everything goes, and a feedback row carries the
		// sender's own words and email address — so it goes with the rest rather than
		// outliving the account that wrote it.
		await tx.feedback.deleteMany({ where: { userId: normalizedUserId } });
	});

	return { success: true };
};
