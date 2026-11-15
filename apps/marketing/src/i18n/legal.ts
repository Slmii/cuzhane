import { CONTACT_EMAIL } from '../config';
import type { Locale } from './copy';

/**
 * The privacy policy and the support page.
 *
 * **Every claim here is checked against the code, not against a template.** App Store Connect's
 * privacy questionnaire has to agree with this page, and the app's own behaviour has to agree
 * with both — so if a column is added to `UserSettings`, or a third-party service starts
 * receiving anything, this file changes in the same commit.
 *
 * What the app actually holds today: a Clerk account (email, name, optional photo), group
 * membership and reading progress, per-user settings, an Expo push token, and any feedback
 * message sent from the app. There is no analytics, no advertising, no tracking, and nothing
 * is sold or shared.
 */
export interface LegalSection {
	heading: string;
	paragraphs: string[];
	bullets?: string[];
}

export interface LegalPage {
	title: string;
	metaTitle: string;
	metaDescription: string;
	updated: string;
	intro: string;
	sections: LegalSection[];
}

const UPDATED = '2026-10-01';

const privacyTr: LegalPage = {
	title: 'Gizlilik',
	metaTitle: 'Gizlilik · Cüzhane',
	metaDescription:
		'Cüzhane hangi verileri saklar, neden saklar ve nasıl silersiniz. Reklam yok, izleme yok, üçüncü taraflara satış yok.',
	updated: UPDATED,
	intro: 'Cüzhane, çalışması için gereken en az veriyi saklar. Reklam göstermez, seni izlemez, verini satmaz.',
	sections: [
		{
			heading: 'Sakladığımız veriler',
			paragraphs: ['Uygulamayı kullanmak için bir hesap gerekir. Sakladıklarımız şunlarla sınırlıdır:'],
			bullets: [
				'Hesabın: e-posta adresin, adın ve yüklediysen profil fotoğrafın.',
				'Grupların: kurduğun veya katıldığın grupların adları, niyet metni, üyeliğin ve grup içindeki sıran.',
				'Okuma ilerlemen: hangi babı hangi turda okuduğun, havuzdan üstlendiğin bablar, bir grubun cüzünde ya da Hizb bölümünde kaldığın sayfa ile kaç sayfa okuduğun, ve Hizbü’l-Hakaik’te sayarak okunan kısımları (Sekine, Delâil, istiğfar) her turda kaç kez okuduğun.',
				'Ayarların: arayüz dili, tema, günlük hatırlatmaların saatleri (Cevşen ve Hizbü’l-Hakaik için ayrı), bildirim tercihlerin ve okuma ekranının yazı tipi ile boyutu; ayrıca hangi ipuçlarını zaten gördüğün.',
				'Bildirim kutun: gruplarında olan bitenin kaydı — olayın türü, grubun adı ve ilgili üyenin görünen adı.',
				'Bildirim için cihaz anahtarın (push token).',
				'Uygulamadan geri bildirim gönderdiysen: mesajın, konusu, hesabının e-posta adresi, cihazının platform, sürüm ve dil bilgisi ve bir hatayı bulabilmemiz için uygulamada son açtığın en fazla 30 ekran (ekran adları ve bab numarası gibi sayılar; isim ya da metin yok).'
			]
		},
		{
			heading: 'Saklamadığımız veriler',
			paragraphs: [
				'Analitik aracı kullanmıyoruz. Reklam ağı yok, izleme pikseli yok, üçüncü taraf çerezi yok. Konumunu, rehberini, takvimini veya cihazındaki başka hiçbir şeyi okumuyoruz. Okuduğun metnin kendisi uygulamayla birlikte gelir; hangi kelimeyi ne zaman okuduğun sunucuya gitmez — birlikte okuma dışında; aşağıya bak.'
			]
		},
		{
			heading: 'Kuran metni',
			paragraphs: [
				'Uygulamadaki Kuran metni, Kral Fahd Kur’an-ı Kerim Basım Kompleksi’nin (Medine) Medine Mushafı’dır. Quran Foundation’ın (quran.com) API’sinden alınır ve uygulamayla birlikte gelir. Metin cihazında okunur. Bir âyete basılı tuttuğunda meali, kendi sunucumuz aracılığıyla Quran Foundation’dan o an istenir: yalnızca âyetin numarası ve dil gider; hesabın ya da senin hakkında hiçbir bilgi gitmez. Meal cihazında saklanmaz.'
			]
		},
		{
			heading: 'Verini kimler görür',
			paragraphs: [
				'Grup üyeleri birbirinin adını, payını ve ilerlemesini görür — bir hatmi birlikte yürütmenin gereği budur. Grubu kuran kişi isimleri gizleyebilir; o zaman adları yalnızca kurucu görür ve Hizbü’l-Hakaik gruplarında kurucunun seçtiği en fazla üç okuma sorumlusu da görür. Bunun dışında verin yalnızca aşağıdaki hizmet sağlayıcılarında işlenir:'
			],
			bullets: [
				'Clerk — hesap ve oturum yönetimi.',
				'DigitalOcean — sunucunun ve veritabanının barındırıldığı yer (Avrupa).',
				'Expo — yalnızca bildirim gönderimi için; bildirimin metni ve cihaz anahtarı iletilir.',
				'Cloudflare — yalnızca birlikte okumada okuyucu sesini açtığında; ses, takip edenlere ulaşmak için canlı olarak Cloudflare üzerinden geçer ve kaydedilmez.'
			]
		},
		{
			heading: 'Birlikte okuma',
			paragraphs: [
				'Serbest Cevşen’de ya da Mushaf’ta birlikte okurken okuyucunun yeri — hangi bab ya da sayfada olduğu, sayfanın neresinde olduğu ve dokunduğu satır — sunucumuz üzerinden takip edenlere canlı olarak gider. Bu yer kaydedilmez: sunucu onu yalnızca oturum sürerken bellekte tutar.',
				'Oturum sürerken sunucuda küçük bir kayıt durur: katılma kodu, oturumu başlatan kişi ve okunan şey (Cevşen ya da Kuran). Oturum bittiğinde bu kayıt normalde silinir — okuyucu bitirdiğinde, okuyucu bir dakika içinde dönmediğinde, on dakika okunmadığında ya da en geç dört saat sonra. Oturum yarıda kesilirse (örneğin sunucu yeniden başlarsa) kayıt daha uzun kalabilir; okuyucu yeni bir oturum açtığında, biri o kodu aradığında ya da hesap silindiğinde silinir.',
				'Bir oturumdaki herkes okuyucunun ve diğer takip edenlerin adını görür; burada grup olmadığı için isimler gizlenemez. Kodu kiminle paylaşacağına sen karar verirsin. Birlikte okuma hiçbir şeyi okundu olarak işaretlemez ve kimsenin ilerlemesini değiştirmez.',
				'Okuyucu isterse sesini açabilir; o zaman sesi, oturumdakilerden dinlemeyi seçenlere canlı olarak gider. Ses sunucumuzdan geçmez: Cloudflare’in sunucuları onu takip edenlere iletir. Ses ne bizim tarafımızdan ne de Cloudflare tarafından kaydedilir veya saklanır. Mikrofon yalnızca okuyucu sesini açtığında ve açık kaldığı sürece kullanılır; ilk açışta telefonun izin istenir.'
			]
		},
		{
			heading: 'Bildirimler',
			paragraphs: [
				'Günlük hatırlatmalar (Cevşen ve Hizbü’l-Hakaik için ayrı) cihazında kurulur ve sunucuya çıkmaz. Ayrıca sunucu altı durumda bildirim gönderir: havuzdan üstlendiğin bir bab başkasına geçtiğinde, grubundaki biri payını tamamladığında, grubun turu bitirdiğinde, biri ortak havuzdan bab üstlendiğinde, gruba biri katıldığında ve gruptan biri ayrıldığında. İlki dışındakileri Bildirimler ekranındaki ayarlardan ayrı ayrı açıp kapatabilirsin. Tek istisna: okuma sorumluları seçilmiş bir Hizbü’l-Hakaik grubunda “okudu” bildirimini yalnızca bu sorumlular alır, kendi ayarları ne olursa olsun; diğer üyeler almaz.'
			]
		},
		{
			heading: 'Verini silmek',
			paragraphs: [
				'Uygulama içinden Profil → Hesabı sil yolunu izlediğinde hesabın ve verin kalıcı olarak silinir: kurduğun gruplar üyeleriyle birlikte, katıldığın gruplardaki üyeliklerin, ayarların, bildirim kutun, cihaz anahtarların ve gönderdiğin geri bildirimler. Bu işlem geri alınamaz.',
				'Katıldığın (ama kurmadığın) bir grupta, hangi babın hangi turda okunduğu kaydı grubun geçmişinde kalır — kalmasaydı diğer üyelerin birlikte tamamladığı turlar eksik görünürdü. Bu kayıt yalnızca bir hesap kimliği taşır; adın, e-postan ve fotoğrafın silindiği için artık bir kişiye çözülmez.',
				'Veritabanının şifreli yedekleri sunucuda 14 gün, sunucu dışında en fazla 90 gün tutulur; silinen bir kayıt en çok o kadar süre yedeklerde kalır. Ayrıntı: /delete-account sayfası.',
				`Silme, düzeltme veya verine erişim taleplerin için ${CONTACT_EMAIL} adresine yazabilirsin.`
			]
		},
		{
			heading: 'Çocuklar',
			paragraphs: ['Cüzhane çocuklara yönelik bir uygulama değildir ve çocuklardan bilerek veri toplamaz.']
		},
		{
			heading: 'Değişiklikler',
			paragraphs: [
				'Bu sayfa değişirse üstündeki tarih güncellenir. Önemli bir değişiklik olursa uygulama içinden haber veririz.'
			]
		}
	]
};

