# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo Layout

pnpm-workspaces monorepo with three apps:

-   `apps/server` — Express 5 + TypeScript (ESM), Clerk auth, Prisma/PostgreSQL
-   `apps/web` — Expo React Native client (iOS/Android/web) using Clerk Expo, TanStack Query, React Navigation
-   `apps/marketing` — Astro static site (the public page, privacy and support), served from the same droplet

Root-level scripts live in the top `package.json`; run them from the repo root.

## Common Commands

From repo root:

-   `pnpm server` — API dev server (`tsx watch`)
-   `pnpm start` / `ios` / `android` / `web` — Expo dev client
-   `pnpm dev:ios` / `dev:android` / `dev:web` — server + client in parallel
-   `pnpm db:up` / `db:down` — local Postgres container
-   `pnpm test` / `lint` / `format` / `check-types` — across both workspaces

Per workspace (`--filter @cuzhane/server` or `@cuzhane/web`):

-   `pnpm --filter <pkg> check-types` — `tsc --noEmit`
-   `pnpm --filter <pkg> test` — Vitest. Single file: `pnpm exec vitest run path/to/file.test.ts`
    **The server suite needs Postgres running (`pnpm db:up`).** `test/support/globalSetup.ts` creates a
    separate `cuzhane_test` database beside the dev one and runs `migrate deploy` into it, then
    `setupEnv.ts` repoints each worker's `DATABASE_URL` at it — so `@db/prisma` and the services under
    test hit the test database without any mocking. `assertIsTestDatabase` refuses to truncate a database
    whose name doesn't end in `_test`, which is the only thing standing between a misconfigured URL and
    your dev data; don't weaken it. Integration files truncate between tests, hence `fileParallelism: false`.
-   Server build: `pnpm --filter @cuzhane/server build` (tsc + `tsc-alias` — TS path aliases are
    rewritten at build time, not runtime)
-   Prisma: `pnpm --filter @cuzhane/server db:migrate｜db:generate｜db:studio｜db:seed`

## Domain model — read this before touching group logic

The Cevşen is **100 babs**. Legacy Hizb groups divide **33 portions** across their members. New Hizb groups instead use personal daily plans, selected by `Group.hizbPlan`: `null` preserves the legacy model, `0` allows member choice, and `7`, `15`, or `33` requires that plan.

### Personal Hizb plans

- `hizbReading.service.ts` owns versioned enrollments and dated personal assignments; these groups have no `GroupBab` rows. Membership is unlimited. Creation starts daily reading immediately in the group's timezone.
- `HizbEnrollment.sequence` is allocated from persistent per-plan counters; `ordinal` records shared join order. Joins and rejoins append under the group lock, even after account deletion. Never compact or reuse these positions.
- Rotation advances each calendar day; missed readings remain catch-up. A personal traversal counts only after all its assignments are completed. Shared coverage is the union of completed canonical text spans for the assignment date; duplicate or mixed-plan overlaps never count twice.
- The opening istighfar’s final sentence has its own saved count and target (11 by default, optionally 33 or 100). New completions require the selected target; old completed records retain their status without fabricated counts. The exact source sentence is highlighted by the shared `HizbBody`; free/legacy counters are session-local. Do not interpret ordinary Arabic verse markers as repetition instructions.
- The Delail salawat in section 9, block 1, line 0 ends at `﴿٣﴾` and requires three readings total. Highlight only that line, excluding the following prayer. Its saved `delailRepetitions` count is independent of istighfar and Sekine; new completions require three, existing completed history is preserved, and free/legacy counts are session-local.
- Sekine needs 19 repetitions by the same reader for each dated assignment. Assignment updates require a revision; repetition counts, bookmarks and history are never inherited on rejoin.
- Optional inactivity removal ends reading enrollment while retaining group membership and administration, so the removal notice and explicit rejoin action remain accessible. Only a newly completed assignment resets inactivity. Changing the rule starts a grace period after enforcing the previous rule.
- The server/client `utils/hizbPlans.ts` manifests must remain identical. `lib/content/hizbPlans.ts` slices the existing source; tests verify exact coverage. The approved 15-day Hulasat split is section 16, block 16. The 7-day plan is app-designed from existing boundaries.
- `HizbPlanGroup` and `HizbPlanReader` provide personal progress, actual shared coverage, catch-up and a bounded reader. Reuse existing membership, invitation and privacy controls. Clients send `X-Cuzhane-Hizb-Plans: 1`; unsupported clients cannot discover or join these groups, and legacy board/round writes are rejected.
- See `docs/plans/2026-09-26-hizb-personal-plans-design.md` for the approved behavior. Existing groups are not automatically converted.

### Individual Hizb reading

`Group.hizbIndividual` creates an owner-only entry with a fixed 7/15/33 plan. `hizbStartPortion` offsets the first day's assignment; all subsequent dates rotate from there and wrap normally. Existing rows default to non-individual and start portion 1. Individual entries are always private and closed to joins, including invite-code joins, and cannot enable inactivity removal or regenerate invitations. Owners delete them instead of leaving; allowing the sole membership to leave would orphan private history. The creation form offers the individual switch and starting-portion description. Hide shared coverage, members, sharing and inactivity controls; keep personal history, reading, renaming and deletion. Shelf progress represents today's individual assignment. The daily boundary uses the creator's device timezone, like other Hizb plans.

### Legacy shared-board groups

The following seat, pool and round rules apply to Cevşen and to Hizb groups with `hizbPlan === null`.

-   **`Group.kind` is `CEVSEN` or `HIZB`, and it is immutable.** Everything that differs by kind is derived
    from it in `utils/groupKinds.ts`: the part count (`partCountFor` — 100 or 33), the parts one reader
    must repeat (`requiredRepetitions` — Sekine, below) and the cycles it may be created with
    (`CYCLES_FOR_KIND` — the Cevşen keeps DAILY/WEEKLY, the Hizb adds MONTHLY). It is mirrored in
    `apps/web/src/lib/utils/groupKinds.ts` — **change both together**; `groupKinds.test.ts` holds the web
    copy to the server's values. Sizes are a create-time rule per kind, enforced by both
    `group.schema.ts` and the web's `SPOTS_FOR_KIND`: the Cevşen 5, 10 or 20 seats (each divides the
    hundred, so nobody carries a leftover bab), the Hizb any of 1–33 (past 33 a seat would hold nothing).
    **A legacy Hizb group uses this same machine over 33**; personal-plan groups use the enrollment model described above. What follows says "bab" and "100"
    because it was written for the Cevşen; read them as "part" and "the group's part count".
-   `Group` owns exactly one `GroupBab` row per part, created up front in the same transaction as the group.
-   `GroupBab` is the single source of truth for BOTH assignment (`assignedUserId`) and progress
    (`readByUserId` / `readAt`). A member's displayed range is **derived** from the babs assigned to
    them — never store a range on the member, or the two will drift.
-   `GroupMember.slotIndex` is a stable 0-based seat. It caps membership at `Group.spots` and determines
    the member's block. Leaving frees the seat; the next joiner takes the lowest free one.
-   Splitting the parts across `spots` seats: the first `partCount % spots` seats get one extra. `rangeForSlot` /
    `babNumbersForSlot` in `utils/babs.ts` are the only place this math lives, and it is duplicated
    verbatim in `apps/web/src/lib/utils/babs.ts` — **change both together.** (`slotIndexForBab` is its
    inverse; the rotation helpers below live in the same pair of files.) **Every one of them takes the
    part count as an argument** — `rangeForSlot(slotIndex, spots, partCount)` and so on down the file —
    and `BAB_COUNT` survives only as the Cevşen's own number, which nothing in the seat math reads, so a
    caller cannot quietly split the wrong book.
-   **`splitMode` decides which block a seat reads on a given day, not which one it owns.**
    `ROTATION` (default) advances a seat by one whole seat per day — seat `s` reads seat
    `(s + dayIndex) % spots`. Advancing by a _block_ rather than a fixed bab offset is what keeps the
    hundred tiled exactly when `spots` doesn't divide evenly. `FIXED` never moves. `FREE` is retired:
    the value survives in the DB enum because dropping one is destructive, but nothing can create it
    and `toSplitMode` reads such a row as `FIXED`.
-   **Nothing stores who reads what.** A member's share is derived from their seat and the round —
    `shareBabNumbersToday` (server) or `GroupSummary.myBabNumbers` (client). Joining writes no bab rows
    and creating a group writes one bare one per part. Never try to work out ownership from a column.
-   **`GroupBab.assignedUserId` means exactly one thing: "I volunteered for this bab out of the pool,
    this round."** It is _not_ seat ownership — it used to be both, and once the rotation moved the
    leftovers onto a member's old block the pool started reporting it as claimed by whoever had held
    that seat at join time. The rollover clears the whole column, so a non-null value always belongs to
    the round in progress. Reading never writes it; only volunteering does.
-   **Joining a seat releases whatever was volunteered for it.** A claim means "I'll cover for an empty
    seat this round"; filling the seat ends the errand, so `attemptJoin` clears `assignedUserId` across
    the block that seat is offering — via `poolBlockFor`, the same helper the pool itself uses, so the
    two can't disagree about which block a seat offers. Left standing, the claim stranded the volunteer:
    the block stops being pool once the seat is filled and was never their own seat's, so `setBabRead`
    refused it as "not yours to mark today" while their share still listed it — and the joiner was handed
    the same babs, because a share is derived from seat + round and knows nothing about claims. **Reads
    already made are never touched**: they happened, and `BabRead` keeps them. Only the claim comes off.
    A Hizb block can be held a portion at a time by several people, so the join reads the claims
    before clearing them and files one `PoolClaimRelease` **per run per claimant** — a row is a start
    and an end, and "16–18" for someone who held 16 and 18 would say they held 17 too. The join
    transaction takes `lockGroup` (in `rounds.service`, beside the rollover it orders against) **first**,
    like every board path: it reads the members and the round to find the block, and unlocked, a
    portion taken between that read and the clear was cleared with no release recorded.
-   **Lifecycle.** A group is `GATHERING` until the owner starts it: no `startedAt`, no day index, and
    nothing is counted. `startGroupForUser` stamps `startedAt` under a conditional `updateMany` guarded
    on `status: 'GATHERING'`, so a double tap can't rewind everyone's rotation. `autoStartIfFull` runs
    inside the join transaction when `autoStartWhenFull` is set, so the last joiner's own response
    already says RUNNING.
-   **Shared pool.** The blocks nobody is reading this round, because their seat is empty. **The pool
    rotates too** — an empty seat `e` leaves uncovered the block it would have been reading,
    `(e + roundIndex) % spots`, not its own. Use `poolBlocks`; taking the standing block instead hands
    one bab to two people and makes another unreachable, so 100/100 becomes impossible. A Cevşen slot is
    taken _whole_. **A Hizb pool is claimed portion by portion** (`POST`/`DELETE`
    `/api/groups/:groupId/pool/parts/:babNumber`, refused for a Cevşen group): a block there is a
    portion or two and each portion is a du'a of its own, so one block can be split between several people.
    Either way a claim sits on top of the taker's share and **lasts one round**. A full group never has
    a pool.
-   **A round boundary is a local midnight, in the group's own zone.** `Group.timezone` is the owner's
    IANA zone, captured at creation and immutable after it. All the zone-aware math lives in
    `utils/rounds.ts` and is **server-only** — the client is handed a `roundIndex` and never computes
    one, which is why `roundIndexSince`/`roundStartedAtFor` were moved out of `utils/babs.ts` and are
    deliberately absent from its web mirror. The zone belongs to the group, not the member: a shared
    board needs one shared day or two members disagree about whose reads the rollover may wipe. Personal
    stats are the opposite case — `profile.service.ts` buckets the streak and heatmap in the **viewer's**
    zone, sent per request. The same file keeps the **bab total Cevşen-only** on purpose: `babsRead`
    is labelled in babs, so a Hizb portion must not swell it, while the streak, the heatmap and
    `roundsCompleted` count reading of either kind. Don't "fix" the asymmetry. Day arithmetic goes through `civilDayNumber`/`startOfCivilDay`, which read
    the wall-clock date via `Intl` rather than adding hours; that is what keeps a 23- or 25-hour DST day
    counting as one day. Never reintroduce `Date.UTC(...getUTCDate())` bucketing — it put the reset at
    20:00 the previous evening in New York.
-   **Rounds.** A group makes repeated passes at the hundred. `DAILY` rolls every day, `WEEKLY` every
    seven — `ROUND_DAYS` in `utils/rounds.ts`, a `Record<'DAILY' | 'WEEKLY', number>`, because the third
    cycle is not a number of days. **`MONTHLY` (Hizb only) rolls on the start's day of the month,
    clamped to the month**: a group started on Jan 31 rolls on Feb 28, then Mar 31. It is measured **from
    the anchor every time**, never from the previous boundary, or one short February would pull every
    later round back to the 28th — so `boundaryDayNumber` is the one place a boundary is computed, and
    `roundEndsAt(startedAt, cycle, roundIndex, tz)` takes the anchor and an index rather than the
    round's own start (a month after Feb 28 is Mar 28, but that group rolls on Mar 31). Every cycle
    rolls, so `roundEndsAt` is always the next boundary rather than an end date for the group.
    (`ONE_OFF` and `OPEN_ENDED` were both removed; unlike `GroupSplitMode.FREE` these are gone from the
    DB enum too, each by its own migration.)
    **The board resets at the boundary whether or not it was finished** — the cycle is a promise about
    _when_, not about completing.
    `Group.roundIndex` is also the rotation index, so a WEEKLY group holds one range for the whole week.
-   **The rollover is lazy, not scheduled.** There is no cron. `ensureCurrentRound` sits in front of
    every path that reads or writes a group, and the first request after a boundary performs the reset:
    clear the board, release pool claims, bump `roundIndex`, clear `completedAt`, recompute `endsAt`.
    It is guarded on the round being left, so two simultaneous requests can't both roll. A group nobody
    opens rolls when someone opens it — nothing observes a group except through these paths.
