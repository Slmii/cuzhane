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

const UPDATED = '2026-09-06';

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
				'Okuma ilerlemen: hangi babı hangi turda okuduğun ve havuzdan üstlendiğin bablar.',
				'Ayarların: arayüz dili, tema, hatırlatma saati ve okuma ekranının yazı tipi ile boyutu.',
				'Bildirim için cihaz anahtarın (push token).',
				'Uygulamadan geri bildirim gönderdiysen: mesajın, konusu, hesabının e-posta adresi ve cihazının platform, sürüm ve dil bilgisi.'
			]
		},
		{
			heading: 'Saklamadığımız veriler',
			paragraphs: [
				'Analitik aracı kullanmıyoruz. Reklam ağı yok, izleme pikseli yok, üçüncü taraf çerezi yok. Konumunu, rehberini, takvimini veya cihazındaki başka hiçbir şeyi okumuyoruz. Okuduğun metnin kendisi uygulamayla birlikte gelir; hangi kelimeyi ne zaman okuduğun sunucuya gitmez.'
			]
		},
		{
			heading: 'Verini kimler görür',
			paragraphs: [
				'Grup üyeleri birbirinin adını, payını ve ilerlemesini görür — bir hatmi birlikte yürütmenin gereği budur. Bunun dışında verin yalnızca aşağıdaki hizmet sağlayıcılarında işlenir:'
			],
			bullets: [
				'Clerk — hesap ve oturum yönetimi.',
				'DigitalOcean — sunucunun ve veritabanının barındırıldığı yer (Avrupa).',
				'Expo — yalnızca bildirim gönderimi için; bildirimin metni ve cihaz anahtarı iletilir.'
			]
		},
		{
			heading: 'Bildirimler',
			paragraphs: [
				'Günlük hatırlatma cihazında kurulur ve sunucuya çıkmaz. Ayrıca havuzdan üstlendiğin bir bab başkasına geçtiğinde sunucudan bir bildirim gönderilir. Bildirimleri kapatmak istersen Hatırlatma ekranından kapatabilirsin.'
			]
		},
		{
			heading: 'Verini silmek',
			paragraphs: [
				'Uygulama içinden Profil → Hesabı sil yolunu izlediğinde hesabın ve verin kalıcı olarak silinir: kurduğun gruplar üyeleriyle birlikte, katıldığın gruplardaki üyeliklerin, ayarların, cihaz anahtarların ve gönderdiğin geri bildirimler. Bu işlem geri alınamaz.',
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
				'Your reading progress: which bab you read in which round, and any babs you claimed from the pool.',
				'Your settings: interface language, theme, reminder time, and the reader’s typeface and size.',
				'A device key for notifications (a push token).',
				'If you send feedback from the app: your message, its topic, your account email, and your device’s platform, version and language.'
			]
		},
		{
			heading: 'What we do not store',
			paragraphs: [
				'There is no analytics tool. No advertising network, no tracking pixel, no third-party cookie. We do not read your location, contacts, calendar, or anything else on your device. The text you read ships inside the app; which words you read, and when, never reaches the server.'
			]
		},
		{
			heading: 'Who can see your data',
			paragraphs: [
				'Members of a group can see each other’s name, share and progress — that is what running a hatim together means. Beyond that, your data is processed only by these providers:'
			],
			bullets: [
				'Clerk — accounts and sessions.',
				'DigitalOcean — where the server and database are hosted (Europe).',
				'Expo — for delivering notifications only; the notification text and the device key are passed to it.'
			]
		},
		{
			heading: 'Notifications',
			paragraphs: [
				'The daily reminder is scheduled on your device and never leaves it. Separately, the server sends a notification when a bab you claimed from the pool passes to somebody else. You can turn notifications off from the Reminders screen.'
			]
		},
		{
			heading: 'Deleting your data',
			paragraphs: [
				'Profile → Delete account, inside the app, permanently deletes your account and your data: groups you own along with their members, your memberships in groups you joined, your settings, your device keys, and any feedback you sent. This cannot be undone.',
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
				'Je leesvoortgang: welke bab je in welke ronde las, en welke babs je uit de pool nam.',
				'Je instellingen: taal, thema, herinneringstijd, en het lettertype en de lettergrootte van het leesscherm.',
				'Een apparaatsleutel voor meldingen (push token).',
				'Als je feedback stuurt vanuit de app: je bericht, het onderwerp, je e-mailadres en het platform, de versie en de taal van je toestel.'
			]
		},
		{
			heading: 'Wat we niet bewaren',
			paragraphs: [
				'Er is geen analysetool. Geen advertentienetwerk, geen trackingpixel, geen cookie van derden. We lezen je locatie, contacten, agenda of wat dan ook op je toestel niet. De tekst die je leest zit in de app zelf; welke woorden je wanneer leest, bereikt de server nooit.'
			]
		},
		{
			heading: 'Wie je gegevens ziet',
			paragraphs: [
				'Leden van een groep zien elkaars naam, deel en voortgang — dat is nu eenmaal wat samen een hatim doen betekent. Verder worden je gegevens alleen verwerkt door deze partijen:'
			],
			bullets: [
				'Clerk — accounts en sessies.',
				'DigitalOcean — waar de server en de database draaien (Europa).',
				'Expo — uitsluitend voor het bezorgen van meldingen; de tekst van de melding en de apparaatsleutel gaan daarheen.'
			]
		},
		{
			heading: 'Meldingen',
			paragraphs: [
				'De dagelijkse herinnering wordt op je toestel ingepland en verlaat het niet. Daarnaast stuurt de server een melding wanneer een bab die je uit de pool nam naar iemand anders gaat. Meldingen kun je uitzetten via het scherm Herinneringen.'
			]
		},
		{
			heading: 'Je gegevens verwijderen',
			paragraphs: [
				'Via Profiel → Account verwijderen in de app worden je account en je gegevens definitief verwijderd: groepen die je zelf maakte inclusief hun leden, je lidmaatschappen in andere groepen, je instellingen, je apparaatsleutels en de feedback die je stuurde. Dit kan niet ongedaan worden gemaakt.',
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

export const PRIVACY: Record<Locale, LegalPage> = { en: privacyEn, nl: privacyNl, tr: privacyTr };
export const SUPPORT: Record<Locale, LegalPage> = { en: supportEn, nl: supportNl, tr: supportTr };