const privacyEn: LegalPage = {
	title: 'Privacy',
	metaTitle: 'Privacy · Cüzhane',
	metaDescription:
		'What Cüzhane stores, why it stores it, and how to delete it. No ads, no tracking, nothing sold to anyone.',
	updated: UPDATED,
	intro: 'Cüzhane keeps the least data it can and still work. No advertising, no tracking, nothing sold.',
	sections: [
		{
			heading: 'What we store',
			paragraphs: ['Using the app requires an account. What we hold is limited to:'],
			bullets: [
				'Your account: email address, name, and a profile photo if you upload one.',
				'Your groups: the names of groups you create or join, their intention text, your membership and your seat within the group.',
				'Your reading progress: which bab you read in which round, any babs you claimed from the pool, in a group’s cüz or Hizb portion the page you stopped on and how many pages you have read, and how many times you have read the counted passages of the Hizbü’l-Hakaik (Sekine, Delâil, istighfar) in each round.',
				'Your settings: interface language, theme, the times of your daily reminders (one for the Cevşen, one for the Hizbü’l-Hakaik), your notification preferences, and the reader’s typeface and size; also which tips you have already seen.',
				'Your notification inbox: a record of what happened in your groups — the kind of event, the group’s name, and the display name of the member it concerns.',
				'A device key for notifications (a push token).',
				'If you send feedback from the app: your message, its topic, your account email, your device’s platform, version and language, and — so we can trace a bug — the last 30 or fewer screens you opened in the app (screen names and numbers such as a bab’s; no names or text).'
			]
		},
		{
			heading: 'What we do not store',
			paragraphs: [
				'There is no analytics tool. No advertising network, no tracking pixel, no third-party cookie. We do not read your location, contacts, calendar, or anything else on your device. The text you read ships inside the app; which words you read, and when, never reaches the server — except when reading together; see below.'
			]
		},
		{
			heading: 'The Quran text',
			paragraphs: [
				'The Quran text in the app is the Madinah Mushaf of the King Fahd Glorious Qur’an Printing Complex (Madinah). It comes from the Quran Foundation’s API (quran.com) and ships inside the app. It is read on your device. When you long-press a verse, its translation is requested from the Quran Foundation at that moment, through our own server: only the verse number and the language are sent — nothing about you or your account. The translation is not stored on your device.'
			]
		},
		{
			heading: 'Who can see your data',
			paragraphs: [
				'Members of a group can see each other’s name, share and progress — that is what running a hatim together means. A group’s creator can hide names; then only the creator sees them, and in a Hizbü’l-Hakaik group so do up to three responsible members the creator chooses. Beyond that, your data is processed only by these providers:'
			],
			bullets: [
				'Clerk — accounts and sessions.',
				'DigitalOcean — where the server and database are hosted (Europe).',
				'Expo — for delivering notifications only; the notification text and the device key are passed to it.',
				'Cloudflare — only when the reader turns on their voice while reading together; the voice passes live through Cloudflare to reach the people following, and is not recorded.'
			]
		},
		{
			heading: 'Reading together',
			paragraphs: [
				'When you read together in the free Cevşen or Mushaf, the reader’s place — which bab or page they are on, how far down it, and the line they tap — goes through our server to the people following, live. That place is not saved: the server holds it in memory only while the session runs.',
				'While a session runs, the server keeps a small record of it: the join code, who started it and what is being read (Cevşen or Quran). The record is normally deleted when the session ends — when the reader ends it, when the reader does not come back within a minute, after ten minutes without reading, or after four hours at most. If a session is cut off (for example by a server restart), the record can stay longer; it is deleted when that reader starts a new session, when someone looks up its code, or when the account is deleted.',
				'Everyone in a session sees the names of the reader and of the others following; there is no group here, so names cannot be hidden. You decide who you share the code with. Reading together marks nothing as read and changes nobody’s progress.',
				'The reader can choose to turn on their voice; it then goes live to the people in the session who choose to listen. The voice does not pass through our server: Cloudflare’s servers carry it to the people following. It is not recorded or stored, by us or by Cloudflare. The microphone is used only when the reader turns their voice on, and only while it stays on; the phone asks for permission the first time.'
			]
		},
		{
			heading: 'Notifications',
			paragraphs: [
				'The daily reminders (one for the Cevşen, one for the Hizbü’l-Hakaik) are scheduled on your device and never leave it. Separately, the server sends a notification in six cases: when a bab you claimed from the pool passes to somebody else, when someone in your group finishes their share, when your group completes a round, when someone takes babs from the shared pool, when someone joins one of your groups, and when someone leaves one. All but the first can each be turned off from the notification settings. One exception: in a Hizbü’l-Hakaik group with responsible members, only they get the “has read” notification, whatever their own settings; the other members don’t.'
			]
		},
		{
			heading: 'Deleting your data',
			paragraphs: [
				'Profile → Delete account, inside the app, permanently deletes your account and your data: groups you own along with their members, your memberships in groups you joined, your settings, your notification inbox, your device keys, and any feedback you sent. This cannot be undone.',
				'In a group you joined but did not create, the record that a bab was read in a given round stays in that group’s history — without it, rounds the other members finished together would develop holes. That record carries an account identifier and nothing else, and once your account is gone it no longer resolves to a person.',
				'Encrypted backups of the database are kept for 14 days on the server and at most 90 days off-site, so a deleted record persists in those snapshots for up to that long. The account deletion page has the detail.',
				`For access, correction or deletion requests, write to ${CONTACT_EMAIL}.`
			]
		},
		{
			heading: 'Children',
			paragraphs: ['Cüzhane is not directed at children and does not knowingly collect data from them.']
		},
		{
			heading: 'Changes',
			paragraphs: [
				'If this page changes, the date above it changes with it. We will say so in the app if a change is significant.'
			]
		}
	]
};

