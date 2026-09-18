import prisma from '@db/prisma';
import { normalizeUserId } from '@utils/normalizeUserId';

/**
 * Push copy lives on the server because the server is what sends it — the phone is not
 * involved in composing a notification it receives while the app is closed. That means this
 * file is a second, smaller copy table beside `apps/web/src/lib/i18n/strings.ts`, and the
 * two have to be kept in step by hand, exactly as the serializer types are.
 *
 * Only strings that appear in a *notification* belong here. Anything the app renders itself
 * stays in the client's table, where it can use the interpolation and typing that exist there.
 */
export type PushLanguage = 'tr' | 'en' | 'nl';

/**
 * The reader's language, defaulting the way `UserSettings` does.
 *
 * A push arrives with no app running to ask, so the language has to be resolved at send
 * time from what the account last chose.
 */
export const pushLanguageFor = async (userId: string): Promise<PushLanguage> => {
	const settings = await prisma.userSettings.findUnique({
		where: { userId: normalizeUserId(userId) },
		select: { language: true }
	});

	return toPushLanguage(settings?.language);
};

/**
 * The same defaulting, for a language already in hand.
 *
 * A send that fans out across a group reads every recipient's row in **one** query, so it must
 * not then call `pushLanguageFor` per person and issue N more.
 */
export const toPushLanguage = (language: string | null | undefined): PushLanguage =>
	language === 'tr' || language === 'nl' ? language : 'en';

/**
 * "A joiner took over the block you volunteered for."
 *
 * Names the range, because that is the only detail that makes it actionable — and closes on
 * what was *not* lost, since "your babs were taken" is the reading to avoid: the reads they
 * already made still stand.
 */
export const poolClaimReleasedPush = (language: PushLanguage, range: string) => {
	if (language === 'tr') {
		return {
			title: 'Üstlendiğin bablar devredildi',
			body: `${range}. bablar gruba yeni katılan üyenin payı oldu. Okuduğun bablar sende kalır.`
		};
	}

	if (language === 'nl') {
		return {
			title: 'De babs die je overnam zijn doorgegeven',
			body: `Babs ${range} zijn het deel geworden van het nieuwe lid. Wat je al gelezen hebt, blijft van jou.`
		};
	}

	return {
		title: 'Babs you took were passed on',
		body: `Babs ${range} became a new member's share. Anything you already read still counts for you.`
	};
};

/**
 * "Someone in your group finished their share."
 *
 * **The group's name is the title, not the body.** Several groups can be running at once and the
 * notification is only useful if you can tell at a glance which board moved — and a body reading
 * "Ahmet finished 1–13 in Aile Hatmi" is the same fact said twice on a lock screen.
 *
 * **It names the range, and it is sent once.** This used to fire per bab with a number in it,
 * which meant a thirteen-bab share sent thirteen notifications; the range is what the reader
 * actually took on, and finishing it is the one moment worth interrupting anybody for.
 *
 * No pronoun for the reader in any of the three: a name says nothing about how somebody is
 * addressed, and "his share" would be a guess printed on someone else's lock screen.
 */
export const groupReadPush = (
	language: PushLanguage,
	input: { groupName: string; range: string; readerName: string }
) => {
	const { groupName, range, readerName } = input;

	if (language === 'tr') {
		return {
			title: groupName,
			// "Okumasını", not "payını": the range can carry a pool block taken on top of the
			// share, and calling that their share would be untrue. English and Dutch state the
			// babs rather than claim anything about whose they were, so they needed no change.
			body: `${readerName} okumasını tamamladı (${range}).`
		};
	}

	if (language === 'nl') {
		return {
			title: groupName,
			body: `${readerName} is klaar met babs ${range}.`
		};
	}

	return {
		title: groupName,
		body: `${readerName} finished babs ${range}.`
	};
};

