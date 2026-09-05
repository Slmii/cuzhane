import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

/**
 * The marketing site. Static output, no client-side framework, no JavaScript shipped unless a
 * component asks for it — the page is text and a lot of CSS, and a crawler must be able to read
 * every word of it without executing anything.
 *
 * `site` is not decoration: it is what makes canonical URLs, `hreflang` alternates and the
 * sitemap absolute. Without it `@astrojs/sitemap` refuses to build.
 */
export default defineConfig({
	site: 'https://cuzhane.sbytes-it.com',

	/*
	 * **Three languages, three URLs.** A JavaScript switcher on one URL would leave Google with
	 * one page in one language; separate routes let each be indexed and let `hreflang` say they
	 * are the same page. English is the site's default and sits at the root
	 * (`prefixDefaultLocale` off), with Turkish and Dutch prefixed — note that this is the
	 * *site's* default, while the app itself opens in Turkish.
	 */
	i18n: {
		defaultLocale: 'en',
		locales: ['tr', 'en', 'nl'],
		routing: {
			prefixDefaultLocale: false
		}
	},

	integrations: [
		sitemap({
			// Emits `xhtml:link` alternates for every page, which is the sitemap half of the
			// hreflang contract; the `<link>` tags in the head are the other half.
			i18n: {
				defaultLocale: 'en',
				locales: { tr: 'tr-TR', en: 'en', nl: 'nl-NL' }
			}
		})
	],

	build: {
		// `/tr/index.html` rather than `/tr.html`, so Caddy's file server resolves
		// `https://…/tr/` without a redirect.
		format: 'directory'
	}
});