const privacyNl: LegalPage = {
	title: 'Privacy',
	metaTitle: 'Privacy · Cüzhane',
	metaDescription:
		'Wat Cüzhane bewaart, waarom, en hoe je het verwijdert. Geen advertenties, geen tracking, niets verkocht.',
	updated: UPDATED,
	intro: 'Cüzhane bewaart zo min mogelijk gegevens. Geen advertenties, geen tracking, niets wordt verkocht.',
	sections: [
		{
			heading: 'Wat we bewaren',
			paragraphs: ['Voor de app heb je een account nodig. Wat we bewaren blijft beperkt tot:'],
			bullets: [
				'Je account: e-mailadres, naam en een profielfoto als je die uploadt.',
				'Je groepen: de namen van groepen die je maakt of waaraan je meedoet, de intentietekst, je lidmaatschap en je plaats in de groep.',
				'Je leesvoortgang: welke bab je in welke ronde las, welke babs je uit de pool nam, in een cüz of Hizb-deel van een groep de bladzijde waar je bleef en hoeveel bladzijden je las, en hoe vaak je de getelde passages van de Hizbü’l-Hakaik (Sekine, Delâil, istighfar) per ronde hebt gelezen.',
				'Je instellingen: taal, thema, de tijden van je dagelijkse herinneringen (één voor de Cevşen, één voor de Hizbü’l-Hakaik), je meldingsvoorkeuren, en het lettertype en de lettergrootte van het leesscherm; ook welke tips je al hebt gezien.',
				'Je meldingenoverzicht: een verslag van wat er in je groepen gebeurde — het soort gebeurtenis, de naam van de groep en de weergavenaam van het betrokken lid.',
				'Een apparaatsleutel voor meldingen (push token).',
				'Als je feedback stuurt vanuit de app: je bericht, het onderwerp, je e-mailadres, het platform, de versie en de taal van je toestel en — zodat we een fout kunnen terugvinden — de laatste hoogstens 30 schermen die je in de app opende (schermnamen en getallen zoals een babnummer; geen namen of tekst).'
			]
		},
		{
			heading: 'Wat we niet bewaren',
			paragraphs: [
				'Er is geen analysetool. Geen advertentienetwerk, geen trackingpixel, geen cookie van derden. We lezen je locatie, contacten, agenda of wat dan ook op je toestel niet. De tekst die je leest zit in de app zelf; welke woorden je wanneer leest, bereikt de server nooit — behalve bij samen lezen; zie hieronder.'
			]
		},
		{
			heading: 'De Korantekst',
			paragraphs: [
				'De Korantekst in de app is de Medina-mushaf van het King Fahd-complex voor het drukken van de Edele Koran (Medina). Hij komt van de API van de Quran Foundation (quran.com) en zit in de app zelf. Je leest hem op je toestel. Houd je een vers ingedrukt, dan wordt de vertaling op dat moment via onze eigen server bij de Quran Foundation opgevraagd: alleen het versnummer en de taal gaan mee — niets over jou of je account. De vertaling wordt niet op je toestel bewaard.'
			]
		},
		{
			heading: 'Wie je gegevens ziet',
			paragraphs: [
				'Leden van een groep zien elkaars naam, deel en voortgang — dat is nu eenmaal wat samen een hatim doen betekent. Wie een groep maakt, kan namen verbergen; dan ziet alleen de maker ze, en in een Hizbü’l-Hakaik-groep ook maximaal drie verantwoordelijken die de maker kiest. Verder worden je gegevens alleen verwerkt door deze partijen:'
			],
			bullets: [
				'Clerk — accounts en sessies.',
				'DigitalOcean — waar de server en de database draaien (Europa).',
				'Expo — uitsluitend voor het bezorgen van meldingen; de tekst van de melding en de apparaatsleutel gaan daarheen.',
				'Cloudflare — alleen als de lezer bij samen lezen het geluid aanzet; de stem gaat live via Cloudflare naar wie meeleest en wordt niet opgenomen.'
			]
		},
		{
			heading: 'Samen lezen',
			paragraphs: [
				'Lees je samen in de vrije Cevşen of Mushaf, dan gaat de plek van de lezer — op welke bab of pagina, hoe ver naar beneden en de regel waarop die tikt — via onze server live naar wie meeleest. Die plek wordt niet opgeslagen: de server houdt hem alleen in het geheugen zolang het samen lezen duurt.',
				'Zolang het duurt, bewaart de server een klein gegeven: de deelnamecode, wie begon en wat er gelezen wordt (Cevşen of Koran). Dat wordt normaal gewist als het samen lezen stopt — als de lezer stopt, als de lezer niet binnen een minuut terugkomt, na tien minuten zonder lezen of uiterlijk na vier uur. Wordt het samen lezen onderbroken (bijvoorbeeld doordat de server opnieuw start), dan kan het gegeven langer blijven; het wordt gewist als die lezer opnieuw begint, als iemand de code opzoekt of als het account wordt verwijderd.',
				'Iedereen die meedoet, ziet de naam van de lezer en van de andere meelezers; er is hier geen groep, dus namen kunnen niet verborgen worden. Jij bepaalt met wie je de code deelt. Samen lezen markeert niets als gelezen en verandert niemands voortgang.',
				'De lezer kan ervoor kiezen het geluid aan te zetten; de stem gaat dan live naar wie meedoet en ervoor kiest te luisteren. De stem gaat niet via onze server: de servers van Cloudflare brengen hem naar wie meeleest. Hij wordt niet opgenomen of bewaard, niet door ons en niet door Cloudflare. De microfoon wordt alleen gebruikt als de lezer het geluid aanzet, en alleen zolang het aan blijft; de eerste keer vraagt de telefoon om toestemming.'
			]
		},
		{
			heading: 'Meldingen',
			paragraphs: [
				'De dagelijkse herinneringen (één voor de Cevşen, één voor de Hizbü’l-Hakaik) worden op je toestel ingepland en verlaten het niet. Daarnaast stuurt de server in zes gevallen een melding: wanneer een bab die je uit de pool nam naar iemand anders gaat, wanneer iemand in je groep het eigen deel afrondt, wanneer je groep een ronde voltooit, wanneer iemand babs uit de gedeelde pool neemt, wanneer iemand lid wordt van een groep van jou en wanneer iemand er een verlaat. Alles behalve de eerste kun je afzonderlijk uitzetten bij de meldingsinstellingen. Eén uitzondering: in een Hizbü’l-Hakaik-groep met verantwoordelijken krijgen alleen zij de melding “heeft gelezen”, ongeacht hun eigen instellingen; de andere leden krijgen hem niet.'
			]
		},
		{
			heading: 'Je gegevens verwijderen',
			paragraphs: [
				'Via Profiel → Account verwijderen in de app worden je account en je gegevens definitief verwijderd: groepen die je zelf maakte inclusief hun leden, je lidmaatschappen in andere groepen, je instellingen, je meldingenoverzicht, je apparaatsleutels en de feedback die je stuurde. Dit kan niet ongedaan worden gemaakt.',
				'In een groep waaraan je deelnam maar die je niet zelf maakte, blijft de vastlegging dat een bab in een bepaalde ronde is gelezen in de geschiedenis van die groep staan — anders zouden rondes die de andere leden samen afmaakten gaten vertonen. Die vastlegging bevat alleen een account-identificatie en verwijst na verwijdering van je account niet meer naar een persoon.',
				'Versleutelde back-ups van de database worden 14 dagen op de server bewaard en maximaal 90 dagen daarbuiten; een verwijderde vastlegging blijft zolang in die momentopnamen bestaan. De pagina over accountverwijdering geeft de details.',
				`Voor inzage, correctie of verwijdering kun je mailen naar ${CONTACT_EMAIL}.`
			]
		},
		{
			heading: 'Kinderen',
			paragraphs: ['Cüzhane richt zich niet op kinderen en verzamelt niet bewust gegevens van hen.']
		},
		{
			heading: 'Wijzigingen',
			paragraphs: [
				'Verandert deze pagina, dan verandert de datum erboven mee. Bij een belangrijke wijziging melden we het in de app.'
			]
		}
	]
};

