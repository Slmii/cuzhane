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