-   **A closed round can still be covered, and covering it is append-only.** "Üstlen" (someone
    else's block or the pool) and "Okudum" (your own) are one write: `coverMissedBabsForUser` inserts the
    `BabRead` row that round never had. It does **not** reopen the round, touch `GroupBab`, or move the
    read into the round now open — the unique key `(groupId, roundIndex, babNumber)` means a cover can
    only fill a gap, never displace whoever read it first (that returns 409). Covering the _open_ round
    is refused with 403: the ordinary read paths own it, because they also keep the board and
    `completedAt` in step. Who _owed_ a bab in a past round is derived, never stored —
    `owedSlotForBab` runs the rotation backwards — so a round shows both who owed each bab and who
    ended up reading it.
-   **`GroupBab` is the current round; `BabRead` is the record.** The rollover wipes
    `GroupBab.readByUserId/readAt`, so anything historical — a member's total, their streak, the 30-day
    heatmap — must read `BabRead`, which is append-only and never cleared. Its unique key
    `(groupId, roundIndex, babNumber)` says a bab is read once per round. Every read/unread path writes
    it through `recordRead`; a new one must too, or the reset will quietly eat that history.
-   **Sekine is read nineteen times, and the count is the reader's own and the round's own.**
    `GroupPartRepetition` (group, user, round, part — unique on all four) holds how far one reader has
    got with a part `requiredRepetitions` says is repeated; today that is Hizb part 19 alone. Another
    member's nineteen cannot stand in for mine, and last round's say nothing about this one, so counts
    are never pooled and never reset — a new round simply has no row yet. `PUT`
    `/api/babs/:groupId/:babNumber/repetitions` sets it **absolutely** (`GET` on the same path reads
    it), not by increment, so a retried request writes the same number twice rather than counting one
    recitation as two. A write for the
    open round sends `isOpenRound` and gets **409 after a rollover**, rather than filing a tap under the
    round that just closed or carrying its count into the new one. `assertRepetitionsMet` gates every
    path that marks a part read: `setBabRead` (asked **after** the no-op branch, so re-marking a saved
    read stays a no-op whatever the count now says), read-all (a share holding an unfinished Sekine is
    refused **whole**, not marked around it) and covering (only the numbers the cover will actually
    insert, against **that past round's** count). The part itself is still marked through the ordinary
    read paths; undoing a read never looks at the count.
-   `kind`, `spots`, `splitMode` and `cycle` are immutable after creation.

Concurrency: claiming a bab and taking a pool slot (or portion) all use a conditional `updateMany` guarded on
`assignedUserId: null` and check `count === 0` — two simultaneous claims cannot both win. Seat
allocation relies on the `@@unique([groupId, slotIndex])` constraint as the final guard, and starting
a hatim is guarded on `status: 'GATHERING'` the same way.

Undoing a read only ever clears rows where `readByUserId` is the caller. Under ROTATION a bab in
today's share may already have been read by whoever held that block yesterday, and today's holder
must not be able to erase it.

`completedAt` must always agree with the board. Every write that can change read state — single bab,
bulk "read my whole share", releasing a pool slot or portion, removing a member, and account deletion — runs
`syncCompletedAt` **in the same transaction**, and that helper decides from a live count rather than a
previously-read value. Don't split the bab write from the sync, and don't pass it a stale `completedAt`.

`syncCompletedAt` takes `SELECT … FOR UPDATE` on the group row **before** counting, so the group row is
the serialisation point for every read-state write. Postgres runs on READ COMMITTED: without the lock,
two members finishing the last two babs at the same moment each count while the other's write is still
uncommitted, each sees one bab outstanding, and neither stamps the round complete — and with every bab
now read there is no later write to correct it. Measured on the dev database: **19/20 concurrent
finishes missed the stamp without the lock, 0/30 with it.** Don't remove it, and keep new read-state
paths going through this helper rather than counting on their own.
(Account deletion is the exception and doesn't need the lock — it clears the stamp with a single
conditional `updateMany` whose subquery is evaluated atomically.)

Deleting an account (`account.service.ts`) removes groups the user OWNS (the schema cascades their
members/babs/cheers/waitlist), frees their babs in groups they merely JOINED, drops their memberships,
cheers, waitlist entries, push tokens, settings and feedback — then clears `completedAt` on any joined
group that is no longer complete. The client must call this endpoint **before** `user.delete()`; deleting
the Clerk user first leaves the API call unauthenticated and strands the rows.

`Feedback` ("Geliştiricilere yaz", `feedback.service.ts`) stores a topic and a message, and **attaches
everything else itself** — the account email is read from Clerk at submit time, and the client sends its
own platform/version/locale without asking. The design deleted the email row and the diagnostics toggle
for exactly that reason; don't put either back as a question. The lookup is best effort: Clerk being
unreachable stores a null address rather than losing a message someone has already written. `reference`
is the sender's only handle on their message — `CV-` plus four characters from the invite alphabet,
rendered as `#CV-4K2P`, allocated with a uniqueness retry like `reserveInviteCode`.

Orphaned on purpose: the design removed the "Mâşallah" cheer button from the members list, so
`Cheer` (model, service, route, `cheers.api.ts`, `useCheer.ts`) is complete and working but currently
unreferenced by any screen. Left in place rather than dropping a DB table over a UI tweak.

The waitlist ("Bana haber ver" on a full group) was removed on request: its screen toggle, hook,
client API, route, schema, serializer field (`onWaitlist`) and `waitlist.service.ts` are all gone, so
nothing can create a `GroupWaitlistEntry` any more. The **model and table remain** — dropping them needs
a destructive migration — as do the two `deleteMany` cleanups (account deletion, joining a group) that
tidy up any rows left from before. Re-adding the feature means rebuilding that surface, not the schema.

## Server Architecture (`apps/server`)

-   Entry: `src/index.ts` builds the app via `createApp()` in `src/app.ts`, and handles `SIGINT`/`SIGTERM`
    to disconnect Prisma.
-   Middleware pipeline: `helmet` → `cors` → `express.json({ limit: '300kb' })` → `clerkMiddleware()`
    (session parse, non-rejecting) → routers.
-   Public: `/health`. Everything else is under `/api` behind an auth gate + `populateAuthLocals`
    (populates `res.locals.auth`).
-   Routes → services split: each `src/routes/*.route.ts` is a thin HTTP layer; logic lives in `src/services/*`.
-   Validation: Zod schemas in `src/schemas/`, applied via `middleware/validate.middleware.ts`.
-   Response shaping goes through `src/services/groupSerializers.ts` — routes must not hand raw Prisma
    rows to the client. Those serializer types mirror `apps/web/src/lib/types/domain.ts` field-for-field;
    the two workspaces share no package, so **changing one means changing the other.**
-   ESM with TS path aliases (`@app`, `@config/*`, `@middleware/*`, `@routes/*`, `@schemas/*`,
    `@services/*`, `@db/*`, `@utils/*`, `@interfaces/*`). Dev uses `tsx`; the prod build relies on
    `tsc-alias --resolve-full-paths`. Strict options on: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
-   The Prisma schema is a **folder**, not a file: `prisma/schema/` holds `schema.prisma` (generator +
    datasource only) plus one file per domain — `group`, `membership`, `bab`, `user`. Prisma merges them, so
    models and enums are global across the folder regardless of which file they sit in; put a new model in
    the domain file it belongs to rather than starting another one. `prisma.config.ts` points `schema` at
    the folder — never back at a single file.
-   Generated Prisma client output is `src/generated/prisma` (custom path in `prisma/schema/schema.prisma`,
    so its `output` is `../../src/generated/prisma`) and is gitignored — run `db:generate` after a fresh clone.

## Web Architecture (`apps/web`)

-   Entry: `index.ts` → `src/AppRoot.tsx`. Provider order: `ClerkProvider` → `ThemeProvider` →
    `I18nProvider` → `QueryClientProvider` → `AppContainer` (`GestureHandlerRootView` →
    `SafeAreaProvider` → `KeyboardProvider` → `NavigationContainer`). Fonts load before render; splash
    held via `expo-splash-screen`.
-   **`SafeAreaProvider` belongs to the app, not to the navigators, and it was missing for a long
    time without anyone noticing.** React Navigation renders `SafeAreaProviderCompat` around each
    navigator's own scenes, so every screen inside a navigator was covered — but anything rendered
    _instead of_ the navigator has nothing above it, and `useSafeAreaInsets` throws "No safe area value
    available". In a release build that is an unhandled JS exception, which aborts the process.
    `AppNavigator`'s gate does exactly that: `HomeSkeleton` while the settings load after sign-in, and
    `ErrorState` when they fail. It presented as **"the app closes after Google sign-in"** and cost days
    on the wrong suspect — Clerk, the redirect allowlist, `linkGate`, the SDK generation — because the
    crash report says only `abort() called` on `expo.controller.errorRecoveryQueue`, which is
    expo-updates re-raising a JS error it swallowed. The message is in the device's own log; see
    `memory/expo-crash-js-error-from-device.md` for pulling it with `devicectl`. It is mounted with
    `initialMetrics={initialWindowMetrics}` so it has nothing to measure and costs no first frame, and
    the compat providers inside each navigator find the context already there and step aside.
-   Navigation: `src/navigation/AppNavigator.tsx` — a 5-tab native bottom navigator (Home, Groups,
    Discover, Notifications, Search) inside a native stack. **The bell tab is the notification
    inbox (P2), and it used to be the reminder settings** — the glyph was always a bell and what
    sat behind it was a screen of switches, which is what a bell least resembles; section P then
    put a second bell in the top bar and the two collided. The settings are `Reminders`, one push
    in, reached by the gear in that tab's bar (`NotificationSettingsToolbar`) and by Profil's own
    row — which is the design's own map, "P2 dişli → P4". The stack's initial route is `Onboarding` until
    `userSettings.hasSeenOnboarding` is true, so the navigator waits for settings before mounting.
    **The fifth tab and the bar's trailing item swap by platform** (`TrailingCornerAction`). On
    iOS the fifth slot is search (K2) and the account is `ProfileCornerAction` — the reader's own
    photo (Clerk `hasImage`, fetched at 84px) or the `person` glyph — at the **right end of every
    bar**: alone on Ana sayfa, the inbox and the plain pushed screens (`pushedScreenOptions`), last
    in the rows `GroupsToolbar`, `DiscoverToolbar`, `GroupDetailToolbar` and `ReaderToolbar` build.
    On Android, Material keeps the navigation bar for destinations and puts search in the top bar,
    so Profil is the fifth tab (`ProfileTabStack`) and `SearchCornerAction` takes the bar slot,
    pushing `Search` inside the current tab. Both `Profile` and (Android only) `Search` are in
    `sharedTabScreens`, so each pushes inside whichever tab you are on and back returns there —
    `isProfileRoot` skips the one the Profil tab already has as its root. `linking.ts` forks the
    fifth tab the same way.
-   **An icon-only `AppButton` is the navigation bar's disc, whatever `size` says.** 44pt, a circle,
    the glyph at 20pt semibold (the set's 2.1 stroke when drawn) — the same control iOS draws for
    the back chevron, so create-group's × and ✓, the reader's arrows, a member row's × and the
    search field's × all read as one control instead of three sizes of another. On glass that is
    SwiftUI's `large` control with `buttonBorderShape('circle')` and the glyph set through the
    `font` modifier, and a `surface` disc tinted with the **text** colour — untinted, SwiftUI
    falls back to the accent, which painted the glyph sage and dulled the rim; `GlassCornerAction
    hasOwnGlass` is the same recipe for a bar glyph used outside a bar. Filled variants keep
    their tint (the ✓ stays prominent sage). `ICON_ONLY_GLYPH_SIZE`
    is mirrored in `Button.component.tsx` and `GlassButton.tsx` — change both together. Every
    SwiftUI `Host` the app draws a control in carries `ignoreSafeArea='keyboard'`: a host dodges
    the keyboard by itself, and one inside a row that already rides the keyboard climbed twice
    and sat above the search field. It has to be the **host's** prop — the same thing as a
    modifier on the button inside never reached the hosting root.
-   **A glyph beside a glass control is `ui/Icon/SymbolIcon`**: the icon set's own drawing as a
    custom SF Symbol (`scripts/build-symbols.mjs <svg-dir> --only=<name>` → `CuzhaneSymbols.xcassets`),
    placed in a SwiftUI host so it and the control next to it are rendered by one engine at one
    weight; a stroked `Icon` beside a symbol read as two hands. The search field's magnifier is
    `ara-search`. Gruplarım and Keşfet have **no search box of their own** any more — searching,
    open groups included, is the Ara tab's job, and `GroupBrowseState` carries no `search`; their
    filter and sort stay in the navigator's pull-down. Everywhere SwiftUI isn't, it is the ordinary `Icon`. **A new symbol
    reaches the app only through a native build** — `expo prebuild -p ios` copies the catalog and
    the app is rebuilt; on a dev client built before it the host draws nothing for that name.
-   **Search (K2) is the `Search` tab, `role: 'search'`** — iOS 26's own detached search button beside
    the capsule, wearing Apple's `magnifyingglass` (the tab library takes only *system* symbols
    there, never the custom catalog), and an ordinary fifth tab on Android with the icon set's
    drawing as a PNG from `build-tab-icons.mjs`. It is the one entry in `TAB_BAR_HIDDEN_ROUTES`:
    search mode *replaces* the bar with `SearchField` (glass field + a × drawn as
    `GlassCornerAction hasOwnGlass`, SwiftUI's own `glass` circle — the disc the header gives the
    back chevron, asked for directly since there is no bar out here — riding the keyboard on
    `KeyboardStickyView`, `KEYBOARD_GAP` above the keyboard), and that × clears query and scope and
    goes **back** — the navigator's `backBehavior='history'` is what makes back on a tab mean the tab
    you came from, bar restored. **Search is a stack** (`SearchTabStack` + `sharedTabScreens`): a
    result pushes over the search, the bar returns for it, and back lands on the query and results
    as left — the field focuses on arrival only while the query is empty, so coming back doesn't
    throw the keyboard over the list. The title and the scope — the platform's `SegmentedControl`,
    no per-scope counts (five native segments have no room; the sections still count) — sit above
    the scroll view, so only the results scroll. **The bar is unhidden a beat after the tab switch**
    (`useSettledTabBarHidden`, 120ms): the library hides it two ways at once — a UIKit `isHidden`
    that snaps and a SwiftUI toolbar modifier that animates — and flipping the flag in the same
    commit as the switch showed the bar, faded it out, and faded it in again (recorded at 12fps).
    **And hidden before a pop lands**: coming back from a result the focused route only becomes
    `Search` once the pop has committed, after the page is on view, so the bar was seen sliding
    out of it; the screen raises `forceTabBarHidden` (`tabBarVisibility.ts`) on its
    `transitionStart` and withdraws it on blur — **and every tab stack withdraws it on
    `gestureCancel`** (`tabStackScreenListeners`): a swipe-back the user lets snap back never
    focuses or blurs the search screen (UIKit skips the disappear callbacks for a cancelled
    interactive pop), so without that the bar stayed hidden over the result. `linking.ts` gives
    every tab `initialRouteName` (`tabLink`), or a cold-start link into a pushed screen builds a
    stack with no root under it. On iOS the Search root carries the same bar as
    every tab root, with the account in it, and the title shares that row
    (`hasReservedSecondaryLabel={false}`, no under-bar padding) to give the results the height.
    The corpora are real: own groups, open groups (`useDiscoverGroups` **asked for the query**,
    debounced — Keşfet answers at most fifty, so filtering a whole fetch would miss anything past the
    newest fifty), the hundred babs by exact number, and the text inside them — the Turkish meal and
    the Arabic with its marks folded away, spaces kept so phrases match —
    through `lib/utils/search.ts` (`normalizeSearch` / `findMatch` / `searchCevsen` / `searchGroups`,
    tested). Bab and text hits open the free reader on that bab, which is why `AllBabs` grew a
    `babNumber` param, the one exception to "no params" there. Recent searches (`recentSearches.ts`)
    live on the device in `expo-secure-store`, like the theme and language, **under a key carrying
    the Clerk user id** — one list per account, none while signed out, six entries, a query joining
    only when a result is opened. They were session memory first, which lasted only until the app
    was quit; a server column was judged not worth it for a convenience list. K2 is drawn
    in Apple's system face and iOS blue; the screen keeps the app's type and accent and takes K2's
    structure.
-   **The bottom bar stays visible on every screen behind the tabs.** Every tab owns a stack
    (`sharedTabScreens()` registers `GroupDetail`, `BabReader`, the rounds screens, the Keşfet preview
    and `Profile` in all five), so detail screens push _inside_ a tab and each tab keeps its own back stack. Adding a pushed
    screen means adding it to `sharedTabScreens`, not to the root stack — the root stack holds only
    `Onboarding`, `Tabs` and sheet routes. Tabs carry `popToTopOnBlur`, so leaving a tab resets it to its
    root — switching away from a group and back lands on the tab's list, not the group you were in.
    `TAB_BAR_HIDDEN_ROUTES` lists the screens the bar steps aside for, and it also zeroes
    `TabBarOffsetContext`, so never hide the bar without going through it. It holds **only `Search`**:
    the reader was once an entry, on the grounds that reading should be immersive, and is being tried
    with the bar left in. A screen that keeps the bar must not inset its own `bottom` safe-area edge — the bar is a
    sibling below it and already clears the home indicator, and doing both stacks two gaps (which is exactly
    what opened up under `BabReader`'s action bar). Listed screens **collapse** the bar (`BottomNavBar
isCollapsed`), never unmount it: returning `null` from `tabBar` removed it the moment you navigated, which
    reflowed the screen being pushed away and flashed its card corner under the incoming one for a few frames.
-   **Every section surface is glass, and `components/ui/CardSurface` is the only thing that decides it.**
    `hasGlassSurface` defaults to **true**, so Home, Gruplarım, Keşfet, the group / rounds / pool
    screens, the lobby, the invite preview, joined-welcome, Hatırlatma and Profil all get the material
    from one place, with the flat `surface` token as the fallback on Android and older iOS (not
    Reduce Transparency — see below, that one is the system's). Two opt-outs exist, and both are
    `hasGlassSurface={false}`: a card carrying a **fill
    of its own** — the assigned panel's `accentSoft`, the pool release notice's `sand` — because the
    glass tints itself `surface` and washes over whatever colour `style` supplies. `StatTile` forwards
    the prop and must default it to `true`, or it would hold every stat tile back off the material.
    **Inside a sheet is allowed**, and three panels use `CardSurface` there deliberately — the share
    sheet's code and `PlanPreview` in create-group with the glass, `AssignmentBanner` in the join sheet
    without it (sage fill): a panel still has to read as its own surface against the sheet behind it.
    What sheets must not get is a *sweep* of cards.
    `CardSurface` also owns the `accessibilityRole='button'` for every tappable card — no call site
    sets it.
    A card must **not** override `borderRadius` in its own `style`: the glass is drawn at
    `theme.radius.lg` and the card clips to whatever `style` says, so a smaller radius slices the
    material's corners and the hairline stops short around each curve.
-   **Controls are not sections.** Search boxes, option cards, chips, steppers, the ring's core, legend
    swatches and the reader's bars keep their flat `surface` fill. Glass on a control is a different
    decision from glass on a card, and the reader's bars are settled the other way — see below.
-   **Reduce Transparency is the system's business — no component checks it.** UIKit's and SwiftUI's
    own materials already respond to that setting, so a check of our own duplicates the OS and
    duplicates it worse: we don't get a more opaque control, we lose the native control entirely.
    Four components used to check it (`GlassSurface` and therefore every bottom sheet,
    `GlassBackLink`, `CreateGroupStepHeader`, `GlassCornerAction`) and four never did (`AppButton`,
    `AppSwitch`, `SegmentedControl`, `ReaderSizeSlider`) — which with the setting on gave a sheet
    that went flat under controls that stayed glass. Settled by looking at it rather than by
    argument. `useReducedTransparency` was deleted with its last consumer; if the judgement is ever
    revisited it belongs in all eight places or none.
-   **The navigator's bar is where a screen's whole-screen actions live**, and three things about it
    are easy to undo. `GlassCornerAction` is one bare toolbar glyph, `ui/MenuAction` is a pull-down
    button (one glyph, several actions — Gruplarım's +), and both are handed to `headerRight`.
    -   **Register the bar in `AppNavigator`'s `options`, never from a screen's `setOptions` effect.**
        An effect runs after the screen's first commit, so the first frame you see has an empty bar
        and a later commit fills it — visible as the controls appearing a beat after the screen. The
        cost is that a header lives _outside_ the screen and can reach none of its state, and that is
        what `GroupsToolbar` and `GroupDetailToolbar` are for: they read the query cache the screen is
        already holding, and ask for a sheet through a **route param** (`GroupDetail.sheet`,
        `Groups.shouldOpenJoinSheet`) which the screen clears on dismissal.
    -   **Size a `Host` in a header; never `matchContents`.** It reports 0×0 until its native view has
        laid out, and React Navigation measures `headerRight` to size the capsule it draws around the
        items — so a screen being _pushed_ sized its bar against nothing and jumped once the Hosts came
        back. It hides itself: navigating _back_ always looks right, because that header was still
        mounted and measured long ago. There is nothing to measure anyway, since the `frame` modifier
        already pins the box; declare the same number on the React side. (`GlassButton` keeps
        `matchContents` legitimately — its width depends on a label. Nothing in a header should.)
    -   **A glyph that depends on a query needs a seed, or it visibly swaps.** `GroupDetailToolbar`
        picks settings-or-members from `isOwner`, and `useGetGroupById` is a different key from the
        shelf's, so it starts pending and an owner watched the members glyph turn into the gear. It
        seeds from `groupQueryKeys.groups()` via `getQueryData` — read off the cache rather than
        subscribing, which would fetch the whole shelf on a deep link to decide one glyph.
-   **`ui/MenuAction`'s drawn panel is D4's two-level menu, and it is the fallback.** iOS keeps
    SwiftUI's native `Menu` on every version; the drawn surface exists for Android and is the only
    place the design's four row shapes are hand-built — action, submenu (chevron + current value),
    choice (tick, dismisses), toggle (filled checkbox, stays open). Three things on the item types
    exist for it: `MenuActionSubmenu.value` (the root row reads "Filtrele · Günlük" without being
    opened), `MenuActionCommand.tone: 'destructive'` (Temizle in `danger`, the iOS `Button`'s
    destructive role), and `kind: 'section'` (an eyebrow with a divider above it, for a level
    that mixes a choice with toggles; SwiftUI ignores it). A choice draws its own label as an
    eyebrow **unless it is the only item on its level**, where the back row already names it.
    Motion is Reanimated CSS animations, never `entering`, for the reason `CellGrid` records: the
    panel grows from its anchor corner (`om-menu`), and a level keyed on its label remounts so its
    directional slide (`om-lvl-in` / `-back`) plays from the opening frame each time.
-   **The interface language is a list (G4) in a sheet, reached from a row on Profil (G3).** It
    was a three-way segmented control, which was already stacking onto its own line at three
    languages. `LanguageSheet` is an `AppBottomSheet` like Profil's photo and feedback sheets, not
    a route — the design's screen was tried as a root push and swapped for the sheet on sight.
    **A row tap is the whole transaction**: it applies the language and closes. It briefly carried
    create-group's × / ✓ pair with the choice held pending until the tick; that was two taps for a
    decision that needs one, and it went. No search box: three rows do not need one. Each row
    names its language twice —
    `LANGUAGE_NATIVE_NAMES` (in itself, deliberately outside the strings tables so it never changes
    with the interface language) over `langName*` (in the current one).
-   **Sign-in failure is one generic banner, plus offline — `utils/signInErrors.ts` tells only
    those two apart.** `network_error` → offline (with the pinned "Çevrimdışısın" strip);
    every other refusal → server, one neutral "Giriş yapılamadı" with a status-code footnote
    when Clerk sent one, and "Tekrar dene" resubmits. A2e's per-cause banners — wrong password,
    unknown address, malformed address, lockout with its countdown — were built and then
    **deliberately collapsed**: the screen no longer says whether an address exists or which
    half of the credentials was wrong, and there are no field-level error lines. Don't bring a
    cause back on its own; the decision was all-or-nothing. There is no netinfo dependency, so
    `offline` is the failed request's verdict, not a live signal.
-   **A failed screen is `ui/ErrorState`, frame 2a, and it is the whole screen.** Ring glyph
    (`alertCircle`, traced from the frame), "Bir şeyler ters gitti", the line that nothing of
    theirs is lost, a live "Tekrar dene", and a mono footer with the HTTP status and the time
    it failed. The frame's "Çevrimdışı devam et" link was built and dropped on request: one
    action, no second way out. It takes the screen's **query results** —
    `<ErrorState queries={[groupQuery, babsQuery]} />` — and renders its own `ScreenContainer`,
    so an error branch is that one line and nothing wraps it: no `SafeAreaView`, no centred
    `View`, no `refetchAll` closure. It replaced a bare `EmptyState` line on every screen; the
    design's brief was "instead of an empty black screen". `EmptyState` is still right for a
    genuinely empty list and inside a sheet (`MembersSheet`), where a full page can't be.
-   **Pull-to-refresh is each platform's own control, around the one scrollable, via
    `ui/PullToRefresh`.** `usePullToRefresh(queryA, queryB)` takes the query objects and
    returns `{ isRefreshing, onRefresh }`; `ScreenContainer` takes that as `pullToRefresh`, a
    `FlatList` screen wraps its list in `<PullToRefresh {...pullToRefresh}>`. **iOS** clones
    the child with React Native's own `RefreshControl` as its `refreshControl` — it must be
    that element and not a component wrapping one, because `ScrollView` mounts the prop as its
    native child. **Android** is Material 3's `PullToRefreshBox` from `@expo/ui`, with the
    Expressive indicator the app's Compose sheets and dialogs already use; React Native's
    Android control is `SwipeRefreshLayout`'s white disc and arrow, a generation older. The
    list stays a React Native view inside `RNHostView`, which forwards its nested scrolling up
    to Compose — **only if the list has `nestedScrollEnabled`**, which Android's `ScrollView`
    leaves off by default and the wrapper turns on; without it the list never offers its
    scroll and the box never hears the pull. `contentAlignment='topCenter'` because Expo's
    wrapper leaves the indicator at the box's alignment. The Compose module is required behind
    a `Platform` check and a `try`, as `DestructiveDialog` does. A short screen (the lobby, a
    preview, a one-group shelf) is held one pixel taller than the host, because an Android
    `ScrollView` whose content fits refuses the drag before it starts.
    **Known gap, deliberately left unpatched:** `RNHostView` only tells Compose about a release
    when Compose consumed movement on the *last* drag frame, so a finger that pauses before
    lifting can leave the indicator hung mid-pull (seen once on Keşfet). A pnpm patch of the
    Kotlin (settle on any gesture that moved Compose, send the pre-fling too) was built and
    then removed on request — it is a native change and needs a full Android rebuild. If it
    comes back, either patch `@expo/ui` upstream or fall back to React Native's own
    `RefreshControl` on Android, which handles its own release. `ScreenContainer` moves the
    top inset onto the *viewport* when it holds one (the same device the sticky header uses):
    `UIRefreshControl` draws above the content's top edge, and with the inset carried by the
    content that edge is the top of the screen, under the Dynamic Island. The `refreshing`
    flag is the hook's own, up only for the pull's refetch — not the query's `isRefetching`,
    which is also true on focus and reconnect, when a spinner nobody pulled reads as the app
    doing something to them. The design (D2 /
    D4 / D14 and their dark twins) prototypes the gesture as a drawn arc turning with the drag
    and a label under it; on a phone that is `UIRefreshControl` and Android's indicator, which
    already do both, and a JS-drawn one has to fight the scroll view's bounce for the same
    pixels. What carries over is the accent tint and the copy as the iOS title
    ("Yenilemek için çek" / "Yenileniyor…"). Gruplarım, Keşfet and its group preview, the
    lobby, the group screen, Havuz, Turlar, a round's detail, **Ana sayfa and the group reader**
    all pull — Home was the one exception while its ring docked on scroll, and H1 has no dock to
    fight. The reader's pull refreshes the **group** (its board, its pool), never the text, which
    is bundled; the free reader on B7 has no group behind it and no pull.
-   **The heading below that bar is `ScreenTitle`'s `isUnderNavigationBar`, not a padding.** Screens
    declare that they sit under a bar; the component owns the distance. It was a constant each call
    site applied, and Gruplarım declared the style and never passed it — so its title drew behind the
    toolbar while the group screen cleared it. The pushed-screen skeletons don't use `ScreenTitle`, so
    they still apply `SCREEN_TITLE_PADDING_UNDER_BAR` by hand and are the one place that can drift.
-   **The reader walks the whole hundred; only the _marking_ is gated.** `BabReader`'s arrows step ±1
    across 1–100, its eyebrow reads "Bab 87 / 100" and its rail spans the cevşen. It used to walk
    `myBabNumbers` instead — arrows skipping 17→34, an eyebrow reading "Bab 3 / 5" — which did stop anyone
    marking a bab that wasn't theirs, but only by making the other ninety-five unreachable. E2 moved the
    guard onto the thing that actually belongs to someone: an **ownership chip** beside the bab name
    (`ownMine` / `ownPool` / `ownOther`, coloured `accentSoft` / `sand` / `secondary`), a one-line hint
    above the action bar, and a **disabled** Okudum reading `readLocked` for another member's bab. Disabled,
    not merely muted — most babs are somebody else's most days. Pool babs stay live and still route through
    `handleTakeAndRead`, because marking one claims it. The old full-width pool banner card is gone: the
    chip and the hint say it twice already. `linking.ts` must still keep `parse: { babNumber: Number }`.
-   **A verse ornament inside running Arabic is `۝` (ARABIC END OF AYAH) followed by its number —
    a character, never a drawn view.** React Native cannot place an inline `<View>` inside right-to-left
    text: the advance the line reserves and the frame the view is painted at disagree, so the rosette lands
    on top of words with a gap where its box was. It looks font-specific and isn't — measured across Nesih,
    Amiri and Şehrizad, every face broke on some babs and not others, purely on how that line's runs
    reorder. It only appeared at all once the reader was given a real Arabic font: the iOS system fallback
    never showed it, which is why this shipped fine before E2a. `۝` shapes and wraps with the words, so
    it cannot be misplaced, and all three faces enclose the digits that follow — Latin `1` as readily as
    Arabic-Indic `١`, so the numerals setting works either way. **Don't put a view back in that line.**
-   **`ui/Ornament` is the drawn rosette, and it is still right where a `View` is legal** — the mark that
    opens a bab and the settings preview's sample. Traced from the design system's Ornament Set page: eight
    r3 petals 5.4 out on a 26 grid and an r6.3 centre disc **filled with the page colour** (that disc is
    what cuts the petals into lobes, so `backgroundColor` must match whatever it sits on). The spec's r4.5
    dotted ring is deliberately dropped — at reading size its dashes and the numeral's strokes were the same
    weight and read as one texture. Colour is its own `theme.colors.ornament` token — `#A65D5D` light,
    `#C97B7B` dark — deliberately not `danger`, which is the deeper `#8C3F3F` in light mode. Its numeral is
    **SVG text on an explicit baseline**, not an overlaid `<Text>`: RN centres a text's _line box_, and Noto
    Naskh's digits don't sit at the centre of theirs, so overlaid they rode high in the rosette.
-   The bottom bar is a **sibling below the scene, not an overlay** — the tab navigator already insets the
    screen by the bar's height. `TabBarOffsetContext` is therefore just a small content gap, not the bar's
    height; reserving the height again leaves a screenful of dead space under long content.
-   Screens inside a tab type their navigation with `TabStackParamList`, not `RootStackParamList`.
-   **Ana sayfa is H1: two layers, and it is a list of every group, not one.** A deep-green top layer
    (`headerSurface` / `onHeaderSurface` — *not* `accent`, whose dark value is a light sage meant for
    marks) carries the greeting and the free-reading row; the navigator's bar floats over it with the
    same trailing item every tab root has, which is where the design puts the account anyway. **That
    item is the one bar glyph that does not follow the theme**: `TrailingCornerAction
    isOnHeaderSurface`, set only on Home, paints it `onHeaderSurface` — white in both modes —
    instead of `text`, which in light mode was a near-black magnifier on deep green. It reaches
    whichever item the platform draws there, Android's search and iOS's `person` glyph when there is
    no photo; every other bar sits on the page and keeps the theme's own colour. A paper
    sheet rounded over that layer (radius 32, `overflow: hidden`) holds the rest — and **only the rows
    scroll**: the streak card and the "Gruplarım" heading are pinned above them, as the search screen
    pins its field, because scrolling the week away to reach the third group made the card read as a
    banner. That dark layer is why `AppStatusBar` exists, and why Home's **error state renders inside
    the sheet** rather than replacing the screen: the status bar follows the route, and a light bar over
    `ErrorState`'s pale page would be unreadable.
    Every running group with a share is a row of the same kind, ordered with the unfinished first —
    **the row opens the group, its button opens the reader**. `StreakCard` and `HomeGroupRow` are its
    parts; `weekStrip` (tested) decides the seven squares and takes "today" from the payload's last day,
    not the device clock, so the strip cannot disagree with the counts it is drawing. The streak card is
    **absent** until the stats arrive, rather than showing a zero streak and an empty week.
    **Belonging to no group at all is H1-E, and it is not the same empty screen as owing nothing
    today.** `HomeEmptyState` keeps both layers and replaces the sheet's contents: the mark, the
    promise that a streak appears once a share is taken, "Davet kodum var" over "Yeni grup kur"
    (joining leads — someone arriving with nothing is usually holding a friend's code, and a scanned
    QR opens that same sheet), a rule, and Keşfet as a quieter row. **The streak card and the
    "Gruplarım" heading go with the list there** — a run of days is a record of shares taken, so a
    zero would be a loss they never had, which is exactly what the body copy promises instead. The
    greeting turns into "Hoş geldin". Groups that simply owe nothing today (all gathering, all
    finished) keep the streak card and the older `ShelfEmptyState` line, because the way out is the
    group they are already in. The design draws a bare `ح` in the tile; it is `BrandMark` here, since
    a letter set as an icon is the one thing the icon rules refuse.
    **Nothing on Home marks a bab read any more.** It replaced 01g's docking ring, which showed one
    group at a time and committed a whole share with `PATCH /babs/:groupId/read-all`; the rows open the
    reader instead, and `DockRing`/`CountingText` were deleted with it, along with that screen's
    strings. That endpoint is still the right way to mark a whole share at once if a screen ever needs
    to again — don't loop the single-bab one. `longestStreakDays` was added to `ProfileStats` for the
    card's "En uzunu" note (server and client types both).
-   Data layer: `src/api/wrapper.api.ts` attaches the Clerk bearer token; feature APIs in `src/api/*.api.ts`
    are wrapped by TanStack Query hooks in `src/lib/hooks/use*.ts`. `queryKeys.ts` centralises cache keys.
    `useSetBabRead` and `useUpdateUserSettings` are optimistic — preserve the cancel/snapshot/rollback
    pattern when editing them.
-   Theme: token system in `src/lib/theme/tokens.ts`, light + dark. **Never hardcode a hex in a component** —
    every colour comes from `theme.colors.*` via `useThemeContext()`. The **status bar** is
    `navigation/AppStatusBar`, which follows the focused route as well as the theme: Ana sayfa's top
    layer is dark in both modes, and light mode's dark clock vanished into it. It reads `navigationRef`
    rather than `useNavigationState` — it sits beside the navigator, where that hook throws — and the
    screen must not set the style itself: a child's effects run before its parents', so the root's own
    `StatusBar` re-applied the theme's style over it on every theme change. `ThemeProvider`'s context value is
    memoised on the **resolved** mode, not on `useColorScheme`: choosing a theme is two steps (the mode
    changes, then `Appearance.setColorScheme` makes the scheme hook echo it back), and keyed on the hook
    the same theme was rebuilt twice, so every consumer of a five-tab app that mounts all its tabs rendered
    twice per switch — the stutter felt on a device.
-   i18n: `src/lib/i18n/strings.ts` holds the full TR/EN table; `useTranslation()` gives `t(key, values)`
    with `{token}` interpolation. TR is the default. **No user-facing string may be hardcoded** — add a key.
    `en` is typed as `typeof tr`, so a key added to one language fails the build until added to the other.
-   Components: `src/components/<Name>/<Name>.component.tsx` + `<Name>.types.ts`, named exports only,
    `StyleSheet.create` at the bottom. All text goes through `components/ui/Typography` — no bare `<Text>`.
-   **Icons**: every glyph comes from `components/ui/Icon` → `<Icon name size strokeWidth color />`, traced
    from the design system's `Icon Set.dc.html`. All are drawn on a 24 grid, render at 21px, inherit
    `currentColor` and carry **no fill** — activity is expressed by stroke weight (1.6 resting, 2.1 on the
    active tab), never by a filled variant, and nothing goes below 14px. Never use a typographic character
    (`←`, `×`, `+`, `›`, `✓`) as an icon — **including inside a string**: a label like `'Kopyalandı ✓'`
    smuggles one past the rule, so the tick belongs in `AppButton`'s `icon` prop and the string stays
    plain. The one exception the design keeps is the home ring's core mark (`۞`/`✓`), which is a
    Newsreader display glyph the size of a heading and is animated as text. Pushed screens get their back
    affordance from `ui/BackLink`. An icon-only `AppButton` reaches the **glass** path only for an icon
    in `GLYPH_BY_ICON` (`hasSfSymbol`); everything else silently falls back to the drawn button, which
    is what left Yönet's delete flat beside a tick in glass until `sil-delete` was converted. Prefer a
    **converted** symbol over Apple's for a glyph that sits beside one: Apple's are drawn to the full
    box the converted ones leave room in, so at one point size `trash` came out heavier than `check` and
    needed a fudge factor to match. Apple's stay right where nothing of ours sits next to them (`close`,
    the chevrons).
    **The inbox has its own row glyphs** — the set's "Bildirim türleri" section, whose rule is
    `biri = kişi silueti, bab = blok, tur = daire`: `memberJoined`/`memberLeft` (one figure, a
    plus and a minus), `shareRead` (a block with a tick), `roundComplete` (a ring with rays,
    **not** `completed`, which is the hatim mark), `poolTaken`, `claimReleased` and `unclaimed`.
    Each kind borrowed a glyph meant for something else before; they were legible one at a time
    and read as unrelated marks in a column. `unclaimed` is drawn and unreferenced — the set
    defines a "sahipsiz bab" warning before a round closes, which nothing raises yet.
-   Avatars are DiceBear `thumbs` (`@dicebear/core` + `@dicebear/styles`), seeded on the person's name so
    they are stable, and re-tinted into the app palette — never DiceBear's default colours.
-   **Screen titles**: every screen heads with `components/ScreenTitle` → `<ScreenTitle label secondaryLabel
description leading action size />`; pushed screens get it via `ScreenHeader`, which stacks a back row on
    top of the same block. It owns the design's `padding: 8px 0 18px`, so never hand-roll a heading or add
    padding around one — screens that did drifted apart and the title visibly jumped when switching tabs.
    `secondaryLabel` is the eyebrow above the label, `description` the caption below; `size` picks the three
    scales the design uses (`page` 27px, `name` 22px beside an avatar, `compact` 17px for Home's group name).
    The eyebrow row is laid out at a **fixed height** wherever it appears, so a diacritic like the
    "Â" in "Selâm" cannot grow the line box and push one screen's title below the rest. What it is
    **not** is reserved on every screen: `hasReservedSecondaryLabel={false}` drops it, and that is
    the right call wherever the design heads straight into the title. Measured against the export —
    D2 Gruplarım is the one tab root with an eyebrow, because it has a greeting to put there, while
    D4 Keşfet, P2 the inbox, G1 Hatırlatma and G3 Profil all go `padding: 8px …` straight to the
    heading. Reserving it on the inbox and Keşfet put those two titles 19pt (14 + 5 margin) below
    the screen the gear opens, and 19pt below their own skeletons, so the heading dropped as the
    list landed. `ScreenHeader` opts out for the same reason on every pushed screen.
-   **Forms**: any screen that collects values goes through `components/ui/Form` → `<Form<T> schema
defaultValues render={({ handleSubmit, watch, setValue }) => …} />`, which wires `react-hook-form` to the
    zod resolver and puts the methods on context. Inside it use the bound controls — `Field` (text),
    `Switch`, `ToggleRow`, `OptionGroup` (choice cards), `Select` (cycle chips / segmented), `Stepper` — each
    binds by `name` and renders its own validation message. Don't hand-roll `useState` per input, and don't
    render your own error text under a bound control.
-   Schemas live in `src/lib/schemas/*.schema.ts` and are **factories taking `t`** (`createGroupSchema(t)`),
    not module constants — validation messages are user-facing and this app is bilingual. Build them with
    `useMemo(() => createX(t), [t])`.
-   Base inputs are `components/ui/Input` → `AppInput` and `components/ui/Switch` → `AppSwitch`, both mirroring
    React Native's own contracts (`value` / `onChangeText` / `onValueChange`) so the `Controller` wrappers can
    bind them. Use these directly only outside a `Form`.
-   Settings-style screens (Reminders) still use `Form`, but persist on change rather than submit — see the
    `ReminderPersistence` component there, which subscribes via `watch`'s callback form so it never fires on
    mount and never trips `react-hooks/set-state-in-effect`.
-   **Bottom sheets**: every modal surface in the app is `components/ui/BottomSheet` → `AppBottomSheet`, so
    they all share one grabber, spring, scrim and drag-to-dismiss. It's declarative — hold a state
    flag on the screen and pass `isVisible`. There is **no close button**: the grabber, a downward drag and a
    tap on the backdrop dismiss it; don't add an × back. Don't hand-roll a `Modal`, animate a sheet by hand,
    or reach for the navigator's `pageSheet` presentation. Share, Manage, reader text-size, member-removal,
    profile-photo, delete-account, feedback, members, join-by-code and create-group all use it.
-   **The sheet is the platform's own** — `UISheetPresentationController` on iOS, Material 3
    `ModalBottomSheet` on Android — through `@expo/ui/community/bottom-sheet`, whose API is a drop-in for
    `@gorhom/bottom-sheet`. **gorhom is uninstalled**; there is no JS-drawn fallback, no custom backdrop,
    no 26pt radius and no `BottomSheetModalProvider` in `AppRoot`. The surface, the scrim, the grabber and
    the corner radius are the OS's, deliberately — `backdropComponent`, `backgroundComponent` and
    `handleIndicatorStyle` are accepted by the wrapper but do nothing natively, so don't pass them.
    Three findings once said this was impossible and all three were fixed upstream: touches now reach the
    content (`RNHostView`), SwiftUI can measure it (`matchContents` + `fitToContents`), and Android
    forwards `containerColor` and can skip its half-height detent. `AppInput` no longer swaps in a
    sheet-aware `TextInput`, and `IsInsideSheetContext` is gone with it — an OS sheet moves itself for
    its own keyboard.
-   **The content paints its own ground.** iOS presents a sheet on a translucent material and
    expects the app to fill it; with nothing behind the padding the screen behind read straight
    through the panel. `containerColor` is the Android sheet's own prop and has no iOS half, so
    `AppBottomSheet` puts `theme.colors.sheet` on the content view — which is the whole sheet,
    every sheet here being sized by what it holds. The surface, the grabber and the corner radius
    are still the platform's.
-   **Every sheet sizes to its content, and `snapPoints` is never passed to the platform.** A sheet that
    needs a fixed height gives its *content* one, via `AppBottomSheet`'s `heightRatio` (a fraction of the
    screen) — the members list is `0.75`, create-group `0.82`, everything else omits it and is as tall as
    it needs to be. `maxHeight` and `topInset` went with gorhom; they have no platform equivalent.
-   **Detents are not portable, which is why `heightRatio` exists.** iOS honours an arbitrary
    `presentationDetents` height; Android's Material 3 sheet has only two states — partial at about half,
    and expanded — so a single snap point is also the *last* one, resolves to expanded, and a `flex: 1`
    body fills the screen. The same `'82%'` gave 82% on iOS and 100% on Android. Sizing the content is the
    one instruction both platforms follow, since both size a sheet to what it holds.
-   **Never let `enableDynamicSizing` change on a live sheet** — which is now impossible, because it is
    hard-coded on. `BottomSheetView.swift` branches on `if props.fitToContents`, a *structural* SwiftUI
    `if`: flipping it swaps `_ConditionalContent` arms, so SwiftUI tears down one arm and builds the
    other, **taking the hosted React Native surface with it**, and everything inside remounts.
    Create-group learned this the expensive way — giving the seats step alone a detent re-presented the
    sheet instead of resizing it and remounted the `Form`, so the name and dedication reverted to their
    defaults entering that step and again on the way out, which then blocked creating the group at the
    last one.
-   **Create-group is therefore one fixed height for all four steps** — kind → define → seats & plan →
    cycle, for both kinds — sized for step 3, the tallest (the seat stepper, the lattice, the plan
    options and their preview; a Hizb's 33-seat lattice makes it taller still, and the scroll view takes
    the difference, never the sheet). A remount there would now also drop the book chosen at step 1.
    Not only to avoid that remount: a fitted sheet's detent is assigned outside any animation
    transaction, so a sheet that changes height between steps *jumps*, and nothing in JS reaches that
    (`withAnimation` from `@expo/ui` only covers `useNativeState`). A sheet that never resizes has no
    transition to get wrong. The other steps carry some room below their last control; that is the
    accepted cost, and the alternative was tried and is worse.
-   **Sheets cannot stack**: iOS refuses to present one over another, which is why member-removal is a
    native `Alert` and why switching sheets on the group screen goes through a route param and a delay.
-   **The group screen's two whole-group actions are corner actions in its heading, and nothing else.**
    Owners get settings (which opens Yönet, and the members list from inside it) beside the filled Paylaş;
    non-owners get a members icon in that same slot, because they have no settings to open and the list is
    the one thing Yönet held for them. The old full-width "Yönet" button and the "Bu grupta kimler var" row
    are both gone — don't reintroduce either as a second way to the same place. `MembersSheet` is a sheet,
    not a route: `Members` was removed from `sharedTabScreens`, `TabDetailParamList` and `linking.ts`
    together. It takes a 52pt `topInset` because a list of twenty members genuinely runs long; the join
    flow deliberately does **not** — it sizes to its content like every other sheet, and a fixed detent
    there left a screenful of dead space under eight code cells.
-   **Yönet is a corner pair over two sections.** Destroy on the left, keep on the right — the same
    icon-only `AppButton`s create-group heads its steps with (`trash` in `dangerFilled`, `check` in
    `accent`), above the sheet's own "Yönet" heading, so the sheet passes no `title` and draws that
    heading itself. Under it, "Grup bilgileri" is a `Form` over `editGroupSchema` — name, intention,
    visibility — and those are the **only** three things a group can still be told: `spots`, `splitMode`
    and `cycle` divide the parts, and `kind` decides which text, so the server never applies them
    (`UpdateGroupBodySchema` has no such fields; it is not strict, so they are silently dropped
    rather than refused). "Katılım" below is the open-to-join switch and the members row, which save on the touch
    rather than waiting for the tick, because a name being typed is not an answer until it is finished.
    Three details are load-bearing: **the form wraps the whole sheet**, or the tick in the corner would
    have no `handleSubmit` to call; the sheet carries a `heightRatio` with the body in a `flex: 1`
    scroller, as `MembersSheet` does, because content-sized it ran off the bottom of the screen; and the
    form is keyed on `isVisible`, so reopening shows the saved values rather than an edit abandoned by
    closing the sheet. The tick has no label to turn into "Kaydedildi", so it goes `surface` for a
    moment instead.
-   **An invitation is a code, shown two ways: typed and scanned.** The code is the hero of the share
    sheet and of the lobby, "Kodu kopyala" puts the bare (un-dashed) code on the clipboard, and it is typed
    back in on the other side. Under it, on the share sheet and in the lobby, `components/InviteQr` draws the
    same code as a **QR in the design's own style** (`QR Generator.dc.html` / `cuzhane-qr.js`): the matrix
    from `qrcode` (byte mode, ECC M), drawn with `react-native-svg` — dotted modules at `DOT_SCALE` 0.76,
    sage rounded finder eyes, a 5×5 zone cleared for the Cüzhane mark on a sage plate, four quiet modules
    in the viewBox. On the `codePaper`/`codeInk`/`codeAccent` tokens: a **light plate in both modes**
    (a scanner does not read light-on-dark reliably), dark mode getting the generator's warmer plate and
    deeper ink, and the eyes' sage pinned to the deep `#3E6B5C` because the dark theme's lighter accent
    would wash out on the plate. The mark is `ui/BrandMark`'s `BrandMarkGlyph`, one geometry for the icon
    and the emblem. The symbol is **pinned to version 3** and `inviteCode.test.ts` holds it there: the
    cleared zone is only known to be safe at that version (clear of timing rows and the alignment pattern,
    at most seven of ECC M's thirteen recoverable codewords), so a payload that outgrows it fails to
    encode — and draws no QR — rather than scanning badly. Don't enlarge the emblem zone. It encodes
    `inviteLink(code)` (`utils/inviteCode.ts`) = `cuzhane://groups/join/<CODE>`, the **one** link the app has: `linking.ts` aliases
    it onto the Gruplarım root, which opens `JoinByCodeSheet` with `initialCode` and looks it up at once.
    Nothing else emits or displays that URL, there is no web fallback (the scheme resolves only with the
    app installed), and no `https://cuzhane.app/...` — that link was removed on purpose earlier and stays
    removed; the QR came back on request because scanning is typing, not sharing. **Links wait for the
    tabs** (`linkGate.ts`, wired as `getInitialURL`/`subscribe` in `linking.ts`): a URL arriving signed
    out or on Onboarding is held and released when `TabsNavigator` mounts, because the auth stack drops a
    `Tabs` link and a cold link would have skipped the tour — and the person scanning a QR is usually the
    one who still has to sign up. The release waits for `navigationRef.isReady()`: effects fire
    child-first, so at the tab navigator's mount the container cannot dispatch yet, and releasing at
    once logged "The 'navigation' object hasn't been initialized" and dropped the link on the last step.
    Holding a link also pops the mounted stack to its top: a scan from the camera otherwise surfaced
    the app on whatever auth form was open, which read as the QR having done nothing — an invite is a
    fresh start, so signed out it lands on sign-in. The join sheet keeps a lookup id so an answer arriving after close, or
    after a newer scan, cannot set the step; a new scan over an open preview starts the sheet over.
-   Joining by code is therefore a **sheet, not a route** — `screens/Join/JoinByCodeSheet`, one surface
    holding all three steps (code entry → preview → group-full), opened over whatever screen you are on.
    It is mounted from Gruplarım's key button, Gruplarım's empty state and Home's empty state; Onboarding's
    "Davet kodum var" can't mount it directly, so it lands on the Groups tab with `shouldOpenJoinSheet` and
    that screen opens it. `screens/Join/InvitePreviewScreen` is still a pushed screen, because browsing
    Keşfet genuinely is navigation.
-   A sheet that needs to be a _route_ (create-group, which is reachable from two screens) registers under
    the `sheetRouteOptions` group — a `transparentModal` with `animation: 'none'`, because the sheet itself
    owns the animation. Pass `snapPoints` for content taller than the screen and `hasScrollableContent` when
    the body scrolls, so the sheet yields vertical gestures to it.
-   **Motion**: the design doc is an HTML prototype and expresses motion as CSS. Translate intent, not
    syntax — `:hover` and `cursor:pointer` have no touch equivalent and become **press** feedback via
    `Pressable`'s `({ pressed })`. Real motion uses Reanimated. Eased colour/width transitions already live
    inside `ProgressBar`, `CellGrid` and `BabRow`'s checkbox, so callers get them for free; don't reimplement
    them per screen.
-   **`Keyframe` is mutable — build one per animated element, never share a module constant.** `.delay()`
    writes to the instance and returns the same object, so a shared `const POP = new Keyframe(...)` used
    across a grid ends up carrying whatever delay the last cell asked for: every cell then animates on one
    schedule, which is no stagger at all and reads as "the animation doesn't work". `CellGrid`'s `pop()` /
    `shrink()` and `Stepper`'s `countPop()` are factories for exactly this reason.
-   **Grid motion follows `design_handoff_cuzhane/pool-fill.html`**, which is deliberate about _which_
    channel moves. The **pool fill** (üstlen, on the havuz board and the Turlar grid) is **colour only** —
    no scale — because at forty cells a pop reads as noise while a colour change reads as ownership.
    It is **160ms, every cell of the block at once**: `CellGrid`'s `COLOR_DURATION_MS` came down from the
    prototype's 420 via 300, and `FILL_STEP_MS` in `utils/groups.ts` is 0, because a 13-bab block swept
    at 70ms a step was still starting cells 840ms after the tap. `staggerWithinRuns` still runs (and
    returns zeros), one constant away from sweeping again. The **spots picker** is the opposite: the cell
    _count_ changes there, so entrance and exit have to be legible, and it pops (380ms) and ghosts out
    (300ms) with its own 26ms cascade (`SpotsGrid`'s `CASCADE_STEP_MS`, deliberately not the fill's).
    Both honour `useReducedMotion`.
-   The square-lattice UI (100-bab board, spots picker, activity heatmap, pool board) all builds on the
    single `components/ui/CellGrid` primitive, which derives cell size from measured width. Don't
    reintroduce percentage-based grid sizing — it drifts a pixel per column.
-   **The cells ease their colours with a Reanimated CSS transition, never `useAnimatedStyle`.** A mapper
    per cell is what made the board unscrollable: measured on the group screen with RN's performance
    monitor, a fling held the **JS thread at 17–24fps and the UI thread at 35–40** with a hundred
    `useAnimatedStyle` cells, and **59–60 on both** once the same easing was declared as
    `transitionProperty`/`transitionDuration`/`transitionDelay` on a flat style object. Bisected by
    hiding the board (JS back to 60), then by removing the cells' `Pressable`s (no change — not the
    touch targets), then by swapping the animated style for a plain `View` (JS back to 60). The
    transition properties must sit on **one flat style object**, not inside a style array, or Reanimated
    never sees them. A transition also only animates a _change_, which is why the old `hasPainted`
    shared value — a hand-rolled guard so the first paint snapped instead of fading in from nothing —
    could go.
-   **A hundred cells is a lot of views, and both things that keep it cheap are easy to undo.** A `Cell`
    mounts a `Hatch` only if it is hatched _or has been_ — the stripes are eight rotated views apiece, so
    mounting one on every cell made three quarters of the board invisible scenery and it scrolled like it.
    Keeping the node after the hatch comes off is deliberate: that is what lets taking a pool bab fade the
    stripes out on the fill's own curve. And `Cell` is `memo`'d, which only pays if `items` and
    `onPressCell` hold their identity — build them with `useMemo`/`useCallback`, above the early returns
    where the screen has them (`GroupDetailScreen`, `RoundDetailScreen`). An inline `.map` in the JSX
    hands every cell a new object per render and silently restores the old cost.
-   **The pool board is `components/PoolGrid`, and there is exactly one of it.** Numbered cells in three
    states — hatched "havuzda", a soft panel for "başkası üstlendi", solid accent with a `text` ring for
    "sen üstlendin" — plus the matching three-item legend. The Havuz screen (07a/07b) renders it; the
    group screen's Havuz entry (07c) is now a **row card** in the "Geçen tur" shape — the whole pool's
    count in a `sand` tile, "Ortak havuz", "N bab", a chevron — that navigates to the screen, on request
    (the board on the group screen was dropped). It counts `poolAllBabNumbers` from the group, so it
    neither waits on the board nor disappears once the last block is claimed. **07b is not a separate
    screen**: a crowded pool is the same board with more slots. The ring is a per-cell `borderColor` at a uniform `borderWidth`, not the
    design's outer `box-shadow` — `CellGrid` clips its cells, so an outset shadow would never show, and
    a uniform width keeps every cell the same size. Cells are always **sorted by bab number**: under
    ROTATION the slots arrive in rotated order, and the two surfaces build their cells from different
    sources (slots on the Havuz screen, the hundred via `toPoolCells` on the group screen), so without
    the sort the same pool would read in two different orders one tap apart.
-   **A share is one slice plus a count, never a list of ranges** (design 01g). Volunteering for a pool
    block gives a member a second, unconnected range, so "1–13, 27–39, 66–78" is now an ordinary share —
    and spelled out it wrapped Home's ring onto three lines and doubled the group heading. `shareSlices`
    in `utils/groups.ts` picks the stretch holding `myNextBabNumber` (where the reader actually is, not
    their lowest number) and counts the rest; `components/SliceChip` renders the "+2 aralık daha" chip.
    Two surfaces use the pair and must keep using it: H1's group rows (`isCompact`, just "+2", beside a
    name that already has to fit) and the group screen's "Sana atanan" heading. `babRuns`/`formatRun` underneath live in the **mirrored** `utils/babs.ts` pair, so
    they change on both sides together.
-   **"Geri al" is for anything you hold; "az önce üstlendin" only for what you just took.** Two
    questions that were one for a while. Every slot (Cevşen) or portion (Hizb) you hold offers "Geri al"
    beside its avatar for as long as the round is open, because the server lets you release your own
    claim until then — gating the button on the session made it vanish on every relaunch, so a block
    taken yesterday had no way back at all. The sub-line "az önce üstlendin" is a statement about the
    last minute, so only claims made in this app run carry it: `claimedThisSession`, module memory on each
    Havuz screen seeded into `takenHere` — deliberately not a stored timestamp, and not the screen's own
    state either, since stepping back to the group and returning is the ordinary thing to do. The undo
    drains on the fill's own curve (`PoolGrid`'s `drainingSlotIndexes`, cleared on a timer sized to the
    fade so a later claim can't inherit it); the reversed, last-bab-first order `staggerWithinRuns`'s
    `reversedKeys` gives is a no-op while `FILL_STEP_MS` is 0. Both the take and the release are
    optimistic: the colour change _is_ the confirmation, so it has to start on the tap, not on the response.
-   The Havuz screen's header counts **free** babs and **free** slots — what you could still take on —
    while the group screen's card chip counts the **whole** pool. Two questions, deliberately two
    numbers; `GroupInvitePreview.poolBabNumbers` is the whole pool too, `GroupSummary.poolBabNumbers`
    only the unclaimed part (it feeds the board, where a claimed bab is someone's work).
-   **A legacy Hizb group uses the Cevşen's screens with a Hizb body** (design HC1–HC4,
    HJ1–HJ3, HZ1–HZ5). The lobby, invite preview and joined-waiting screens, the group screen, Turlar
    and Home's rows all branch on `kind` in place. HZ1 swaps the board for `HizbBoard` (the 33 as
    11 × 3, with a "Fihrist ›" to `HizbIndex`, the portions work by work — registered in
    `sharedTabScreens` like every pushed screen) and the share section for `HizbSharePanel`. The
    Havuz route carries **`kind` as a param** and picks `HizbPoolScreen` (HZ3, a portion at a time)
    from it — a kind never changes, so it can't go stale, and the right screen draws without waiting
    on the group's query. A round's detail delegates to `HizbRoundDetail` (HZ4/HZ5). Those three
    lattices are `CellGrid` too, coloured by one palette (`HizbBoard/hizbCellPalette.ts`) so the
    board, the pool and a round cannot disagree about what a state looks like; `PoolGrid` stays the
    Cevşen's. A portion is read in **`HizbReader`'s group mode** (`groupId` + `partNumber`, rendered by
    `HizbPortionReader`): the Cevşen reader's E2 — the strip walks all 33, only the *marking* is
    gated by the ownership chip, a pool portion is claimed as it is marked, and marking does **not**
    carry you on, since the next portion is usually somebody else's. A `roundIndex` below the group's
    is cover mode for that closed round, and Sekine carries `RepetitionCounter` above the action row,
    the button disabled until the viewer's own count for the round shown is met (a server 409 still
    rolls the read back). **Free Hizb reading is unchanged**: `HizbReader`'s `sectionIndex` shape,
    from Profil, counts nothing — two components rather than one with a mode, because they share
    the page and none of the group's queries, gates or counter may reach a free read. The two
    books' marks are `ui/KindMark` — **filled emblems like `BrandMark`, not icon-set glyphs**, and the
    star's ring and dot are real cut-outs (an even-odd clip) rather than paint in "the colour behind",
    because a glass card has no one colour behind it. Deviations from the design, all deliberate:
    **33 portions, not its 32** (the grids are 11 × 3; its 8 × 4 does not tile 33); the cycle keeps
    **its own step** rather than sharing HC3's, so "Adım n / 4" holds for both kinds; create-group
    stays **the platform sheet**, not the prototype's full pages; and HC1's **Hatim card is left
    out** — only the Cevşen and the Hizb are offered.