const supportTr: LegalPage = {
	title: 'Destek',
	metaTitle: 'Destek · Cüzhane',
	metaDescription: 'Cüzhane ile ilgili yardım, hata bildirimi ve iletişim.',
	updated: UPDATED,
	intro: 'Bir sorun mu var, bir öneri mi? Yazmanın en hızlı yolu uygulamanın içinden.',
	sections: [
		{
			heading: 'Uygulamadan yaz',
			paragraphs: [
				'Profil → Geliştiricilere yaz. Mesajına cihazının sürümü ve dili otomatik eklenir, böylece sorunu daha çabuk bulabiliriz. Gönderdikten sonra bir referans numarası alırsın (#CV-0000 gibi); yazışmada onu kullan.'
			]
		},
		{
			heading: 'E-posta',
			paragraphs: [
				`Uygulamaya giremiyorsan doğrudan ${CONTACT_EMAIL} adresine yazabilirsin. Hesabının e-posta adresini ve mümkünse ekran görüntüsünü eklemen işi hızlandırır.`
			]
		},
		{
			heading: 'Sık karşılaşılanlar',
			paragraphs: [],
			bullets: [
				'Gruba katılamıyorum: grup dolu olabilir (en fazla 20 üye) ya da davet kodu değişmiş olabilir.',
				'Bab işaretleyemiyorum: o bab bugün senin payında olmayabilir; havuzdaki bablar üstlenildiğinde işaretlenebilir.',
				'Hatırlatma gelmiyor: bildirim iznini ve Hatırlatma ekranındaki saati kontrol et. Seçtiğin saat bugün geçtiyse ilk bildirim yarın gelir.'
			]
		},
		{
			heading: 'Hesabını silmek',
			paragraphs: ['Profil → Hesabı sil. Silme kalıcıdır; ayrıntısı Gizlilik sayfasındadır.']
		}
	]
};

