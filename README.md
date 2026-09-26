# Cüzhane

Read together, finish together. Cüzhane is a group tracker for two shared readings:

-   **Cevşen** — the 100 babs split across a group's members, each reading their share every round.
-   **Kur'an (hatim)** — the 30 cüz, each member taking one or more; the ones nobody takes wait in a
    shared pool. A round ends when all thirty are read.

Groups run daily, weekly, monthly or as a one-off, rounds roll over at local midnight in the
group's own time zone, and missed readings can be caught up afterwards.

## Layout

```
apps/
  server/     Express 5 + Prisma + PostgreSQL — the Clerk-authenticated JSON API
  web/        Expo (React Native) app — iOS, Android and web
  marketing/  Astro static site — the public page, privacy and support
deploy/       The server's compose stack and Caddy config (see deploy/README.md)
```

A pnpm-workspaces monorepo. You need Node 20+, pnpm and Docker, and a [Clerk](https://clerk.com)
application for sign-in.

## Getting started

```bash
pnpm install

# 1. Local Postgres (Docker, port 5433)
pnpm db:up

# 2. Server env — fill in your Clerk keys
cp apps/server/.env.example apps/server/.env

# 3. Prisma client and schema
pnpm --filter @cuzhane/server db:generate
pnpm db:migrate

# 4. App env — fill in your Clerk publishable key
cp apps/web/.env.example apps/web/.env

# 5. Run the API and the app together
pnpm dev:ios      # or dev:android / dev:web
```

`pnpm server` and `pnpm ios` run the two halves separately. `pnpm db:seed` fills the database with
sample groups; set `SEED_USER_ID` to your own Clerk user id to make them yours.

Optional:

-   `QURAN_CLIENT_ID` / `QURAN_CLIENT_SECRET` (server) enable the verse translations in the Kur'an
    reader. Without them that one feature answers "unavailable".
-   The **Hüsrev** page images are not part of this repository. Without them the Hüsrev reading
    mode has no pages to show; every other reader mode works.

## Scripts

| Command                                      | Effect                       |
| -------------------------------------------- | ---------------------------- |
| `pnpm dev:ios` \| `dev:android` \| `dev:web` | API and app together         |
| `pnpm server`                                | API only, watch mode         |
| `pnpm db:up` / `db:down`                     | Local Postgres container     |
| `pnpm db:migrate` / `db:seed`                | Prisma migrate / sample data |
| `pnpm test`                                  | Vitest across workspaces     |
| `pnpm lint` / `format` / `check-types`       | Across workspaces            |

The server tests need the local Postgres running; they create and use their own `cuzhane_test`
database.

## Contributing

Pull requests target `development`; `main` is released from it. `CLAUDE.md` holds the codebase's
rules and traps — the domain model in particular — and is worth reading before touching group or
round logic.

## Content and credits

-   **Cevşen** text: from the Risale-i Nur Kütüphanesi app, kept in its original orthography.
-   **Kur'an** text and sura metadata: the [Quran Foundation](https://quran.foundation) API, fetched
    by `apps/server/scripts/fetch-quran-text.ts`. Verse translations are fetched live from the same
    API.
-   **Fonts:** KFGQPC Uthman Taha Naskh (King Fahd Glorious Qur'an Printing Complex), bundled
    unmodified as its licence requires; Kitab; and Amiri Quran, Noto Naskh Arabic, Manrope,
    Newsreader and IBM Plex Mono via Google Fonts.

Religious text is never generated, transliterated or approximated in this codebase — it is taken
from these sources as published.

## Security

Please report security issues privately through GitHub (**Security → Report a vulnerability**)
rather than in a public issue.

## Licence

No licence has been chosen yet, so the code is all rights reserved: you can read it, but not reuse
it. The third-party content above keeps its own terms.
