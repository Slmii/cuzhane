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
	metaTitle: "Cüzhane · Cevşen, Kur'an hatmi ve Hizbü'l-Hakaik'i birlikte oku",
	metaDescription:
		"Cüzhane; Cevşen bablarını, Kur'an cüzlerini ve Hizbü'l-Hakaik porsiyonlarını tek listede toplar. Grupla ya da tek başına oku, payını işaretle, birlikte tamamla. iOS ve Android için ücretsiz, reklamsız.",
	skipToContent: 'İçeriğe geç',
	ogImageAlt: "Cüzhane — Cevşen, Kur'an hatmi ve Hizbü'l-Hakaik tek uygulamada",
	navCevsen: 'Cevşen',
	navQuran: "Kur'an",
	navHizb: 'Hizb',
	navHow: 'Nasıl çalışır',
	navFaq: 'Sorular',
	kCevsen: 'Cevşen',
	kQuran: "Kur'an hatmi",
	kHizb: "Hizbü'l-Hakaik",
	heroTitle: 'Payını oku, birlikte tamamla.',
	heroBody:
		"Cevşen babları, Kur'an cüzleri ve Hizbü'l-Hakaik porsiyonları tek listede. Sıradaki okuma en üstte, ne kadar süren kaldığı yanında.",
	ctaGet: 'Ücretsiz indir',
	ctaJoin: 'Kodla katıl',
	heroMeta: 'iOS ve Android · Türkçe, English, Nederlands · reklamsız',
	shotHome: "Cüzhane ana ekranı — Cevşen, Kur'an ve Hizb okumaları tek listede",
	kindsEyebrow: 'Üç okuma',
	kindsTitle: 'Grupla ya da tek başına — hangi okumayı seçersen seç.',
	kinds: [
		{
			name: 'Cevşen',
			unit: '100 bab · haftalık tur',
			body: 'Bablar gruba paylaşılır. Herkes kendi aralığını okur, kalanlar ortak havuzda bekler.'
		},
		{
			name: "Kur'an hatmi",
			unit: '30 cüz · bir hatim',
			body: "Cüzler üyelere dağılır. Mushaf'ta, kaldığın sayfadan devam edersin."
		},
		{
			name: "Hizbü'l-Hakaik",
			unit: 'günlük porsiyon · 32 günlük plan',
			body: 'Her güne bir porsiyon. Tekrarlı dualarda sayacı uygulama tutar.'
		}
	],
	cvEyebrow: 'Cevşen',
	cvTitle: 'Yüz bab, gruba paylaşılmış bir tur.',
	cvBody: 'Grup 100 babı her tur birlikte okur. Sana düşen aralık ana ekrana gelir. Okunmayan bablar ortak havuza düşer, gücü yeten üstlenir. Tur saati her üyeye kendi saatiyle gösterilir.',
	cvBullets: [
		'Grup ızgarası: okunan, senin, havuzdaki ve başkasının babı tek bakışta',
		'Okurken üstteki şerit 100 babın neresinde olduğunu gösterir',
		'Ayet işaretine uzun bas, meali açılsın; bitince «Okundu»'
	],
	shotCvGroup: 'Cevşen grubu — Gönül Hatmi, grup ilerlemesi ve bab ızgarası',
	shotCvReader: 'Cevşen okuma ekranı — 35. bab',
	qEyebrow: "Kur'an hatmi",
	qTitle: 'Otuz cüz, bir hatim, birlikte.',
	qBody: "Ramazan hatmi, bir yakının için hatim ya da her ay yeni bir tur. Grubu kur, süresini seç. Cüzler üyelere dağılır, sahipsiz kalanlar havuzda bekler. Okuma Mushaf'ta, kaldığın sayfadan devam eder.",
	qBullets: [
		'Cüz ızgarası: okunan, başkasının, havuzdaki ve senin cüzün',
		'Cüzün sayfa sayfa ilerler; kaç sayfa ve kaç gün kaldığı ana ekranda',
		'Sure başlıkları, ayet işaretleri ve «Kaldığım yeri işaretle»'
	],
	shotQGroup: "Kur'an grubu — Ramazan Hatmi, cüz ızgarası",
	shotQReader: 'Mushaf okuyucu — Lokman suresi',
	hEyebrow: "Hizbü'l-Hakaik",
	hTitle: 'Her güne bir porsiyon; sayıyı uygulama tutar.',
	hBody: '32 günlük planı tek başına ya da grupla başlat. O günün porsiyonu hazır gelir. Sekîne gibi tekrarlı dualarda metne dokun, sayaç bir artsın. Kitaptan okuduysan tek dokunuşla işaretle.',
	hBullets: [
		'Sayaç: metne dokun +1, geri al ya da sıfırla; kaç tekrar kaldığını gösterir',
		'«Kitaptan okudum»: basılı kitaptan okuduğun gün de sayılır',
		'Tur takvimi: okunan, kaçan ve bugünkü gün tek sırada'
	],
	shotHPlan: "Hizbü'l-Hakaik planı — bugünün porsiyonu ve tur takvimi",
	shotHCounter: "Hizbü'l-Hakaik okuma ekranı — Sekîne sayacı 7 / 19",
	howEyebrow: 'Üç adım',
	howTitle: 'Okumayı seç, payını al, birlikte bitir.',
	steps: [
		{
			n: '01',
			title: 'Okumayı seç',
			body: "Cevşen, Kur'an hatmi ya da Hizbü'l-Hakaik. Grup kur, bir koda katıl ya da tek başına başla."
		},
		{
			n: '02',
			title: 'Payını al',
			body: 'Bab aralığın, cüzün ya da günün porsiyonu ana ekrana gelir. Sıradaki en üstte.'
		},
		{
			n: '03',
			title: 'Oku ve işaretle',
			body: 'Uygulamada ya da kitaptan oku, sonra işaretle. Grup ilerlemeyi hemen görür.'
		}
	],
	featTitle: 'Üç okumada da işine yarayanlar.',
	feats: [
		{
			title: 'Ortak havuz',
			body: "Cevşen babları ve Kur'an cüzleri havuzda durur. Kimse görev dağıtmaz, isteyen üstlenir."
		},
		{
			title: 'Tekrar sayacı',
			body: 'Tekrarlı dualarda metne dokun. Kaç kez okuduğunu uygulama sayar.'
		},
		{
			title: 'Kitaptan okudum',
			body: 'Basılı kitaptan okuduysan da işaretle; ilerlemen eksik kalmaz.'
		},
		{
			title: 'Kaldığın yer',
			body: "Mushaf'ta, babda ya da porsiyonda bıraktığın yerden devam et."
		},
		{
			title: 'Kendi saatinle',
			body: 'Tur saati grubun saat dilimine göre kurulur, sana kendi saatinle gösterilir.'
		},
		{
			title: 'Kodla davet',
			body: 'Kod, bağlantı ya da karekod. Yeni üye katılır, payını seçer.'
		}
	],
	faqTitle: 'Sık sorulanlar',
	faq: [
		{
			q: 'Ücretli mi?',
			a: 'Hayır. Cüzhane ücretsiz ve reklamsız.'
		},
		{
			q: 'Hangi okumalar var?',
			a: "Cevşen (100 bab), Kur'an hatmi (30 cüz) ve Hizbü'l-Hakaik (günlük porsiyonlar). Hepsi aynı ana ekranda, süresi en yakın olan en üstte."
		},
		{
			q: "Hizbü'l-Hakaik'i tek başıma okuyabilir miyim?",
			a: 'Evet. Kendine bir plan başlatabilir ya da bir gruba katılabilirsin. Her gün sana düşen porsiyon ana ekranda.'
		},
		{
			q: 'Farklı ülkelerdeyiz, saat sorun olur mu?',
			a: 'Hayır. Tur saati grubun saat dilimine göre belirlenir, her üyeye kendi saatiyle gösterilir.'
		},
		{
			q: 'Hesap açmam gerekir mi?',
			a: 'Evet. Gruba katılmak, pay almak ve ilerlemeni saklamak için ücretsiz bir hesap gerekir.'
		},
		{
			q: 'Verilerim ne olacak?',
			a: 'Yalnızca grup üyeliğin ve okuma ilerlemen saklanır. Üçüncü taraflarla paylaşılmaz, satılmaz.'
		}
	],
	endTitle: 'Bu hafta bir okuma başlat.',
	endBody: 'Okumayı seç, kodu paylaş, ilk payını al. Beş dakika.',
	storeIos: 'iOS için indir',
	storeAndroid: 'Android için indir',
	endMeta: 'Ücretsiz · reklamsız · hesap açmak 30 saniye',
	footLeft: 'Cüzhane · 2026',
	footPrivacy: 'Gizlilik',
	footContact: 'İletişim',
	storeSoon: 'Yakında',
	footMadeBy: 'Yapan'
};