const supportEn: LegalPage = {
	title: 'Support',
	metaTitle: 'Support · Cüzhane',
	metaDescription: 'Help with Cüzhane, reporting a problem, and how to reach us.',
	updated: UPDATED,
	intro: 'Something wrong, or an idea? The quickest way to reach us is from inside the app.',
	sections: [
		{
			heading: 'Write from the app',
			paragraphs: [
				'Profile → Write to the developers. Your device’s version and language are attached automatically, so a problem is quicker to find. You get a reference afterwards (like #CV-0000) — quote it if you follow up.'
			]
		},
		{
			heading: 'Email',
			paragraphs: [
				`If you cannot get into the app, write to ${CONTACT_EMAIL} directly. Including your account email address and a screenshot makes it faster.`
			]
		},
		{
			heading: 'Common questions',
			paragraphs: [],
			bullets: [
				'I can’t join a group: it may be full (20 members maximum), or the invite code may have changed.',
				'I can’t mark a bab: it may not be in your share today. Babs in the pool become markable once you claim them.',
				'My reminder didn’t arrive: check notification permission and the time on the Reminders screen. If the time has already passed today, the first notification arrives tomorrow.'
			]
		},
		{
			heading: 'Deleting your account',
			paragraphs: ['Profile → Delete account. Deletion is permanent; the Privacy page has the detail.']
		}
	]
};