-   Environment: `EXPO_PUBLIC_API_URL` (localhost auto-resolves to the Metro host for devices) and
    `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Locally these come from `apps/web/.env`, which is gitignored
    and points at localhost; **release builds take them from EAS environment variables** on the
    `production` and `preview` environments, so a build never carries a developer's machine in it.
    `eas env:list` is not the way to check them — it shows every candidate, including account-wide
    variables shared across every project on the account, and says nothing about which one wins.
    **`eas env:exec production '<command>'` resolves them the way a build does**, and it is what
    caught an account-wide `EXPO_PUBLIC_API_URL` from another app outranking this project's own:
    production would have shipped pointing at a different API and a different Clerk instance, while
    preview resolved correctly, so testing would not have found it.
-   **`eas update` MUST carry `--environment`, every single time.** `EXPO_PUBLIC_*` is inlined into
    the JS bundle when the update is built, not read at runtime — so `eas update --branch production`
    on its own bakes in whatever `apps/web/.env` says, which is `http://localhost:3001` and a
    `pk_test_` Clerk key. The CLI's own help calls the flag *"Required for projects using Expo SDK 55
    or greater"* and this project is on 57, yet it publishes without complaint. The result reaches
    every installed app: `fetch` to localhost throws, so there is **no HTTP response and no status
    code** — `ErrorState`'s footer shows only a time, because `code` is `null` for anything that
    isn't a `WrapperApiError`. That missing status is the tell, and it is what finally separated
    this from a 401. The correct form, on both channels:

    ```
    eas update --branch preview    --environment preview    -m "…"
    eas update --branch production --environment production -m "…"
    ```

    It also explains a confusing symptom worth recognising: a **preview build looks fine while
    production is broken**, even though the two builds are byte-identical (same native fingerprint).
    The preview install was still running its *embedded* bundle — built by EAS with the right
    environment — while the App Store install had taken the bad update. The builds were never the
    difference; the bundle each was running was.