/**
 * "The group closed the hundred."
 *
 * The one notification in the app that is purely good news — every other one is a task, a
 * reminder, or something that was taken away. It names the round, because a group that has run
 * for months is on its fortieth and that number is the record of what they have done together.
 *
 * Sent once per round per group — see `claimRoundCompleteNotice` — and never to whoever read the
 * last bab: their phone is already in their hand and the group screen is about to tell them.
 */
export const roundCompletePush = (language: PushLanguage, input: { groupName: string; roundNumber: number }) => {
	const { groupName, roundNumber } = input;

	if (language === 'tr') {
		return {
			title: groupName,
			body: `${roundNumber}. tur tamamlandı — 100 babın hepsi okundu.`
		};
	}

	if (language === 'nl') {
		return {
			title: groupName,
			body: `Ronde ${roundNumber} is voltooid — alle 100 babs gelezen.`
		};
	}

	return {
		title: groupName,
		body: `Round ${roundNumber} is complete — all 100 babs read.`
	};
};

/**
 * "Somebody took a block out of the shared pool."
 *
 * The pool is the babs nobody's seat is covering this round, and a group only finishes the
 * hundred if they are covered — so somebody taking one is the group closing a gap, which is
 * worth knowing and is *not* the same event as a share being finished. It names the range for
 * the same reason `groupReadPush` does: what was taken on is the information.
 *
 * Off by default, like the bab-by-bab switch and unlike the round: a busy pool in a large group
 * can fire several times a day, so this is opt-in rather than something to be rescued from.
 */
export const poolClaimPush = (
	language: PushLanguage,
	input: { groupName: string; range: string; takerName: string }
) => {
	const { groupName, range, takerName } = input;

	if (language === 'tr') {
		return {
			title: groupName,
			body: `${takerName} havuzdan ${range} bablarını üstlendi.`
		};
	}

	if (language === 'nl') {
		return {
			title: groupName,
			body: `${takerName} heeft babs ${range} uit de pool genomen.`
		};
	}

	return {
		title: groupName,
		body: `${takerName} took babs ${range} from the pool.`
	};
};

/**
 * "Somebody joined a group of yours."
 *
 * It says how full the group is now, because that is the thing the members are actually waiting
 * on — a gathering group starts when it fills, and a running one has a smaller pool with every
 * seat taken. The count is the news; the name is who to welcome.
 */
export const memberJoinedPush = (
	language: PushLanguage,
	input: { groupName: string; memberCount: number; memberName: string; spots: number }
) => {
	const { groupName, memberCount, memberName, spots } = input;

	if (language === 'tr') {
		return {
			title: groupName,
			body: `${memberName} gruba katıldı — ${memberCount}/${spots} kişi.`
		};
	}

	if (language === 'nl') {
		return {
			title: groupName,
			body: `${memberName} is lid geworden — ${memberCount}/${spots} leden.`
		};
	}

	return {
		title: groupName,
		body: `${memberName} joined — ${memberCount}/${spots} members.`
	};
};

/**
 * "Somebody left a group of yours."
 *
 * The counterpart, and the one that actually costs the group something: a seat emptying puts its
 * block back in the pool for the rest of the round, so the remaining members have more to cover.
 * The count is stated for the same reason as above — it is what changed.
 *
 * Sent for a removal as well as a departure. From the other members' side the two are the same
 * event: a seat is free again. Whoever left is not told, and neither is the owner who removed
 * them — both already know.
 */
export const memberLeftPush = (
	language: PushLanguage,
	input: { groupName: string; memberCount: number; memberName: string; spots: number }
) => {
	const { groupName, memberCount, memberName, spots } = input;

	if (language === 'tr') {
		return {
			title: groupName,
			body: `${memberName} gruptan ayrıldı — ${memberCount}/${spots} kişi.`
		};
	}

	if (language === 'nl') {
		return {
			title: groupName,
			body: `${memberName} heeft de groep verlaten — ${memberCount}/${spots} leden.`
		};
	}

	return {
		title: groupName,
		body: `${memberName} left — ${memberCount}/${spots} members.`
	};
};