const supportNl: LegalPage = {
	title: 'Ondersteuning',
	metaTitle: 'Ondersteuning · Cüzhane',
	metaDescription: 'Hulp bij Cüzhane, een probleem melden en contact opnemen.',
	updated: UPDATED,
	intro: 'Iets kapot, of een idee? Het snelst bereik je ons vanuit de app zelf.',
	sections: [
		{
			heading: 'Schrijf vanuit de app',
			paragraphs: [
				'Profiel → Schrijf de ontwikkelaars. De versie en taal van je toestel gaan automatisch mee, zodat een probleem sneller te vinden is. Je krijgt daarna een referentie (zoals #CV-0000) — noem die als je erop terugkomt.'
			]
		},
		{
			heading: 'E-mail',
			paragraphs: [
				`Kom je de app niet in, mail dan rechtstreeks naar ${CONTACT_EMAIL}. Vermeld het e-mailadres van je account en stuur zo mogelijk een schermafbeelding mee.`
			]
		},
		{
			heading: 'Veelvoorkomend',
			paragraphs: [],
			bullets: [
				'Ik kan niet meedoen met een groep: die kan vol zijn (maximaal 20 leden), of de uitnodigingscode is veranderd.',
				'Ik kan een bab niet afvinken: hij zit vandaag misschien niet in jouw deel. Babs uit de pool kun je afvinken zodra je ze neemt.',
				'Mijn herinnering kwam niet: controleer de meldingsrechten en de tijd op het scherm Herinneringen. Is die tijd vandaag al voorbij, dan komt de eerste melding morgen.'
			]
		},
		{
			heading: 'Je account verwijderen',
			paragraphs: [
				'Profiel → Account verwijderen. Verwijderen is definitief; de details staan op de pagina Privacy.'
			]
		}
	]
};

/*
 * **The account-deletion page, and it exists because Google asks for it by URL.** Play Console
 * requires a public page that names the app, spells out the steps, and says which data is
 * deleted, which is kept and for how long — a link into a section of the privacy policy does
 * not reliably satisfy a reviewer, so this is a page of its own.
 *
 * Two facts on it are easy to get wrong and are checked against the code rather than assumed:
 *
 *  · `account.service.ts` does **not** delete `BabRead`. Groups the reader *owned* are deleted
 *    outright and their reads cascade with them, but in a group they merely *joined* the record
 *    that a bab was read in a given round stays — otherwise every past round would develop
 *    holes for the members who are still in that group. Those rows carry the account id and no
 *    other identifier.
 *  · Backups outlive the delete. `deploy/backup.sh` keeps 14 days on the droplet and
 *    `R2_KEEP_DAYS` 90 off-site, so a deleted row survives in encrypted snapshots for up to 90
 *    days before the last one holding it is dropped. That is exactly the "additional retention
 *    period" Play asks about, so it is stated rather than glossed.
 */