-   **`eas update` runs from `apps/web`, never from the repo root.** The root is not the Expo
    project: `apps/web/package.json` is what declares `main: index.ts`, and `apps/web/app.json`
    holds the name, plugins and the fixed `runtimeVersion: "1.0.0"`. A root-run publish resolves
    the entry as `expo/AppEntry.js`, which imports `../../App` and fails — and the root once
    carried a **stub `app.json`** that made it look like a project while declaring a *different*
    `runtimeVersion` policy, so a publish from there would have been accepted, reported as
    success, and delivered to nobody. That stub is deleted; don't let `eas update:configure`
    recreate it (run from `apps/web` and it writes to the right file). It also installs
    `expo-updates` into whichever workspace it is run in — the root does not need it, `apps/web`
    already has it.
-   **A channel is not a branch, and matching names do not link them.** A build asks its
    **channel** for updates; `eas update` publishes to a **branch**; a mapping joins the two and
    nothing creates it implicitly. `preview` had a channel and a branch both called `preview` and
    no mapping between them, so an installed preview build asked and was correctly told there was
    nothing — while `eas update:list` showed the update sitting there with the right runtime
    version. The tell is `eas channel:view <name>` reporting *"No branches are pointed to this
    channel"*; the fix is `eas channel:edit <name> --branch <name>`. **Check the mapping, not the
    names** — production was mapped from the start, which is why only preview and development
    were ever silent.
