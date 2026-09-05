/**
 * Every word on the site, in the three languages the app speaks. Taken from the design's own
 * `LOC` table rather than re-translated.
 *
 * `en` and `nl` are typed as `typeof tr`, exactly as `apps/web/src/lib/i18n/strings.ts` does it:
 * a key added to one language fails the build until it exists in all three. That is the only
 * thing keeping three tables in step by hand.
 */
export const LOCALES = ['tr', 'en', 'nl'] as const;

export type Locale = (typeof LOCALES)[number];

/** What each language calls itself — never translated, so a reader can always find their own. */
export const LOCALE_NAMES: Record<Locale, string> = {
	en: 'English',
	nl: 'Nederlands',
	tr: 'Türkçe'
};

/** The `lang` attribute and `hreflang` value for each locale. */
export const LOCALE_TAGS: Record<Locale, string> = {
	en: 'en',
	nl: 'nl-NL',
	tr: 'tr-TR'
};

const tr = {
	// Head — not shown on the page, but the most-read words on it.
	metaTitle: 'Cüzhane · Cevşen gruplarında payını oku, turu tamamla',
	metaDescription:
		"Cüzhane, Cevşen'in 100 babını grubuna paylar hâlinde dağıtır. Sahipsiz bablar havuzda durur, herkes gücü kadarını üstlenir, tur birlikte kapanır. iOS ve Android için ücretsiz.",

	navPool: 'Havuz',
	navHow: 'Nasıl çalışır',
	navFeat: 'Özellikler',
	navFaq: 'Sorular',
	skipToContent: 'İçeriğe geç',

	heroEyebrow: 'Cevşen grupları için',
	heroTitle: 'Payını oku, turu tamamla.',
	heroBody:
		"Cüzhane, Cevşen'in 100 babını gruba paylar hâlinde dağıtır ve turun nerede olduğunu tek ekranda gösterir. Kim hangi babı üstlendi, ne kadar kaldı, kim kaldığı yerden devam ediyor.",
	ctaGet: 'Ücretsiz indir',
	ctaJoin: 'Kodla katıl',
	heroMeta: 'iOS ve Android · Türkçe, English, Nederlands · reklamsız',

	mockGreet: 'İyi akşamlar',
	mockName: 'Emine',
	mockPoolTitle: 'Sahipsiz bablar',
	mockPoolSub: ' 3 bab havuzda · üstlenmek için dokun',
	mockStreakCap: 'Seri',
	mockStreakVal: '12 gün',
	mockGroupsCap: 'Gruplarım',
	mockAlt: 'Cüzhane ana ekranı: seri, hafta şeridi ve grup satırları',

	poolEyebrow: 'Uygulamanın kalbi',
	poolTitle: 'Yüz bab, ortada duran bir havuz.',
	poolBody:
		"Cevşen'in 100 babı bir turu oluşturur. Kimse kimseye görev vermez — havuzdaki sahipsiz bablar açıkta durur, herkes gücü kadarını üstlenir. Bırakılan bab havuza geri döner, biri mutlaka sahiplenir.",
	poolLegend: ['Okundu', 'Üstlenildi', 'Havuzda', 'Boş'],
	poolStats: [
		{ v: '100', l: 'bab · bir tur' },
		{ v: '20', l: 'üye sınırı' },
		{ v: '1 dk', l: 'bab üstlenmek' }
	],
	poolGridAlt: 'Bir turun yüz babı: okunanlar, üstlenilenler ve havuzda duranlar',

	howEyebrow: 'Üç adım',
	howTitle: 'Grup kur, bablar dağılsın, turu birlikte bitir.',
	steps: [
		{ n: '01', title: 'Grup kur', body: 'Turun süresini belirle, kodu ya da karekodu paylaş.' },
		{
			n: '02',
			title: 'Babını üstlen',
			body: 'Havuzdaki sahipsiz bablardan seç. Vazgeçersen bab havuza geri döner.'
		},
		{
			n: '03',
			title: 'Turu tamamla',
			body: 'Okudukça raf dolar. 100 bab bitince tur kapanır, yenisi başlar.'
		}
	],

	readerEyebrow: 'Okuma ekranı',
	readerTitle: 'Babı aç, oku, işaretle.',
	readerBody:
		'Arapça metin, ayet işaretleri ve istersen meal. Yazı boyutunu ayarla, ayete uzun bas mealı aç, bittiğinde tek dokunuşla işaretle — grup ilerlemeyi anında görür.',
	readerBullets: [
		'Üstteki 100 sütunluk şerit nerede olduğunu ve havuzun neresi olduğunu gösterir',
		'Ayete uzun basınca meali açılır',
		'Kaldığın bab hatırlanır; gece temasıyla devam eder'
	],
	readerBab: '46. bab · 100 içinde',
	readerMark: 'Okundu işaretle',
	readerAa: 'Aa',
	readerOwn: 'Payım',
	readerAlt: 'Cüzhane okuma ekranı: bab şeridi, Arapça metin ve okundu işareti',

	shelfTitle: 'Raf tamamen dolduğunda tur tamamlanır.',
	shelfBody:
		'Her sütun bir pay. Sütunlar eşit değil, çünkü paylar da eşit olmak zorunda değil — biri on bab alır, biri iki.',
	shelfLeft: '1. bab',
	shelfRight: '100. bab',

	progEyebrow: 'Grup ilerlemesi',
	progTitle: 'Tur nerede, kim nerede — tek bakışta.',
	progBody:
		'Her tur için grup ilerlemesi, üstlenilen bablar ve süre geri sayımı. Eksik bab kalırsa gruba nazikçe hatırlatılır; suçlayan bir liste değil, birlikte kapatılacak bir boşluk.',
	progRound: 'Tur 23',
	progCountdown: '6 sa 12 dk kaldı',
	progDone: '78 / 100 bab',
	progMembersCap: 'Üyeler ve payları',
	progMembers: [
		{ n: 'Emine', r: '1–5 bab', p: '100%' },
		{ n: 'Yusuf', r: '6–12 bab', p: '72%' },
		{ n: 'Havva', r: '13–18 bab', p: '48%' },
		{ n: 'Havuzda', r: '19–24 bab', p: '0%' }
	],

	featTitle: 'Bir turu birlikte yürütmek için gereken her şey.',
	feats: [
		{
			title: 'Bab havuzu',
			body: 'Sahipsiz bablar ortada durur; isteyen üstlenir, kimse kimseye görev dağıtmaz.'
		},
		{
			title: 'Kaldığın yer',
			body: 'Bıraktığın babda devam et. Okuma ekranı yazı boyutunu ve mealini hatırlar.'
		},
		{
			title: 'Nazik hatırlatma',
			body: 'Süre doluyorsa gruba tek dokunuşluk dürtme — suçlama değil, hatırlatma.'
		},
		{ title: 'Açık gruplar', body: "Keşfet'ten herkese açık turlara katıl ya da kendi grubunu listele." },
		{
			title: 'Karekodla davet',
			body: 'Kod, bağlantı veya karekod. Yeni üye kodu okutur, hesabıyla girer, babını seçer.'
		},
		{ title: 'Gece okuma', body: 'Koyu tema, büyük punto, meal yanında. Yatmadan önceki pay için yapıldı.' }
	],

	faqTitle: 'Sık sorulanlar',
	faq: [
		{ q: 'Ücretli mi?', a: 'Hayır. Cüzhane ücretsiz ve reklamsız.' },
		{
			q: 'Hesap açmam gerekir mi?',
			a: 'Evet. Cüzhane hesapla çalışır — gruba katılmak, bab üstlenmek ve ilerlemeni saklamak için ücretsiz bir hesap gerekir.'
		},
		{
			q: 'Grup ne kadar büyük olabilir?',
			a: 'Bir grupta en fazla 20 üye olabilir; bir turun 100 babını aralarında paylaşırlar.'
		},
		{
			q: 'Verilerim ne olacak?',
			a: 'Yalnızca grup üyeliğin ve okuma ilerlemen saklanır. Üçüncü taraflarla paylaşılmaz, satılmaz.'
		}
	],

	endTitle: 'Bu hafta bir tur başlat.',
	endBody: 'Grubu kur, kodu paylaş, ilk babı üstlen. Beş dakika.',
	storeIos: 'iOS için indir',
	storeAndroid: 'Android için indir',
	storeSoon: 'Yakında',
	endMeta: 'Ücretsiz · reklamsız · hesap açmak 30 saniye',

	footLeft: 'Cüzhane · 2026',
	footPrivacy: 'Gizlilik',
	footContact: 'İletişim'
};