const en: typeof tr = {
	metaTitle: "Cüzhane · Read the Cevşen, a Quran hatim and Hizbü'l-Hakaik together",
	metaDescription:
		"Cüzhane brings Cevşen babs, Quran juz and Hizbü'l-Hakaik portions into one list. Read with a group or on your own, mark your share and finish together. Free and ad-free for iOS and Android.",
	skipToContent: 'Skip to content',
	ogImageAlt: "Cüzhane — the Cevşen, a Quran hatim and Hizbü'l-Hakaik in one app",
	navCevsen: 'Cevşen',
	navQuran: 'Quran',
	navHizb: 'Hizb',
	navHow: 'How it works',
	navFaq: 'Questions',
	kCevsen: 'Cevşen',
	kQuran: 'Quran hatim',
	kHizb: "Hizbü'l-Hakaik",
	heroTitle: 'Read your share, finish it together.',
	heroBody:
		"Cevşen babs, Quran juz and Hizbü'l-Hakaik portions in one list. The next reading sits on top, with the time you have left beside it.",
	ctaGet: 'Download free',
	ctaJoin: 'Join with a code',
	heroMeta: 'iOS and Android · Türkçe, English, Nederlands · no ads',
	shotHome: 'Cüzhane home screen — Cevşen, Quran and Hizb readings in one list',
	kindsEyebrow: 'Three readings',
	kindsTitle: 'With a group or on your own — whichever reading you choose.',
	kinds: [
		{
			name: 'Cevşen',
			unit: '100 babs · weekly round',
			body: 'The babs are shared across the group. Everyone reads their own range; the rest wait in a shared pool.'
		},
		{
			name: 'Quran hatim',
			unit: '30 juz · one hatim',
			body: 'The juz are handed out to members. You read in the Mushaf, right from the page where you stopped.'
		},
		{
			name: "Hizbü'l-Hakaik",
			unit: 'daily portion · 32-day plan',
			body: 'One portion a day. For repeated prayers, the app keeps count for you.'
		}
	],
	cvEyebrow: 'Cevşen',
	cvTitle: 'A hundred babs, one round, shared by the group.',
	cvBody: "Each round, the group reads all 100 babs together. Your range shows up on the home screen. Unread babs drop into a shared pool for whoever can take them. The round's deadline shows in each member's own time.",
	cvBullets: [
		"Group grid: read, yours, in the pool and someone else's — at a glance",
		'While you read, the strip up top shows where you are among the 100 babs',
		"Long-press a verse mark for its translation; tap “Mark read” when you're done"
	],
	shotCvGroup: 'Cevşen group — Gönül Hatmi, group progress and bab grid',
	shotCvReader: 'Cevşen reader — bab 35',
	qEyebrow: 'Quran hatim',
	qTitle: 'Thirty juz, one hatim, together.',
	qBody: 'A Ramadan hatim, a hatim for someone you love, or a new round every month. Start a group and pick how long it runs. The juz go out to members; unclaimed ones wait in the pool. You read in the Mushaf, right from the page where you stopped.',
	qBullets: [
		"Juz grid: read, someone else's, in the pool and yours",
		'Your juz moves page by page; pages and days left show on the home screen',
		'Surah headers, verse marks and “Mark my place”'
	],
	shotQGroup: 'Quran group — Ramadan hatim, juz grid',
	shotQReader: 'Mushaf reader — Surah Luqman',
	hEyebrow: "Hizbü'l-Hakaik",
	hTitle: 'A portion for every day. The app keeps count.',
	hBody: "Start the 32-day plan alone or with a group. Each day's portion is ready for you. For repeated prayers like the Sekîne, tap the text to add one to the count. If you read from the book, mark it with one tap.",
	hBullets: [
		'Counter: tap the text for +1, undo or reset; it shows how many are left',
		'“I read it from the book”: days you read from print count too',
		'Round calendar: read, missed and today in one row'
	],
	shotHPlan: "Hizbü'l-Hakaik plan — today's portion and round calendar",
	shotHCounter: "Hizbü'l-Hakaik reader — Sekîne counter at 7 of 19",
	howEyebrow: 'Three steps',
	howTitle: 'Pick a reading, take your share, finish together.',
	steps: [
		{
			n: '01',
			title: 'Pick a reading',
			body: "Cevşen, a Quran hatim or Hizbü'l-Hakaik. Start a group, join with a code, or go on your own."
		},
		{
			n: '02',
			title: 'Take your share',
			body: "Your bab range, your juz or today's portion lands on the home screen. The next one is on top."
		},
		{
			n: '03',
			title: 'Read and mark it',
			body: 'Read in the app or from the book, then mark it. The group sees your progress right away.'
		}
	],
	featTitle: 'What helps across all three.',
	feats: [
		{
			title: 'Shared pool',
			body: 'Cevşen babs and Quran juz sit in the pool. Nobody hands out tasks; people take what they can.'
		},
		{
			title: 'Repeat counter',
			body: "For repeated prayers, tap the text. The app counts how many times you've read it."
		},
		{
			title: 'I read it from the book',
			body: 'Read from a printed copy? Mark it anyway, so your progress stays complete.'
		},
		{
			title: 'Where you left off',
			body: 'Pick up where you stopped — in the Mushaf, in a bab, or in a portion.'
		},
		{
			title: 'In your own time',
			body: "The round runs on the group's time zone and is shown to you in yours."
		},
		{
			title: 'Invite with a code',
			body: 'Code, link or QR. A new member joins and picks their share.'
		}
	],
	faqTitle: 'Common questions',
	faq: [
		{
			q: 'Does it cost anything?',
			a: 'No. Cüzhane is free and ad-free.'
		},
		{
			q: 'Which readings are there?',
			a: "Cevşen (100 babs), Quran hatim (30 juz) and Hizbü'l-Hakaik (daily portions). All on the same home screen, with the closest deadline on top."
		},
		{
			q: "Can I read Hizbü'l-Hakaik on my own?",
			a: "Yes. Start a plan just for yourself or join a group. Each day's portion is on your home screen."
		},
		{
			q: 'We live in different countries. Is time a problem?',
			a: "No. The round is set in the group's time zone and shown to each member in their own time."
		},
		{
			q: 'Do I need an account?',
			a: 'Yes. You need a free account to join a group, take a share and keep your progress.'
		},
		{
			q: 'What happens to my data?',
			a: 'Only your group membership and reading progress are stored. Never shared or sold.'
		}
	],
	endTitle: 'Start a reading this week.',
	endBody: 'Pick a reading, share the code, take your first share. Five minutes.',
	storeIos: 'Download for iOS',
	storeAndroid: 'Download for Android',
	endMeta: 'Free · no ads · making an account takes 30 seconds',
	footLeft: 'Cüzhane · 2026',
	footPrivacy: 'Privacy',
	footContact: 'Contact',
	storeSoon: 'Coming soon',
	footMadeBy: 'Made by'
};