-   **A freshly installed build never runs the newest update on its first launch**, and that is
    `expo-updates`' default rather than a fault: `fallbackToCacheTimeout` is `0`, so the app
    launches its **embedded** bundle at once, downloads in the background, and applies on the
    *next* launch. Relaunch once after installing before judging whether an update landed.
    **Do not "fix" this with `fallbackToCacheTimeout`** — Expo advise against it, because it holds
    the splash for the *full* timeout on a bad connection and so punishes the worst networks
    hardest; their recommendation is a programmatic check, and `components/CheckForUpdateOnLaunch` +
    `useInitialUpdateState` are it — **ported from the reference they point at**,
    `brentvatne/microfoam-app`, patterns and all: a component that stands in front of the app
    until `onComplete` fires, and `AppRoot` returning it instead of the tree exactly as that
    repo's `_layout.tsx` does.
    **The thing an obvious implementation gets wrong: it must start no check of its own.**
    `checkAutomatically` defaults to `ON_LOAD`, so the native module is already checking before
    any React code runs — `useUpdates` observes that state machine, where calling
    `checkForUpdateAsync()` yourself puts a second check and a second download beside it.
    The reference leaves its loading UI as a spinner; here it renders `AnimatedSplash`, so the
    check happens behind the brand animation that was going to play anyway and there is no seam
    when the app takes over. `SPLASH_MIN_DURATION_MS` is timed in `AppContainer` rather than in
    the check, so the animation's minimum runs *alongside* it instead of after it.
    `UPDATE_CHECK_TIMEOUT_MS` is a ceiling, not a typical wait, and an update that is ready
    reloads rather than calling `onComplete` — releasing the splash first would show the old
    bundle for the moment before it went.
