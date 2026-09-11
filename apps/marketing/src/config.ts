/**
 * The few facts that live outside the copy table.
 *
 * The store links are **null until the listings exist**. A button that points at `#` is worse
 * than one that says "coming soon": it reads as broken, and a crawler follows it. Fill these in
 * when the App Store and Play listings are live and the buttons become links on their own.
 */
export const SITE_URL = 'https://cuzhane.sbytes-it.com';

/*
 * No `/nl/` or `/tr/` in the App Store URL. Apple's storefront prefix pins the link to one
 * country's store, and a reader outside it gets bounced to a "not available" page rather than
 * their own storefront — on a trilingual page that would be wrong for most visitors. Without a
 * prefix Apple resolves the storefront from the reader's own account.
 */
export const APP_STORE_URL: string | null = 'https://apps.apple.com/app/id6809141582';

/*
 * Play's canonical form, and the `&hl=` parameter is deliberately absent for the same reason
 * the Apple link carries no storefront: pinning a language would hand a Turkish reader the
 * Dutch listing. Play picks the listing language from the reader's own account.
 */
export const PLAY_STORE_URL: string | null = 'https://play.google.com/store/apps/details?id=com.cuzhaneapp.app';

/** Where "İletişim" goes, and the address in the privacy policy. */
export const CONTACT_EMAIL = 'selami.c@sbytes-it.com';
