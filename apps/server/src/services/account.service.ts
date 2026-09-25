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
			/*
			 * **The claim is released; the reads stand** — the same rule `removeMember` follows,
			 * because deleting an account is leaving every group at once.
			 *
			 * This used to clear reads twice over, and the first was the worse of the two: it
			 * wiped `readByUserId` on every bab *assigned* to this user, which under ROTATION
			 * is read by whoever holds that block on the day — so deleting one account could
			 * erase somebody else's work. The second cleared their own reads, which were facts
			 * about the group rather than possessions of theirs.
			 *
			 * `BabRead` was never deleted here and still isn't, so the history has always
			 * outlived the account. All this changes is that the board now agrees with it.
			 */
			await tx.groupBab.updateMany({
				where: { groupId: { in: remainingGroupIds }, assignedUserId: normalizedUserId },
				data: { assignedUserId: null }
			});

			// A hatim's holdings go with the claim: nobody is going to read them now, so they
			// return to the pool for whoever is left.
			await tx.cuzHolding.deleteMany({
				where: { groupId: { in: remainingGroupIds }, userId: normalizedUserId }
			});

			/*
			 * **No `completedAt` reconciliation any more, because nothing above can un-read a
			 * bab.** Releasing a claim cannot lower a group's read count, so a group that was
			 * complete when this began is complete when it ends. The sweep that used to clear
			 * the stamp existed only to repair the damage the two wipes above were doing.
			 */
		}

		await tx.groupMember.deleteMany({ where: { userId: normalizedUserId } });
		// "Bu turu atla" choices — a record about the member, so it leaves with them.
		await tx.cuzRoundSkip.deleteMany({ where: { userId: normalizedUserId } });

		await tx.cheer.deleteMany({
			where: { OR: [{ fromUserId: normalizedUserId }, { toUserId: normalizedUserId }] }
		});
		await tx.groupWaitlistEntry.deleteMany({ where: { userId: normalizedUserId } });
		await tx.pushToken.deleteMany({ where: { userId: normalizedUserId } });
		/*
		 * The inbox goes too. `Notification` has no foreign key on `userId` — there is no user
		 * table, the id is Clerk's — and its group relation is `SetNull` so history does not gap
		 * when a group is deleted, which together meant nothing ever collected these. Every row
		 * carries a group name and often another member's display name, and the delete-account
		 * copy promises the lot is gone.
		 *
		 * `ShareReadNotice` and `GroupEventNotice` are left alone deliberately: each is a claim
		 * that an announcement was already made for a (group, user, round), it names nobody, and
		 * deleting it would let the same round announce itself a second time for whoever is still
		 * in that group.
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