-   **iPhone only — `supportsTablet` is `false`, deliberately.** Every layout here is designed to a
    phone's width: H1's two layers, the hundred-cell board, the reader's measure, the bottom bar and
    the platform sheets. On a 13" iPad they stretch rather than adapt. Declaring iPad support also
    makes iPad screenshots mandatory in App Store Connect, for a form factor that has never been
    laid out or tested. Adding it later is a feature; removing it later takes it away from people
    who already have it.
-   Path alias: `@/*` → `src/*`.

## The Cevşen text

`cevsen.data.json` holds the whole hundred — 100 babs, 999 invocations, a closing refrain each, and the
du'a that follows the hundredth. **Do not generate, transliterate or approximate any of it.** The reader
still renders `readerMissing` for an empty bab, which should now never happen.

It comes from the **Risale-i Nur Kütüphanesi** app (`org.feyyaz.Risale-iNur-Kutuphanesi`, FEYYAZ Bilim ve
Gelişim Derneği), which ships the Cevşen as a delimited text file rather than a scan — so this is the
publisher's own digital text, not something rebuilt from glyph geometry. That app is **available on Apple
Silicon Macs**, which is how it was read: install it, open the Cevşen once so it downloads, and the file
lands at `~/Library/Containers/org.feyyaz.Risale-iNur-Kutuphanesi/Data/Documents/kitaplar/cevsen/cevsen.txt`.
Its format is `#N` per bab, `~…|@` per line, `❁` between invocations; bab 1 carries the title and the
besmele, bab 100 carries the du'a as a third line. `meta` in the JSON records all of this.

It **replaced** an earlier extraction rebuilt from a PDF's per-character geometry. Two things made the
swap safe, and a future one should clear the same bar: the structures matched exactly (both sources give
100 babs and 999 invocations with identical per-bab counts, from wholly unrelated origins), and the du'a
acted as a control — it had already been pasted in by hand from this same app, and matched.

**The orthography is Ottoman/Turkish, and that is not incidental.** The long î is `U+06EA` plus yâ
(`رَح۪يمُ`) rather than a kasra — **549 of them across 70 of the 100 babs** — final yâ is dotless
(`وَلِىَّ`), and hamza sits on its Turkish carrier (`اَسْئَلُكَ`). The old PDF extraction had normalised all
of this to standard Arabic. Don't normalise it back: it is what this edition sets.

**The long î is `U+0656` (subscript alef), not the `U+06EA` the source file writes** — 549 of
them across 70 babs, converted at ingestion. This is worth knowing before "fixing" it back.
The publisher's file uses `U+06EA` (ARABIC EMPTY CENTRE LOW STOP) and then relies on its own
fonts to draw something else: **Osman Taha, the face that app actually renders with, maps
`U+06EA` straight onto its `uni0656` glyph**, and so do the other three it ships. So the
codepoint in the file is not what the edition prints — the glyph is, and that glyph is the
subscript alef. Any font not in on the arrangement renders `U+06EA` faithfully as the small
empty diamond its name describes, which is what Kitab, Amiri and Noto Naskh all did (2
contours, 0 curves, ~1:1). Writing the codepoint the edition _means_ fixes every face at once:
all three of ours carry `U+0656` as a zero-width curved stroke, Kitab's within a hair of the
reference (0.093×0.304 em against 0.080×0.254 em).

It also retired a workaround. KFGQPC gave `U+06EA` a **1442-unit advance and a 0.61 em body on
the baseline** — a black disc standing between words, at nearly verse-ornament size — so the
reader used to strip the mark for that face. Its `U+0656` is an ordinary zero-advance mark, so
`arabicFor` and its face set are gone. **`ornamentFaceFor` stays**: KFGQPC's `U+06DD` is still
a wide standalone rosette that the number sits beside, so Madinah still borrows Nesih for the
verse mark.

Nesih is the default. Medine Mushaf was briefly made the default and reverted, back when the
`U+06EA` stripping made it the wrong face to hand someone first.

### The Hizb-ül Hakaik text

`hizbulhakaik.data.json` is the same publisher's text for the **Hizb-ü Envâr-ıl Hakâik-ın Nuriye**, in the
same markup, and the same rules apply: nothing generated or approximated, `U+06EA` written as `U+0656` at
ingestion. Unlike the Cevşen it is **generated in the repo**: `scripts/hizbulhakaik.txt` is the source and
`node scripts/build-hizbulhakaik.mts` writes the JSON through prettier, with the parse rules in
`src/lib/content/hizbulhakaik.parse.ts` (tested on markup fragments) and the output checked against the
source's own census in `hizbulhakaik.test.ts` — 17 sections, 723 lines, 236 of 242 pages, the Cevşen's
closings ﴿١﴾–﴿١٠٠﴾. Edit the text, re-run the script; never hand-edit the JSON.

**It is not a hundred babs, so it does not take the Cevşen's shape.** Sections hold blocks, blocks hold
lines, and each line carries the printed page it is on. Pages are not a level of their own because a du'a
runs across them — the print closes one with `* * *` at the foot of a page only 15 times in 242, so a page
break says nothing about where a unit ends — and three sections (Haşir, Tebareke, Nebe) begin partway down
a page. A block is what the print closes with `* * *`: a bab of the Cevşen, a du'a, a prayer. `❁` lines
carry `invocations` beside their `text`; one line (Evrâd-ı Kudsiyye, page 106) ends in a `❁` and yields no
empty invocation for it.

**The 33-day and legacy shared-board divisions are defined in `lib/content/hizbPortions.ts`.** The thirty-three are the family's **revised** division, read off the numbered photographs of
their book; the older 32-part calendar the design was drawn to is historical. They fall into ten works
(`HIZB_WORKS`: the Kur'ân 1–3, the Cevşen 4–8, Evrâd 9–13, Delâil 14–18, Sekine 19, … Tazarru 31–33),
and **the seventeen sections are the print's headings, not the division** — a portion can run across
several sections or stop inside one, even inside a single line. So the manifest stores **only each
portion's start** (`HizbAnchor`: section, block, line, invocation) and no text at all: each runs to the
next one's start, so the 33 cover the whole without a gap or an overlap by construction, and moving a
boundary is one edit rather than two that must agree. **A mid-line cut is made at the Nth ❁ of the
line's own `text`, never rebuilt from `invocations`** — joining those back with ` ❁ ` is not the
source, and thirteen lines would come back different — and the ❁ at a cut belongs to neither side, so
it is dropped from both and the head, that mark and the tail concatenate back to the line byte for
byte. `hizbPortions.test.ts` pins every portion's footprint (the blocks and lines it is cut from) and
opening words long enough that no other block opens with them, so an anchor one block off, or a
regenerated JSON that moves one, fails there rather than handing someone the wrong du'a. Two content
questions are surfaced rather than resolved: **Âmenerresûlü is not in the digital text**, so portion 3
has none; and the Cevşen portions are taken to start on the bab **after** each marked refrain — babs
21, 42, 62 and 82, not the older table's 41/61/81 — a reading of the photographs' markers still to be
confirmed (`docs/plans/2026-09-26-hizb-groups.md`).

## Notifications

The daily reminder is a **local** notification, scheduled on the device — one repeating
`DAILY` trigger, so the OS keeps firing it whether the app is backgrounded, force-quit or
never opened again. There is no server push; `PushToken` is stored but nothing sends to it.

`useReminderNotificationSync` is what makes that survive: the settings live on the server,
so a fresh install, a new device or a sign-in leaves the OS knowing nothing. It reconciles
on mount (hard reopen), whenever the settings or the counts change, and on every
`AppState` → `active` (soft reopen). `NotificationOrchestrator` mounts it in `AppRoot` — app
lifetime, not the Reminders tab's, because the schedule must be right whether or not anyone
opened that screen.

It compares **signatures** stored in the notification's own `data` rather than rescheduling
blindly: `triggerSig` (time + enabled) and `contentSig` (title + body). Cancelling and
re-adding on every launch leaves a window with nothing scheduled, and an app opened at the
moment the reminder was due would silently lose that day's notification. Only reminders
carrying this app's `kind` are ever cancelled.

Four rules the reconciler must keep — each of them was a real bug found in audit:

-   **Serialise runs, never drop them.** A request arriving mid-run sets a rerun flag and the
    loop goes round again, reading the desired state from a ref. Returning early instead meant
    that on a cold start — where settings and groups resolve moments apart — the first run
    cancelled (no group yet) and the second was discarded, leaving _nothing_ scheduled.
-   **Act only when the answer is known.** `isReady` needs both queries, or signed-out.
    Reconciling on settings alone cancels a good notification in the gap before groups arrive.
-   **Signed out is a known answer, not an unknown one.** It means "cancel". Otherwise the
    previous account's reminder — with their group's name in it — keeps arriving on a
    signed-out device, because clearing the cache leaves no successful query to reconcile.
-   **The reconciler reads permission and never requests it.** It runs on every launch, so
    prompting from there would throw the system dialog at someone who merely reopened the app.
    Two screens own the asking, and nothing else may: `HomeScreen` via
    `useNotificationPermissionPrompt` — once per session, and only when `canAskAgain` says a
    dialog would actually appear — and `RemindersScreen`, at the moment the switch is turned
    on. Home asks because it is the screen the reminder is _about_; onboarding would ask before
    any of it means anything.

The Android channel is declared inside `scheduleReminder`, immediately before the schedule
that needs it — from a mount effect it raced the first schedule, and Android silently drops
anything posted to a channel that doesn't exist yet.

The body's bab count is a **snapshot taken when it was scheduled** — a local notification's
text is fixed and nothing can recompute it at 21:30. Keeping the count in `contentSig` is
what keeps it honest: reading a bab re-syncs and replaces the pending notification. It can
only go stale if the reader progresses on another device.

**A repeating trigger fires at the next match, which may be tomorrow.** iOS resolves the
hour/minute against the next date _strictly after_ now, so a time already reached today is
scheduled for tomorrow — and because the picker write is debounced and round-trips the
server, choosing a time a minute out routinely lands a second or two past it. Diagnosed from
`PendingNotifications.plist` after a 09:29 reminder set at 09:29:02 never arrived and looked
broken. `isNextReminderTomorrow` in `utils/reminder.ts` puts that on screen under the picker
("İlk bildirim yarın 09:29"), which is the only thing distinguishing it from a reminder that
simply doesn't work. The `now` it compares against is refreshed on focus (`useIsFocused`,
adjusted during render), on foreground and on picking a time — a tab switch is none of the
others, and without the focus case the line kept claiming "bugün 09:52" at 09:54.

The picker's "Tamam" **closes the sheet and does not save.** The value is written on every
turn of the spinner and debounced 600ms, with a flush on blur and on unmount, so leaving
without tapping it keeps the time either way. It uses `confirm`, not `done` — `done` is the
lowercase mid-sentence "3 / 5 tamam" on the group screen.

**The reminder is about the day, not about one group.** `reminderTotals` in
`utils/reminder.ts` sums what is still owed across every running group, for the scheduler.
(The Reminders screen used to show a preview built from it; its sample cards were dropped once
the inbox one tap away could show the real thing.) Two of its numbers are the whole point:
`pendingGroups` (still owing) drives the copy — past one group the body names the count, because
a bare "26 babın kaldı" over six groups reads as one group's — while `participatingGroups`
(running, with a share, finished or not) decides whether there is anything to say at all.
Nothing to remind about is not the same as having finished. **Babs and portions are counted
apart** (`unreadBabs`, `unreadPortions`) and never summed under one noun: each has its own lines,
including one for a single part, and owing both says "okuman", a reading, which is true of either.

`setNotificationHandler` is set at module scope in `AppRoot`, before any component mounts —
without it a reminder arriving while the app is open is delivered silently.

## Push notifications

The daily reminder above is **local**. Separately there is now a **server push** path, for
things only the server can know about. There are six: a pool claim released because somebody
joined the seat it was covering, somebody in your group finishing their share, a group closing
the hundred, somebody taking a block out of the shared pool, somebody joining, and somebody
leaving. **Only the first is unconditional** — it is about something taken away from you rather
than group news — and the other five each have a switch on P4.

The last three go through one helper, `groupEvents.service.ts` → `notifyGroupMembers`: file a row
for every other member, push to those who asked. The two above them are written out longhand in
`babs.service.ts` because each carries a once-per-round claim the helper cannot express.

