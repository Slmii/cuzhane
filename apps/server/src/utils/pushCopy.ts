import prisma from '@db/prisma';
import { partCountFor, type GroupKindName } from '@utils/groupKinds';
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

const anonymousMember = (language: PushLanguage) => ({ tr: 'Bir üye', en: 'A member', nl: 'Een lid' }[language]);

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
 * **What a group reads decides the noun.** A Cevşen group reads babs, a hatim cüz ("juz" in
 * English) and a Hizb group portions — "bölüm", "portion", "gedeelte" — and a notification
 * naming the wrong one would describe a book the reader is not reading: "all 100 babs read" is
 * simply false about thirty cüz.
 *
 * A range can also be a single part: a Hizb group of more than sixteen seats hands some of
 * them one portion each, so "portion 19" and "portions 1–3" both occur. A Cevşen share never
 * drops below five babs, but the rule is the same for it. A range is one part exactly when it
 * has neither a dash nor a comma — `formatRun` writes a lone part as its bare number.
 */
const isSinglePart = (range: string) => !/[–,]/.test(range);

const PART_NOUNS: Record<'en' | 'nl', Record<GroupKindName, { one: string; many: string }>> = {
	en: {
		CEVSEN: { one: 'bab', many: 'babs' },
		HATIM: { one: 'juz', many: 'juz' },
		HIZB: { one: 'portion', many: 'portions' }
	},
	nl: {
		CEVSEN: { one: 'bab', many: 'babs' },
		HATIM: { one: 'cüz', many: 'cüz' },
		HIZB: { one: 'gedeelte', many: 'gedeelten' }
	}
};

/**
 * Turkish puts the noun in whichever case the sentence needs, and vowel harmony picks each
 * suffix, so the forms are spelled out rather than built. A noun after a number stays
 * singular — "33 bölümün hepsi", never "bölümlerin".
 */
const TR_PART_NOUNS: Record<
	GroupKindName,
	{ one: string; many: string; accusative: string; possessiveAccusative: string; genitive: string }
> = {
	CEVSEN: { one: 'bab', many: 'bablar', accusative: 'babı', possessiveAccusative: 'bablarını', genitive: 'babın' },
	// Vowel harmony puts "cüz" at "cüzün" where "bab" is at "babın", so nothing here is built.
	HATIM: { one: 'cüz', many: 'cüzler', accusative: 'cüzü', possessiveAccusative: 'cüzlerini', genitive: 'cüzün' },
	HIZB: {
		one: 'bölüm',
		many: 'bölümler',
		accusative: 'bölümü',
		possessiveAccusative: 'bölümlerini',
		genitive: 'bölümün'
	}
};

const partNoun = (language: 'en' | 'nl', kind: GroupKindName, range: string) =>
	isSinglePart(range) ? PART_NOUNS[language][kind].one : PART_NOUNS[language][kind].many;

const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * "A joiner took over the block you volunteered for."
 *
 * Names the range, because that is the only detail that makes it actionable — and closes on
 * what was *not* lost, since "your babs were taken" is the reading to avoid: the reads they
 * already made still stand.
 */