const en: typeof tr = {
	metaTitle: 'Cüzhane · Read your share, finish the round',
	metaDescription:
		'Cüzhane hands the 100 babs of the Cevşen out to your group as shares. Unclaimed babs sit in an open pool, everyone takes what they can carry, and the round closes together. Free on iOS and Android.',

	navPool: 'The pool',
	navHow: 'How it works',
	navFeat: 'Features',
	navFaq: 'Questions',
	skipToContent: 'Skip to content',

	heroEyebrow: 'For group Cevşen readings',
	heroTitle: 'Read your share, finish the round.',
	heroBody:
		"Cüzhane hands the 100 babs of the Cevşen out to your group as shares and shows where the round stands on one screen. Who took which bab, what's left, who's picking up where they stopped.",
	ctaGet: 'Download free',
	ctaJoin: 'Join with a code',
	heroMeta: 'iOS and Android · Türkçe, English, Nederlands · no ads',

	mockGreet: 'Good evening',
	mockName: 'Emine',
	mockPoolTitle: 'Unclaimed babs',
	mockPoolSub: '3 babs in the pool · tap to claim',
	mockStreakCap: 'Streak',
	mockStreakVal: '12 days',
	mockGroupsCap: 'My groups',
	mockAlt: "Cüzhane's home screen: streak, week strip and group rows",

	poolEyebrow: 'The heart of the app',
	poolTitle: 'A hundred babs, and a pool left in the open.',
	poolBody:
		'The 100 babs of the Cevşen make one round. Nobody assigns anybody anything — unclaimed babs sit in the open pool and each person takes what they can carry. Drop a bab and it returns to the pool, where someone else picks it up.',
	poolLegend: ['Read', 'Claimed', 'In the pool', 'Untouched'],
	poolStats: [
		{ v: '100', l: 'babs · one round' },
		{ v: '20', l: 'member limit' },
		{ v: '1 min', l: 'to claim a bab' }
	],
	poolGridAlt: 'The hundred babs of a round: read, claimed, and still in the pool',

	howEyebrow: 'Three steps',
	howTitle: 'Start a group, let the babs spread out, finish the round together.',
	steps: [
		{ n: '01', title: 'Start a group', body: "Set the round's deadline. Share the code or the QR." },
		{
			n: '02',
			title: 'Claim your babs',
			body: 'Pick from the open pool. Change your mind and the bab goes back.'
		},
		{
			n: '03',
			title: 'Finish the round',
			body: 'The shelf fills as you read. At 100 babs the round closes and the next one opens.'
		}
	],

	readerEyebrow: 'The reader',
	readerTitle: 'Open the bab, read it, mark it.',
	readerBody:
		'Arabic text, verse marks, and the translation when you want it. Set the type size, long-press a verse for its meaning, and mark it done in one tap — the group sees it immediately.',
	readerBullets: [
		'The 100-column strip up top shows where you are and where the pool is',
		'Long-press a verse to open its translation',
		'Your last bab is remembered, and carries over into the dark theme'
	],
	readerBab: 'bab 46 of 100',
	readerMark: 'Mark as read',
	readerAa: 'Aa',
	readerOwn: 'My share',
	readerAlt: "Cüzhane's reader: the bab strip, Arabic text and the mark-as-read action",

	shelfTitle: 'When the shelf is full, the round is complete.',
	shelfBody:
		"Each column is one share. The columns aren't equal, because shares don't have to be — one person takes ten babs, another takes two.",
	shelfLeft: 'bab 1',
	shelfRight: 'bab 100',

	progEyebrow: 'Group progress',
	progTitle: 'Where the round stands, and where everyone is.',
	progBody:
		'Progress, claimed babs and the countdown for every round. If babs are left over, the group gets a gentle reminder — not a list of blame, just a gap to close together.',
	progRound: 'Round 23',
	progCountdown: '6 h 12 m left',
	progDone: '78 / 100 babs',
	progMembersCap: 'Members and their shares',
	progMembers: [
		{ n: 'Emine', r: 'babs 1–5', p: '100%' },
		{ n: 'Yusuf', r: 'babs 6–12', p: '72%' },
		{ n: 'Havva', r: 'babs 13–18', p: '48%' },
		{ n: 'In the pool', r: 'babs 19–24', p: '0%' }
	],

	featTitle: 'Everything a group round actually needs.',
	feats: [
		{
			title: 'Bab pool',
			body: 'Unclaimed babs sit in the open — people take them. No one has to assign work.'
		},
		{
			title: 'Where you left off',
			body: 'Resume on the exact bab. The reader remembers your text size and translation.'
		},
		{
			title: 'Gentle nudge',
			body: 'Deadline closing in? Send the group a one-tap nudge — a reminder, not a scolding.'
		},
		{ title: 'Open groups', body: 'Join a public round from Discover, or list your own group for others.' },
		{
			title: 'Invite by QR',
			body: 'Code, link or QR. A new member scans it, signs in, and picks their babs.'
		},
		{
			title: 'Night reading',
			body: 'Dark theme, large type, translation alongside. Built for the share you read before bed.'
		}
	],

	faqTitle: 'Common questions',
	faq: [
		{ q: 'Does it cost anything?', a: 'No. Cüzhane is free and ad-free.' },
		{
			q: 'Do I need an account?',
			a: 'Yes. Cüzhane runs on accounts — you need a free account to join a group, claim babs and keep your progress.'
		},
		{
			q: 'How big can a group be?',
			a: 'Up to 20 members per group, sharing the 100 babs of a round between them.'
		},
		{
			q: 'What happens to my data?',
			a: 'Only your group membership and reading progress are stored. Never shared or sold.'
		}
	],

	endTitle: 'Start a round this week.',
	endBody: 'Create the group, share the code, claim the first bab. Five minutes.',
	storeIos: 'Download for iOS',
	storeAndroid: 'Download for Android',
	storeSoon: 'Coming soon',
	endMeta: 'Free · no ads · making an account takes 30 seconds',

	footLeft: 'Cüzhane · 2026',
	footPrivacy: 'Privacy',
	footContact: 'Contact'
};