-   **"Someone in your group finished their share" is `UserSettings.groupReadsEnabled`, off by
    default, and it fires once per *range* — never per bab.** It fired on every read first, which
    meant a member working through a thirteen-bab share sent thirteen notifications to everybody
    opted in, one per tap of Okudum. `notifyGroupOfShareRead` (in `babs.service.ts`) is reached
    only when the last bab of a share lands: both read paths count the share's unread babs
    **inside the same transaction that wrote the read**, and the push names the range
    (`shareRange`, built from the mirrored `babRuns`/`formatRun`) rather than a number. Marking a
    whole share at once therefore sends the same single notification the bab-by-bab route does.
    It is the one notification in the app that fires on another person's action, so it is opt-in,
    from the second switch on Hatırlatma. That flag is read **before** anything else: on an
    account that never turned it on the recipient query comes back empty and the *push* half
    stops there. It no longer keeps the Clerk name lookup off the hot path, though, and that
    sentence used to say it did: the inbox row needs the reader's name whatever the preferences
    say, so `getMemberProfiles` now runs on every finished share. Every recipient's language comes
    out of that same query — `toPushLanguage`, not a `pushLanguageFor` each. The whole body is
    wrapped in a `catch`: it runs **after** the commit, so a failed lookup there must not turn a
    successful write into a 5xx and make the client roll its optimistic update back. **It is said
    once per round**: finishing a share is not a one-way door — Geri al on the last bab and Okudum
    again made it true a second time and sent the same range twice — so `claimShareNotice` inserts
    a `ShareReadNotice` row (unique on group + user + round, `skipDuplicates`) **on the read's own
    transaction** and only a `count` of 1 notifies. The unique key is also what settles two
    requests finishing the same share at once, and `roundIndex` being part of it means the next
    round announces itself again with nothing to clean up. Covering a
    bab from a *closed* round (`roundHistory.service.ts`) deliberately sends nothing: a different
    event, and it would need its own copy. **That silence is now held by tests**, because it was
    held only by an absence — `coverMissedBabsForUser` simply never calls the notify helpers, and
    adding them "for symmetry" with the read paths would look like a fix. It is not one: covering
    is catching up days later, and announcing that somebody finished a share last Tuesday is noise
    about a round nobody is reading. The two paths cannot reach each other's rounds either —
    `recordRead`'s only two callers pass `group.roundIndex`, and the cover endpoint 403s on
    anything that is not strictly older. Switching it on also registers a push token there and
    then — the reconciler only ever registers a device that already had permission, so a device
    granting it that second would otherwise have no row until the next launch.
-   **"The round is complete" is `UserSettings.roundCompleteEnabled`, and it is the one push that
    is opt-OUT.** `@default(true)`, unlike the two beside it: it fires once per round per group
    and it is the moment the app is built around, so behind an off-by-default switch almost
    nobody would ever see it. `syncCompletedAt` now **returns** whether this call performed the
    `completedAt: null → set` transition — free, because its stamp is already a conditional
    `updateMany` guarded on `completedAt: null`, so the count distinguishes "I closed it" from
    "it was closed when I arrived", and the group lock means only one concurrent finisher sees
    it. That alone is not once per round, though: **closing the hundred is not a one-way door**
    — Geri al and Okudum again re-closes it, and so does a member leaving or releasing a pool
    slot (both clear reads) followed by someone re-reading those babs. `RoundCompleteNotice`
    (unique on group + round, claimed in the read's own transaction) is what makes the
    announcement happen once; without it a member could toggle the last bab and buzz the whole
    group at will. Everyone in the group is told **except the finisher**, whose phone is already
    in their hand. The two other `syncCompletedAt` callers ignore the boolean deliberately: they
    clear reads first, so they can only *un*-complete.
-   **The reminder reconciler stands down while the tour runs.** `useReminderNotificationSync`
    reads `useGetGroups`, which answers with the stand-in shelf during the walkthrough, and
    `contentSig` carries the bab count — so without the guard it cancelled the reader's real
    reminder and re-added one about three groups they are not in, then swapped it back a minute
    later. A force-quit mid-tour left the demo one standing. The tour is a fourth **unknown**
    answer beside the two queries and signed-out, so it joins `isReady` rather than getting a
    branch of its own.
-   `push.service.ts` → `sendPushToUser(userId, payload)` fans out across the user's devices via
    `expo-server-sdk`, and **never throws**: callers reach it from inside domain flows where the
    write is the point and the push is a courtesy. It prunes `DeviceNotRegistered` tokens, which
    is the only receipt error meaning "stop trying" — kept, a stale token is retried forever.
-   Send **after the commit, never inside the transaction**, and `await` it rather than leaving
    it dangling: an unawaited rejection would escape the request as an unhandled one.
-   Copy lives in `utils/pushCopy.ts`, not the client's strings table — the phone is not involved
    in composing a notification it receives while closed. The language is resolved per send from
    `UserSettings`. That makes it a second, smaller copy table to keep in step by hand. Every
    builder that names parts takes the group's `kind` and says babs or portions accordingly
    (`PART_NOUNS`), singular for a range of one; the inbox does the same from `groupKind` on each
    row — joined from the live group, and named so because `kind` is already what the *notification* is.
-   `usePushTokenRegistration` (in `NotificationOrchestrator`) registers this device's Expo token
    on sign-in and **withdraws it on sign-out** — left behind, the account's next notification
    arrives on a phone somebody else is now using. It only registers a device that already has
    permission; `registerDeviceForPush` is shared with the Home prompt so a newly-granted
    permission registers immediately rather than at the next launch.
-   A notification carrying a `groupId` in its `data` opens that group; the local reminder, which
    counts every group, still lands on Ana sayfa.
-   **A push is never the only channel.** `PoolClaimRelease` records the same event so the group
    screen can show it regardless — permission may be denied, the token may be missing, the phone
    may be off. Anything worth pushing is worth leaving a trace of.
-   **The simulator can register a token but cannot receive a real push.** `getExpoPushTokenAsync`
    succeeds there and the row lands in `PushToken`, which makes it look like the whole path
    works — it doesn't. APNs rejects that token with `BadDeviceToken` (400).
    **`"ios": { "simulator": true }` in the EAS profile does not help**: a simulator build is
    ad-hoc signed (`flags=0x2(adhoc)`) with no provisioning profile, and the `aps-environment`
    entitlement comes from the profile — so it has no push capability either. Verified by
    `codesign -d --entitlements - <app>` on both a local `expo run:ios` build and an EAS
    simulator build; neither has it. **Delivery needs a device build**: `eas device:create` to
    register the phone, `"simulator": false`, then `eas build --profile development -p ios`.
    Confirmed working that way — receipt `{"status":"ok"}`.
-   **A ticket is not a delivery.** `sendPushToUser` returning a count only means Expo _queued_
    the message. Failures like `BadDeviceToken` appear later in the **receipt**, fetched by ticket
    id from `/--/api/v2/push/getReceipts`. When a send looks successful and nothing arrives, the
    receipt is where the answer is — the sender does not currently poll them.
-   **What delivery actually needs is an APNs key on the Expo project.** Without one, Expo accepts
    the request and answers `InvalidCredentials` — "Could not find APNs credentials for
    com.cuzhaneapp.app (@devsc05/cuzhane)". Fix it once with `eas credentials -p ios` → _Push
    Notifications: Manage your Apple Push Notifications Key_; it needs the Apple Developer login,
    so it can't be scripted. **This is the first thing to check when a send silently does nothing.**
-   **Android needs two separate Firebase pieces, and neither is the other.** The *client* half is
    `google-services.json` (Firebase → Project settings → **General**), committed at
    `apps/web/google-services.json` and named by `android.googleServicesFile` in `app.json` — it
    holds identifiers, not credentials. The *server* half is a **service-account private key**
    (Project settings → **Service accounts** → Generate new private key), uploaded with
    `eas credentials -p android` → _Push Notifications: Manage your FCM V1 service account key_;
    that one is a real secret and never enters the repo. Miss the first and the binary has no FCM;
    miss the second and Expo answers `InvalidCredentials` exactly as it does for a missing APNs
    key. The project is `cuzhane-af094`. **`googleServicesFile` is native config, so adding it
    cannot go out over the air** — Android push only reaches people who take a new build.
-   That error is also why `sendPushToUser` prunes on `DeviceNotRegistered` _specifically_ rather
    than on any error: a project-level misconfiguration must not delete every user's good token.
-   Two ways to test without waiting on Expo: `xcrun simctl push <device> <bundle-id> file.apns`
    posts a payload straight to the app, which verifies the receiving and tap-handling half; and
    calling `sendPushToUser` from a scratch script verifies the sending half against the real
    Expo API. Resetting notification permission to re-see the prompt needs an **uninstall and
    reinstall** — `simctl privacy` has no notifications service, and toggling it off in Settings
    sets _denied_, which the prompt deliberately skips.

## The first-use tour (section O)

`components/Tour` — a walkthrough over the live app: a welcome card, sixteen stops, and a
closing card. `hasSeenTour` on `UserSettings` decides whether it opens by itself.

-   **The flag defaults to `false`, and that is the whole migration.** Everyone already using the
    app is shown the tour once too, because the column's default says so — no backfill, no
    special case, nobody excluded. `useShouldAutoStartTour` also requires `hasSeenOnboarding`, so
    a brand-new account gets the tour *after* the tour it already has rather than on top of it.
-   **It opens from Ana sayfa, not from `AppRoot`.** `useTourAutoStart` is called by `HomeScreen`
    because the first two stops point at things on that screen, and starting at the root would
    open the tour over Onboarding, over the auth stack, or over whatever a notification tap had
    just pushed. That also satisfies the design's `A1·5 → O1` for free: onboarding sets
    `hasSeenOnboarding` and lands on Ana sayfa, where the condition is suddenly true.
-   **The welcome card navigates nobody.** It is a sheet over whatever screen the reader was on,
    so "Daha sonra" leaves them exactly there — dragging someone from Profil to Ana sayfa to ask
    whether they want a tour, and stranding them there when they decline, is worse than not asking
    from that screen. Stop 1 does the unwinding instead, a tap later. That also removes a race at
    its source rather than mitigating it: navigating here put a `popToTop` and a tab switch in the
    same commit as an OS sheet presenting, which is the shape that already lost to UIKit once over
    the splash.
-   **The app underneath is inert while the tour is over it — `TourBlocker`.** The scrim paints
    over the tab bar and the navigation bar but does **not** receive their touches: drawing order
    and hit-testing order agree only inside one view hierarchy, and the navigator's screens, its
    native bar and its tab bar each live in their own view controller. A group row under the scrim
    still opened its group. `pointerEvents='none'` on an ancestor doesn't care — UIKit's hit test
    skips a view with interaction disabled **and its whole subtree** — and it carries
    `accessibilityElementsHidden` / `importantForAccessibility` with it, since a finger is not the
    only way into a dimmed control — nor is a finger the only way *out*: Android's back button is
    a system gesture the blocker never sees, so `TourOverlay` swallows `hardwareBackPress` for the
    same window, or back pops the screen a stop is standing on out from under the scrim. It
    engages on `isActive && !isBlocked && stepIndex > WELCOME_STEP`, which is **exactly** when the
    overlay draws: the two disagreed at first,
    leaving two states where the app was inert with nothing over it to say why — one of them the
    documented "the sheet never presented" race, with no way out but killing the app. The welcome
    card needs nothing from it, being a platform sheet, which blocks what is behind it already.
-   **The overlay is an ordinary view beside the navigator, not a `Modal`.** It was a modal at
    first, on the grounds that the bottom bar is a real UIKit tab bar and nothing inside the
    navigator draws over it — true of a screen, and not true of a view rendered as the navigator's
    sibling in `AppRoot`, which dims the bar perfectly well. A modal brings a separate UIWindow
    and its own touch routing for no gain here. The rectangles still live in a context either way:
    the things being measured are inside the navigator and the thing drawing the hole is outside it.
-   **Sixteen stops across six screens, and the tour drives the navigation itself.** Section O's
    own list is `streak · groups · tabs · mine · pool · rd · settings`; the bottom bar went
    because it names itself under every icon. Added: the Read button, the group's summary card,
    the closed round, sharing, the reader's type controls split from its action bar, and Profil's
    numbers split from its settings — one element each, in the order they are met on screen. The
    closed round and the pool register their rects **inside the guards that render those rows**,
    so a group with neither simply centres those two cards. A step carries the screen it belongs to
    (`TourStep.place`) and `useTourNavigation` pushes there when that screen changes — never per
    step, since four pairs of stops share one. **Two of the six places are tabs** — Ana sayfa and
    the inbox — so `TAB_BY_PLACE` and `goToTourTab` reach those by unwinding the pushes and
    switching tab, while the group screen, the reader, Hatırlatma and Profil go through
    `navigate` inside whichever tab is current. Hatırlatma was a tab until the bell was given to
    the inbox; the inbox took its place here and its settings are now a push like Profil's.
    The inbox stop is the one that needed **new fixtures**: `TOUR_DEMO_NOTIFICATIONS` is built
    from the same three group specs as everything else, so a row cannot name a group the shelf
    behind it does not have, and `TOUR_DEMO_UNREAD_COUNT` is derived from it so the bell's badge
    and the list it opens agree. **The welcome card navigates nobody** — it is a sheet over
    whatever screen the reader was on, and "Daha sonra" has to leave them there; stop 1 does the
    unwinding a tap later, with no `popToTop` racing an OS sheet's presentation. **Replaying from
    Profil drops both bookend cards** (`start({ isReplay: true })`): it opens at stop 1 and
    `next` on the last stop calls `finish` rather than landing on the closing card. Neither is
    doing anything for the reader who tapped that row — the welcome card asks whether they want
    the tour, which is the decision they just made, and would present over Profil, a screen it
    does not describe; the closing card offers "Grup kur" and then tells them the tour lives in
    Profil › Uygulama turu, which is where they came from. "Bitir" already labels the last stop's
    button, so nothing else changes. Everything is pushed inside the tab the tour
    is running in, so one `popToTop` **whenever the tour ends anywhere else** puts the reader back
    on Ana sayfa — not only at the closing card: "Atla" is on every card, six of the fourteen
    stops stand on a *stand-in* group's screen, and skipping from one of those left someone on
    `GroupDetail` for `tour-demo-group-1`, whose queries flip to the real keys the instant
    `isActive` drops and land on `ErrorState`. It is skipped when `currentPlace` is already
    `home`, because the closing card's "Yeni grup kur" opens create-group on the **root** stack
    and an unwind would pop it straight back off —
    **and it must carry a `target`.** An action dispatched without one is offered to a navigator
    and then bubbles *up*; it never descends into a tab's nested stack, so the untargeted pop was
    silently doing nothing and the closing card was read over Profil. `useTourNavigation`'s
    `focusedStackKey` finds the stack from the root state; `AppNavigator`'s `resetTabStack` is the
    same move from inside the tree, and predates it.
    Ana sayfa nominates the group to walk through (`TourSubject`, the topmost row), and without
    one — a reader in no group, which is who the tour opens for — the later stops keep their
    centred cards and nothing is navigated.
-   **The tour always supplies its own data** — **three groups**, built by one factory in
    `tourDemoData` so each one's share, board, counts and rounds cannot disagree. It opens
    straight after onboarding, when Ana sayfa is `HomeEmptyState`, the group screen cannot be
    reached and Profil reads zero over an empty month, so ten of the thirteen stops would
    describe a blank app and the rest would pause on a spinner at every navigation. Three groups
    rather than one because one is not a shelf: stop 2 says "each row is a group" and stop 3 says
    Read resumes, and both need a list to point at. They differ the way rows actually differ —
    one owned and barely begun, one joined and nearly done, one finished, which is the row that
    sinks to the bottom and reads "Tamam". **Its month ends on the most recent Friday, not on
    today**: Home's week strip is the calendar week containing the last entry with the days ahead
    drawn faint, so a month ending on a Monday gave a card reading "6 gün" over six blank squares.
    Ending on a Friday shows a week taking shape whatever day the tour is opened.
    **It was conditional at first**, on the account having no groups of its own, and that made
    the walkthrough two different things: the copy has to describe what is on screen, and what
    was on screen depended on who was looking. `useIsTourDemo` is now simply "the tour is
    running", which also keeps it honest — a flag derived from the shelf would see the stand-in
    shelf it had just installed and flip back, once a frame. The cost is that a reader with real
    groups sees these three for the minute it lasts, and their own the moment it ends.
    Five hooks (`useGetGroups`, `useGetGroupById`, `useGetBabs`, `useGetRounds`,
    `useGetProfileStats`) answer from the fixtures under a **separate key namespace**
    (`tourDemoQueryKeys`), so the real entries are left untouched and nothing has to be
    invalidated when the tour ends. Each of those five also passes **`initialData`**: a `queryFn`
    is a promise however fast it settles, so without it the first render after mount is still
    `isPending` — and the group screen's gate is exactly that, which flashed its skeleton every
    time the tour navigated onto it.
-   **A bar glyph's rectangle is arithmetic, never measured.** `headerRight` is hosted in a
    container of its own, so `measureInWindow` inside it does not answer in window coordinates:
    the reader's Aa control reported `y: 0` and an `x` counted from that container's left edge,
    which put the spotlight on the back chevron at the opposite corner of the screen. Correcting
    `y` by the top inset moved the hole but left it on the chevron, which is how the `x` half was
    found. `useTourBarTarget(id, indexFromRight)` computes it instead — 44pt discs flush against
    the right edge, the last one ending 24pt from it, the pair sitting at `y: 62` under a 59pt
    inset. **Both platforms' numbers were read off a screenshot**, from the glyph centres on the
    group screen's toolbar: iOS leaves 24 between the last item and the right edge and sits 3
    below the top inset, Android leaves 16 and sits 6. Same 44 item on both, since that disc is
    the app's own.
-   **Stop 3 is the Read button on the first group row, and it replaced section O's bottom bar.**
    Naming the five tabs was the one stop that described furniture rather than anything the reader
    was about to do, and the bar labels itself. What is not self-evident is that Read *resumes* —
    it opens the bab they stopped at, not the group's first — so the cut-out moved there.
    `HomeGroupRow` takes `isTourTarget` and the screen sets it on the topmost row only; every
    other row renders the same button with no measured box around it. `tour3Title`/`tour3Sub` were
    rewritten in all three languages rather than a key being added, so the numbering still follows
    the order of the stops. The bar's rectangle was arithmetic over `useBottomTabBarHeight` (a
    UIKit bar has no React view to measure) and went with the stop.
