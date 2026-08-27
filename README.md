# Cuzhane — group tracker

A hundred babs, one circle. Create a group, split the Cevşen's 100 babs across its members, and the
round completes as everyone reads their share.

## Layout

```
apps/
  server/   Express 5 + Prisma 7 + Postgres, Clerk-authenticated JSON API
  web/      Expo (React Native) app — iOS, Android and web
```

pnpm workspaces. Node 20+ and Docker are the only prerequisites.

## Getting started

```bash
pnpm install

# 1. Local Postgres
pnpm db:up

# 2. Server env — fill in the Clerk keys
cp apps/server/.env.example apps/server/.env

# 3. Schema
pnpm db:migrate

# 4. App env — fill in the Clerk publishable key
cp apps/web/.env.example apps/web/.env

# 5. Run both
pnpm dev:ios      # or dev:android / dev:web
```

`pnpm server` and `pnpm ios` run the two halves separately.

## Data model

A group owns exactly 100 `GroupBab` rows, created up front. Every bab is the single source of truth for
both assignment (`assignedUserId`) and progress (`readByUserId` / `readAt`) — a member's displayed range
is derived from the babs assigned to them, never stored separately.

Members hold a stable 0-based `slotIndex` that caps membership at `spots` and, in `FIXED` groups,
determines their block of babs. 100 is split across seats as evenly as possible: the first
`100 % spots` seats carry one extra bab. Leaving frees the seat for the next joiner.

Two split modes:

- **FIXED** — joining assigns you a contiguous range.
- **FREE** — babs stay unassigned and members claim them; marking an unclaimed bab as read claims it in
  the same atomic write.

## Scripts

| Command                                      | Effect                   |
| -------------------------------------------- | ------------------------ |
| `pnpm dev:ios` \| `dev:android` \| `dev:web` | server + app together    |
| `pnpm server`                                | API only, watch mode     |
| `pnpm db:up` / `db:down`                     | local Postgres container |
| `pnpm db:migrate` / `db:seed`                | Prisma migrate / seed    |
| `npm test`                                   | vitest across workspaces |
| `pnpm lint` / `format` / `check-types`       | across workspaces        |

## Known gap

`apps/web/src/lib/content/cevsen.ts` ships 100 bab entries with **empty** `arabic` fields — the actual
Cevşen text is not bundled. The reader renders the `readerMissing` string for any empty bab. Supplying
the text in that one file is the only change needed; no UI depends on its absence.