const nl: typeof tr = {
	metaTitle: 'Cüzhane · Lees je deel, maak de ronde af',
	metaDescription:
		'Cüzhane verdeelt de 100 babs van de Cevşen als delen over je groep. Vrije babs liggen open in de pool, ieder neemt wat hij kan dragen, en de ronde wordt samen afgemaakt. Gratis voor iOS en Android.',

	navPool: 'De pool',
	navHow: 'Hoe het werkt',
	navFeat: 'Functies',
	navFaq: 'Vragen',
	skipToContent: 'Naar de inhoud',

	heroEyebrow: 'Voor Cevşen-lezingen in groep',
	heroTitle: 'Lees je deel, maak de ronde af.',
	heroBody:
		'Cüzhane verdeelt de 100 babs van de Cevşen als delen over je groep en laat op één scherm zien waar de ronde staat. Wie welke bab nam, wat er over is, wie verdergaat waar hij stopte.',
	ctaGet: 'Gratis downloaden',
	ctaJoin: 'Meedoen met code',
	heroMeta: 'iOS en Android · Türkçe, English, Nederlands · geen advertenties',

	mockGreet: 'Goedenavond',
	mockName: 'Emine',
	mockPoolTitle: 'Vrije babs',
	mockPoolSub: '3 babs in de pool · tik om te nemen',
	mockStreakCap: 'Reeks',
	mockStreakVal: '12 dagen',
	mockGroupsCap: 'Mijn groepen',
	mockAlt: 'Het beginscherm van Cüzhane: reeks, weekstrook en groepsrijen',

	poolEyebrow: 'Het hart van de app',
	poolTitle: 'Honderd babs en een pool die open blijft.',
	poolBody:
		'De 100 babs van de Cevşen vormen één ronde. Niemand deelt taken uit — vrije babs liggen open in de pool en ieder neemt wat hij kan dragen. Laat je een bab los, dan gaat hij terug naar de pool en pakt iemand anders hem op.',
	poolLegend: ['Gelezen', 'Genomen', 'In de pool', 'Nog vrij'],
	poolStats: [
		{ v: '100', l: 'babs · één ronde' },
		{ v: '20', l: 'maximaal leden' },
		{ v: '1 min', l: 'om een bab te nemen' }
	],
	poolGridAlt: 'De honderd babs van een ronde: gelezen, genomen en nog in de pool',

	howEyebrow: 'Drie stappen',
	howTitle: 'Groep starten, babs verdelen, de ronde samen afmaken.',
	steps: [
		{ n: '01', title: 'Groep starten', body: 'Bepaal de einddatum van de ronde. Deel de code of de QR.' },
		{
			n: '02',
			title: 'Babs nemen',
			body: 'Kies uit de vrije babs in de pool. Zie je het niet zitten, dan gaat de bab terug.'
		},
		{
			n: '03',
			title: 'Ronde afmaken',
			body: 'Het rek vult zich terwijl je leest. Bij 100 babs sluit de ronde en begint de volgende.'
		}
	],

	readerEyebrow: 'Het leesscherm',
	readerTitle: 'Bab openen, lezen, afvinken.',
	readerBody:
		'Arabische tekst, versmarkeringen en de vertaling als je die wilt. Zet je lettergrootte, houd een vers vast voor de betekenis, en vink met één tik af — de groep ziet het meteen.',
	readerBullets: [
		'De strook van 100 kolommen bovenaan laat zien waar je bent en waar de pool zit',
		'Houd een vers vast om de vertaling te openen',
		'Je laatste bab wordt onthouden, ook in het donkere thema'
	],
	readerBab: 'bab 46 van 100',
	readerMark: 'Als gelezen markeren',
	readerAa: 'Aa',
	readerOwn: 'Mijn deel',
	readerAlt: 'Het leesscherm van Cüzhane: de babstrook, Arabische tekst en de afvinkknop',

	shelfTitle: 'Is het rek vol, dan is de ronde klaar.',
	shelfBody:
		'Elke kolom is één deel. De kolommen zijn niet gelijk, want delen hoeven dat ook niet te zijn — de een neemt tien babs, de ander twee.',
	shelfLeft: 'bab 1',
	shelfRight: 'bab 100',

	progEyebrow: 'Voortgang van de groep',
	progTitle: 'Waar de ronde staat en waar iedereen zit.',
	progBody:
		'Voortgang, genomen babs en de aftelling voor elke ronde. Blijven er babs liggen, dan krijgt de groep een vriendelijke herinnering — geen lijst met verwijten, maar een gat om samen te dichten.',
	progRound: 'Ronde 23',
	progCountdown: '6 u 12 m over',
	progDone: '78 / 100 babs',
	progMembersCap: 'Leden en hun delen',
	progMembers: [
		{ n: 'Emine', r: 'bab 1–5', p: '100%' },
		{ n: 'Yusuf', r: 'bab 6–12', p: '72%' },
		{ n: 'Havva', r: 'bab 13–18', p: '48%' },
		{ n: 'In de pool', r: 'bab 19–24', p: '0%' }
	],

	featTitle: 'Alles wat een ronde in groep echt nodig heeft.',
	feats: [
		{
			title: 'Babpool',
			body: 'Vrije babs liggen open; wie wil, neemt er een. Niemand hoeft taken uit te delen.'
		},
		{
			title: 'Waar je stopte',
			body: 'Ga verder op precies dezelfde bab, met je tekstgrootte en vertaling.'
		},
		{
			title: 'Vriendelijk duwtje',
			body: 'Loopt de tijd af? Stuur de groep met één tik een herinnering, geen verwijt.'
		},
		{
			title: 'Open groepen',
			body: 'Doe mee aan een openbare ronde via Ontdek, of zet je eigen groep in de lijst.'
		},
		{
			title: 'Uitnodigen met QR',
			body: 'Code, link of QR. Een nieuw lid scant, meldt zich aan en kiest zijn babs.'
		},
		{
			title: "Lezen 's avonds",
			body: 'Donker thema, grote letters, vertaling ernaast. Voor het deel vlak voor het slapen.'
		}
	],

	faqTitle: 'Veelgestelde vragen',
	faq: [
		{ q: 'Kost het iets?', a: 'Nee. Cüzhane is gratis en zonder advertenties.' },
		{
			q: 'Heb ik een account nodig?',
			a: 'Ja. Cüzhane werkt met accounts — je hebt een gratis account nodig om mee te doen, babs te nemen en je voortgang te bewaren.'
		},
		{
			q: 'Hoe groot kan een groep zijn?',
			a: 'Maximaal 20 leden per groep, die samen de 100 babs van een ronde verdelen.'
		},
		{
			q: 'Wat gebeurt er met mijn gegevens?',
			a: 'Alleen je groepslidmaatschap en leesvoortgang worden opgeslagen. Nooit gedeeld of verkocht.'
		}
	],

	endTitle: 'Begin deze week een ronde.',
	endBody: 'Maak de groep, deel de code, neem de eerste bab. Vijf minuten.',
	storeIos: 'Download voor iOS',
	storeAndroid: 'Download voor Android',
	storeSoon: 'Binnenkort',
	endMeta: 'Gratis · geen advertenties · een account maken duurt 30 seconden',

	footLeft: 'Cüzhane · 2026',
	footPrivacy: 'Privacy',
	footContact: 'Contact'
};