const deleteAccountTr: LegalPage = {
	title: 'Hesabını silmek',
	metaTitle: 'Hesabını silmek · Cüzhane',
	metaDescription: 'Cüzhane hesabını ve verini nasıl silersin, silindiğinde ne gider, ne kalır ve ne kadar süreyle.',
	updated: UPDATED,
	intro: 'Cüzhane hesabını uygulamanın içinden kendin silebilirsin. Silme kalıcıdır ve geri alınamaz.',
	sections: [
		{
			heading: 'Uygulamadan sil',
			paragraphs: ['Hesabını silmek için:'],
			bullets: [
				'Cüzhane uygulamasını aç ve hesabınla giriş yap.',
				'Alt bardan Profil sekmesine geç.',
				'Hesabı sil satırına dokun.',
				'Çıkan onayı kabul et.'
			]
		},
		{
			heading: 'Giriş yapamıyorsan',
			paragraphs: [
				`Hesabına ulaşamıyorsan ${CONTACT_EMAIL} adresine, hesabında kayıtlı e-posta adresinden yaz. Talebi doğruladıktan sonra hesabı 30 gün içinde sileriz.`
			]
		},
		{
			heading: 'Silinen veriler',
			paragraphs: ['Hesabınla birlikte şunlar kalıcı olarak silinir:'],
			bullets: [
				'Hesabın: e-posta adresin, adın ve varsa profil fotoğrafın.',
				'Kurduğun gruplar — üyeleri, panoları ve davet kodlarıyla birlikte.',
				'Katıldığın gruplardaki üyeliklerin ve üstlendiğin bablar.',
				'Ayarların: dil, tema, hatırlatma saatleri ve hangi ipuçlarını gördüğün.',
				'Bildirim için saklanan cihaz anahtarların.',
				'Uygulamadan gönderdiğin geri bildirim mesajları.'
			]
		},
		{
			heading: 'Kalan veriler',
			paragraphs: [
				'Katıldığın (ama kurmadığın) bir grupta, hangi babın hangi turda okunduğu kaydı grubun geçmişinde kalır. Kalmasaydı, o gruptaki diğer üyelerin tamamladığı turlar eksik görünürdü. Bu kayıt yalnızca bir hesap kimliği taşır; adın, e-postan veya fotoğrafın silindiği için bu kimlik artık bir kişiye çözülmez.',
				'Kurduğun gruplar tümüyle silindiği için oradaki okuma kayıtları da gider.'
			]
		},
		{
			heading: 'Yedekler',
			paragraphs: [
				'Veritabanının şifreli yedekleri sunucuda 14 gün, sunucu dışında en fazla 90 gün tutulur. Silinen bir kayıt, o yedeklerin sonuncusu düşene kadar — en çok 90 gün — şifreli olarak var olmaya devam eder. Yedekler yalnızca felaket kurtarma için tutulur, uygulamaya geri okunmaz.'
			]
		},
		{
			heading: 'Hesabını silmeden veri silmek',
			paragraphs: [
				`Verinin bir kısmının silinmesini istiyorsan — örneğin gönderdiğin geri bildirimler — hesabını silmeden ${CONTACT_EMAIL} adresine yazabilirsin. Erişim ve düzeltme talepleri de aynı adrese.`
			]
		}
	]
};

const deleteAccountEn: LegalPage = {
	title: 'Delete your account',
	metaTitle: 'Delete your account · Cüzhane',
	metaDescription:
		'How to delete your Cüzhane account and your data, what is removed, what is kept, and for how long.',
	updated: UPDATED,
	intro: 'You can delete your Cüzhane account yourself, from inside the app. Deletion is permanent and cannot be undone.',
	sections: [
		{
			heading: 'Delete it in the app',
			paragraphs: ['To delete your account:'],
			bullets: [
				'Open the Cüzhane app and sign in to your account.',
				'Go to the Profile tab in the bottom bar.',
				'Tap Delete account.',
				'Confirm when asked.'
			]
		},
		{
			heading: 'If you cannot sign in',
			paragraphs: [
				`If you cannot get into your account, write to ${CONTACT_EMAIL} from the email address the account uses. Once we have confirmed the request, the account is deleted within 30 days.`
			]
		},
		{
			heading: 'What is deleted',
			paragraphs: ['Deleting your account permanently removes:'],
			bullets: [
				'Your account: your email address, your name, and your profile photo if you set one.',
				'Groups you created — along with their members, boards and invite codes.',
				'Your memberships in groups you joined, and any babs you had claimed.',
				'Your settings: language, theme, reminder times, and which tips you have already seen.',
				'The device keys stored for notifications.',
				'Feedback messages you sent from the app.'
			]
		},
		{
			heading: 'What is kept, and why',
			paragraphs: [
				'In a group you joined but did not create, the record that a bab was read in a given round stays in that group’s history. Without it, rounds the other members finished together would develop holes. That record carries an account identifier and nothing else — no name, no email, no photo — and once the account is gone the identifier no longer resolves to a person.',
				'Groups you created are deleted outright, so the reading records inside them go too.'
			]
		},
		{
			heading: 'Backups',
			paragraphs: [
				'Encrypted backups of the database are kept for 14 days on the server and for at most 90 days off-site. A deleted record therefore continues to exist inside those encrypted snapshots until the last one holding it is dropped — at most 90 days. Backups exist for disaster recovery and are never read back into the app.'
			]
		},
		{
			heading: 'Deleting data without deleting your account',
			paragraphs: [
				`If you want part of your data removed — the feedback you sent, for instance — without deleting your account, write to ${CONTACT_EMAIL}. Requests for access to or correction of your data go to the same address.`
			]
		}
	]
};

