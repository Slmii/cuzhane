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

	if (settings?.language === 'tr' || settings?.language === 'nl') {
		return settings.language;
	}

	return 'en';
};

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
