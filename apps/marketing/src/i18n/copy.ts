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

/**
 * `og:locale` is not `hreflang`, and lowercasing the tag with an underscore in it is the usual
 * way to get this wrong. Open Graph wants `language_TERRITORY` — a bare `en`, which is a
 * perfectly good `hreflang`, is not a valid `og:locale` and Facebook falls back to `en_US`
 * silently. Spelled out rather than derived, because the territory is a choice: `en_US` is the
 * one Facebook actually recognises, not `en_GB`, whatever the copy's spelling.
 */
export const OG_LOCALES: Record<Locale, string> = {
	en: 'en_US',
	nl: 'nl_NL',
	tr: 'tr_TR'
};

const tr = {
	// Head — not shown on the page, but the most-read words on it.
	metaTitle: "Cüzhane · Cevşen ve Kur'an gruplarında payını oku, turu tamamla",
	metaDescription:
		"Cüzhane, Cevşen'in 100 babını ve Kur'an'ın 30 cüzünü grubuna paylar hâlinde dağıtır. Sahipsiz paylar havuzda durur, herkes gücü kadarını üstlenir, tur birlikte kapanır. iOS ve Android için ücretsiz.",

	navPool: 'Havuz',
	navQuran: "Kur'an hatmi",
	navHow: 'Nasıl çalışır',
	navFeat: 'Özellikler',
	navFaq: 'Sorular',
	skipToContent: 'İçeriğe geç',

	heroEyebrow: "Cevşen ve Kur'an grupları için",
	heroTitle: 'Payını oku, turu tamamla.',
	heroBody:
		"Cüzhane, Cevşen'in 100 babını ve Kur'an'ın 30 cüzünü gruba paylar hâlinde dağıtır. Bugün ne okuyacağın tek listede, sıradaki en üstte; kim neyi üstlendi, ne kadar kaldı, bir bakışta.",
	ctaGet: 'Ücretsiz indir',
	ctaJoin: 'Kodla katıl',
	heroMeta: 'iOS ve Android · Türkçe, English, Nederlands · reklamsız',

	shotHome: "Cüzhane ana ekranı: Cevşen ve Kur'an payları tek listede, sıradaki en üstte",
	// The Kur'an hatim — its own section between the pool and the three steps.
	quranEyebrow: "Kur'an hatmi",
	quranTitle: 'Otuz cüz, bir hatim, birlikte.',
	quranBody:
		"Kırk günlük hatim, bir yakının için hatim ya da her gün bir cüz. Grubu kur, bitiş tarihini seç; cüzler havuza düşer, herkes gücü kadarını alır. Okuma Mushaf'ta, kaldığın sayfada devam eder.",
	quranBullets: [
		'Cüz ızgarası: okunan, başkasının, havuzdaki ve senin cüzün tek bakışta',
		'Bitiş tarihine göre geri sayım; günlük cüz grupları her gece yenilenir',
		'Mushaf okuyucu: sure başlıkları, ayet işaretleri, «Kaldığım yeri işaretle»'
	],
	quranStats: [
		{ v: '30', l: 'cüz · bir hatim' },
		{ v: '604', l: 'sayfa' },
		{ v: '1 liste', l: "Cevşen + Kur'an" }
	],
	shotQuranGroup: "Cüzhane Kur'an grubu — Kırk Günlük Hatim, cüz ızgarası",
	shotQuranReader: 'Cüzhane Mushaf okuyucu — Bakara suresi',
	shotGroup: 'Cüzhane grup ekranı: yüz bablık pano ve üyelerin payları',
	shotReader: 'Cüzhane okuma ekranı: bab şeridi, Arapça metin ve okundu işareti',
	ogImageAlt: 'Cüzhane uygulamasının grup okuma ekranı',

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

	shelfTitle: 'Raf tamamen dolduğunda tur tamamlanır.',
	shelfBody:
		'Her sütun bir pay. Sütunlar eşit değil, çünkü paylar da eşit olmak zorunda değil — biri on bab alır, biri iki.',
	shelfLeft: '1. bab',
	shelfRight: '100. bab',

	progEyebrow: 'Grup ilerlemesi',
	progTitle: 'Tur nerede, kim nerede — tek bakışta.',
	progBody:
		'Her tur için grup ilerlemesi, üstlenilen bablar ve süre geri sayımı. Eksik bablar suçlayan bir liste değil; birlikte kapatılacak bir boşluk.',

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
			title: 'Günlük hatırlatma',
			body: 'Seçtiğin saatte, her gruptaki payını tek satırda toplar. Telefonunda kalır — sunucudan bildirim gelmez.'
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
			q: "Kur'an hatmi de yapılabiliyor mu?",
			a: "Evet. Grup kurarken Kur'an'ı seç; 30 cüz havuza düşer, bitiş tarihi ya da günlük cüz seçilebilir. Cevşen ve Kur'an okumaların aynı ana ekranda sıralanır."
		},
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
	footContact: 'İletişim',
	footMadeBy: 'Yapan'
};