export const poolClaimReleasedPush = (language: PushLanguage, input: { kind: GroupKindName; range: string }) => {
	const { kind, range } = input;
	const isSingle = isSinglePart(range);

	if (language === 'tr') {
		const nouns = TR_PART_NOUNS[kind];
		const noun = isSingle ? nouns.one : nouns.many;

		return {
			title: `Üstlendiğin ${noun} devredildi`,
			// The closing line is about whatever they read, not about this range, so it stays plural.
			body: `${range}. ${noun} gruba yeni katılan üyenin payı oldu. Okuduğun ${nouns.many} sende kalır.`
		};
	}

	const noun = partNoun(language, kind, range);
	const lead = capitalized(noun);

	if (language === 'nl') {
		/*
		 * "Het deel geworden van" says share with *deel*, which beside "gedeelte" reads as the
		 * same word twice meaning two things — so the Hizb line says it with "hoort bij". The
		 * Cevşen line keeps the wording it has always had.
		 */
		const became =
			kind === 'HIZB'
				? `${isSingle ? 'hoort' : 'horen'} nu bij`
				: `${isSingle ? 'is' : 'zijn'} het deel geworden van`;

		return {
			// No article: Dutch would have to know the noun's gender, and "je" needs none.
			title: isSingle ? `Je overgenomen ${noun} is doorgegeven` : `De ${noun} die je overnam zijn doorgegeven`,
			body: `${lead} ${range} ${became} het nieuwe lid. Wat je al gelezen hebt, blijft van jou.`
		};
	}

	return {
		title: isSingle ? `The ${noun} you took was passed on` : `${lead} you took were passed on`,
		body: `${lead} ${range} became a new member's share. Anything you already read still counts for you.`
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
	input: { groupName: string; kind: GroupKindName; range: string; readerName: string }
) => {
	const { groupName, kind, range, readerName } = input;

	if (language === 'tr') {
		return {
			title: groupName,
			// "Okumasını", not "payını": the range can carry a pool block taken on top of the
			// share, and calling that their share would be untrue. English and Dutch state the
			// babs rather than claim anything about whose they were, so they needed no change.
			// It names no noun at all, which is why a Hizb group's line reads the same.
			body: `${readerName || anonymousMember(language)} okumasını tamamladı (${range}).`
		};
	}

	if (language === 'nl') {
		return {
			title: groupName,
			body: `${readerName || anonymousMember(language)} is klaar met ${partNoun(language, kind, range)} ${range}.`
		};
	}

	return {
		title: groupName,
		body: `${readerName || anonymousMember(language)} finished ${partNoun(language, kind, range)} ${range}.`
	};
};

/**
 * "The group closed the hundred" — or, in a hatim, the thirty, and in a Hizb group the 33.
 *
 * The one notification in the app that is purely good news — every other one is a task, a
 * reminder, or something that was taken away. It names the round, because a group that has run
 * for months is on its fortieth and that number is the record of what they have done together.
 *
 * Sent once per round per group — see `claimRoundCompleteNotice` — and never to whoever read the
 * last bab: their phone is already in their hand and the group screen is about to tell them.
 */
export const roundCompletePush = (
	language: PushLanguage,
	input: { groupName: string; kind: GroupKindName; roundNumber: number }
) => {
	const { groupName, kind, roundNumber } = input;
	// The group's own count — 100, 30 or 33 — so the line says what was actually closed.
	const partCount = partCountFor(kind);

	if (language === 'tr') {
		return {
			title: groupName,
			body: `${roundNumber}. tur tamamlandı — ${partCount} ${TR_PART_NOUNS[kind].genitive} hepsi okundu.`
		};
	}

	if (language === 'nl') {
		return {
			title: groupName,
			body: `Ronde ${roundNumber} is voltooid — alle ${partCount} ${PART_NOUNS.nl[kind].many} gelezen.`
		};
	}

	return {
		title: groupName,
		body: `Round ${roundNumber} is complete — all ${partCount} ${PART_NOUNS.en[kind].many} read.`
	};
};

/**
 * "Somebody took a block out of the shared pool."
 *
 * The pool is the babs nobody's seat is covering this round, and a group only finishes its
 * board if they are covered — so somebody taking one is the group closing a gap, which is
 * worth knowing and is *not* the same event as a share being finished. It names the range for
 * the same reason `groupReadPush` does: what was taken on is the information.
 *
 * Off by default, like the bab-by-bab switch and unlike the round: a busy pool in a large group
 * can fire several times a day, so this is opt-in rather than something to be rescued from.
 */
export const poolClaimPush = (
	language: PushLanguage,
	input: { groupName: string; kind: GroupKindName; range: string; takerName: string }
) => {
	const { groupName, kind, range, takerName } = input;

	if (language === 'tr') {
		const nouns = TR_PART_NOUNS[kind];

		return {
			title: groupName,
			// A lone part takes the ordinal — "19. bölümü", the nineteenth — since "19 bölümü"
			// would read as nineteen of them.
			body: isSinglePart(range)
				? `${takerName || anonymousMember(language)} havuzdan ${range}. ${nouns.accusative} üstlendi.`
				: `${takerName || anonymousMember(language)} havuzdan ${range} ${nouns.possessiveAccusative} üstlendi.`
		};
	}

	if (language === 'nl') {
		return {
			title: groupName,
			body: `${takerName || anonymousMember(language)} heeft ${partNoun(
				language,
				kind,
				range
			)} ${range} uit de pool genomen.`
		};
	}

	return {
		title: groupName,
		body: `${takerName || anonymousMember(language)} took ${partNoun(
			language,
			kind,
			range
		)} ${range} from the pool.`
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
			body: `${memberName || anonymousMember(language)} gruba katıldı — ${
				spots > 0 ? `${memberCount}/${spots}` : memberCount
			} kişi.`
		};
	}

	if (language === 'nl') {
		return {
			title: groupName,
			body: `${memberName || anonymousMember(language)} is lid geworden — ${
				spots > 0 ? `${memberCount}/${spots}` : memberCount
			} leden.`
		};
	}

	return {
		title: groupName,
		body: `${memberName || anonymousMember(language)} joined — ${
			spots > 0 ? `${memberCount}/${spots}` : memberCount
		} members.`
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
			body: `${memberName || anonymousMember(language)} gruptan ayrıldı — ${
				spots > 0 ? `${memberCount}/${spots}` : memberCount
			} kişi.`
		};
	}

	if (language === 'nl') {
		return {
			title: groupName,
			body: `${memberName || anonymousMember(language)} heeft de groep verlaten — ${
				spots > 0 ? `${memberCount}/${spots}` : memberCount
			} leden.`
		};
	}

	return {
		title: groupName,
		body: `${memberName || anonymousMember(language)} left — ${
			spots > 0 ? `${memberCount}/${spots}` : memberCount
		} members.`
	};
};