const nl: typeof tr = {
	metaTitle: "Cüzhane · Lees de Cevşen, een Koran-hatim en Hizbü'l-Hakaik samen",
	metaDescription:
		"Cüzhane zet Cevşen-babs, Koran-juz en Hizbü'l-Hakaik-porties in één lijst. Lees in een groep of alleen, markeer je deel en maak het samen af. Gratis en zonder advertenties voor iOS en Android.",
	skipToContent: 'Naar de inhoud',
	ogImageAlt: "Cüzhane — de Cevşen, een Koran-hatim en Hizbü'l-Hakaik in één app",
	navCevsen: 'Cevşen',
	navQuran: 'Koran',
	navHizb: 'Hizb',
	navHow: 'Hoe het werkt',
	navFaq: 'Vragen',
	kCevsen: 'Cevşen',
	kQuran: 'Koran-hatim',
	kHizb: "Hizbü'l-Hakaik",
	heroTitle: 'Lees je deel, maak het samen af.',
	heroBody:
		"Cevşen-babs, Koran-juz en Hizbü'l-Hakaik-porties in één lijst. De volgende lezing staat bovenaan, met de tijd die je nog hebt ernaast.",
	ctaGet: 'Gratis downloaden',
	ctaJoin: 'Meedoen met code',
	heroMeta: 'iOS en Android · Türkçe, English, Nederlands · geen advertenties',
	shotHome: 'Cüzhane startscherm — Cevşen-, Koran- en Hizb-lezingen in één lijst',
	kindsEyebrow: 'Drie lezingen',
	kindsTitle: 'In een groep of alleen — welke lezing je ook kiest.',
	kinds: [
		{
			name: 'Cevşen',
			unit: '100 babs · wekelijkse ronde',
			body: 'De babs worden over de groep verdeeld. Ieder leest zijn eigen stuk; de rest wacht in een gedeelde pool.'
		},
		{
			name: 'Koran-hatim',
			unit: '30 juz · één hatim',
			body: 'De juz worden over de leden verdeeld. Je leest in de Mushaf, vanaf de pagina waar je stopte.'
		},
		{
			name: "Hizbü'l-Hakaik",
			unit: 'dagelijkse portie · plan van 32 dagen',
			body: 'Elke dag één portie. Bij herhaalde gebeden telt de app voor je mee.'
		}
	],
	cvEyebrow: 'Cevşen',
	cvTitle: 'Honderd babs, één ronde, verdeeld over de groep.',
	cvBody: 'Elke ronde leest de groep samen alle 100 babs. Jouw stuk staat op het startscherm. Ongelezen babs gaan naar een gedeelde pool, voor wie ze kan nemen. De deadline van de ronde zie je in je eigen tijd.',
	cvBullets: [
		'Groepsraster: gelezen, van jou, in de pool en van een ander — in één oogopslag',
		'Tijdens het lezen laat de strook bovenaan zien waar je bent in de 100 babs',
		'Houd een versteken vast voor de vertaling; tik op ‘Gelezen’ als je klaar bent'
	],
	shotCvGroup: 'Cevşen-groep — Gönül Hatmi, groepsvoortgang en babraster',
	shotCvReader: 'Cevşen-leesscherm — bab 35',
	qEyebrow: 'Koran-hatim',
	qTitle: 'Dertig juz, één hatim, samen.',
	qBody: 'Een Ramadan-hatim, een hatim voor een dierbare, of elke maand een nieuwe ronde. Start een groep en kies hoe lang hij loopt. De juz gaan naar de leden; vrije juz wachten in de pool. Je leest in de Mushaf, vanaf de pagina waar je stopte.',
	qBullets: [
		'Juz-raster: gelezen, van een ander, in de pool en van jou',
		"Je juz loopt pagina voor pagina; pagina's en dagen die over zijn staan op het startscherm",
		'Soera-koppen, versmarkeringen en ‘Mijn plek markeren’'
	],
	shotQGroup: 'Koran-groep — Ramadan-hatim, juz-raster',
	shotQReader: 'Mushaf-lezer — soera Luqman',
	hEyebrow: "Hizbü'l-Hakaik",
	hTitle: 'Elke dag een portie. De app houdt de telling bij.',
	hBody: 'Start het plan van 32 dagen alleen of met een groep. De portie van de dag staat klaar. Bij herhaalde gebeden zoals de Sekîne tik je op de tekst, en de teller gaat één omhoog. Heb je uit het boek gelezen? Markeer het met één tik.',
	hBullets: [
		'Teller: tik op de tekst voor +1, zet terug of begin opnieuw; je ziet hoeveel er nog over zijn',
		'‘Ik heb het uit het boek gelezen’: ook dagen uit een gedrukt boek tellen mee',
		'Rondekalender: gelezen, gemist en vandaag op één rij'
	],
	shotHPlan: "Hizbü'l-Hakaik-plan — portie van vandaag en rondekalender",
	shotHCounter: "Hizbü'l-Hakaik-leesscherm — Sekîne-teller op 7 van 19",
	howEyebrow: 'Drie stappen',
	howTitle: 'Kies een lezing, neem je deel, maak het samen af.',
	steps: [
		{
			n: '01',
			title: 'Kies een lezing',
			body: "Cevşen, een Koran-hatim of Hizbü'l-Hakaik. Start een groep, doe mee met een code, of begin alleen."
		},
		{
			n: '02',
			title: 'Neem je deel',
			body: 'Je babs, je juz of de portie van vandaag komt op je startscherm. De volgende staat bovenaan.'
		},
		{
			n: '03',
			title: 'Lees en markeer',
			body: 'Lees in de app of uit het boek en markeer het. De groep ziet je voortgang meteen.'
		}
	],
	featTitle: 'Wat bij alle drie helpt.',
	feats: [
		{
			title: 'Gedeelde pool',
			body: 'Cevşen-babs en Koran-juz liggen in de pool. Niemand deelt taken uit; ieder neemt wat hij kan.'
		},
		{
			title: 'Herhalingsteller',
			body: 'Tik bij herhaalde gebeden op de tekst. De app telt hoe vaak je het las.'
		},
		{
			title: 'Uit het boek gelezen',
			body: 'Gelezen uit een gedrukt boek? Markeer het toch, zodat je voortgang klopt.'
		},
		{
			title: 'Waar je stopte',
			body: 'Ga verder waar je was — in de Mushaf, in een bab of in een portie.'
		},
		{
			title: 'In je eigen tijd',
			body: 'De ronde loopt op de tijdzone van de groep en je ziet hem in de jouwe.'
		},
		{
			title: 'Uitnodigen met code',
			body: 'Code, link of QR. Een nieuw lid doet mee en kiest zijn deel.'
		}
	],
	faqTitle: 'Veelgestelde vragen',
	faq: [
		{
			q: 'Kost het iets?',
			a: 'Nee. Cüzhane is gratis en zonder advertenties.'
		},
		{
			q: 'Welke lezingen zijn er?',
			a: "Cevşen (100 babs), Koran-hatim (30 juz) en Hizbü'l-Hakaik (dagelijkse porties). Allemaal op hetzelfde startscherm, de dichtstbijzijnde deadline bovenaan."
		},
		{
			q: "Kan ik Hizbü'l-Hakaik alleen lezen?",
			a: 'Ja. Start een plan voor jezelf of doe mee met een groep. De portie van elke dag staat op je startscherm.'
		},
		{
			q: 'We wonen in verschillende landen. Is de tijd een probleem?',
			a: 'Nee. De ronde staat in de tijdzone van de groep en ieder lid ziet hem in zijn eigen tijd.'
		},
		{
			q: 'Heb ik een account nodig?',
			a: 'Ja. Je hebt een gratis account nodig om mee te doen, een deel te nemen en je voortgang te bewaren.'
		},
		{
			q: 'Wat gebeurt er met mijn gegevens?',
			a: 'Alleen je groepslidmaatschap en leesvoortgang worden opgeslagen. Nooit gedeeld of verkocht.'
		}
	],
	endTitle: 'Begin deze week een lezing.',
	endBody: 'Kies een lezing, deel de code, neem je eerste deel. Vijf minuten.',
	storeIos: 'Download voor iOS',
	storeAndroid: 'Download voor Android',
	endMeta: 'Gratis · geen advertenties · een account maken duurt 30 seconden',
	footLeft: 'Cüzhane · 2026',
	footPrivacy: 'Privacy',
	footContact: 'Contact',
	storeSoon: 'Binnenkort',
	footMadeBy: 'Gemaakt door'
};

export type Copy = typeof tr;

const COPY: Record<Locale, Copy> = { en, nl, tr };

export const copyFor = (locale: Locale): Copy => COPY[locale];