const en: typeof tr = {
	metaTitle: 'Cüzhane · Read your share, finish the round',
	metaDescription:
		'Cüzhane hands the 100 babs of the Cevşen and the 30 juz of the Quran out to your group as shares. Unclaimed shares sit in an open pool, everyone takes what they can carry, and the round closes together. Free on iOS and Android.',

	navPool: 'The pool',
	navQuran: 'Quran hatim',
	navHow: 'How it works',
	navFeat: 'Features',
	navFaq: 'Questions',
	skipToContent: 'Skip to content',

	heroEyebrow: 'For group Cevşen and Quran readings',
	heroTitle: 'Read your share, finish the round.',
	heroBody:
		"Cüzhane hands the 100 babs of the Cevşen and the 30 juz of the Quran out to your group as shares. Today's readings sit in one list with the next one on top — who took what and what's left, at a glance.",
	ctaGet: 'Download free',
	ctaJoin: 'Join with a code',
	heroMeta: 'iOS and Android · Türkçe, English, Nederlands · no ads',

	shotHome: "Cüzhane's home screen: Cevşen and Quran shares in one list, the next one on top",
	// The Kur'an hatim — its own section between the pool and the three steps.
	quranEyebrow: 'Quran hatim',
	quranTitle: 'Thirty juz, one hatim, together.',
	quranBody:
		"A forty-day hatim, a hatim for someone you've lost, or a juz a day. Start a group and pick an end date; the juz go into the pool and everyone takes what they can. Reading happens in the Mushaf, right where you stopped.",
	quranBullets: [
		'Juz grid: read, taken, in the pool and yours — at a glance',
		'Countdown to the end date; daily juz groups reset every night',
		'Mushaf reader with surah headers, verse marks and “Mark my place”'
	],
	quranStats: [
		{ v: '30', l: 'juz · one hatim' },
		{ v: '604', l: 'pages' },
		{ v: '1 list', l: 'Cevşen + Quran' }
	],
	shotQuranGroup: 'Cüzhane Quran group — forty-day hatim, juz grid',
	shotQuranReader: 'Cüzhane Mushaf reader — Al-Baqarah',
	shotGroup: "Cüzhane's group screen: the hundred-bab board and each member's share",
	shotReader: "Cüzhane's reader: the bab strip, Arabic text and the mark-as-read action",
	ogImageAlt: 'Group reading screen of the Cüzhane app',

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

	shelfTitle: 'When the shelf is full, the round is complete.',
	shelfBody:
		"Each column is one share. The columns aren't equal, because shares don't have to be — one person takes ten babs, another takes two.",
	shelfLeft: 'bab 1',
	shelfRight: 'bab 100',

	progEyebrow: 'Group progress',
	progTitle: 'Where the round stands, and where everyone is.',
	progBody:
		'Progress, claimed babs and the countdown for every round. Babs left over aren’t a list of blame — just a gap to close together.',

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
			title: 'A daily reminder',
			body: 'At a time you choose, counting what you still owe across every group. It lives on your phone — nothing is pushed from a server.'
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
			q: 'Can we do a Quran hatim too?',
			a: 'Yes. Choose Quran when you create a group; the 30 juz go into the pool, with an end date or a juz a day. Cevşen and Quran readings share the same home screen.'
		},
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
	footContact: 'Contact',
	footMadeBy: 'Made by'
};