-   **Closing the hole means fading the mask's rectangle, not the ring.** A mask reads brightness,
    so the black rectangle that punches the cut-out closes it again only by going to opacity 0.
    The four stops that point at nothing faded the hairline ring and left the hole exactly where
    the previous stop had put it, so they were read over an undimmed patch of the screen behind
    them. The opacity belongs on the animated `Rect` inside the `Mask`.
-   **The card is pinned to the bottom, and the arrow went with the change.** It used to take
    whichever side of the spotlight was free, which put it somewhere different at almost every
    stop: the reader had to find the words again thirteen times and Devam moved out from under
    their thumb between taps. A fixed home beats adjacency, since the cut-out already says which
    thing is being described — and an arrow pointing at something half a screen away says nothing,
    so `TourStepCard` no longer draws one. The exception is measured, not guessed: a card at the
    bottom would be *on top of* a target low on the screen, so those stops (the reader's action
    bar, Profil's settings list) put the card at the top instead. Eleven of the thirteen keep
    Devam in exactly the same place.
-   **A centred card is centred with flex, never a percentage translate.** The closing card used
    the browser idiom, `top: '50%'` with a `-50%` translate, and sat visibly above centre: a
    percentage translate resolves against the animated box, and that wrapper carries an entrance
    that moves it. `top: 0, bottom: 0, justifyContent: 'center'` has nothing to resolve against.
-   **The safe area is a floor on the card's position, not a margin.** `marginTop: insets.top` on
    the absolutely positioned wrapper *adds* to the `top` it was given, which put the height of the
    notch of scrim between the spotlight and the card pointing at it. `Math.max` against the inset
    keeps the card clear of the notch and the home indicator without moving it when it is near
    neither.
-   **Measure with `measureInWindow`, never `onLayout`'s own numbers.** `onLayout` reports a box
    relative to the parent; the scrim is full-screen. The two only agree on a screen with no
    header, no inset and no scroll offset, which is no screen in this app. `TourTarget`
    re-measures on every layout rather than once, because Ana sayfa's streak card is **absent
    until the stats arrive** — a mount-time measurement would record a box about to move.
-   **The hole is the design's own `box-shadow`, after a spell as an SVG mask.** The prototype
    paints scrim and hole with one view and a 2000px spread; the mask was picked over it because
    nothing else in the app uses `boxShadow`. It worked and it was slow — a full-screen `Svg`
    whose `Mask` rectangle animates re-composites the whole screen every frame, and the tour moved
    between stops in visible steps rather than gliding. One view costs a frame nothing, and it is
    the scrim, the cut-out *and* the design's hairline ring at once; the ring had been a second
    view only because a mask cannot draw one. A stop with nothing to point at gets a plain scrim
    view instead, and the two cross-fade on the same shared value so there is no seam between a
    spotlit stop and a centred one.
-   **A stop whose target isn't on screen centres its card instead.** This is not a fallback, it
    is most of the tour: section O describes the group screen, the reader and Profil, and the
    tour opens when the reader belongs to **no group at all** and Ana sayfa is showing
    `HomeEmptyState`. Navigating them into a group that does not exist is not an option, and
    drawing a mock of one is what the marketing site already learned not to do. `TourTarget`
    withdraws its rect on **blur, not unmount** — the tabs are not lazy and Profil is pushed
    inside a tab, so Ana sayfa is still mounted underneath and unmount cleanup never runs.
    Withdrawing on unmount meant replaying from Profil cut a hole through Profil at Ana sayfa's
    coordinates. It also re-measures when the tour opens: `onLayout` fires when a view's own box
    changes, which is not the same as the view having moved, and the streak card arrives *above*
    the group rows and pushes them down without touching theirs.
-   **The closing card's mark is a drawn mosque, not a tick** — `TourDoneMark`, ported from
    `Tur Bitti Animasyonu.dc.html`: ground, walls, dome, minarets, then a crescent and two stars,
    each stroke easing its own `strokeDashoffset` with the frame's own delays, over a pulsing
    radial halo. The strokes are **animated props**, not styles, because `strokeDashoffset` is an
    SVG attribute — the shape `ProgressRing` already uses. Two things the frame carries that are
    easy to drop: `fill="none"` on the root `svg` (without it SVG's default fill is black, and
    the dome and minarets come out solid), and the glow drawn in its **own** `Svg`, since it is
    larger than the mark's box and React Native clips to it rather than honouring
    `overflow: visible`. Reduce Motion gets the finished drawing.
-   Copy is `tour1…tour16` in `strings.ts`, three languages, numbered in the order the stops are
    visited — so inserting a stop renumbers the keys after it rather than appending, the same way
    stop 3's text was rewritten rather than a key added. `tourStep` interpolates `{a}` and `{b}`;
    the counter reads "1 / 16" because the welcome and closing cards are not steps.

There is **no account-wide notifications switch.** `UserSettings.notificationsEnabled` was
a column with an update endpoint and no control in any screen, so nothing ever wrote
anything but its `true` default — while a row holding `false` would have stopped every
reminder for good with the Reminders toggle still reading "on". It was dropped
(`20260828090000_drop_notifications_enabled`) from the schema, the zod body, the service,
the domain type and the API input. `reminderEnabled` is the only switch, because it is the
only one the app gives anybody a way to set; add a column back only alongside its UI.

## Marketing site (`apps/marketing`)

Astro, static output, built from the designer's `Cüzhane Tanıtım.dc.html`. It is the public page,
and it is also where the **privacy policy and support page** live — App Store Connect will not
accept a listing without both as live URLs.

-   **Zero JavaScript ships.** The page is text and CSS; there is no island, no framework, no
    hydration. Everything that moves is a CSS animation. Verified by the absence of any `.js` in
    `dist`.
-   **Three languages, three URLs, and the site's default is not the app's.** `/` is **English**,
    `/tr/` and `/nl/` are prefixed — while the app itself opens in Turkish. `pathFor` in
    `i18n/routing.ts` is the only place that rule lives, `DEFAULT_LOCALE` beside it, and
    `astro.config.mjs` must agree with both. A language *switcher* on one URL was the prototype's
    approach and is wrong here: Google would index one page in one language. Every page declares
    all three as `hreflang` alternates plus `x-default`, reciprocally — a one-way set is ignored.
-   **Copy lives in `i18n/copy.ts`, typed `en: typeof tr`** exactly as the app's `strings.ts` is,
    so a key added to one language fails the build until it exists in all three.
-   **`i18n/legal.ts` is checked against the code, not against a template.** Apple's privacy
    questionnaire, that page, and the app's actual behaviour all have to agree; a new column on
    `UserSettings`, or a new third-party service, changes this file in the same commit.
-   **An animation must never be what makes content visible.** The prototype's `animation: … both`
    declarations meant the hero was `opacity: 0` until it ran, so with Reduce Motion the page was
    an empty green box. Entrance animations sit inside `@media (prefers-reduced-motion:
no-preference)`, and the scroll-driven `.reveal` needs `@supports (animation-timeline: view())`
    as well — a browser that ignores the timeline would otherwise hold the `from` keyframe
    forever. Screenshot with `--force-prefers-reduced-motion` to check this, which is how it was
    caught.
-   **A section carries both `.shell` and `.section`, so `.section` must use padding *longhand*.**
    A `padding` shorthand wins on source order and resets the shell's horizontal padding to zero —
    invisible at desktop widths and flush against the edge on a phone.
-   Store buttons read "coming soon" and are **not links** until `APP_STORE_URL` / `PLAY_STORE_URL`
    in `src/config.ts` are filled in. A button pointing at `#` reads as broken and a crawler
    follows it.
-   **The three phones on the page are real screenshots, and they used to be drawn.** Hero,
    "İlerleme" and "Okuma" each carried a hand-built CSS replica of the app — chosen so they
    would stay sharp at any density and never cost a 400 KB download. The design replaced all
    three (`src/assets/01-home.png`, `04-group.png`, `07-reader.png`, 1320×2868 from the
    designer's `screenshots/src/`), and it was the right call twice over: a drawn approximation
    quietly misrepresents the product and drifted from it with every app change, and
    `astro:assets` answers the weight objection at build time — `<Image widths={[300,600,900]}
sizes="300px">` emits WebP and a `srcset`, so the 300px variant a phone actually downloads is
    **11 KB**. The mockups' fourteen copy keys and the `MOCK_ROWS`/`WEEK_INITIALS` tables went
    with them; `shotHome`/`shotGroup`/`shotReader` are the alt text that replaced them. The hero's
    shot is `object-fit: cover` pinned to the top rather than scaled to fit — the design gives it
    300×560 against a 300×652 image, and the crop is what the squared-off bottom corners are for.
    Only the hero is `loading='eager'`; it is the LCP element.
-   **The share cards are generated, committed, and one per language.** `pnpm --filter
@cuzhane/marketing og` runs `scripts/build-og.mjs`, which renders the design's `OG Images.dc.html`
    through headless Chrome into `public/og-{en,tr,nl}.png` (1200×630) and `public/og-square.png`
    (1200×1200, for WhatsApp's chat list and the `schema.org` logo — a 1.91:1 card cropped square
    cuts the wordmark in half). The build does **not** run it; re-run it and commit the PNGs when
    the copy, palette or mark changes. Two things it must keep: the fonts are inlined as data URIs
    so a render never touches the network, and each card is rendered under its own **`lang`** —
    the eyebrows are `text-transform: uppercase` and Turkish casing is not the default one, so
    without it "takibi" bakes into the PNG as "TAKIBI" instead of "TAKİBİ" and no CSS can undo it
    afterwards. The prototype's three stats were *usage* numbers ("12 active groups", "9 day
    average streak"); they are product facts here instead ("100 babs · one round", "3 languages",
    "0 ads"), because a share card carries no framing that would read invented metrics as an
    illustration.
-   **`og:locale` is not `hreflang`.** Open Graph wants `language_TERRITORY`, so a bare `en` —
    a perfectly good `hreflang` — is invalid and Facebook silently substitutes `en_US`.
    `OG_LOCALES` in `copy.ts` spells all three out, separately from `LOCALE_TAGS`. Every page also
    declares `og:image:width`/`height`: without them a crawler must fetch the image before it can
    lay the card out, so the first share of a link often renders with no picture at all.
-   Fonts are self-hosted through `@fontsource`, not fetched from Google — a third-party
    render-blocking round trip is the single biggest thing between this page and a good LCP.
-   `.astro` files are in `.prettierignore`: Prettier cannot parse one without
    `prettier-plugin-astro`, and without it every file is an error rather than a skip.
-   Deployment is `deploy-marketing.yml` — build, `rsync --delete` into `/opt/cuzhane/www`, then
    curl three URLs to prove it is served. Caddy has a second site block for `$SITE_DOMAIN`
    pointing at that directory, with `_astro/*` cached forever (the filenames are fingerprinted)
    and HTML not cached at all.

## Cross-Cutting

-   Auth: Clerk is the source of truth in both apps. Server needs `CLERK_PUBLISHABLE_KEY` +
    `CLERK_SECRET_KEY`; client needs `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
-   **A request with no session token signs the app out.** `wrapper.api.ts` asks Clerk for a
    JWT (three tries, 120ms apart) and, finding none, calls the handler `useAuthTokenSync`
    installed, which runs Clerk's `signOut` and clears the query cache — so the sign-in screen
    appears instead of an error page whose retry could never succeed. It acts only while
    Clerk still reports *signed in*: `AppNavigator` runs the settings query before it checks
    `isSignedIn`, so a signed-out app makes token-less requests too, and signing out on those
    would clear, refetch and loop. Once per episode, guarded by `isSigningOut`.
-   **A build declares the group kinds it can draw, and the server hides the rest from it.**
    `wrapper.api.ts` sends `X-Cuzhane-Kinds: CEVSEN,HIZB` (`CLIENT_KINDS`) on every request;
    `clientCapabilities.middleware.ts` parses it into `res.locals.clientKinds`, and a request
    **without** it — every build older than `Group.kind` — is taken to know the Cevşen alone. Such
    a build reads any group as a hundred babs: it would join a Hizb group and mark "bab 7" read,
    which marks portion 7 and corrupts the round, and an OTA update narrows that window without
    closing it. So the routes that let someone *find or enter* a group consult
    `clientCompatibility.service.ts`: Discover (and Search, which asks the same endpoint) drops
    the kinds the caller didn't list (`filterGroupsForClient`), and both previews and both joins
    (`/memberships/preview/code/:code`, `/preview/group/:groupId`, `/join/code`, `/join/:groupId`)
    answer **426** "Update the app to open this group" (`assertClientCanUseGroup`) — the join
    sheet has no branch for it and lands on its not-found step. It is applied at the route
    layer, not in the services. It guards the doors, not the rooms: a group someone is already
    in is not hidden from their own list. **A new group kind must be added to `CLIENT_KINDS` —
    once the build can draw it, not before — and is then refused to every build that doesn't
    list it, with no further server change.**
-   Shared versions (`package.json` `overrides`): `react`/`react-dom` pinned to `19.1.0`,
    `@react-navigation/native` to `7.2.2`.
-   Formatting: Prettier, tabs, width 120, single quotes, no trailing commas. ESLint 9 flat configs per app.
-   `design-reference.html` at the repo root is the original design doc every screen was built from.
    Treat it as the spec when changing screen layout.
-   `design_handoff_cuzhane/` holds the designer's `.dc.html` exports, copied in **byte for byte** and
    listed in `.prettierignore` — a reformatted copy can't be diffed against the next export to see what
    actually changed. They are read as source, not opened: each one is a template needing the design
    tool's `support.js` runtime (and React from a CDN), neither of which is vendored here.
    `Ornament Set.dc.html` is the verse ornament's spec — grid, anatomy, the ١–١٢٠ set and the Kurallar.
