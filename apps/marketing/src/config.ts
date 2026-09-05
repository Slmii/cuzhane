/**
 * The few facts that live outside the copy table.
 *
 * The store links are **null until the listings exist**. A button that points at `#` is worse
 * than one that says "coming soon": it reads as broken, and a crawler follows it. Fill these in
 * when the App Store and Play listings are live and the buttons become links on their own.
 */
export const SITE_URL = 'https://cuzhane.sbytes-it.com';

export const APP_STORE_URL: string | null = null;
export const PLAY_STORE_URL: string | null = null;

/** Where "İletişim" goes, and the address in the privacy policy. */
export const CONTACT_EMAIL = 'selami.c@sbytes-it.com';