const nl: typeof tr = {
	metaTitle: 'Cüzhane · Lees je deel, maak de ronde af',
	metaDescription:
		'Cüzhane verdeelt de 100 babs van de Cevşen en de 30 juz van de Koran als delen over je groep. Vrije delen liggen open in de pool, ieder neemt wat hij kan dragen, en de ronde sluit samen. Gratis voor iOS en Android.',

	navPool: 'De pool',
	navQuran: 'Koran-hatim',
	navHow: 'Hoe het werkt',
	navFeat: 'Functies',
	navFaq: 'Vragen',
	skipToContent: 'Naar de inhoud',

	heroEyebrow: 'Voor Cevşen- en Koranlezingen in groep',
	heroTitle: 'Lees je deel, maak de ronde af.',
	heroBody:
		'Cüzhane verdeelt de 100 babs van de Cevşen en de 30 juz van de Koran als delen over je groep. De lezingen van vandaag staan in één lijst, de volgende bovenaan — wie wat nam en wat er over is, in één oogopslag.',
	ctaGet: 'Gratis downloaden',
	ctaJoin: 'Meedoen met code',
	heroMeta: 'iOS en Android · Türkçe, English, Nederlands · geen advertenties',

	shotHome: 'Het beginscherm van Cüzhane: Cevşen- en Korandelen in één lijst, de volgende bovenaan',
	// The Kur'an hatim — its own section between the pool and the three steps.
	quranEyebrow: 'Koran-hatim',
	quranTitle: 'Dertig juz, één hatim, samen.',
	quranBody:
		'Een hatim van veertig dagen, een hatim voor een dierbare, of elke dag een juz. Start een groep en kies een einddatum; de juz gaan de pool in en ieder neemt wat hij kan. Je leest in de Mushaf, precies waar je stopte.',
	quranBullets: [
		'Juz-raster: gelezen, van een ander, in de pool en van jou — in één oogopslag',
		'Aftelling tot de einddatum; dagelijkse juz-groepen beginnen elke nacht opnieuw',
		'Mushaf-lezer met soera-koppen, versmarkeringen en ‘Mijn plek markeren’'
	],
	quranStats: [
		{ v: '30', l: 'juz · één hatim' },
		{ v: '604', l: "pagina's" },
		{ v: '1 lijst', l: 'Cevşen + Koran' }
	],
	shotQuranGroup: 'Cüzhane Koran-groep — hatim van veertig dagen, juz-raster',
	shotQuranReader: 'Cüzhane Mushaf-lezer — Al-Baqarah',
	shotGroup: 'Het groepsscherm van Cüzhane: het bord van honderd babs en ieders deel',
	shotReader: 'Het leesscherm van Cüzhane: de babstrook, Arabische tekst en de afvinkknop',
	ogImageAlt: 'Groepsleesscherm van de Cüzhane-app',

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

	shelfTitle: 'Is het rek vol, dan is de ronde klaar.',
	shelfBody:
		'Elke kolom is één deel. De kolommen zijn niet gelijk, want delen hoeven dat ook niet te zijn — de een neemt tien babs, de ander twee.',
	shelfLeft: 'bab 1',
	shelfRight: 'bab 100',

	progEyebrow: 'Voortgang van de groep',
	progTitle: 'Waar de ronde staat en waar iedereen zit.',
	progBody:
		'Voortgang, genomen babs en de aftelling voor elke ronde. Babs die blijven liggen zijn geen lijst met verwijten, maar een gat om samen te dichten.',

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
			title: 'Dagelijkse herinnering',
			body: 'Op een tijd die jij kiest, met wat je in al je groepen nog openstaat. Hij blijft op je toestel — er wordt niets vanaf een server gestuurd.'
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
			q: 'Kunnen we ook een Koran-hatim doen?',
			a: 'Ja. Kies Koran bij het maken van een groep; de 30 juz gaan de pool in, met een einddatum of één juz per dag. Cevşen- en Koranlezingen staan op hetzelfde startscherm.'
		},
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
	footContact: 'Contact',
	footMadeBy: 'Gemaakt door'
};

export type Copy = typeof tr;

const COPY: Record<Locale, Copy> = { en, nl, tr };

export const copyFor = (locale: Locale): Copy => COPY[locale];