export type Copy = typeof tr;

const COPY: Record<Locale, Copy> = { en, nl, tr };

export const copyFor = (locale: Locale): Copy => COPY[locale];

/** The seven weekday initials the phone mock's streak strip draws. */
export const WEEK_INITIALS: Record<Locale, readonly string[]> = {
	en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
	nl: ['M', 'D', 'W', 'D', 'V', 'Z', 'Z'],
	tr: ['P', 'S', 'Ç', 'P', 'C', 'C', 'P']
};

/** The three groups in the phone mock, whose names are the only translated part. */
export const MOCK_ROWS: Record<Locale, readonly { range: string; name: string; pct: string; cta: string }[]> = {
	en: [
		{ cta: 'Read', name: 'Neighbourhood', pct: '72%', range: '1–5' },
		{ cta: 'Done', name: 'Friday circle', pct: '100%', range: '12' },
		{ cta: 'Read', name: 'Family', pct: '34%', range: '23–24' }
	],
	nl: [
		{ cta: 'Lees', name: 'Wijkgroep', pct: '72%', range: '1–5' },
		{ cta: 'Klaar', name: 'Vrijdagkring', pct: '100%', range: '12' },
		{ cta: 'Lees', name: 'Familie', pct: '34%', range: '23–24' }
	],
	tr: [
		{ cta: 'Oku', name: 'Mahalle grubu', pct: '72%', range: '1–5' },
		{ cta: 'Bitti', name: 'Cuma halkası', pct: '100%', range: '12' },
		{ cta: 'Oku', name: 'Aile', pct: '34%', range: '23–24' }
	]
};