const deleteAccountNl: LegalPage = {
	title: 'Je account verwijderen',
	metaTitle: 'Je account verwijderen · Cüzhane',
	metaDescription: 'Hoe je je Cüzhane-account en je gegevens verwijdert, wat er weggaat, wat er blijft en hoelang.',
	updated: UPDATED,
	intro: 'Je kunt je Cüzhane-account zelf verwijderen, vanuit de app. Verwijderen is definitief en kan niet ongedaan worden gemaakt.',
	sections: [
		{
			heading: 'Verwijderen in de app',
			paragraphs: ['Zo verwijder je je account:'],
			bullets: [
				'Open de Cüzhane-app en log in op je account.',
				'Ga naar het tabblad Profiel in de onderste balk.',
				'Tik op Account verwijderen.',
				'Bevestig wanneer daarom wordt gevraagd.'
			]
		},
		{
			heading: 'Als je niet kunt inloggen',
			paragraphs: [
				`Kom je niet meer in je account, mail dan naar ${CONTACT_EMAIL} vanaf het e-mailadres dat bij het account hoort. Na bevestiging van het verzoek verwijderen we het account binnen 30 dagen.`
			]
		},
		{
			heading: 'Wat er wordt verwijderd',
			paragraphs: ['Bij het verwijderen van je account gaat het volgende definitief weg:'],
			bullets: [
				'Je account: je e-mailadres, je naam en je profielfoto als je die hebt ingesteld.',
				'Groepen die je zelf hebt gemaakt — inclusief hun leden, borden en uitnodigingscodes.',
				'Je lidmaatschappen in groepen waaraan je deelnam, en babs die je had genomen.',
				'Je instellingen: taal, thema, herinneringstijden en welke tips je al hebt gezien.',
				'De apparaatsleutels die voor meldingen worden bewaard.',
				'Feedbackberichten die je vanuit de app hebt gestuurd.'
			]
		},
		{
			heading: 'Wat er blijft, en waarom',
			paragraphs: [
				'In een groep waaraan je deelnam maar die je niet zelf maakte, blijft de vastlegging dat een bab in een bepaalde ronde is gelezen in de geschiedenis van die groep staan. Zonder die vastlegging zouden rondes die de andere leden samen hebben afgemaakt gaten vertonen. Die vastlegging bevat alleen een account-identificatie — geen naam, geen e-mailadres, geen foto — en zodra het account weg is, verwijst die identificatie niet meer naar een persoon.',
				'Groepen die je zelf maakte worden volledig verwijderd, dus de leesvastleggingen daarin gaan mee.'
			]
		},
		{
			heading: 'Back-ups',
			paragraphs: [
				'Versleutelde back-ups van de database worden 14 dagen op de server bewaard en maximaal 90 dagen daarbuiten. Een verwijderde vastlegging blijft daardoor in die versleutelde momentopnamen bestaan tot de laatste back-up die haar bevat vervalt — maximaal 90 dagen. Back-ups bestaan voor noodherstel en worden nooit teruggelezen in de app.'
			]
		},
		{
			heading: 'Gegevens verwijderen zonder je account te verwijderen',
			paragraphs: [
				`Wil je een deel van je gegevens laten verwijderen — bijvoorbeeld de feedback die je stuurde — zonder je account op te heffen, mail dan naar ${CONTACT_EMAIL}. Verzoeken om inzage of correctie gaan naar hetzelfde adres.`
			]
		}
	]
};

export const PRIVACY: Record<Locale, LegalPage> = { en: privacyEn, nl: privacyNl, tr: privacyTr };
export const SUPPORT: Record<Locale, LegalPage> = { en: supportEn, nl: supportNl, tr: supportTr };
export const DELETE_ACCOUNT: Record<Locale, LegalPage> = {
	en: deleteAccountEn,
	nl: deleteAccountNl,
	tr: deleteAccountTr
};
